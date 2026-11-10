"""故事线管理：故事 / 平行空间 / 结构单元 / 选择节点 / 结局。

设计要点（docs/PHASE-D-故事线管理设计.md）：
- 空间不新建状态引擎：分叉空间绑定一个 simulation_branch，状态隔离复用既有快照。
- 故事层只存结构（空间/单元/事件挂接/选择/结局），不存人物状态。
- 原始空间（is_original）不绑定分支，事件为主时间线事件。
- 事件仍存于 events 表；空间内事件必须带对应 branch_id（正史共享事件除外）。
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import multipath as mp
from common import fail, get_or_404, utcnow
from database import get_db

router = APIRouter()

UNIT_KINDS = {"mainline", "side", "instance", "phase"}
UNIT_STATUS = {"planned", "active", "done", "abandoned"}
CHOICE_STATUS = {"open", "resolved", "abandoned"}
ENDING_KINDS = {"final", "stage", "open"}
STORY_STATUS = {"planning", "active", "completed", "archived"}
SPACE_STATUS = {"active", "archived"}


# ---------------------------------------------------------------------
# 序列化
# ---------------------------------------------------------------------
def _iso(value):
    return value.isoformat() if value else None


def _project_row(row: models.StoryProject) -> dict:
    return {
        "id": row.id,
        "world_id": row.world_id,
        "title": row.title,
        "premise": row.premise or "",
        "status": row.status,
        "settings": row.settings or {},
        "official_key": row.official_key,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _space_row(db: Session, row: models.StorySpace) -> dict:
    node_count = 0
    if row.branch_id:
        node_count = (
            db.query(models.SimulationBranchNode)
            .filter(models.SimulationBranchNode.branch_id == row.branch_id)
            .count()
        )
    return {
        "id": row.id,
        "story_id": row.story_id,
        "name": row.name,
        "is_original": bool(row.is_original),
        "parent_space_id": row.parent_space_id,
        "fork_choice_id": row.fork_choice_id,
        "branch_id": row.branch_id,
        "base_node_id": row.base_node_id,
        "status": row.status,
        "summary": row.summary or "",
        "node_count": node_count,
        "unit_count": db.query(models.StoryUnit).filter(models.StoryUnit.space_id == row.id).count(),
        "ending_count": db.query(models.StoryEnding).filter(models.StoryEnding.space_id == row.id).count(),
        "chapter_count": db.query(models.StoryChapterLink).filter(models.StoryChapterLink.space_id == row.id).count(),
        "created_at": _iso(row.created_at),
    }


def _unit_row(db: Session, row: models.StoryUnit) -> dict:
    event_count = db.query(models.StoryUnitEvent).filter(models.StoryUnitEvent.unit_id == row.id).count()
    return {
        "id": row.id,
        "story_id": row.story_id,
        "space_id": row.space_id,
        "parent_unit_id": row.parent_unit_id,
        "kind": row.kind,
        "title": row.title,
        "summary": row.summary or "",
        "order_index": row.order_index or 0,
        "status": row.status,
        "meta": row.meta or {},
        "event_count": event_count,
        "created_at": _iso(row.created_at),
    }


def _unit_event_row(row: models.StoryUnitEvent, event: Optional[models.Event]) -> dict:
    return {
        "id": row.id,
        "unit_id": row.unit_id,
        "event_id": row.event_id,
        "role": row.role,
        "order_index": row.order_index or 0,
        "is_shared": bool(row.is_shared),
        "note": row.note or "",
        "event_name": event.name if event else "",
        "event_polarity": event.polarity if event else "",
        "event_intensity": event.intensity if event else "",
        "branch_id": event.branch_id if event else None,
    }


def _option_row(row: models.StoryChoiceOption) -> dict:
    return {
        "id": row.id,
        "choice_id": row.choice_id,
        "label": row.label,
        "description": row.description or "",
        "consequence": row.consequence or "",
        "target_space_id": row.target_space_id,
        "source": row.source,
        "confirmed": bool(row.confirmed),
        "order_index": row.order_index or 0,
    }


def _choice_row(db: Session, row: models.StoryChoice) -> dict:
    options = (
        db.query(models.StoryChoiceOption)
        .filter(models.StoryChoiceOption.choice_id == row.id)
        .order_by(models.StoryChoiceOption.order_index.asc(), models.StoryChoiceOption.created_at.asc())
        .all()
    )
    return {
        "id": row.id,
        "story_id": row.story_id,
        "space_id": row.space_id,
        "anchor_event_id": row.anchor_event_id,
        "title": row.title,
        "description": row.description or "",
        "precondition": row.precondition or {},
        "allow_rejoin": bool(row.allow_rejoin),
        "status": row.status,
        "resolved_option_id": row.resolved_option_id,
        "options": [_option_row(option) for option in options],
        "created_at": _iso(row.created_at),
    }


def _ending_row(row: models.StoryEnding) -> dict:
    return {
        "id": row.id,
        "story_id": row.story_id,
        "space_id": row.space_id,
        "node_id": row.node_id,
        "name": row.name,
        "content": row.content or "",
        "kind": row.kind,
        "is_final": bool(row.is_final),
        "path_event_ids": row.path_event_ids or [],
        "path_node_ids": row.path_node_ids or [],
        "precondition": row.precondition or {},
        "source_ending_id": row.source_ending_id,
        "created_at": _iso(row.created_at),
    }


# ---------------------------------------------------------------------
# 校验
# ---------------------------------------------------------------------
def _world(db: Session, world_id: str) -> models.World:
    world = db.query(models.World).filter(models.World.id == world_id).first()
    if not world or world.deleted_at is not None:
        fail(404, "WORLD_NOT_FOUND", "世界不存在")
    if world.archived_at is not None:
        fail(409, "WORLD_ARCHIVED", "世界已归档，恢复后才能编辑故事线")
    return world


def _project(db: Session, story_id: str) -> models.StoryProject:
    story = get_or_404(db, models.StoryProject, story_id, "故事")
    _world(db, story.world_id)
    if story.status == "archived":
        fail(409, "STORY_ARCHIVED", "故事已归档")
    return story


def _space(db: Session, space_id: str) -> models.StorySpace:
    space = get_or_404(db, models.StorySpace, space_id, "故事空间")
    _project(db, space.story_id)
    return space


def _unit(db: Session, unit_id: str) -> models.StoryUnit:
    return get_or_404(db, models.StoryUnit, unit_id, "故事单元")


def _choice(db: Session, choice_id: str) -> models.StoryChoice:
    return get_or_404(db, models.StoryChoice, choice_id, "选择节点")


def _option(db: Session, option_id: str) -> models.StoryChoiceOption:
    return get_or_404(db, models.StoryChoiceOption, option_id, "选择项")


def _event(db: Session, event_id: str) -> models.Event:
    return get_or_404(db, models.Event, event_id, "事件")


def _unit_depth(db: Session, unit: models.StoryUnit) -> int:
    depth = 1
    seen = set()
    current = unit
    while current.parent_unit_id and current.parent_unit_id not in seen:
        seen.add(current.parent_unit_id)
        parent = db.query(models.StoryUnit).filter(models.StoryUnit.id == current.parent_unit_id).first()
        if not parent:
            break
        depth += 1
        current = parent
    return depth


def _require(condition, code: str, message: str):
    if not condition:
        fail(422, code, message)


# ---------------------------------------------------------------------
# 故事
# ---------------------------------------------------------------------
@router.post("/api/stories")
def create_story(payload: dict, db: Session = Depends(get_db)):
    world_id = str(payload.get("world_id") or "").strip()
    if not world_id:
        fail(422, "VALIDATION_ERROR", "缺少 world_id")
    world = _world(db, world_id)
    title = str(payload.get("title") or "").strip()[:200] or "未命名故事"
    status = str(payload.get("status") or "planning")
    if status not in STORY_STATUS:
        fail(422, "INVALID_STATUS", "故事状态不合法")
    official_key = str(payload.get("official_key") or "").strip()[:80] or None
    if official_key:
        exists = db.query(models.StoryProject).filter(models.StoryProject.official_key == official_key).first()
        if exists:
            fail(409, "OFFICIAL_KEY_EXISTS", "该官方演示标记已被占用")
    story = models.StoryProject(
        world_id=world.id,
        title=title,
        premise=str(payload.get("premise") or "")[:4000],
        status=status,
        settings=payload.get("settings") if isinstance(payload.get("settings"), dict) else {},
        official_key=official_key,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return _project_row(story)


@router.get("/api/worlds/{world_id}/stories")
def list_stories(world_id: str, db: Session = Depends(get_db)):
    _world(db, world_id)
    rows = (
        db.query(models.StoryProject)
        .filter(models.StoryProject.world_id == world_id)
        .order_by(models.StoryProject.created_at.asc())
        .all()
    )
    return [_project_row(row) for row in rows]


@router.get("/api/stories/{story_id}")
def get_story(story_id: str, db: Session = Depends(get_db)):
    story = get_or_404(db, models.StoryProject, story_id, "故事")
    _world(db, story.world_id)
    spaces = (
        db.query(models.StorySpace)
        .filter(models.StorySpace.story_id == story.id)
        .order_by(models.StorySpace.created_at.asc())
        .all()
    )
    data = _project_row(story)
    data.update(
        {
            "space_count": len(spaces),
            "original_space_id": next((s.id for s in spaces if s.is_original), None),
            "endings": [
                _ending_row(row)
                for row in db.query(models.StoryEnding)
                .filter(models.StoryEnding.story_id == story.id)
                .order_by(models.StoryEnding.created_at.asc())
                .all()
            ],
            "spaces": [_space_row(db, row) for row in spaces],
        }
    )
    return data


@router.patch("/api/stories/{story_id}")
def update_story(story_id: str, payload: dict, db: Session = Depends(get_db)):
    story = get_or_404(db, models.StoryProject, story_id, "故事")
    _world(db, story.world_id)
    if "title" in payload:
        story.title = str(payload.get("title") or "").strip()[:200] or story.title
    if "premise" in payload:
        story.premise = str(payload.get("premise") or "")[:4000]
    if "status" in payload:
        status = str(payload.get("status") or "")
        if status not in STORY_STATUS:
            fail(422, "INVALID_STATUS", "故事状态不合法")
        story.status = status
    if "settings" in payload and isinstance(payload.get("settings"), dict):
        story.settings = payload["settings"]
    story.updated_at = utcnow()
    db.commit()
    db.refresh(story)
    return _project_row(story)


# ---------------------------------------------------------------------
# 空间
# ---------------------------------------------------------------------
def _create_space_branch(db: Session, story: models.StoryProject, name: str, anchor_event_id: str,
                         parent_space: Optional[models.StorySpace], base_node_id: Optional[str]) -> dict:
    branch_payload = {
        "root_event_id": anchor_event_id,
        "name": f"{story.title} · {name}"[:120],
        "note": f"故事空间：{story.title}",
    }
    if parent_space and parent_space.branch_id:
        branch_payload["parent_branch_id"] = parent_space.branch_id
        if base_node_id:
            branch_payload["parent_node_id"] = base_node_id
    return mp.create_branch(branch_payload, db)


@router.post("/api/stories/{story_id}/spaces")
def create_space(story_id: str, payload: dict, db: Session = Depends(get_db)):
    story = _project(db, story_id)
    name = str(payload.get("name") or "").strip()[:120]
    _require(name, "VALIDATION_ERROR", "缺少空间名称")
    is_original = bool(payload.get("is_original"))
    if is_original:
        exists = (
            db.query(models.StorySpace)
            .filter(models.StorySpace.story_id == story.id, models.StorySpace.is_original.is_(True))
            .first()
        )
        if exists:
            fail(409, "ORIGINAL_EXISTS", "该故事已存在原始空间")
        space = models.StorySpace(
            story_id=story.id,
            world_id=story.world_id,
            name=name,
            is_original=True,
            status="active",
            summary=str(payload.get("summary") or "")[:1000],
        )
        db.add(space)
        db.commit()
        db.refresh(space)
        return _space_row(db, space)

    parent_id = str(payload.get("parent_space_id") or "").strip()
    _require(parent_id, "VALIDATION_ERROR", "分叉空间必须指定 parent_space_id")
    parent = _space(db, parent_id)
    if parent.story_id != story.id:
        fail(409, "SPACE_MISMATCH", "父空间不属于该故事")

    choice_id = str(payload.get("fork_choice_id") or "").strip() or None
    choice = None
    anchor_event_id = str(payload.get("anchor_event_id") or "").strip() or None
    if choice_id:
        choice = _choice(db, choice_id)
        if choice.space_id != parent.id:
            fail(409, "CHOICE_MISMATCH", "选择节点不属于父空间")
        anchor_event_id = anchor_event_id or choice.anchor_event_id
    _require(anchor_event_id, "VALIDATION_ERROR", "分叉空间需要一个锚定事件（anchor_event_id 或选择节点）")
    anchor = _event(db, anchor_event_id)
    if anchor.world_id != story.world_id:
        fail(409, "WORLD_MISMATCH", "锚定事件不在该世界")

    base_node_id = str(payload.get("base_node_id") or "").strip() or None
    branch_info = _create_space_branch(db, story, name, anchor.id, parent, base_node_id)
    space = models.StorySpace(
        story_id=story.id,
        world_id=story.world_id,
        name=name,
        is_original=False,
        parent_space_id=parent.id,
        fork_choice_id=choice.id if choice else None,
        branch_id=branch_info["id"],
        base_node_id=base_node_id,
        status="active",
        summary=str(payload.get("summary") or "")[:1000],
    )
    db.add(space)
    db.commit()
    db.refresh(space)
    if not space.base_node_id:
        first_node = (
            db.query(models.SimulationBranchNode)
            .filter(models.SimulationBranchNode.branch_id == space.branch_id)
            .order_by(models.SimulationBranchNode.seq.asc())
            .first()
        )
        if first_node:
            space.base_node_id = first_node.id
            db.commit()
            db.refresh(space)
    return _space_row(db, space)


@router.get("/api/stories/{story_id}/spaces")
def list_spaces(story_id: str, db: Session = Depends(get_db)):
    get_or_404(db, models.StoryProject, story_id, "故事")
    rows = (
        db.query(models.StorySpace)
        .filter(models.StorySpace.story_id == story_id)
        .order_by(models.StorySpace.created_at.asc())
        .all()
    )
    return [_space_row(db, row) for row in rows]


@router.patch("/api/spaces/{space_id}")
def update_space(space_id: str, payload: dict, db: Session = Depends(get_db)):
    space = _space(db, space_id)
    if "name" in payload:
        space.name = str(payload.get("name") or "").strip()[:120] or space.name
    if "summary" in payload:
        space.summary = str(payload.get("summary") or "")[:1000]
    if "status" in payload:
        status = str(payload.get("status") or "")
        if status not in SPACE_STATUS:
            fail(422, "INVALID_STATUS", "空间状态不合法")
        space.status = status
        if space.branch_id:
            branch = db.query(models.SimulationBranch).filter(models.SimulationBranch.id == space.branch_id).first()
            if branch:
                branch.status = "archived" if status == "archived" else "active"
    space.updated_at = utcnow()
    db.commit()
    db.refresh(space)
    return _space_row(db, space)


@router.post("/api/spaces/{space_id}/rollback")
def rollback_space(space_id: str, payload: dict, db: Session = Depends(get_db)):
    space = _space(db, space_id)
    if not space.branch_id:
        fail(409, "NO_BRANCH", "原始空间没有分支快照，无法回溯")
    node_id = str(payload.get("node_id") or "").strip()
    _require(node_id, "VALIDATION_ERROR", "缺少 node_id")
    result = mp.rollback_branch(space.branch_id, {"node_id": node_id, "reason": payload.get("reason") or ""}, db)
    return {"space": _space_row(db, space), "rollback": result}


# ---------------------------------------------------------------------
# 结构单元
# ---------------------------------------------------------------------
@router.get("/api/spaces/{space_id}/units")
def list_units(space_id: str, db: Session = Depends(get_db)):
    _space(db, space_id)
    rows = (
        db.query(models.StoryUnit)
        .filter(models.StoryUnit.space_id == space_id)
        .order_by(models.StoryUnit.order_index.asc(), models.StoryUnit.created_at.asc())
        .all()
    )
    return [_unit_row(db, row) for row in rows]


@router.post("/api/spaces/{space_id}/units")
def create_unit(space_id: str, payload: dict, db: Session = Depends(get_db)):
    space = _space(db, space_id)
    kind = str(payload.get("kind") or "mainline")
    if kind not in UNIT_KINDS:
        fail(422, "INVALID_KIND", "单元类型不合法")
    if kind == "mainline":
        exists = (
            db.query(models.StoryUnit)
            .filter(models.StoryUnit.space_id == space.id, models.StoryUnit.kind == "mainline")
            .first()
        )
        if exists:
            fail(409, "MAINLINE_EXISTS", "该空间已有主线单元")
    parent_unit_id = str(payload.get("parent_unit_id") or "").strip() or None
    if parent_unit_id:
        parent = _unit(db, parent_unit_id)
        if parent.space_id != space.id:
            fail(409, "UNIT_MISMATCH", "父单元不属于该空间")
        if _unit_depth(db, parent) >= 4:
            fail(422, "UNIT_DEPTH_EXCEEDED", "单元层级最多 4 层（故事→空间→单元→阶段）")
    status = str(payload.get("status") or "planned")
    if status not in UNIT_STATUS:
        fail(422, "INVALID_STATUS", "单元状态不合法")
    unit = models.StoryUnit(
        story_id=space.story_id,
        world_id=space.world_id,
        space_id=space.id,
        parent_unit_id=parent_unit_id,
        kind=kind,
        title=str(payload.get("title") or "")[:200] or "未命名单元",
        summary=str(payload.get("summary") or "")[:2000],
        order_index=int(payload.get("order_index") or 0),
        status=status,
        meta=payload.get("meta") if isinstance(payload.get("meta"), dict) else {},
    )
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return _unit_row(db, unit)


@router.patch("/api/units/{unit_id}")
def update_unit(unit_id: str, payload: dict, db: Session = Depends(get_db)):
    unit = _unit(db, unit_id)
    _project(db, unit.story_id)
    if "title" in payload:
        unit.title = str(payload.get("title") or "")[:200] or unit.title
    if "summary" in payload:
        unit.summary = str(payload.get("summary") or "")[:2000]
    if "order_index" in payload:
        unit.order_index = int(payload.get("order_index") or 0)
    if "status" in payload:
        status = str(payload.get("status") or "")
        if status not in UNIT_STATUS:
            fail(422, "INVALID_STATUS", "单元状态不合法")
        unit.status = status
    if "meta" in payload and isinstance(payload.get("meta"), dict):
        unit.meta = payload["meta"]
    unit.updated_at = utcnow()
    db.commit()
    db.refresh(unit)
    return _unit_row(db, unit)


@router.delete("/api/units/{unit_id}")
def delete_unit(unit_id: str, db: Session = Depends(get_db)):
    unit = _unit(db, unit_id)
    _project(db, unit.story_id)
    children = db.query(models.StoryUnit).filter(models.StoryUnit.parent_unit_id == unit.id).count()
    if children:
        fail(409, "UNIT_HAS_CHILDREN", "该单元下还有子单元，先移动或删除子单元")
    db.query(models.StoryUnitEvent).filter(models.StoryUnitEvent.unit_id == unit.id).delete(synchronize_session=False)
    db.delete(unit)
    db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------------
# 单元事件
# ---------------------------------------------------------------------
@router.get("/api/units/{unit_id}/events")
def list_unit_events(unit_id: str, db: Session = Depends(get_db)):
    _unit(db, unit_id)
    rows = (
        db.query(models.StoryUnitEvent)
        .filter(models.StoryUnitEvent.unit_id == unit_id)
        .order_by(models.StoryUnitEvent.order_index.asc(), models.StoryUnitEvent.created_at.asc())
        .all()
    )
    event_ids = [row.event_id for row in rows]
    events = {
        event.id: event
        for event in db.query(models.Event).filter(models.Event.id.in_(event_ids)).all()
    } if event_ids else {}
    return [_unit_event_row(row, events.get(row.event_id)) for row in rows]


@router.post("/api/units/{unit_id}/events")
def add_unit_event(unit_id: str, payload: dict, db: Session = Depends(get_db)):
    unit = _unit(db, unit_id)
    space = _space(db, unit.space_id)
    event_id = str(payload.get("event_id") or "").strip()
    _require(event_id, "VALIDATION_ERROR", "缺少 event_id")
    event = _event(db, event_id)
    if event.world_id != space.world_id:
        fail(409, "WORLD_MISMATCH", "事件不在该世界")
    if space.branch_id:
        if event.branch_id is None and not payload.get("is_shared"):
            fail(409, "SHARED_EVENT_FLAG", "正史事件放入分叉空间需显式标记 is_shared")
        if event.branch_id not in (None, space.branch_id):
            fail(409, "BRANCH_MISMATCH", "事件属于其他分支")
    else:
        if event.branch_id is not None:
            fail(409, "BRANCH_EVENT_IN_ORIGINAL", "原始空间只能挂主时间线事件")
    exists = (
        db.query(models.StoryUnitEvent)
        .filter(models.StoryUnitEvent.unit_id == unit.id, models.StoryUnitEvent.event_id == event.id)
        .first()
    )
    if exists:
        fail(409, "EVENT_ALREADY_LINKED", "该事件已挂在此单元")
    role = str(payload.get("role") or "normal")
    if role not in {"normal", "choice", "climax", "ending"}:
        fail(422, "INVALID_ROLE", "事件角色不合法")
    link = models.StoryUnitEvent(
        world_id=space.world_id,
        unit_id=unit.id,
        event_id=event.id,
        role=role,
        order_index=int(payload.get("order_index") or 0),
        is_shared=bool(payload.get("is_shared")),
        note=str(payload.get("note") or "")[:500],
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return _unit_event_row(link, event)


@router.delete("/api/units/{unit_id}/events/{event_id}")
def remove_unit_event(unit_id: str, event_id: str, db: Session = Depends(get_db)):
    unit = _unit(db, unit_id)
    _project(db, unit.story_id)
    link = (
        db.query(models.StoryUnitEvent)
        .filter(models.StoryUnitEvent.unit_id == unit.id, models.StoryUnitEvent.event_id == event_id)
        .first()
    )
    if not link:
        fail(404, "LINK_NOT_FOUND", "该事件未挂在此单元")
    db.delete(link)
    db.commit()
    return {"status": "removed"}


# ---------------------------------------------------------------------
# 选择节点
# ---------------------------------------------------------------------
@router.get("/api/spaces/{space_id}/choices")
def list_choices(space_id: str, db: Session = Depends(get_db)):
    _space(db, space_id)
    rows = (
        db.query(models.StoryChoice)
        .filter(models.StoryChoice.space_id == space_id)
        .order_by(models.StoryChoice.created_at.asc())
        .all()
    )
    return [_choice_row(db, row) for row in rows]


@router.post("/api/spaces/{space_id}/choices")
def create_choice(space_id: str, payload: dict, db: Session = Depends(get_db)):
    space = _space(db, space_id)
    anchor_event_id = str(payload.get("anchor_event_id") or "").strip() or None
    if anchor_event_id:
        anchor = _event(db, anchor_event_id)
        if anchor.world_id != space.world_id:
            fail(409, "WORLD_MISMATCH", "锚定事件不在该世界")
        if space.branch_id and anchor.branch_id not in (None, space.branch_id):
            fail(409, "BRANCH_MISMATCH", "锚定事件属于其他分支")
        if not space.branch_id and anchor.branch_id is not None:
            fail(409, "BRANCH_EVENT_IN_ORIGINAL", "原始空间只能锚定主时间线事件")
    choice = models.StoryChoice(
        story_id=space.story_id,
        world_id=space.world_id,
        space_id=space.id,
        anchor_event_id=anchor_event_id,
        title=str(payload.get("title") or "")[:200] or "未命名选择",
        description=str(payload.get("description") or "")[:2000],
        precondition=payload.get("precondition") if isinstance(payload.get("precondition"), dict) else {},
        allow_rejoin=bool(payload.get("allow_rejoin")),
        status="open",
    )
    db.add(choice)
    db.commit()
    db.refresh(choice)
    return _choice_row(db, choice)


@router.patch("/api/choices/{choice_id}")
def update_choice(choice_id: str, payload: dict, db: Session = Depends(get_db)):
    choice = _choice(db, choice_id)
    _project(db, choice.story_id)
    for field in ("title", "description"):
        if field in payload:
            setattr(choice, field, str(payload.get(field) or "")[:2000])
    if "precondition" in payload and isinstance(payload.get("precondition"), dict):
        choice.precondition = payload["precondition"]
    if "allow_rejoin" in payload:
        choice.allow_rejoin = bool(payload.get("allow_rejoin"))
    if "status" in payload:
        status = str(payload.get("status") or "")
        if status not in CHOICE_STATUS:
            fail(422, "INVALID_STATUS", "选择节点状态不合法")
        choice.status = status
    choice.updated_at = utcnow()
    db.commit()
    db.refresh(choice)
    return _choice_row(db, choice)


@router.post("/api/choices/{choice_id}/options")
def add_option(choice_id: str, payload: dict, db: Session = Depends(get_db)):
    choice = _choice(db, choice_id)
    _project(db, choice.story_id)
    label = str(payload.get("label") or "").strip()[:200]
    _require(label, "VALIDATION_ERROR", "缺少选项文案")
    max_order = (
        db.query(models.StoryChoiceOption)
        .filter(models.StoryChoiceOption.choice_id == choice.id)
        .count()
    )
    option = models.StoryChoiceOption(
        world_id=choice.world_id,
        choice_id=choice.id,
        label=label,
        description=str(payload.get("description") or "")[:2000],
        consequence=str(payload.get("consequence") or "")[:2000],
        source="ai" if payload.get("source") == "ai" else "user",
        confirmed=False if payload.get("source") == "ai" else bool(payload.get("confirmed", True)),
        order_index=int(payload.get("order_index") or max_order),
    )
    db.add(option)
    db.commit()
    db.refresh(option)
    return _option_row(option)


@router.post("/api/choices/{choice_id}/resolve")
def resolve_choice(choice_id: str, payload: dict, db: Session = Depends(get_db)):
    choice = _choice(db, choice_id)
    story = _project(db, choice.story_id)
    option_id = str(payload.get("option_id") or "").strip() or None
    option = None
    if option_id:
        option = _option(db, option_id)
        if option.choice_id != choice.id:
            fail(409, "OPTION_MISMATCH", "选择项不属于该节点")
        if option.source == "ai" and not option.confirmed:
            fail(409, "OPTION_UNCONFIRMED", "AI 建议的选项需确认后才能采用")
        if option.target_space_id:
            fail(409, "OPTION_ALREADY_RESOLVED", "该选项已经生成过空间")
    space_name = str(payload.get("space_name") or "").strip()[:120]
    if not space_name:
        space_name = (option.label if option else "未命名空间")[:120]

    target_space_id = str(payload.get("target_space_id") or "").strip() or (option.target_space_id if option else None)
    if target_space_id:
        target = _space(db, target_space_id)
        if target.story_id != story.id:
            fail(409, "SPACE_MISMATCH", "目标空间不属于该故事")
        space = target
    else:
        parent = _space(db, choice.space_id)
        anchor_event_id = choice.anchor_event_id
        if not anchor_event_id:
            fail(409, "NO_ANCHOR", "选择节点没有锚定事件，无法建立分叉空间")
        branch_info = _create_space_branch(db, story, space_name, anchor_event_id, parent, None)
        space = models.StorySpace(
            story_id=story.id,
            world_id=story.world_id,
            name=space_name,
            is_original=False,
            parent_space_id=parent.id,
            fork_choice_id=choice.id,
            branch_id=branch_info["id"],
            status="active",
            summary=(option.consequence if option else "")[:1000],
        )
        db.add(space)
        db.flush()
        first_node = (
            db.query(models.SimulationBranchNode)
            .filter(models.SimulationBranchNode.branch_id == space.branch_id)
            .order_by(models.SimulationBranchNode.seq.asc())
            .first()
        )
        space.base_node_id = first_node.id if first_node else None

    choice.resolved_option_id = option.id if option else None
    if option:
        option.target_space_id = space.id
        option.confirmed = True
    remaining = (
        db.query(models.StoryChoiceOption)
        .filter(
            models.StoryChoiceOption.choice_id == choice.id,
            models.StoryChoiceOption.target_space_id.is_(None),
            models.StoryChoiceOption.confirmed.is_(True),
        )
        .count()
    )
    # 多个选项可各自探索；全部选项都有空间后才自动标记已确定。
    choice.status = "resolved" if remaining == 0 else "open"
    db.commit()
    db.refresh(space)
    return {"choice": _choice_row(db, choice), "space": _space_row(db, space)}


# ---------------------------------------------------------------------
# 结局
# ---------------------------------------------------------------------
@router.get("/api/spaces/{space_id}/endings")
def list_endings(space_id: str, db: Session = Depends(get_db)):
    _space(db, space_id)
    rows = (
        db.query(models.StoryEnding)
        .filter(models.StoryEnding.space_id == space_id)
        .order_by(models.StoryEnding.created_at.asc())
        .all()
    )
    return [_ending_row(row) for row in rows]


@router.post("/api/spaces/{space_id}/endings")
def create_ending(space_id: str, payload: dict, db: Session = Depends(get_db)):
    space = _space(db, space_id)
    name = str(payload.get("name") or "").strip()[:200]
    _require(name, "VALIDATION_ERROR", "缺少结局名称")
    kind = str(payload.get("kind") or "final")
    if kind not in ENDING_KINDS:
        fail(422, "INVALID_KIND", "结局类型不合法")
    node_id = str(payload.get("node_id") or "").strip() or None
    if node_id and space.branch_id:
        node = get_or_404(db, models.SimulationBranchNode, node_id, "分支节点")
        if node.branch_id != space.branch_id:
            fail(409, "NODE_MISMATCH", "节点不属于该空间的分支")
    ending = models.StoryEnding(
        story_id=space.story_id,
        world_id=space.world_id,
        space_id=space.id,
        node_id=node_id,
        name=name,
        content=str(payload.get("content") or "")[:20000],
        kind=kind,
        is_final=bool(payload.get("is_final")) if "is_final" in payload else kind == "final",
        path_event_ids=payload.get("path_event_ids") if isinstance(payload.get("path_event_ids"), list) else [],
        path_node_ids=payload.get("path_node_ids") if isinstance(payload.get("path_node_ids"), list) else [],
        precondition=payload.get("precondition") if isinstance(payload.get("precondition"), dict) else {},
    )
    db.add(ending)
    db.commit()
    db.refresh(ending)
    return _ending_row(ending)


@router.post("/api/spaces/{space_id}/import-ending")
def import_ending(space_id: str, payload: dict, db: Session = Depends(get_db)):
    space = _space(db, space_id)
    ending_id = str(payload.get("ending_id") or "").strip()
    _require(ending_id, "VALIDATION_ERROR", "缺少 ending_id")
    source = get_or_404(db, models.SimulationEnding, ending_id, "推演结局")
    if source.world_id != space.world_id:
        fail(409, "WORLD_MISMATCH", "结局不在该世界")
    if not space.branch_id or source.branch_id != space.branch_id:
        fail(409, "BRANCH_MISMATCH", "结局不属于该空间的分支")
    exists = (
        db.query(models.StoryEnding)
        .filter(models.StoryEnding.space_id == space.id, models.StoryEnding.source_ending_id == source.id)
        .first()
    )
    if exists:
        return _ending_row(exists)
    ending = models.StoryEnding(
        story_id=space.story_id,
        world_id=space.world_id,
        space_id=space.id,
        node_id=source.node_id,
        name=source.name,
        content=source.description or "",
        kind="final",
        is_final=True,
        path_event_ids=[],
        path_node_ids=source.path_node_ids or [],
        precondition={"key_reasons": source.key_reasons or ""},
        source_ending_id=source.id,
    )
    db.add(ending)
    db.commit()
    db.refresh(ending)
    return _ending_row(ending)


# ---------------------------------------------------------------------
# 导入与对比
# ---------------------------------------------------------------------
@router.post("/api/stories/{story_id}/import-branch")
def import_branch(story_id: str, payload: dict, db: Session = Depends(get_db)):
    story = _project(db, story_id)
    branch_id = str(payload.get("branch_id") or "").strip()
    _require(branch_id, "VALIDATION_ERROR", "缺少 branch_id")
    branch = get_or_404(db, models.SimulationBranch, branch_id, "推演分支")
    if branch.world_id != story.world_id:
        fail(409, "WORLD_MISMATCH", "分支不在该世界")
    exists = (
        db.query(models.StorySpace)
        .filter(models.StorySpace.story_id == story.id, models.StorySpace.branch_id == branch.id)
        .first()
    )
    if exists:
        return _space_row(db, exists)
    space = models.StorySpace(
        story_id=story.id,
        world_id=story.world_id,
        name=str(payload.get("name") or branch.name or "导入空间")[:120],
        is_original=False,
        parent_space_id=str(payload.get("parent_space_id") or "").strip() or None,
        branch_id=branch.id,
        status="active",
        summary=str(payload.get("summary") or "")[:1000],
    )
    db.add(space)
    db.commit()
    db.refresh(space)
    return _space_row(db, space)


@router.post("/api/stories/compare-spaces")
def compare_spaces(payload: dict, db: Session = Depends(get_db)):
    space_ids = payload.get("space_ids") if isinstance(payload.get("space_ids"), list) else []
    if len(space_ids) < 2:
        fail(422, "VALIDATION_ERROR", "至少选择两个空间")
    spaces = [_space(db, str(sid)) for sid in space_ids[:6]]
    story_id = spaces[0].story_id
    if any(space.story_id != story_id for space in spaces):
        fail(409, "STORY_MISMATCH", "只能对比同一故事下的空间")

    def collect(space: models.StorySpace) -> dict:
        unit_ids = [row.id for row in db.query(models.StoryUnit.id).filter(models.StoryUnit.space_id == space.id).all()]
        links = (
            db.query(models.StoryUnitEvent)
            .filter(models.StoryUnitEvent.unit_id.in_(unit_ids))
            .all()
        ) if unit_ids else []
        event_ids = []
        for link in links:
            if link.event_id not in event_ids:
                event_ids.append(link.event_id)
        events = (
            db.query(models.Event)
            .filter(models.Event.id.in_(event_ids))
            .order_by(models.Event.occurred_at.asc())
            .all()
        ) if event_ids else []
        endings = (
            db.query(models.StoryEnding)
            .filter(models.StoryEnding.space_id == space.id)
            .all()
        )
        return {
            "space": _space_row(db, space),
            "events": [
                {"id": event.id, "name": event.name, "polarity": event.polarity, "intensity": event.intensity}
                for event in events
            ],
            "endings": [_ending_row(row) for row in endings],
        }

    data = [collect(space) for space in spaces]
    event_sets = [{event["id"] for event in item["events"]} for item in data]
    names = [event["name"] for item in data for event in item["events"]]
    name_sets = [{event["name"] for event in item["events"]} for item in data]
    return {
        "spaces": data,
        "differences": {
            "same_events": sorted(set.intersection(*event_sets)) if all(event_sets) else [],
            "unique_event_names": {
                item["space"]["name"]: sorted(name_sets[index] - set.union(*(name_sets[:index] + name_sets[index + 1:])))
                for index, item in enumerate(data)
            } if len(name_sets) > 1 else {},
            "event_counts": {item["space"]["name"]: len(item["events"]) for item in data},
            "ending_counts": {item["space"]["name"]: len(item["endings"]) for item in data},
        },
    }


# ---------------------------------------------------------------------
# 章节关联（G6）
# ---------------------------------------------------------------------
def _chapter_link_row(link: models.StoryChapterLink, chapter: Optional[models.Story]) -> dict:
    return {
        "id": link.id,
        "story_id": link.story_id,
        "space_id": link.space_id,
        "unit_id": link.unit_id,
        "chapter_id": link.chapter_id,
        "order_index": link.order_index or 0,
        "title": chapter.title if chapter else "章节已删除",
        "word_count": chapter.word_count if chapter else 0,
        "status": chapter.status if chapter else "",
        "created_at": _iso(link.created_at),
    }


@router.post("/api/stories/{story_id}/chapter-links")
def link_chapter(story_id: str, payload: dict, db: Session = Depends(get_db)):
    story = _project(db, story_id)
    chapter_id = str(payload.get("chapter_id") or "").strip()
    _require(chapter_id, "VALIDATION_ERROR", "缺少 chapter_id")
    chapter = get_or_404(db, models.Story, chapter_id, "章节")
    if chapter.world_id != story.world_id:
        fail(409, "WORLD_MISMATCH", "章节不在该世界")
    space = _space(db, str(payload.get("space_id") or ""))
    if space.story_id != story.id:
        fail(409, "SPACE_MISMATCH", "空间不属于该故事")
    unit_id = str(payload.get("unit_id") or "").strip() or None
    if unit_id:
        unit = _unit(db, unit_id)
        if unit.space_id != space.id:
            fail(409, "UNIT_MISMATCH", "单元不属于该空间")

    link = (
        db.query(models.StoryChapterLink)
        .filter(models.StoryChapterLink.chapter_id == chapter.id)
        .first()
    )
    if link:
        link.story_id = story.id
        link.space_id = space.id
        link.unit_id = unit_id
        if "order_index" in payload:
            link.order_index = int(payload.get("order_index") or 0)
    else:
        count = db.query(models.StoryChapterLink).filter(models.StoryChapterLink.space_id == space.id).count()
        link = models.StoryChapterLink(
            world_id=story.world_id,
            story_id=story.id,
            space_id=space.id,
            unit_id=unit_id,
            chapter_id=chapter.id,
            order_index=int(payload.get("order_index") or count),
        )
        db.add(link)
    db.commit()
    db.refresh(link)
    return _chapter_link_row(link, chapter)


@router.get("/api/spaces/{space_id}/chapters")
def list_space_chapters(space_id: str, db: Session = Depends(get_db)):
    _space(db, space_id)
    links = (
        db.query(models.StoryChapterLink)
        .filter(models.StoryChapterLink.space_id == space_id)
        .order_by(models.StoryChapterLink.order_index.asc(), models.StoryChapterLink.created_at.asc())
        .all()
    )
    ids = [link.chapter_id for link in links]
    chapters = {row.id: row for row in db.query(models.Story).filter(models.Story.id.in_(ids)).all()} if ids else {}
    return [_chapter_link_row(link, chapters.get(link.chapter_id)) for link in links]


@router.delete("/api/story-chapters/{link_id}")
def unlink_chapter(link_id: str, db: Session = Depends(get_db)):
    link = get_or_404(db, models.StoryChapterLink, link_id, "章节关联")
    _world(db, link.world_id)
    db.delete(link)
    db.commit()
    return {"status": "removed"}
