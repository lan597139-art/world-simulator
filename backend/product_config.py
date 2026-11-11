"""四套产品的统一功能配置层。

产品只决定：导航展示、可用模块、业务模式与工作空间形态；
人物、关系、事件、记忆、模型调用等底层能力共用，不复制实现。
"""

from __future__ import annotations

from typing import Optional

PRODUCT_KEYS = ("game", "literature", "companion", "diary")

PRODUCT_LABELS = {
    "game": "游戏创作",
    "literature": "文学创作",
    "companion": "AI 伴侣",
    "diary": "日记与传记",
}

PRODUCT_SHORT = {
    "game": "游戏",
    "literature": "文学",
    "companion": "伴侣",
    "diary": "日记",
}

PRODUCT_ICONS = {
    "game": "🎮",
    "literature": "📖",
    "companion": "💬",
    "diary": "📔",
}

PRODUCT_DESCRIPTIONS = {
    "game": "开放完整世界模拟：世界、NPC、规则、事件、时间线、多路径推演与写作。",
    "literature": "以人物、关系和叙事为中心，保留模拟作为辅助推演，不改变完整写作能力。",
    "companion": "只开放个人 AI 人格、AI 伴侣角色、长期会话、独立记忆与互动事件，不开放世界构建。",
    "diary": "记录本人及他人的人生、关系、经历与来源证据，生成时间线与传记，不开放推演。",
}

# 模块是底层能力的稳定标识；page 是前端现有页面键。
MODULES = {
    "overview": {"label": "01 世界总览", "page": "overview", "description": "产品工作台与统计入口"},
    "world-management": {"label": "02 世界管理", "page": "world-management", "description": "进入或创建本产品世界"},
    "world-building": {"label": "世界建设配置", "page": "world-building", "description": "世界初始配置；仅作为创建世界的子页面"},
    "character-management": {"label": "03 人物管理", "page": "character-management", "description": "人物档案；不同产品使用完整/轻量模式"},
    "chat": {"label": "AI 角色聊天", "page": "chat", "description": "NPC 或 AI 伴侣角色会话"},
    "world-structure": {"label": "世界结构", "page": "world-structure", "description": "地点、组织、资源等世界结构"},
    "world-data": {"label": "世界设定", "page": "world-data", "description": "世界规则、背景与设定"},
    "relationships": {"label": "04 关系与组织", "page": "relationships", "description": "人物关系网络"},
    "events": {"label": "05 事件管理", "page": "events", "description": "世界事件、互动事件或人生经历"},
    "timeline": {"label": "06 时间线", "page": "timeline", "description": "世界、互动或人生时间线"},
    "simulation": {"label": "07 模拟运行", "page": "simulation", "description": "完整模拟、辅助推演或人格运行"},
    "storyline": {"label": "故事线管理", "page": "storyline", "description": "真实树状故事结构"},
    "writing": {"label": "08 写作辅助", "page": "writing", "description": "章节、传记与叙事写作"},
    "multipath": {"label": "多路径沙盒", "page": "multipath", "description": "事件分支沙盒子页面；复用同一引擎"},
    "time-machine": {"label": "时光机", "page": "time-machine", "description": "快照与回溯"},
    "archive": {"label": "归档库", "page": "archive", "description": "已归档内容"},
    "trash": {"label": "回收站", "page": "trash", "description": "可恢复的删除内容"},
    "personas": {"label": "个人 AI 人格", "page": "personas", "description": "独立身份、ESA、会话与记忆"},
    "memories": {"label": "记忆管理", "page": "memories", "description": "按人格隔离的长期记忆"},
    "companion-runtime": {"label": "07 人格运行", "page": "companion-runtime", "description": "人格后台运行状态与互动入口；不开放完整模拟台"},
    "information-sources": {"label": "信息来源管理", "page": "information-sources", "description": "本人回忆、他人叙述、资料证据与 AI 推断"},
    "diary": {"label": "日记与传记", "page": "diary", "description": "独立日记、人生记录与传记素材"},
}

# 业务模式：同一模块在不同产品下的行为差异。
MODES = {
    "game": {
        "character-management": "full",
        "events": "narrative",
        "timeline": "world",
        "simulation": "full",
        "writing": "narrative",
        "chat": "npc",
        "relationships": "world",
        "personas": "hidden",
    },
    "literature": {
        "character-management": "full",
        "events": "narrative",
        "timeline": "world",
        "simulation": "auxiliary",
        "writing": "narrative",
        "chat": "npc",
        "relationships": "world",
        "personas": "hidden",
    },
    "companion": {
        "character-management": "light",
        "events": "interaction",
        "timeline": "interaction",
        "simulation": "persona",
        "writing": "hidden",
        "chat": "companion",
        "relationships": "relationship",
        "personas": "full",
    },
    "diary": {
        "character-management": "light",
        "events": "life",
        "timeline": "life",
        "simulation": "hidden",
        "writing": "biography",
        "chat": "hidden",
        "relationships": "life",
        "personas": "hidden",
    },
}


def _nav(title: str, modules: list[str]) -> dict:
    return {
        "title": title,
        "items": [{"module": module, "label": MODULES[module]["label"], "page": MODULES[module]["page"]} for module in modules],
    }


NAV_GROUPS = {
    "game": [
        _nav("工作台", ["overview"]),
        _nav("世界与人物", ["world-management", "character-management", "chat", "world-structure", "world-data", "relationships", "events"]),
        _nav("模拟与叙事", ["timeline", "simulation", "storyline", "writing"]),
        _nav("数据安全", ["time-machine", "archive", "trash"]),
    ],
    "literature": [
        _nav("工作台", ["overview"]),
        _nav("世界与人物", ["world-management", "character-management", "chat", "world-structure", "world-data", "relationships", "events"]),
        _nav("人物与叙事", ["timeline", "storyline", "writing", "simulation"]),
        _nav("数据安全", ["time-machine", "archive", "trash"]),
    ],
    "companion": [
        _nav("伴侣空间", ["character-management", "personas", "chat"]),
        _nav("长期互动", ["relationships", "events", "timeline", "companion-runtime", "memories"]),
        _nav("数据安全", ["time-machine", "archive", "trash"]),
    ],
    "diary": [
        _nav("人生记录", ["diary", "character-management"]),
        _nav("经历与来源", ["relationships", "events", "timeline", "writing", "information-sources"]),
        _nav("数据安全", ["time-machine", "archive", "trash"]),
    ],
}

# 同一模块在不同产品导航中的业务化命名（底层能力不变）。
NAV_LABEL_OVERRIDES = {
    "game": {"chat": "AI 角色聊天（NPC）"},
    "literature": {"chat": "AI 角色聊天", "simulation": "07 模拟运行 · 辅助", "writing": "08 写作工作台"},
    "companion": {
        "character-management": "03 人物管理 · 轻量",
        "chat": "AI 伴侣角色",
        "relationships": "04 关系管理",
        "events": "05 互动事件",
        "timeline": "06 互动时间线",
    },
    "diary": {
        "diary": "日记与传记",
        "character-management": "03 人物档案 · 轻量",
        "relationships": "04 人物关系",
        "events": "05 人生经历",
        "timeline": "06 人生时间线",
        "writing": "08 传记写作",
    },
}

# 导航之外的合法子页面权限。
EXTRA_ALLOWED = {
    "game": {"world-building", "multipath"},
    "literature": {"world-building", "multipath"},
    "companion": set(),
    "diary": set(),
}

AUTO_WORKSPACE = {
    "game": False,
    "literature": False,
    "companion": True,
    "diary": True,
}

WORKSPACE_NAME = {
    "companion": "AI 伴侣空间",
    "diary": "人生记录空间",
}

HOME_PAGE = {
    "game": "overview",
    "literature": "overview",
    "companion": "personas",
    "diary": "diary",
}


def normalize_product(product: Optional[str]) -> str:
    value = str(product or "game").strip().lower()
    if value not in PRODUCT_KEYS:
        raise ValueError("product 只能是 game/literature/companion/diary")
    return value


def allowed_modules(product: str) -> set[str]:
    product = normalize_product(product)
    modules = {item["module"] for group in NAV_GROUPS[product] for item in group["items"]}
    return modules | EXTRA_ALLOWED[product]


def nav_groups_for(product: str) -> list[dict]:
    overrides = NAV_LABEL_OVERRIDES.get(product, {})
    groups = []
    for group in NAV_GROUPS[product]:
        groups.append({
            "title": group["title"],
            "items": [
                {**item, "label": overrides.get(item["module"], item["label"])}
                for item in group["items"]
            ],
        })
    return groups


def config_for(product: Optional[str]) -> dict:
    product = normalize_product(product)
    return {
        "key": product,
        "label": PRODUCT_LABELS[product],
        "short": PRODUCT_SHORT[product],
        "icon": PRODUCT_ICONS[product],
        "description": PRODUCT_DESCRIPTIONS[product],
        "home": HOME_PAGE[product],
        "auto_workspace": AUTO_WORKSPACE[product],
        "workspace_name": WORKSPACE_NAME.get(product),
        "allowed_modules": sorted(allowed_modules(product)),
        "nav_groups": nav_groups_for(product),
        "modes": MODES[product],
        "permissions": {
            "world_management": "world-management" in allowed_modules(product),
            "world_structure": "world-structure" in allowed_modules(product),
            "world_data": "world-data" in allowed_modules(product),
            "storyline": "storyline" in allowed_modules(product),
            "simulation": "simulation" in allowed_modules(product),
            "writing": "writing" in allowed_modules(product),
            "personas": "personas" in allowed_modules(product),
            "memories": "memories" in allowed_modules(product),
            "information_sources": "information-sources" in allowed_modules(product),
        },
    }


def matrix() -> dict:
    return {
        "version": "L2.1",
        "products": [config_for(key) for key in PRODUCT_KEYS],
        "modules": MODULES,
    }


def module_allowed(product: str, module: str) -> bool:
    return module in allowed_modules(product)


def require_module(product: str, module: str) -> str:
    product = normalize_product(product)
    if module not in allowed_modules(product):
        raise PermissionError(f"产品「{PRODUCT_LABELS[product]}」未开放模块 {module}")
    return product
