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
class AppUser(Base):
    __tablename__ = "app_users"

    id = Column(String, primary_key=True, default=_uuid)
    username = Column(String, unique=True, nullable=False)
    display_name = Column(String, default="")
    password_hash = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class AuthSession(Base):
    """登录会话：只存 token 的 SHA-256，不存明文。"""

    __tablename__ = "auth_sessions"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, nullable=False, index=True)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=_now)


class World(Base):
    __tablename__ = "worlds"

    id = Column(String, primary_key=True, index=True, default=_uuid)
    name = Column(String, index=True)
    description = Column(String, default="")
    # 世界类型：reality / fiction / historical / experimental
    type = Column(String, default="custom")
    owner_id = Column(String, index=True)
    product_scene = Column(String, index=True)  # game / literature / companion / diary
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
    # K1：自我人物与 AI 角色同表；self 表示用户在这个世界中的化身。
    persona_type = Column(String, default="npc", index=True)
    owner_user_id = Column(String)


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
    # 多路径推演：为空 = 主时间线；有值 = 该分支独有的后续事件
    branch_id = Column(String, index=True)


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
    # 多路径推演：为空 = 主时间线
    branch_id = Column(String, index=True)
    created_at = Column(DateTime, default=_now)


# =====================================================================
# 多路径推演（分支沙盒）
# =====================================================================
class SimulationDirection(Base):
    """事件的发展方向（用户预设 / AI 建议）。"""

    __tablename__ = "simulation_directions"

    id = Column(String, primary_key=True, index=True, default=_uuid)
    world_id = Column(String, index=True)
    event_id = Column(String, index=True)
    name = Column(String)
    description = Column(Text, default="")
    trigger_conditions = Column(JSON, default=list)
    related_character_ids = Column(JSON, default=list)
    cognition = Column(JSON, default=dict)          # {meaning, attribution, certainty}
    engine_activation = Column(JSON, default=dict)  # {competing:[], dominant:[]}
    behavior_output = Column(Text, default="")
    reality_resistance = Column(Text, default="")
    direct_result = Column(Text, default="")
    future_impacts = Column(JSON, default=list)
    sort_order = Column(Integer, default=0)
    enabled = Column(Boolean, default=True, nullable=False)
    source = Column(String, default="user")         # user / ai / ai_confirmed
    confirmed = Column(Boolean, default=True, nullable=False)
    note = Column(String, default="")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class SimulationBranch(Base):
    """一条平行推演分支（沙盒），状态存于快照，不污染主时间线。"""

    __tablename__ = "simulation_branches"

    id = Column(String, primary_key=True, index=True, default=_uuid)
    world_id = Column(String, index=True)
    root_event_id = Column(String, index=True)
    source_direction_id = Column(String)
    parent_branch_id = Column(String, index=True)
    parent_node_id = Column(String)
    name = Column(String)
    note = Column(String, default="")
    status = Column(String, default="active")       # active / paused / archived
    base_snapshot = Column(JSON, default=dict)      # 分叉点全量状态（不可变）
    current_snapshot = Column(JSON, default=dict)   # 当前沙盒状态
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class SimulationBranchNode(Base):
    """分支路径节点：每次推演/回溯留一个带全量快照的锚点。"""

    __tablename__ = "simulation_branch_nodes"

    id = Column(String, primary_key=True, index=True, default=_uuid)
    branch_id = Column(String, index=True)
    world_id = Column(String, index=True)
    seq = Column(Integer, default=0)
    kind = Column(String, default="simulation")     # fork / simulation / manual_edit / ending
    event_id = Column(String)
    run_id = Column(String)
    summary = Column(Text, default="")
    source = Column(String, default="simulation")
    snapshot = Column(JSON, default=dict)
    rollback_reason = Column(String, default="")
    created_at = Column(DateTime, default=_now)


class SimulationEnding(Base):
    """结局：锚定到某个分支节点，保存最终状态与路径。"""

    __tablename__ = "simulation_endings"

    id = Column(String, primary_key=True, index=True, default=_uuid)
    world_id = Column(String, index=True)
    branch_id = Column(String, index=True)
    node_id = Column(String, index=True)
    name = Column(String)
    description = Column(Text, default="")
    key_reasons = Column(Text, default="")
    path_node_ids = Column(JSON, default=list)
    character_final_states = Column(JSON, default=list)
    relationship_changes = Column(JSON, default=list)
    resource_changes = Column(JSON, default=list)
    world_changes = Column(JSON, default=list)
    allow_continue = Column(Boolean, default=True, nullable=False)
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
    citations = Column(JSON, default=list)  # [{kind,id,title,...}] 文档级来源
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


# =====================================================================
# 故事线：故事 / 空间 / 结构单元 / 选择节点 / 结局
# =====================================================================
class StoryProject(Base):
    """故事总览：一部作品的顶层容器（区别于 stories 章节表）。"""

    __tablename__ = "story_projects"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    title = Column(String, default="未命名故事")
    premise = Column(Text, default="")
    status = Column(String, default="planning")  # planning/active/completed/archived
    settings = Column(JSON, default=dict)
    official_key = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class StorySpace(Base):
    """平行空间：绑定推演分支以获得独立快照；原始空间不绑定分支。"""

    __tablename__ = "story_spaces"

    id = Column(String, primary_key=True, default=_uuid)
    story_id = Column(String, nullable=False, index=True)
    world_id = Column(String, nullable=False, index=True)
    name = Column(String, default="")
    is_original = Column(Boolean, default=False, nullable=False)
    parent_space_id = Column(String, nullable=True)
    fork_choice_id = Column(String, nullable=True)
    branch_id = Column(String, nullable=True, unique=True)
    base_node_id = Column(String, nullable=True)
    status = Column(String, default="active")  # active/archived
    summary = Column(Text, default="")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class StoryUnit(Base):
    """结构单元：主线 / 支线 / 副本 / 阶段，属于某个空间。"""

    __tablename__ = "story_units"

    id = Column(String, primary_key=True, default=_uuid)
    story_id = Column(String, nullable=False, index=True)
    world_id = Column(String, nullable=False, index=True)
    space_id = Column(String, nullable=False, index=True)
    parent_unit_id = Column(String, nullable=True)
    kind = Column(String, default="mainline")  # mainline/side/instance/phase
    title = Column(String, default="")
    summary = Column(Text, default="")
    order_index = Column(Integer, default=0)
    status = Column(String, default="planned")
    meta = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class StoryUnitEvent(Base):
    """单元与既有事件的挂接（事件本身仍存于 events 表）。"""

    __tablename__ = "story_unit_events"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    unit_id = Column(String, nullable=False, index=True)
    event_id = Column(String, nullable=False, index=True)
    role = Column(String, default="normal")  # normal/choice/climax/ending
    order_index = Column(Integer, default=0)
    is_shared = Column(Boolean, default=False, nullable=False)
    note = Column(String, default="")
    created_at = Column(DateTime, default=_now)


class StoryChoice(Base):
    """选择节点：发生在某空间，可产生多个平行空间。"""

    __tablename__ = "story_choices"

    id = Column(String, primary_key=True, default=_uuid)
    story_id = Column(String, nullable=False, index=True)
    world_id = Column(String, nullable=False, index=True)
    space_id = Column(String, nullable=False, index=True)
    anchor_event_id = Column(String, nullable=True)
    title = Column(String, default="")
    description = Column(Text, default="")
    precondition = Column(JSON, default=dict)
    allow_rejoin = Column(Boolean, default=False, nullable=False)
    status = Column(String, default="open")  # open/resolved/abandoned
    resolved_option_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class StoryChoiceOption(Base):
    """选择项：用户自定义方向；resolve 后指向一个空间。"""

    __tablename__ = "story_choice_options"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    choice_id = Column(String, nullable=False, index=True)
    label = Column(String, default="")
    description = Column(Text, default="")
    consequence = Column(Text, default="")
    target_space_id = Column(String, nullable=True)
    source = Column(String, default="user")  # user/ai
    confirmed = Column(Boolean, default=True, nullable=False)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=_now)


class StoryEnding(Base):
    """故事结局：最终 / 阶段 / 开放；可导入推演结局。"""

    __tablename__ = "story_endings"

    id = Column(String, primary_key=True, default=_uuid)
    story_id = Column(String, nullable=False, index=True)
    world_id = Column(String, nullable=False, index=True)
    space_id = Column(String, nullable=False, index=True)
    node_id = Column(String, nullable=True)
    name = Column(String, default="")
    content = Column(Text, default="")
    kind = Column(String, default="final")  # final/stage/open
    is_final = Column(Boolean, default=False, nullable=False)
    path_event_ids = Column(JSON, default=list)
    path_node_ids = Column(JSON, default=list)
    precondition = Column(JSON, default=dict)
    source_ending_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=_now)


class StoryRejoin(Base):
    """空间汇合记录（v1 只记录，不做状态合并）。"""

    __tablename__ = "story_rejoins"

    id = Column(String, primary_key=True, default=_uuid)
    story_id = Column(String, nullable=False, index=True)
    world_id = Column(String, nullable=False, index=True)
    from_space_id = Column(String, nullable=False)
    to_space_id = Column(String, nullable=False)
    at_event_id = Column(String, nullable=True)
    note = Column(String, default="")
    status = Column(String, default="planned")
    created_at = Column(DateTime, default=_now)


# =====================================================================
# AI 角色聊天室：角色配置 / 会话 / 消息 / 记忆
# =====================================================================
class AiRole(Base):
    """人物在聊天中的运行配置；由档案生成，不回写 characters。"""

    __tablename__ = "ai_roles"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    character_id = Column(String, nullable=False, unique=True)
    enabled = Column(Boolean, default=True, nullable=False)
    display_name = Column(String, default="")
    persona = Column(JSON, default=dict)
    source = Column(String, default="auto")  # auto/manual
    version = Column(Integer, default=1)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class ChatThread(Base):
    """私聊或群聊会话。"""

    __tablename__ = "chat_threads"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    kind = Column(String, default="private")  # private/group
    title = Column(String, default="")
    status = Column(String, default="active")
    settings = Column(JSON, default=dict)
    summary = Column(Text, default="")
    last_message_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)


class ChatParticipant(Base):
    __tablename__ = "chat_participants"

    id = Column(String, primary_key=True, default=_uuid)
    thread_id = Column(String, nullable=False, index=True)
    character_id = Column(String, nullable=False)
    role_id = Column(String, nullable=True)
    order_index = Column(Integer, default=0)
    speak_policy = Column(String, default="auto")  # auto/when_mentioned/silent
    joined_at = Column(DateTime, default=_now)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=_uuid)
    thread_id = Column(String, nullable=False, index=True)
    sender_type = Column(String, default="user")  # user/character/system
    character_id = Column(String, nullable=True)
    content = Column(Text, default="")
    reply_to_id = Column(String, nullable=True)
    meta = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_now, index=True)


class CharacterMemory(Base):
    """角色记忆：按角色+线程隔离，不进入人物正式档案。"""

    __tablename__ = "character_memories"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    character_id = Column(String, nullable=False, index=True)
    thread_id = Column(String, nullable=True, index=True)
    scope = Column(String, default="private")  # private/group/global
    kind = Column(String, default="episodic")
    content = Column(Text, default="")
    importance = Column(Float, default=0.4)
    source_message_ids = Column(JSON, default=list)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)


class ChatPlan(Base):
    """群聊发言计划（F5 使用，保留审计）。"""

    __tablename__ = "chat_plans"

    id = Column(String, primary_key=True, default=_uuid)
    thread_id = Column(String, nullable=False, index=True)
    trigger_message_id = Column(String, nullable=True)
    plan = Column(JSON, default=dict)
    model = Column(String, default="")
    created_at = Column(DateTime, default=_now)


class ChatImpact(Base):
    """聊天对世界的影响建议（关系/六轴），须预览并确认后应用。"""

    __tablename__ = "chat_impacts"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    thread_id = Column(String, nullable=False, index=True)
    trigger_message_id = Column(String, nullable=True)
    proposal = Column(JSON, default=dict)
    applied = Column(JSON, default=dict)
    status = Column(String, default="pending")  # pending/applied/dismissed
    model = Column(String, default="")
    created_at = Column(DateTime, default=_now)


class StoryChapterLink(Base):
    """章节（stories）与故事线空间/单元的关联；一章只归一条故事线。"""

    __tablename__ = "story_chapter_links"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    story_id = Column(String, nullable=False, index=True)
    space_id = Column(String, nullable=False, index=True)
    unit_id = Column(String, nullable=True)
    chapter_id = Column(String, nullable=False, unique=True)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=_now)


class EventChoice(Base):
    """05 事件内的选择点；与故事线 story_choices 并存，作为事件层定义。"""

    __tablename__ = "event_choices"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    event_id = Column(String, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    precondition = Column(JSON, default=dict)
    status = Column(String, default="open")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)


class EventChoiceOption(Base):
    """选择项：结果文本 + 可选后续事件 + 可选沙盒分支。"""

    __tablename__ = "event_choice_options"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False, index=True)
    choice_id = Column(String, ForeignKey("event_choices.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String, nullable=False)
    consequence = Column(Text, default="")
    outcome_event_id = Column(String, ForeignKey("events.id", ondelete="SET NULL"))
    target_branch_id = Column(String)
    source = Column(String, default="user")
    confirmed = Column(Boolean, default=True)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=_now)


class StoryThread(Base):
    """人物故事线：配角也可拥有独立主线；事件通过 thread_events 引用。"""

    __tablename__ = "story_threads"

    id = Column(String, primary_key=True, default=_uuid)
    story_id = Column(String, nullable=False, index=True)
    world_id = Column(String, nullable=False, index=True)
    character_id = Column(String, nullable=True, index=True)
    parent_thread_id = Column(String)
    kind = Column(String, default="main")  # main/side/copy/shadow/ensemble
    title = Column(String, nullable=False)
    order_index = Column(Integer, default=0)
    status = Column(String, default="active")
    meta = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_now)


class StoryThreadEvent(Base):
    __tablename__ = "story_thread_events"

    id = Column(String, primary_key=True, default=_uuid)
    world_id = Column(String, nullable=False)
    thread_id = Column(String, ForeignKey("story_threads.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id = Column(String, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    order_index = Column(Integer, default=0)
    role = Column(String, default="")
    note = Column(String, default="")
    created_at = Column(DateTime, default=_now)


class StoryThreadEdge(Base):
    __tablename__ = "story_thread_edges"

    id = Column(String, primary_key=True, default=_uuid)
    story_id = Column(String, nullable=False, index=True)
    world_id = Column(String, nullable=False)
    from_thread_id = Column(String, nullable=False)
    from_event_id = Column(String, nullable=True)
    to_thread_id = Column(String, nullable=False)
    to_event_id = Column(String, nullable=True)
    edge_type = Column(String, default="impact")  # converge/impact/fork
    note = Column(String, default="")
    created_at = Column(DateTime, default=_now)


class DiaryEntry(Base):
    """日记独立于世界：world_id 可空，不进入世界快照，也不随世界删除。"""

    __tablename__ = "diary_entries"

    id = Column(String, primary_key=True, default=_uuid)
    owner_user_id = Column(String, nullable=False, index=True)
    world_id = Column(String, index=True)
    character_id = Column(String)
    entry_date = Column(String, nullable=False, index=True)
    title = Column(String, default="")
    content = Column(Text, nullable=False)
    mood = Column(String, default="")
    tags = Column(JSON, default=list)
    source_type = Column(String, default="user", index=True)  # user/chat/event/branch/import/ai_draft
    source_ref = Column(JSON, default=dict)
    visibility = Column(String, default="private")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)
