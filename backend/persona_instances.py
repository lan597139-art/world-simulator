"""人格定义/版本/实例桥接。

M2 只建立云宝的全局定义、初始版本和每用户实例；旧 companion 人格不迁移。
运行时仍通过 `PersonalPersona` 兼容适配器读取人格内容，版本化编辑器在后续阶段接入。
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

import models


def persona_payload(persona: models.PersonalPersona) -> dict:
    """把当前 PersonalPersona 转成可版本化的最小完整快照。"""
    return {
        "name": persona.name,
        "system_key": persona.system_key,
        "product_key": persona.product_key,
        "identity": persona.identity or "",
        "description": persona.description or "",
        "avatar": persona.avatar or "",
        "maturity": persona.maturity or "",
        "biography": persona.biography or "",
        "growth_experience": persona.growth_experience if isinstance(persona.growth_experience, list) else [],
        "states": persona.states if isinstance(persona.states, list) else [],
        "active_state": persona.active_state or "",
        "esa": persona.esa if isinstance(persona.esa, dict) else {},
        "traits": persona.traits if isinstance(persona.traits, list) else [],
        "cognition": persona.cognition if isinstance(persona.cognition, dict) else {},
        "expression": persona.expression if isinstance(persona.expression, dict) else {},
        "interaction": persona.interaction if isinstance(persona.interaction, dict) else {},
        "memory_policy": persona.memory_policy if isinstance(persona.memory_policy, dict) else {},
        "public_profile": persona.public_profile if isinstance(persona.public_profile, dict) else {},
        "tools": persona.tools if isinstance(persona.tools, list) else [],
        "status": persona.status or "active",
    }


def ensure_definition(
    db: Session,
    persona: models.PersonalPersona,
    *,
    owner_user_id: str,
    scope: str = "private",
    system_key: str | None = None,
) -> models.PersonaDefinition:
    """按 system_key（全局人格）或旧人格 ID（私人人格）幂等获取定义。"""
    query = db.query(models.PersonaDefinition)
    if system_key:
        row = query.filter(models.PersonaDefinition.system_key == system_key).first()
    else:
        row = query.filter(
            models.PersonaDefinition.legacy_persona_id == persona.id,
            models.PersonaDefinition.owner_user_id == owner_user_id,
        ).first()
    if row:
        return row

    row = models.PersonaDefinition(
        owner_user_id=owner_user_id,
        scope=scope,
        system_key=system_key,
        product_key=persona.product_key or "companion",
        name=persona.name,
        status="active",
        legacy_persona_id=persona.id,
    )
    db.add(row)
    db.flush()
    return row


def ensure_version(
    db: Session,
    definition: models.PersonaDefinition,
    persona: models.PersonalPersona,
    *,
    created_by: str,
) -> models.PersonaVersion:
    """获取最新版本；首个版本保存当前人格快照，之后不自动覆盖。"""
    row = db.query(models.PersonaVersion).filter(
        models.PersonaVersion.definition_id == definition.id,
    ).order_by(models.PersonaVersion.version_no.desc()).first()
    if row:
        if not row.payload:
            row.payload = persona_payload(persona)
            db.flush()
        return row

    row = models.PersonaVersion(
        definition_id=definition.id,
        version_no=1,
        payload=persona_payload(persona),
        status="published",
        created_by=created_by,
    )
    db.add(row)
    db.flush()
    return row


def bind_legacy_records(
    db: Session,
    *,
    persona_id: str,
    owner_user_id: str,
    instance_id: str,
) -> None:
    """把该用户此人格下尚未绑定的旧会话/有效记忆归入实例。

    只处理指定 persona + owner；旧 companion 人格不会被调用，因此不会被迁移。
    `legacy_unscoped` 记忆保持原状，不绑定、不召回。
    """
    db.query(models.PersonaThread).filter(
        models.PersonaThread.persona_id == persona_id,
        models.PersonaThread.owner_user_id == owner_user_id,
        models.PersonaThread.instance_id.is_(None),
    ).update(
        {"instance_id": instance_id, "kind": "chat"},
        synchronize_session=False,
    )
    db.query(models.PersonaMemory).filter(
        models.PersonaMemory.persona_id == persona_id,
        models.PersonaMemory.owner_user_id == owner_user_id,
        models.PersonaMemory.persona_instance_id.is_(None),
        models.PersonaMemory.status == "active",
    ).update(
        {"persona_instance_id": instance_id},
        synchronize_session=False,
    )


def ensure_instance(
    db: Session,
    definition: models.PersonaDefinition,
    version: models.PersonaVersion,
    *,
    owner_user_id: str,
    kind: str,
    legacy_persona_id: str | None = None,
) -> models.PersonaInstance:
    """每用户每定义一个实例；旧会话/记忆在创建或首次绑定时归入。"""
    row = db.query(models.PersonaInstance).filter(
        models.PersonaInstance.owner_user_id == owner_user_id,
        models.PersonaInstance.definition_id == definition.id,
    ).first()
    if not row:
        row = models.PersonaInstance(
            definition_id=definition.id,
            version_id=version.id,
            owner_user_id=owner_user_id,
            kind=kind,
            legacy_persona_id=legacy_persona_id,
            status="active",
        )
        db.add(row)
        db.flush()
    else:
        # 只补空版本，不自动切换用户已 pin 的版本。
        if not row.version_id:
            row.version_id = version.id
        if not row.legacy_persona_id and legacy_persona_id:
            row.legacy_persona_id = legacy_persona_id
        row.updated_at = datetime.utcnow()

    if legacy_persona_id:
        bind_legacy_records(
            db,
            persona_id=legacy_persona_id,
            owner_user_id=owner_user_id,
            instance_id=row.id,
        )
    db.flush()
    return row
