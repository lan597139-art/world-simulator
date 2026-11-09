"""世界目录（world_nodes）与世界配置（world_settings）。"""

from typing import Optional

from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

import models
from common import (
    assert_same_world,
    build_tree,
    fail,
    get_or_404,
    get_world,
    next_sort_order,
    record_history,
    resolve_entity,
    utcnow,
)
from database import get_db

router = APIRouter()

BRANCHES = {
    "world_profile": "世界基础",
    "world_rules": "世界规则",
    "space_time": "时空结构",
    "geography": "地理结构",
    "civilization_society": "文明与社会",
    "organizations": "组织结构",
    "people_groups": "人物与群体",
    "resources_economy": "资源与经济",
}

NODE_EDITABLE = {"name", "description", "sort_order", "node_type", "ref_type", "ref_id"}


def _node_dict(node: models.WorldNode) -> dict:
    return {
        "id": node.id,
        "world_id": node.world_id,
        "parent_id": node.parent_id,
        "branch": node.branch,
        "node_type": node.node_type,
        "name": node.name,
        "sort_order": node.sort_order,
        "description": node.description or "",
        "ref_type": node.ref_type,
        "ref_id": node.ref_id,
        "created_at": node.created_at,
        "updated_at": node.updated_at,
    }


def _validate_ref(db: Session, world_id: str, ref_type: Optional[str], ref_id: Optional[str]):
    if bool(ref_type) != bool(ref_id):
        fail(422, "VALIDATION_ERROR", "ref_type 与 ref_id 必须同时提供")
    if not ref_type:
        return
    resolve_entity(db, world_id, ref_type, ref_id)


def seed_world(db: Session, world_id: str):
    """新建世界时自动生成八个分支根节点与时间设置。"""
    for order, (branch, name) in enumerate(BRANCHES.items()):
        db.add(
            models.WorldNode(
                world_id=world_id,
                parent_id=None,
                branch=branch,
                node_type="folder",
                name=name,
                sort_order=order * 10,
                description="",
            )
        )
    db.add(
        models.TimeSettings(
            world_id=world_id,
            current_time=utcnow(),
            last_sync_at=utcnow(),
            time_mode="manual",
        )
    )
    db.flush()


@router.get("/api/worlds/{world_id}/nodes")
def list_nodes(
    world_id: str,
    branch: Optional[str] = None,
    parent_id: Optional[str] = None,
    tree: bool = False,
    db: Session = Depends(get_db),
):
    get_world(db, world_id)
    query = db.query(models.WorldNode).filter(models.WorldNode.world_id == world_id)
    if branch:
        query = query.filter(models.WorldNode.branch == branch)
    if parent_id is not None:
        query = query.filter(models.WorldNode.parent_id == parent_id)
    rows = query.order_by(models.WorldNode.sort_order, models.WorldNode.created_at).all()
    items = [_node_dict(n) for n in rows]
    if tree:
        return build_tree(items)
    return items


@router.post("/api/worlds/{world_id}/nodes")
def create_node(world_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    get_world(db, world_id)
    name = (payload.get("name") or "").strip()
    if not name:
        fail(422, "VALIDATION_ERROR", "节点名称不能为空")

    parent = None
    parent_id = payload.get("parent_id")
    branch = payload.get("branch")
    if parent_id:
        parent = get_or_404(db, models.WorldNode, parent_id, "父节点")
        assert_same_world(parent, world_id, "父节点")
        branch = branch or parent.branch
    if not branch or branch not in BRANCHES:
        fail(422, "VALIDATION_ERROR", "branch 非法")

    node_type = payload.get("node_type") or "folder"
    if node_type not in {"folder", "entity_ref", "note"}:
        fail(422, "VALIDATION_ERROR", "node_type 非法")

    ref_type = payload.get("ref_type")
    ref_id = payload.get("ref_id")
    if node_type == "entity_ref":
        _validate_ref(db, world_id, ref_type, ref_id)
    else:
        ref_type, ref_id = None, None

    node = models.WorldNode(
        world_id=world_id,
        parent_id=parent_id,
        branch=branch,
        node_type=node_type,
        name=name,
        description=payload.get("description") or "",
        sort_order=payload.get("sort_order")
        if payload.get("sort_order") is not None
        else next_sort_order(db, models.WorldNode, world_id=world_id, parent_id=parent_id),
        ref_type=ref_type,
        ref_id=ref_id,
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return _node_dict(node)


@router.patch("/api/nodes/{node_id}")
@router.put("/api/nodes/{node_id}")
def update_node(node_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    node = get_or_404(db, models.WorldNode, node_id, "目录节点")

    parent_id = payload.get("parent_id", "__keep__")
    if parent_id != "__keep__" and parent_id != node.parent_id:
        if parent_id:
            parent = get_or_404(db, models.WorldNode, parent_id, "父节点")
            assert_same_world(parent, node.world_id, "父节点")
            # 防环
            cursor = parent
            while cursor is not None:
                if cursor.id == node.id:
                    fail(409, "CYCLE_DETECTED", "不能把节点移动到自己的后代下")
                cursor = (
                    db.query(models.WorldNode)
                    .filter(models.WorldNode.id == cursor.parent_id)
                    .first()
                )
        record_history(
            db, node.world_id, "world_node", node.id, "parent_id", node.parent_id, parent_id,
            reason="移动目录节点",
        )
        node.parent_id = parent_id

    if "ref_type" in payload or "ref_id" in payload:
        ref_type = payload.get("ref_type", node.ref_type)
        ref_id = payload.get("ref_id", node.ref_id)
        if ref_type and ref_id:
            _validate_ref(db, node.world_id, ref_type, ref_id)
        node.ref_type = ref_type
        node.ref_id = ref_id

    for key in NODE_EDITABLE:
        if key in payload and key not in {"sort_order"}:
            setattr(node, key, payload[key])
    if "sort_order" in payload:
        node.sort_order = int(payload["sort_order"])
    node.updated_at = utcnow()
    db.commit()
    db.refresh(node)
    return _node_dict(node)


@router.delete("/api/nodes/{node_id}")
def delete_node(node_id: str, db: Session = Depends(get_db)):
    node = get_or_404(db, models.WorldNode, node_id, "目录节点")
    children = (
        db.query(models.WorldNode).filter(models.WorldNode.parent_id == node.id).count()
    )
    if children:
        fail(409, "HAS_CHILDREN", "请先删除或移动子节点")
    db.delete(node)
    db.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------
# 世界配置（替代 IndexedDB）
# ---------------------------------------------------------------------


@router.get("/api/worlds/{world_id}/settings")
def get_world_settings(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    row = (
        db.query(models.WorldSettings)
        .filter(models.WorldSettings.world_id == world_id)
        .first()
    )
    if not row:
        return {"world_id": world_id, "selections": {}, "parameters": {}, "revision": 0}
    return {
        "world_id": row.world_id,
        "selections": row.selections or {},
        "parameters": row.parameters or {},
        "revision": row.revision,
        "updated_at": row.updated_at,
    }


@router.put("/api/worlds/{world_id}/settings")
def save_world_settings(world_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    get_world(db, world_id)
    row = (
        db.query(models.WorldSettings)
        .filter(models.WorldSettings.world_id == world_id)
        .first()
    )
    if not row:
        row = models.WorldSettings(world_id=world_id, selections={}, parameters={}, revision=0)
        db.add(row)
    row.selections = payload.get("selections", row.selections or {})
    row.parameters = payload.get("parameters", row.parameters or {})
    row.revision = (row.revision or 0) + 1
    row.updated_at = utcnow()
    db.commit()
    return {"status": "ok", "revision": row.revision}


@router.post("/api/worlds/{world_id}/settings/import")
def import_world_settings(world_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    """IndexedDB 一次性导入，幂等：内容相同则不产生新 revision。"""
    get_world(db, world_id)
    row = (
        db.query(models.WorldSettings)
        .filter(models.WorldSettings.world_id == world_id)
        .first()
    )
    selections = payload.get("selections") or {}
    parameters = payload.get("parameters") or {}
    if row and row.selections == selections and row.parameters == parameters:
        return {"status": "unchanged", "revision": row.revision}
    if not row:
        row = models.WorldSettings(world_id=world_id, selections={}, parameters={}, revision=0)
        db.add(row)
    row.selections = selections
    row.parameters = parameters
    row.revision = (row.revision or 0) + 1
    row.updated_at = utcnow()
    db.commit()
    return {"status": "imported", "revision": row.revision}
