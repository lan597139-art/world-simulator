from sqlalchemy import (
    Column,
    String,
    DateTime,
    JSON,
    Boolean,
    Float,
    Integer,
    ForeignKey,
    Index,
    UniqueConstraint,
    Text,
)
from datetime import datetime, timezone
import uuid

from database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    """UTC, naive（SQLite 友好），避免 aware/naive 混用报错。"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# =====================================================================
# 世界层
# =====================================================================
class World(Base):
    __tablename__ = "worlds"

    id = Column(String, primary_key=True, index=True, default=_uuid)
    name = Column(String, index=True)
    description = Column(String, default="")
    # 世界类型：reality / fiction / historical / experimental
    type = Column(String, default="custom")
    background = Column(String, default="")
    createdAt = Column(String)
    updatedAt = Column(String)
    map_image_url = Column(String, default="")

    # V1.0 扩展
    world_scale = Column(String, default="city")     # city/province/nation/global/planet/galaxy
    status = Column(String, default="draft")         # draft/running/archived
    time_status = Column(String, default="paused")   # paused/running
    settings = Column(JSON, default=dict)

    # 全局归档 / 回收站 / 官方演示世界
    archived_at = Column(DateTime)
    deleted_at = Column(DateTime)
    is_official = Column(Boolean, default=False, nullable=False)
    official_key = Column(String, index=True)


class WorldSettings(Base):
    """承接原 IndexedDB 的 worldBuildingConfigs。"""

    __tablename__ = "world_settings"

    world_id = Column(String, ForeignKey("worlds.id", ondelete="CASCADE"), primary_key=True)
    selections = Column(JSON, default=dict)
    parameters = Column(JSON, default=dict)
    revision = Column(Integer, default=1, nullable=False)
    updated_at = Column(DateTime, default=_now)


class SchemaMigration(Base):
    __tablename__ = "schema_migrations"

    version = Column(String, primary_key=True)
    applied_at = Column(DateTime, default=_now)
    note = Column(String, default="")


# =====================================================================
# 结构层：世界目录
# =====================================================================
class WorldNode(Base):
    __tablename__ = "world_nodes"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(String, ForeignKey("world_nodes.id", ondelete="RESTRICT"), index=True)
    branch = Column(String, nullable=False)
    node_type = Column(String, nullable=False, default="folder")  # folder/entity_ref/note
    name = Column(String, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    description = Column(Text, default="")
    ref_type = Column(String)   # location/organization/character/...
    ref_id = Column(String)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_world_nodes_world_branch", "world_id", "branch", "sort_order"),
    )


# =====================================================================
# 实体层：地理
# =====================================================================
class LocationType(Base):
    __tablename__ = "location_types"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, ForeignKey("worlds.id", ondelete="CASCADE"), index=True)  # NULL = 系统默认
    name = Column(String, nullable=False)
    allowed_parent_type_ids = Column(JSON, default=list)
    default_child_type_ids = Column(JSON, default=list)
    description = Column(Text, default="")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=_now)


class Location(Base):
    __tablename__ = "locations"

    id = Column(String, primary_key=True, index=True, default=_uuid)
    world_id = Column(String, index=True)
    name = Column(String, index=True)
    description = Column(String, default="")

    # 地图画布坐标（0-100）
    x = Column(Float, default=50.0)
    y = Column(Float, default=50.0)
    terrain = Column(String, default="")
    climate = Column(String, default="")
    nation = Column(String, default="")   # 旧字段，只读兼容
    geo_type = Column(String, default="城市")  # 旧字段，只读兼容

    # V1.0 树结构
    parent_location_id = Column(String, ForeignKey("locations.id", ondelete="RESTRICT"), index=True)
    location_type_id = Column(String, ForeignKey("location_types.id", ondelete="RESTRICT"), index=True)
    status = Column(String, default="normal")
    coordinates = Column(JSON)
    environment = Column(JSON, default=dict)
    population = Column(Integer)
    sort_order = Column(Integer, default=0)
    updated_at = Column(DateTime, default=_now)

    created_at = Column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_locations_world_type", "world_id", "location_type_id"),
    )


# =====================================================================
# 实体层：组织
# =====================================================================
class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, index=True, default=_uuid)
    world_id = Column(String, index=True)
    name = Column(String, index=True)
    description = Column(String, default="")

    # V1.0 扩展
    organization_type = Column(String, default="company")
    mission = Column(Text, default="")
    founded_at = Column(DateTime)
    dissolved_at = Column(DateTime)
    status = Column(String, default="normal")
    headquarters_location_id = Column(String, ForeignKey("locations.id", ondelete="SET NULL"))
    attributes = Column(JSON, default=dict)
    # 国家/文明 = societies；政府机构/军队/企业 = organizations，此列表达"属于哪个社会"
    society_id = Column(String, ForeignKey("societies.id", ondelete="SET NULL"))
    updated_at = Column(DateTime, default=_now)

    created_at = Column(DateTime, default=_now)


class OrganizationUnit(Base):
    __tablename__ = "organization_units"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_unit_id = Column(String, ForeignKey("organization_units.id", ondelete="RESTRICT"), index=True)
    name = Column(String, nullable=False)
    unit_type = Column(String, default="department")
    description = Column(Text, default="")
    status = Column(String, default="active")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class OrganizationPosition(Base):
    __tablename__ = "organization_positions"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    unit_id = Column(String, ForeignKey("organization_units.id", ondelete="RESTRICT"), nullable=False, index=True)
    name = Column(String, nullable=False)
    position_level = Column(String)
    responsibilities = Column(Text, default="")
    authority_scope = Column(JSON, default=dict)
    headcount = Column(Integer)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class CharacterAppointment(Base):
    __tablename__ = "character_appointments"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    character_id = Column(String, ForeignKey("characters.id", ondelete="RESTRICT"), nullable=False, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False)
    unit_id = Column(String, ForeignKey("organization_units.id", ondelete="RESTRICT"), nullable=False)
    position_id = Column(String, ForeignKey("organization_positions.id", ondelete="RESTRICT"), nullable=False)
    start_time = Column(DateTime, default=_now)
    end_time = Column(DateTime)
    appointment_status = Column(String, default="active")
    note = Column(Text, default="")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


# =====================================================================
# 人物（保留原有结构）
# =====================================================================
class Character(Base):
    __tablename__ = "characters"

    id = Column(String, primary_key=True, index=True, default=_uuid)
    world_id = Column(String, index=True)
    name = Column(String, index=True)
    basic_profile = Column(JSON, default=dict)
    engines = Column(JSON, default=lambda: {"V": 50, "O": 50, "D": 50, "E": 50, "T": 50})
    defense_mechanisms = Column(JSON, default=dict)
    reality_conditions = Column(JSON, default=dict)
    thought_imprints = Column(JSON, default=list)
    life_history = Column(JSON, default=list)
    initial_state = Column(JSON, default=dict)
    # 种子设定保持稳定；运行态记录人物随时间发生的当前变化。
    runtime_state = Column(JSON, default=dict)
    archived_at = Column(DateTime)
    created_at = Column(DateTime, default=_now)


# =====================================================================
# 关系层
# =====================================================================
class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(String, primary_key=True, index=True, default=_uuid)
    world_id = Column(String, index=True)
    source_id = Column(String, index=True)
    target_id = Column(String, index=True)

    # V1.0：类型化，允许人物/组织/地点/群体/资源/事件
    source_type = Column(String, default="character")
    target_type = Column(String, default="character")

    relation_type = Column(String)
    description = Column(String, default="")
    is_bidirectional = Column(Boolean, default=False)

    source_quadrant = Column(String, default="漠视")
    source_strength = Column(String, default="中")
    source_power = Column(String, default="对等")
    source_value = Column(String, default="利己")

    target_quadrant = Column(String)
    target_strength = Column(String)
    target_power = Column(String)
    target_value = Column(String)

    status = Column(String, default="active")
    strength_level = Column(String)  # 弱/中/强（整体强度）
    valid_from = Column(DateTime)
    valid_until = Column(DateTime)

    # 旧字段：迁移到 state_histories 后只读，不再写入
    history = Column(JSON, default=list)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_rel_world_source", "world_id", "source_type", "source_id"),
        Index("ix_rel_world_target", "world_id", "target_type", "target_id"),
    )


class StateHistory(Base):
    __tablename__ = "state_histories"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    field = Column(String, nullable=False)
    old_value = Column(JSON)
    new_value = Column(JSON)
    event_id = Column(String, ForeignKey("events.id", ondelete="SET NULL"))
    reason = Column(Text, default="")
    source = Column(String, default="user")  # user/ai/import/system
    actor_id = Column(String)
    occurred_at = Column(DateTime, default=_now)
    created_at = Column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_hist_entity", "world_id", "entity_type", "entity_id", "occurred_at"),
    )


# =====================================================================
# 规则层
# =====================================================================
class WorldRule(Base):
    __tablename__ = "world_rules"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    rule_category = Column(String, default="social")  # natural/social/legal/economic/special
    description = Column(Text, default="")
    conditions = Column(Text, default="")
    consequences = Column(Text, default="")
    priority = Column(Integer, default=0)
    status = Column(String, default="active")
    effective_from = Column(DateTime)
    effective_until = Column(DateTime)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class RuleScope(Base):
    __tablename__ = "rule_scopes"

    id = Column(String, primary_key=True, default=_uuid)
    rule_id = Column(String, ForeignKey("world_rules.id", ondelete="CASCADE"), nullable=False, index=True)
    scope_type = Column(String, nullable=False)
    scope_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=_now)

    __table_args__ = (
        UniqueConstraint("rule_id", "scope_type", "scope_id", name="uq_rule_scope"),
    )


# =====================================================================
# 时空
# =====================================================================
class Era(Base):
    __tablename__ = "eras"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    description = Column(Text, default="")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=_now)


class TimeSettings(Base):
    __tablename__ = "time_settings"

    world_id = Column(String, ForeignKey("worlds.id", ondelete="CASCADE"), primary_key=True)
    calendar_type = Column(String, default="gregorian")
    day_length_hours = Column(Float, default=24)
    time_unit = Column(String, default="day")
    timezone = Column(String, default="UTC")
    current_time = Column(DateTime, default=_now)
    current_era_id = Column(String, ForeignKey("eras.id", ondelete="SET NULL"))
    allow_regional_time = Column(Boolean, default=False)
    # 双模式：manual（手动推进）/ realtime（随真实时间流逝）
    time_mode = Column(String, default="manual")
    # realtime 下：现实多少秒 = 世界 1 天（86400 即 1:1；60 表示现实 1 分钟走完 1 天）
    real_seconds_per_world_day = Column(Float, default=86400)
    last_sync_at = Column(DateTime)
    config = Column(JSON, default=dict)
    updated_at = Column(DateTime, default=_now)


# =====================================================================
# 社会
# =====================================================================
class Society(Base):
    __tablename__ = "societies"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    society_type = Column(String, default="nation")  # nation/civilization/tribe/city_state
    government_form = Column(String, default="")
    territory_location_id = Column(String, ForeignKey("locations.id", ondelete="SET NULL"))
    description = Column(Text, default="")
    founded_at = Column(DateTime)
    dissolved_at = Column(DateTime)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class SocialGroup(Base):
    __tablename__ = "social_groups"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    society_id = Column(String, ForeignKey("societies.id", ondelete="SET NULL"))
    name = Column(String, nullable=False)
    group_type = Column(String, default="class")  # class/ethnic/religious/cultural/profession
    description = Column(Text, default="")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class GroupMembership(Base):
    __tablename__ = "group_memberships"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    group_id = Column(String, ForeignKey("social_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    member_type = Column(String, nullable=False)  # character/organization
    member_id = Column(String, nullable=False)
    role = Column(String, default="member")
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=_now)


class CulturalProfile(Base):
    __tablename__ = "cultural_profiles"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    society_id = Column(String, ForeignKey("societies.id", ondelete="CASCADE"))
    language = Column(String, default="")
    religion = Column(String, default="")
    customs = Column(JSON, default=list)
    taboos = Column(JSON, default=list)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


# =====================================================================
# 资源
# =====================================================================
class ResourceType(Base):
    __tablename__ = "resource_types"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, ForeignKey("worlds.id", ondelete="CASCADE"), index=True)  # NULL = 系统默认
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # natural/material/financial/human/information/power
    unit = Column(String, default="")
    description = Column(Text, default="")
    created_at = Column(DateTime, default=_now)


class Resource(Base):
    __tablename__ = "resources"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    resource_type_id = Column(String, ForeignKey("resource_types.id", ondelete="RESTRICT"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    quantity = Column(Float, default=0)  # 允许负数（负债/透支）
    unit = Column(String, default="")
    location_id = Column(String, ForeignKey("locations.id", ondelete="SET NULL"))
    status = Column(String, default="active")
    data = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class ResourceHolding(Base):
    __tablename__ = "resource_holdings"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    resource_id = Column(String, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    holder_type = Column(String, nullable=False)  # character/organization/organization_unit/social_group/location
    holder_id = Column(String, nullable=False)
    role = Column(String, nullable=False, default="holder")  # holder/manager/user/beneficiary
    share = Column(Float)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=_now)


class ResourceTransaction(Base):
    __tablename__ = "resource_transactions"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    resource_id = Column(String, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    from_holder_id = Column(String, ForeignKey("resource_holdings.id", ondelete="SET NULL"))
    to_holder_id = Column(String, ForeignKey("resource_holdings.id", ondelete="SET NULL"))
    event_id = Column(String, ForeignKey("events.id", ondelete="SET NULL"))
    reason = Column(Text, default="")
    occurred_at = Column(DateTime, default=_now)
    created_at = Column(DateTime, default=_now)


# =====================================================================
# 事件层
# =====================================================================
class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, index=True, default=_uuid)
    world_id = Column(String, index=True, nullable=True)
    name = Column(String, index=True)
    domain = Column(JSON, default=list)
    parent_event_id = Column(String)
    polarity = Column(String, default="威胁")
    intensity = Column(String, default="中")
    description = Column(String, default="")
    participants = Column(JSON, default=list)
    affected = Column(JSON, default=list)
    story_time = Column(String, default="")
    location_id = Column(String)
    organization_id = Column(String)
    occurred_at = Column(DateTime)
    ended_at = Column(DateTime)
    event_status = Column(String, default="occurred")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)
    storyline = Column(String, default="主线")
    scale = Column(String, default="中观")
    caused_by = Column(JSON, default=list)


class EventEntity(Base):
    __tablename__ = "event_entities"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    event_id = Column(String, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    # participant（参与者）/ impact（影响对象）
    category = Column(String, default="participant")
    role = Column(String, nullable=False)
    participant_role = Column(String)
    impact_type = Column(String)
    impact_level = Column(String)
    is_confirmed = Column(Boolean, default=True)
    description = Column(Text, default="")
    impact = Column(Text, default="")
    created_at = Column(DateTime, default=_now)


class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id = Column(String, primary_key=True, index=True, default=_uuid)
    world_id = Column(String, index=True)
    event_id = Column(String, index=True)
    direction = Column(String, default="")       # 作者预设推演方向
    perspective = Column(String, default="")     # 作者预设推演视角
    world_changes = Column(String, default="")
    character_actions = Column(JSON, default=list)
    created_at = Column(DateTime, default=_now)


class Story(Base):
    """小说章节：架构师模式由推演生成，探险家模式由作者手写。"""

    __tablename__ = "stories"

    id = Column(String, primary_key=True, index=True, default=_uuid)
    world_id = Column(String, index=True, nullable=True)
    title = Column(String, default="未命名章节")
    content = Column(String, default="")
    plain_text = Column(String, default="")
    word_count = Column(Integer, default=0)
    mode = Column(String, default="architect")  # architect / explorer
    status = Column(String, default="draft")    # draft / published
    source_event_ids = Column(JSON, default=list)
    source_simulation_ids = Column(JSON, default=list)
    archived_at = Column(DateTime)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_stories_world_updated", "world_id", "updated_at"),
    )


class EntityDraft(Base):
    """从章节中提取、尚未正式入库的素材草稿。"""

    __tablename__ = "entity_drafts"

    id = Column(String, primary_key=True, index=True, default=_uuid)
    world_id = Column(String, ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False, index=True)
    story_id = Column(String, index=True)
    entity_type = Column(String, nullable=False)  # character/location/event/organization/relationship
    name = Column(String, nullable=False)
    summary = Column(Text, default="")
    payload = Column(JSON, default=dict)
    evidence = Column(Text, default="")
    confidence = Column(Float, default=0.6)
    status = Column(String, default="pending")  # pending/accepted/ignored
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_drafts_world_status", "world_id", "status"),
        Index("ix_drafts_story", "story_id", "status"),
    )


# =====================================================================
# 关系类型配置
# =====================================================================
class RelationshipType(Base):
    __tablename__ = "relationship_types"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, ForeignKey("worlds.id", ondelete="CASCADE"), index=True)  # NULL = 系统默认
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # character/interpersonal/cross/organization/location/resource
    source_allowed_types = Column(JSON, default=list)
    target_allowed_types = Column(JSON, default=list)
    is_directional = Column(Boolean, default=True)
    description = Column(Text, default="")
    sort_order = Column(Integer, default=0)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=_now)


# =====================================================================
# 事件因果
# =====================================================================
class EventRelation(Base):
    __tablename__ = "event_relations"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    source_event_id = Column(String, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    target_event_id = Column(String, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    relation_type = Column(String, nullable=False)  # causes/contributes_to/triggers/prevents/enables/escalates/follows/correlates_with
    description = Column(Text, default="")
    confidence = Column(Float)  # 0-1，NULL = 未知
    evidence = Column(Text, default="")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class CharacterEventPerception(Base):
    __tablename__ = "character_event_perceptions"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    character_id = Column(String, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id = Column(String, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    perceived_content = Column(Text, default="")
    perceived_polarity = Column(String)
    perceived_intensity = Column(String)
    attribution_target = Column(String)
    certainty = Column(Float)
    information_source = Column(String, default="")
    perceived_at = Column(DateTime, default=_now)
    created_at = Column(DateTime, default=_now)


# =====================================================================
# 全局归档 / 回收站 / 时光机 / 人物传记
# =====================================================================
class TrashEntry(Base):
    """软删除快照：删除时保存整行数据，恢复时按原 ID 重建。"""

    __tablename__ = "trash_entries"

    id = Column(String, primary_key=True, default=_uuid, index=True)
    world_id = Column(String, index=True)
    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(String, nullable=False, index=True)
    name = Column(String, default="")
    data = Column(JSON, default=dict)
    extras = Column(JSON, default=dict)
    deleted_at = Column(DateTime, default=_now, index=True)


class CharacterBiography(Base):
    """人物自传：由生平事件聚合生成，可保存多版。"""

    __tablename__ = "character_biographies"

    id = Column(String, primary_key=True, default=_uuid, index=True)
    world_id = Column(String, nullable=False, index=True)
    character_id = Column(String, nullable=False, index=True)
    title = Column(String, default="")
    content = Column(Text, default="")
    source_event_ids = Column(JSON, default=list)
    engine = Column(String, default="local")  # ai/local/manual
    created_at = Column(DateTime, default=_now, index=True)


class WorldSnapshot(Base):
    """世界时光机：保存整个世界的数据快照。"""

    __tablename__ = "world_snapshots"

    id = Column(String, primary_key=True, default=_uuid, index=True)
    world_id = Column(String, nullable=False, index=True)
    label = Column(String, default="")
    data = Column(Text, default="")
    entity_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=_now, index=True)
