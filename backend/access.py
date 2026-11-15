"""统一的世界/内容访问判断。

公开规则：
- 自己的世界：可读可写；
- 官方演示世界：所有人可读，只有开发者/世界所有者可写；
- 其他用户的世界：不可见（返回 404，避免泄露存在性）。
"""

from __future__ import annotations

import re
from typing import Optional

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

import models

WORLD_PATH_RE = re.compile(r"^/api/worlds/([^/]+)(?:/|$)")
ENTITY_PATH_RE = re.compile(r"^/api/(characters|events|organizations|organization-units|organization-positions|appointments|relationships|nodes|writings|locations|branches|directions|endings|drafts|choices|event-choices|event-choice-options|event-relations|event-entities|location-types|information-sources|group-memberships|axis-objects|chat/threads|chat/memories|chat/impact|journal/people|journal/relations|diary/entries|stories|spaces|units|story-chapters|story-tree-nodes|story-threads|story-thread-events|story-thread-edges|story-units|story-choices|story-endings|story-rejoins|rules|eras|societies|social-groups|resources|resource-holdings|resource-transactions|perceptions|sandbox-scenarios|relationship-types|ai-grants)/([^/]+)(?:/|$)")
ENTITY_MODEL_MAP = {
    "characters": "Character",
    "events": "Event",
    "organizations": "Organization",
    "organization-units": "OrganizationUnit",
    "organization-positions": "OrganizationPosition",
    "appointments": "CharacterAppointment",
    "relationships": "Relationship",
    "nodes": "WorldNode",
    "writings": "Story",
    "locations": "Location",
    "branches": "SimulationBranch",
    "directions": "SimulationDirection",
    "endings": "SimulationEnding",
    "drafts": "EntityDraft",
    "choices": "StoryChoice",
    "event-choices": "EventChoice",
    "event-choice-options": "EventChoiceOption",
    "event-relations": "EventRelation",
    "event-entities": "EventEntity",
    "location-types": "LocationType",
    "information-sources": "InformationSource",
    "group-memberships": "GroupMembership",
    "axis-objects": "AxisObject",
    "chat/threads": "ChatThread",
    "chat/memories": "CharacterMemory",
    "chat/impact": "ChatImpact",
    "journal/people": "JournalPerson",
    "journal/relations": "JournalRelation",
    "diary/entries": "DiaryEntry",
    "story-threads": "StoryThread",
    "story-units": "StoryUnit",
    "story-choices": "StoryChoice",
    "story-endings": "StoryEnding",
    "story-rejoins": "StoryRejoin",
    "stories": "StoryProject",
    "spaces": "StorySpace",
    "units": "StoryUnit",
    "story-chapters": "StoryChapterLink",
    "story-tree-nodes": "StoryTreeNode",
    "story-thread-events": "StoryThreadEvent",
    "story-thread-edges": "StoryThreadEdge",
    "rules": "WorldRule",
    "eras": "Era",
    "societies": "Society",
    "social-groups": "SocialGroup",
    "resources": "Resource",
    "resource-holdings": "ResourceHolding",
    "resource-transactions": "ResourceTransaction",
    "perceptions": "CharacterEventPerception",
    "sandbox-scenarios": "EventSandboxScenario",
    "relationship-types": "RelationshipType",
    "ai-grants": "AiInfoGrant",
}

# 即使世界是官方公开世界，以下内容仍属于个人：只允许 owner 读取。
ENTITY_OWNER_ONLY = {
    "chat/threads", "chat/memories", "journal/people", "journal/relations",
    "diary/entries", "information-sources", "ai-grants",
}


def current_user_id(request: Request) -> str:
    return str(getattr(request.state, "user_id", None) or "local")


def is_owner_request(request: Request, db: Session) -> bool:
    user = db.query(models.AppUser).filter(models.AppUser.id == current_user_id(request)).first()
    return bool(user and user.is_owner)


def world_readable(world: models.World, user_id: str) -> bool:
    return bool(world.is_official or (not world.owner_id and user_id == "local") or world.owner_id == user_id)


def world_writable(world: models.World, user_id: str) -> bool:
    if world.owner_id:
        return world.owner_id == user_id
    return user_id == "local"


def get_world_for_request(
    db: Session,
    world_id: str,
    request: Request,
    *,
    write: bool = False,
    allow_missing: bool = False,
) -> Optional[models.World]:
    world = db.query(models.World).filter(models.World.id == world_id).first()
    if not world or world.deleted_at is not None:
        if allow_missing:
            return None
        raise HTTPException(status_code=404, detail="世界不存在")
    user_id = current_user_id(request)
    if not world_readable(world, user_id):
        # 不泄露其他用户世界的存在性
        raise HTTPException(status_code=404, detail="世界不存在")
    if write and not world_writable(world, user_id):
        raise HTTPException(status_code=403, detail="官方演示世界为只读")
    return world


def assert_world_access(db: Session, world_id: str, request: Request, *, write: bool = False) -> models.World:
    return get_world_for_request(db, world_id, request, write=write)  # type: ignore[return-value]


def accessible_world_ids(db: Session, request: Request) -> list[str]:
    from sqlalchemy import or_
    user_id = current_user_id(request)
    rows = db.query(models.World.id).filter(
        models.World.deleted_at.is_(None),
        or_(
            models.World.owner_id == user_id,
            models.World.is_official.is_(True),
            (models.World.owner_id.is_(None) & (user_id == "local")),
        ),
    ).all()
    return [world_id for (world_id,) in rows]


def entity_world_id(entity) -> str:
    return str(getattr(entity, "world_id", "") or "")


def assert_entity_access(db: Session, entity, request: Request, *, write: bool = False, allow_free: bool = False) -> None:
    world_id = entity_world_id(entity)
    if world_id:
        assert_world_access(db, world_id, request, write=write)
        return
    owner_user_id = getattr(entity, "owner_user_id", None)
    if allow_free and (owner_user_id == current_user_id(request) or (not owner_user_id and current_user_id(request) == "local")):
        return
    raise HTTPException(status_code=404, detail="内容不存在")


def guard_request_world(request: Request, user_id: str, db: Session) -> JSONResponse | None:
    """在鉴权中间件里统一拦截路径/查询参数中携带的 world_id。"""
    path = request.url.path
    world_id = ""
    match = WORLD_PATH_RE.match(path)
    if match:
        world_id = match.group(1)
    if not world_id:
        world_id = (
            request.query_params.get("world_id")
            or request.query_params.get("worldId")
            or ""
        ).strip()
    if not world_id:
        entity_match = ENTITY_PATH_RE.match(path)
        if entity_match:
            kind, entity_id = entity_match.group(1), entity_match.group(2)
            static_tails = {"unprocessed", "save", "generate", "assist", "extract", "tool", "compare", "run"}
            if entity_id in static_tails:
                return None
            model_name = ENTITY_MODEL_MAP.get(kind)
            model = getattr(models, model_name, None) if model_name else None
            if model is not None:
                entity = db.query(model).filter(model.id == entity_id).first()
                if not entity:
                    return JSONResponse(status_code=404, content={"detail": "内容不存在"})
                if kind == "chat/impact":
                    impact_thread = db.query(models.ChatThread).filter(
                        models.ChatThread.id == getattr(entity, "thread_id", "")
                    ).first()
                    thread_owner = str((impact_thread.owner_user_id if impact_thread else "") or "local")
                    if thread_owner != user_id:
                        return JSONResponse(status_code=404, content={"detail": "内容不存在"})
                if kind in ENTITY_OWNER_ONLY:
                    entity_owner = str(getattr(entity, "owner_user_id", "") or "")
                    if entity_owner != user_id and not (not entity_owner and user_id == "local"):
                        return JSONResponse(status_code=404, content={"detail": "内容不存在"})
                entity_world = str(getattr(entity, "world_id", "") or "")
                if entity_world:
                    entity_world_row = db.query(models.World).filter(models.World.id == entity_world).first()
                    if not entity_world_row or not world_readable(entity_world_row, user_id):
                        return JSONResponse(status_code=404, content={"detail": "内容不存在"})
                    if request.method not in {"GET", "HEAD", "OPTIONS"} and not world_writable(entity_world_row, user_id):
                        return JSONResponse(status_code=403, content={"detail": "官方演示世界为只读"})
                else:
                    entity_owner = str(getattr(entity, "owner_user_id", "") or "")
                    if entity_owner != user_id and not (not entity_owner and user_id == "local"):
                        return JSONResponse(status_code=404, content={"detail": "内容不存在"})
            return None
    if not world_id or world_id in {"public"}:
        return None
    world = db.query(models.World).filter(models.World.id == world_id).first()
    if not world or world.deleted_at is not None:
        return JSONResponse(status_code=404, content={"detail": "世界不存在"})
    if not world_readable(world, user_id):
        return JSONResponse(status_code=404, content={"detail": "世界不存在"})
    if request.method not in {"GET", "HEAD", "OPTIONS"} and not world_writable(world, user_id):
        return JSONResponse(status_code=403, content={"detail": "官方演示世界为只读"})
    return None
