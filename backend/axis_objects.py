"""六轴压强 / 负熵的具象对象配置与统一读取。

六轴（稀缺/威胁/地位/声誉/依恋/调节）是压力维度；负熵是环境修复力。
同一维度允许多个对象，每个对象独立数值；世界基础对象可在事件/分支被同名对象覆盖。
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter()

AXES = ("scarcity", "threat", "status", "reputation", "attachment", "regulation", "negentropy")
PRESSURE_AXES = ("scarcity", "threat", "status", "reputation", "attachment", "regulation")
AXIS_LABELS = {
    "scarcity": "稀缺", "threat": "威胁", "status": "地位", "reputation": "声誉",
    "attachment": "依恋", "regulation": "调节", "negentropy": "负熵（环境修复力）",
}
AXIS_PRESETS = {
    "scarcity": [
        ("情感", "缺爱", "缺少亲密、关心与情感回应"), ("情感", "缺乏陪伴", "长期独处，缺少可依靠的人"),
        ("情感", "缺乏认同", "努力不被看见，缺少价值确认"), ("情感", "缺乏归属感", "不属于任何群体或地方"),
        ("资源", "缺钱", "货币与可支配财富不足"), ("资源", "缺少物资", "日常物资短缺"),
        ("资源", "缺少能源", "动力、灵气或能源供给不足"), ("生存物资", "缺水", "饮用水或水源不足"),
        ("生存物资", "缺粮", "食物与粮食供给不足"), ("生存物资", "缺少药品", "治疗与药品不可得"),
        ("生存条件", "缺少土地", "可耕作、可立足的土地不足"), ("生存条件", "缺少住房", "没有稳定住所"),
        ("生存条件", "缺少空间", "活动、修炼或生产空间不足"), ("机会", "缺少工作机会", "没有稳定谋生机会"),
        ("机会", "缺少晋升机会", "上升通道被堵"), ("机会", "缺少发展机会", "长期没有成长空间"),
        ("信息", "缺少情报", "关键信息不可得"), ("信息", "缺少知识", "缺少解决问题所需知识"),
        ("信息", "缺少信息渠道", "无法接触关键信息源"), ("时间", "时间不足", "期限逼近，时间不够"),
        ("时间", "机会窗口缩短", "可行动窗口正在关闭"), ("自定义", "缺乏修炼资源", "功法、丹药、灵石等修炼资源不足"),
    ],
    "threat": [
        ("生命威胁", "死亡", "直接死亡风险"), ("生命威胁", "受伤", "身体伤害风险"),
        ("生命威胁", "疾病", "疾病与恶化风险"), ("人身安全", "暴力", "遭受暴力攻击"),
        ("人身安全", "攻击", "被主动攻击"), ("人身安全", "绑架", "被控制、劫持或囚禁"),
        ("生存威胁", "失去住所", "住所被毁或被夺"), ("生存威胁", "失去资源", "生存资源被夺"),
        ("生存威胁", "无法生存", "基本生存条件无法维持"), ("关系威胁", "背叛", "被亲近者背叛"),
        ("关系威胁", "抛弃", "被重要他人抛弃"), ("关系威胁", "关系破裂", "重要关系面临断裂"),
        ("身份威胁", "身份暴露", "真实身份或秘密被揭穿"), ("身份威胁", "地位丧失", "既有地位被剥夺"),
        ("身份威胁", "被驱逐", "被群体或组织驱逐"), ("外部威胁", "战争", "战争与大规模冲突"),
        ("外部威胁", "灾害", "自然灾害或环境灾难"), ("外部威胁", "敌对势力", "敌对组织/势力施压"),
        ("制度威胁", "惩罚", "规则或权力惩罚"), ("制度威胁", "压迫", "制度性压迫"),
        ("制度威胁", "规则制裁", "触犯规则后的制裁"), ("自定义", "夺舍", "身体与意识被侵占"),
    ],
    "status": [
        ("社会地位", "阶层", "所处社会阶层偏低"), ("社会地位", "身份", "身份不被承认"),
        ("社会地位", "社会等级", "社会等级比较压力"), ("权力地位", "决策权", "缺少决策权"),
        ("权力地位", "控制权", "对关键事务缺少控制"), ("权力地位", "支配权", "无法支配资源与人"),
        ("组织地位", "职位", "职位低或职位不稳"), ("组织地位", "职级", "职级晋升受阻"),
        ("组织地位", "组织内部排名", "组织内排名压力"), ("经济地位", "财富", "财富水平偏低"),
        ("经济地位", "资产", "缺少可保值资产"), ("经济地位", "经济等级", "经济等级差距"),
        ("群体地位", "群体位置", "在群体中边缘化"), ("群体地位", "影响力", "缺少话语影响力"),
        ("群体地位", "话语权", "意见不被听见"), ("关系地位", "主动权", "关系中处于被动"),
        ("关系地位", "依赖程度", "过度依赖对方"), ("关系地位", "权力差异", "关系权力不对等"),
        ("自定义", "宗门地位", "在宗门中的实际地位压力"),
    ],
    "reputation": [
        ("个人名誉", "名声", "外界对个人的整体评价"), ("个人名誉", "信誉", "承诺与信用受损"),
        ("个人名誉", "社会评价", "社会舆论评价低"), ("专业声誉", "能力评价", "能力被质疑"),
        ("专业声誉", "职业信誉", "职业信用受损"), ("专业声誉", "专业认可", "专业身份不被认可"),
        ("道德评价", "品行", "品行受到质疑"), ("道德评价", "诚信", "诚信受到质疑"),
        ("道德评价", "道德形象", "道德形象受损"), ("群体评价", "家族声誉", "家族/宗门声誉压力"),
        ("群体评价", "组织声誉", "所属组织声誉压力"), ("群体评价", "派系声誉", "派系评价压力"),
        ("公众形象", "社会舆论", "舆论风向不利"), ("公众形象", "公众认可", "缺少公众认可"),
        ("公众形象", "污名", "被贴上污名标签"), ("自定义", "散修出身", "出身带来的评价压力"),
    ],
    "attachment": [
        ("人物关系", "亲人", "与亲人的依恋与牵挂"), ("人物关系", "伴侣", "伴侣依恋"),
        ("人物关系", "朋友", "朋友依恋"), ("人物关系", "师徒", "师徒情感与责任"),
        ("人物关系", "主从", "主从关系的忠诚与依赖"), ("情感需求", "爱", "需要被爱"),
        ("情感需求", "陪伴", "需要陪伴"), ("情感需求", "关注", "需要被关注"),
        ("情感需求", "认可", "需要被认可"), ("情感需求", "归属", "需要归属"),
        ("群体依恋", "家族", "对家族的依恋"), ("群体依恋", "宗门", "对宗门的依恋"),
        ("群体依恋", "组织", "对组织的依恋"), ("群体依恋", "社群", "对社群的依恋"),
        ("地点依恋", "故乡", "对故乡的依恋"), ("地点依恋", "住所", "对熟悉住所的依恋"),
        ("地点依恋", "熟悉环境", "对熟悉环境的依赖"), ("身份依恋", "身份认同", "对自我身份的认同"),
        ("身份依恋", "文化归属", "文化归属感"), ("身份依恋", "群体认同", "群体认同感"),
        ("事物依恋", "重要物品", "对重要物品的依恋"), ("事物依恋", "资源", "对关键资源的依恋"),
        ("事物依恋", "宠物", "对宠物/灵兽的依恋"), ("自定义", "师徒关系", "对师徒关系的具体依恋"),
    ],
    "regulation": [
        ("情绪调节", "情绪失控", "难以控制情绪"), ("情绪调节", "情绪压抑", "长期压抑情绪"),
        ("情绪调节", "情绪波动", "情绪起伏大"), ("认知调节", "认知冲突", "信念与事实冲突"),
        ("认知调节", "信息过载", "信息量超过处理能力"), ("认知调节", "认知失衡", "认知结构失衡"),
        ("行为调节", "冲动控制", "难以抑制冲动"), ("行为调节", "行为约束", "缺少行为边界"),
        ("行为调节", "自律能力", "自律不足"), ("生理调节", "睡眠", "睡眠不足"),
        ("生理调节", "疲劳", "身体疲劳"), ("生理调节", "身体恢复", "恢复能力不足"),
        ("关系调节", "冲突处理", "冲突处理能力不足"), ("关系调节", "关系修复", "关系修复困难"),
        ("关系调节", "沟通协调", "沟通协调困难"), ("社会调节", "制度调节", "制度调节失灵"),
        ("社会调节", "组织协调", "组织协调困难"), ("社会调节", "秩序维护", "秩序维护压力"),
        ("环境调节", "资源调配", "资源调配困难"), ("环境调节", "风险缓冲", "缺少风险缓冲"),
        ("环境调节", "环境适应", "适应环境困难"), ("自定义", "修炼反噬", "修炼带来的身心调节压力"),
    ],
    "negentropy": [
        ("资源恢复", "水源恢复", "水源与饮水恢复"), ("资源恢复", "粮食补充", "粮食供给恢复"),
        ("资源恢复", "能源再生", "能源/灵气恢复"), ("生态恢复", "土地修复", "土地恢复"),
        ("生态恢复", "森林恢复", "森林与植被恢复"), ("生态恢复", "水体净化", "水体净化"),
        ("社会恢复", "秩序重建", "社会秩序恢复"), ("社会恢复", "制度修复", "制度修复"),
        ("社会恢复", "经济恢复", "经济恢复"), ("关系恢复", "信任重建", "信任修复"),
        ("关系恢复", "关系修复", "关系修复能力"), ("关系恢复", "群体凝聚", "群体凝聚力恢复"),
        ("个体恢复", "休息", "休息与睡眠恢复"), ("个体恢复", "治疗", "治疗与疗伤"),
        ("个体恢复", "情绪恢复", "情绪恢复"), ("个体恢复", "能力恢复", "能力恢复"),
        ("组织恢复", "组织重建", "组织重建"), ("组织恢复", "人员补充", "人员补充"),
        ("组织恢复", "协作恢复", "协作恢复"), ("自定义", "宗门秩序恢复", "宗门秩序与资源恢复"),
    ],
}


def _world(db: Session, world_id: str) -> models.World:
    row = db.query(models.World).filter(models.World.id == world_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="世界不存在")
    return row


def _axis(value: str) -> str:
    axis = str(value or "")
    if axis not in AXES:
        raise HTTPException(status_code=422, detail="压力维度不合法")
    return axis


def _clamp(value) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="数值必须是 0–1")
    return max(0.0, min(1.0, round(number, 3)))


def _scope(payload: dict) -> tuple[str, Optional[str], Optional[str]]:
    event_id = str(payload.get("event_id") or "").strip() or None
    branch_id = str(payload.get("branch_id") or "").strip() or None
    if branch_id:
        return "branch", branch_id, event_id
    if event_id:
        return "event", event_id, event_id
    return "world", None, None


def _object_row(row: models.AxisObject, *, inherited: bool = False) -> dict:
    return {
        "id": row.id, "axis": row.axis, "axis_label": AXIS_LABELS.get(row.axis, row.axis),
        "name": row.name, "category": row.category or "", "description": row.description or "",
        "value": round(float(row.value or 0), 3), "scope_type": row.scope_type,
        "scope_id": row.scope_id, "event_id": row.event_id, "branch_id": row.branch_id,
        "linked_factors": row.linked_factors or [], "source": row.source or "initial",
        "status": row.status or "active", "inherited": inherited,
        "created_at": row.created_at, "updated_at": row.updated_at,
    }


def _scope_rows(db: Session, world_id: str, event_id: Optional[str], branch_id: Optional[str]):
    base = db.query(models.AxisObject).filter(
        models.AxisObject.world_id == world_id,
        models.AxisObject.branch_id.is_(None),
        models.AxisObject.event_id.is_(None),
    ).all()
    event_rows = []
    if event_id:
        event_rows = db.query(models.AxisObject).filter(
            models.AxisObject.world_id == world_id,
            models.AxisObject.event_id == event_id,
            models.AxisObject.branch_id.is_(None),
        ).all()
    branch_rows = []
    if branch_id:
        branch_rows = db.query(models.AxisObject).filter(
            models.AxisObject.world_id == world_id,
            models.AxisObject.branch_id == branch_id,
        ).all()
    return base, event_rows, branch_rows


def effective_objects(db: Session, world_id: str, event_id: Optional[str] = None, branch_id: Optional[str] = None) -> list[dict]:
    """世界基础 → 事件覆盖 → 分支覆盖；同 axis+name 后者覆盖，不混合同名对象。"""
    base, event_rows, branch_rows = _scope_rows(db, world_id, event_id, branch_id)
    merged: dict[tuple[str, str], dict] = {}
    for row in base:
        merged[(row.axis, row.name)] = _object_row(row, inherited=False)
    for row in event_rows:
        merged[(row.axis, row.name)] = _object_row(row, inherited=False)
    for row in branch_rows:
        merged[(row.axis, row.name)] = _object_row(row, inherited=False)
    return list(merged.values())


def aggregate_axis(objects: list[dict]) -> dict:
    buckets: dict[str, list[float]] = {axis: [] for axis in AXES}
    for item in objects:
        if item.get("axis") in buckets:
            buckets[item["axis"]].append(float(item.get("value") or 0))
    return {axis: round(sum(values) / len(values), 3) if values else 0.0 for axis, values in buckets.items()}


@router.get("/api/axis-objects/presets")
def axis_presets():
    return {
        "axes": [{"key": axis, "label": AXIS_LABELS[axis], "pressure": axis != "negentropy",
                  "presets": [{"category": c, "name": n, "description": d} for c, n, d in AXIS_PRESETS[axis]]}
                 for axis in AXES]
    }


@router.get("/api/worlds/{world_id}/axis-objects")
def list_axis_objects(world_id: str, event_id: Optional[str] = None, branch_id: Optional[str] = None,
                      db: Session = Depends(get_db)):
    world = _world(db, world_id)
    if event_id:
        event = db.query(models.Event).filter(models.Event.id == event_id).first()
        if not event or event.world_id != world.id:
            raise HTTPException(status_code=409, detail="事件不在该世界")
    if branch_id:
        branch = db.query(models.SimulationBranch).filter(models.SimulationBranch.id == branch_id).first()
        if not branch or branch.world_id != world.id:
            raise HTTPException(status_code=409, detail="分支不在该世界")
    base, event_rows, branch_rows = _scope_rows(db, world.id, event_id, branch_id)
    effective = effective_objects(db, world.id, event_id, branch_id)
    return {
        "world_id": world.id,
        "objects": [_object_row(row) for row in base + event_rows + branch_rows],
        "effective": effective,
        "aggregate": aggregate_axis(effective),
    }


@router.post("/api/worlds/{world_id}/axis-objects")
def create_axis_object(world_id: str, payload: dict, db: Session = Depends(get_db)):
    world = _world(db, world_id)
    axis = _axis(payload.get("axis"))
    name = str(payload.get("name") or "").strip()[:120]
    if not name:
        raise HTTPException(status_code=422, detail="缺少具体对象名称")
    scope_type, scope_id, _ = _scope(payload)
    event_id = str(payload.get("event_id") or "").strip() or None
    branch_id = str(payload.get("branch_id") or "").strip() or None
    if event_id:
        event = db.query(models.Event).filter(models.Event.id == event_id).first()
        if not event or event.world_id != world.id:
            raise HTTPException(status_code=409, detail="事件不在该世界")
    if branch_id:
        branch = db.query(models.SimulationBranch).filter(models.SimulationBranch.id == branch_id).first()
        if not branch or branch.world_id != world.id:
            raise HTTPException(status_code=409, detail="分支不在该世界")
    duplicate = db.query(models.AxisObject).filter(
        models.AxisObject.world_id == world.id, models.AxisObject.axis == axis,
        models.AxisObject.name == name,
        models.AxisObject.event_id == event_id if event_id else models.AxisObject.event_id.is_(None),
        models.AxisObject.branch_id == branch_id if branch_id else models.AxisObject.branch_id.is_(None),
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="同一作用域下已存在同名对象")
    linked = payload.get("linked_factors")
    row = models.AxisObject(
        world_id=world.id, axis=axis, name=name,
        category=str(payload.get("category") or "")[:80],
        description=str(payload.get("description") or "")[:2000],
        value=_clamp(payload.get("value")),
        scope_type=scope_type, scope_id=scope_id, event_id=event_id, branch_id=branch_id,
        linked_factors=linked if isinstance(linked, list) else [],
        source=str(payload.get("source") or "user")[:20],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _object_row(row)


@router.patch("/api/axis-objects/{object_id}")
def update_axis_object(object_id: str, payload: dict, db: Session = Depends(get_db)):
    row = db.query(models.AxisObject).filter(models.AxisObject.id == object_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="压力对象不存在")
    if "axis" in payload:
        row.axis = _axis(payload.get("axis"))
    if "name" in payload:
        name = str(payload.get("name") or "").strip()[:120]
        if not name:
            raise HTTPException(status_code=422, detail="对象名称不能为空")
        row.name = name
    if "category" in payload:
        row.category = str(payload.get("category") or "")[:80]
    if "description" in payload:
        row.description = str(payload.get("description") or "")[:2000]
    if "value" in payload:
        row.value = _clamp(payload.get("value"))
    if "linked_factors" in payload and isinstance(payload.get("linked_factors"), list):
        row.linked_factors = payload["linked_factors"]
    if "source" in payload:
        row.source = str(payload.get("source") or "user")[:20]
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _object_row(row)


@router.delete("/api/axis-objects/{object_id}")
def delete_axis_object(object_id: str, db: Session = Depends(get_db)):
    row = db.query(models.AxisObject).filter(models.AxisObject.id == object_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="压力对象不存在")
    db.delete(row)
    db.commit()
    return {"status": "removed"}


def seed_official_axis_objects(db: Session) -> int:
    """官方演示：把抽象总值拆成可解释的对象；事件层再加一组覆盖示例。"""
    world = db.query(models.World).filter(models.World.is_official.is_(True)).first()
    if not world:
        return 0
    base = {
        "scarcity": [
            ("资源", "缺乏修炼资源", "功法、丹药、灵石等修炼资源不足", 0.72),
            ("信息", "缺少情报", "对宗门与敌人掌握的信息有限", 0.64),
            ("机会", "缺少晋升机会", "外门弟子上升通道狭窄", 0.58),
        ],
        "threat": [
            ("身份威胁", "身份暴露", "掌天瓶与自身秘密可能暴露", 0.82),
            ("人身安全", "暴力冲突", "修士争斗与杀机", 0.66),
            ("制度威胁", "宗门惩罚", "门规与强者意志的惩罚", 0.60),
        ],
        "status": [
            ("组织地位", "宗门地位低下", "入门弟子在宗门中的实际地位", 0.60),
            ("社会地位", "阶层压制", "修仙界阶层差距", 0.58),
            ("权力地位", "资源分配权缺失", "无法参与资源分配决策", 0.55),
        ],
        "reputation": [
            ("公众形象", "散修出身评价", "出身带来的外界评价", 0.50),
            ("群体评价", "宗门信誉", "所在宗门与师门的信誉", 0.45),
            ("专业声誉", "能力评价", "修为与办事能力被评估", 0.52),
        ],
        "attachment": [
            ("人物关系", "师徒关系", "与墨居仁的师徒名分和情感牵绊", 0.80),
            ("地点依恋", "故乡与亲人", "对家乡与亲人的牵挂", 0.55),
            ("群体依恋", "宗门归属", "对七玄门/黄枫谷的归属感", 0.50),
        ],
        "regulation": [
            ("情绪调节", "情绪压抑", "长期隐忍与压抑", 0.55),
            ("认知调节", "认知冲突", "对师门与自身处境的认知冲突", 0.60),
            ("生理调节", "身体疲劳", "赶路、修炼与受伤后的疲劳", 0.40),
        ],
        "negentropy": [
            ("资源恢复", "灵气资源恢复", "灵气与丹药带来的恢复力", 0.35),
            ("社会恢复", "宗门秩序恢复", "宗门秩序与庇护的修复", 0.30),
            ("个体恢复", "身体疗养", "休息、治疗与身体恢复", 0.28),
        ],
    }
    # 宗门/家族/地域/势力的具象示例：对象不是抽象总值，而是具体可指认的环境。
    concrete = {
        "scarcity": [("宗门", "七玄门丹药配给不足", "七玄门药园与丹药优先供给内门，外门弟子配额有限", 0.74,
                      [{"type": "organization", "name": "七玄门"}, {"type": "resource", "name": "丹药"}]),
        ],
        "threat": [("势力", "黄枫谷与魔道势力冲突", "越国修仙界势力摩擦外溢到周边宗门与散修", 0.72,
                    [{"type": "organization", "name": "黄枫谷"}, {"type": "environment", "name": "越国修仙界"}]),
        ],
        "status": [("家族", "韩家在青牛镇的地位", "韩家作为普通山村的家族，在地方秩序中的实际位置", 0.45,
                    [{"type": "organization", "name": "韩家"}, {"type": "environment", "name": "青牛镇"}]),
        ],
        "reputation": [("宗门", "七玄门在越国的声誉", "七玄门作为地方宗门在越国修仙界的评价", 0.55,
                        [{"type": "organization", "name": "七玄门"}, {"type": "environment", "name": "越国"}]),
        ],
        "attachment": [("家族", "韩家亲情", "韩立对父母与家人的牵挂", 0.62,
                        [{"type": "character", "name": "韩立"}, {"type": "organization", "name": "韩家"}]),
        ],
        "regulation": [("宗门", "七玄门门规约束", "门规、师徒名分与药园差事带来的行为约束", 0.52,
                        [{"type": "organization", "name": "七玄门"}, {"type": "relationship", "name": "师徒"}]),
        ],
        "negentropy": [("宗门", "七玄门药园资源恢复", "药园灵药、丹药与宗门补给带来的修复力", 0.34,
                        [{"type": "organization", "name": "七玄门"}, {"type": "resource", "name": "灵药"}]),
        ],
    }
    created = 0
    for axis, rows in concrete.items():
        for category, name, description, value, linked in rows:
            exists = db.query(models.AxisObject).filter(
                models.AxisObject.world_id == world.id, models.AxisObject.axis == axis,
                models.AxisObject.name == name, models.AxisObject.event_id.is_(None),
                models.AxisObject.branch_id.is_(None),
            ).first()
            if exists:
                continue
            db.add(models.AxisObject(
                world_id=world.id, axis=axis, name=name, category=category,
                description=description, value=value, scope_type="world", source="initial",
                linked_factors=linked,
            ))
            created += 1
    for axis, rows in base.items():
        for category, name, description, value in rows:
            exists = db.query(models.AxisObject).filter(
                models.AxisObject.world_id == world.id, models.AxisObject.axis == axis,
                models.AxisObject.name == name, models.AxisObject.event_id.is_(None),
                models.AxisObject.branch_id.is_(None),
            ).first()
            if exists:
                continue
            db.add(models.AxisObject(
                world_id=world.id, axis=axis, name=name, category=category,
                description=description, value=value, scope_type="world", source="initial",
            ))
            created += 1
    event = db.query(models.Event).filter(
        models.Event.world_id == world.id, models.Event.name == "墨居仁图谋夺舍"
    ).first()
    if event:
        event_rows = [
            ("threat", "生命威胁", "夺舍", "身体与意识被侵占的直接威胁", 0.95),
            ("attachment", "人物关系", "师徒关系破裂", "师徒名分与信任的破裂", 0.90),
            ("scarcity", "时间", "修炼时间不足", "在夺舍前来不及完成自保准备", 0.70),
        ]
        for axis, category, name, description, value in event_rows:
            exists = db.query(models.AxisObject).filter(
                models.AxisObject.world_id == world.id, models.AxisObject.axis == axis,
                models.AxisObject.name == name, models.AxisObject.event_id == event.id,
            ).first()
            if exists:
                continue
            db.add(models.AxisObject(
                world_id=world.id, axis=axis, name=name, category=category,
                description=description, value=value, scope_type="event", scope_id=event.id,
                event_id=event.id, source="event",
            ))
            created += 1
    if created:
        db.commit()
    return created
