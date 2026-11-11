"""补充整改演示：同一事件的两条分支沙盒 + 分支级压强覆盖。

只使用官方既有事件与人物；分支快照复用多路径引擎，不复制事件。
"""

from sqlalchemy.orm import Session

import models


DEMOS = [
    {
        "branch": "沙盒演示 · 夺舍高压线",
        "scenario": "夺舍高压方案",
        "note": "同一事件，威胁/依恋压力极高，缺少外部缓冲，观察人物如何被迫行动。",
        "axis": [
            ("threat", "夺舍", "生命威胁", "夺舍直接发生，几乎没有缓冲时间", 0.99),
            ("attachment", "师徒关系破裂", "人物关系", "师徒信任彻底破裂，情感牵制变成压力", 0.95),
            ("negentropy", "宗门外援", "社会恢复", "几乎没有可用的外部援助", 0.08),
        ],
        "preset_options": [
            {"text": "不求助，独自应对", "description": "人物只能在现有能力内反应。"},
            {"text": "先保命再反制", "description": "把生存置于揭露真相之前。"},
        ],
        "constraints": [
            {"text": "不得凭空获得外援或高阶功法", "kind": "limit"},
            {"text": "必须保留原事件的夺舍因果", "kind": "must"},
        ],
        "supports": [
            {"text": "人物已察觉部分异常", "kind": "support"},
        ],
        "potentials": [
            {"text": "墨居仁的元神可能已有损伤", "kind": "potential", "status": "potential"},
        ],
        "factors": [
            {"text": "墨居仁", "name": "墨居仁", "type": "character"},
            {"text": "七玄门药园", "name": "七玄门药园", "type": "environment"},
        ],
    },
    {
        "branch": "沙盒演示 · 外援缓冲线",
        "scenario": "外援缓冲方案",
        "note": "同一事件，威胁下降、负熵上升，观察外部支援如何改变人物选择。",
        "axis": [
            ("threat", "夺舍", "生命威胁", "夺舍威胁仍在，但出现缓冲时间", 0.58),
            ("attachment", "师徒关系破裂", "人物关系", "师徒关系仍有表面名分，破裂被延后", 0.55),
            ("negentropy", "宗门外援", "社会恢复", "存在可求援的宗门关系与恢复资源", 0.58),
        ],
        "preset_options": [
            {"text": "先向宗门示警", "description": "把个人危机转为组织可介入的事件。"},
            {"text": "拖延并寻找证据", "description": "争取时间验证夺舍图谋。"},
        ],
        "constraints": [
            {"text": "外援介入需要时间，不能瞬间到场", "kind": "limit"},
        ],
        "supports": [
            {"text": "人物与宗门保持可用的联系", "kind": "support"},
            {"text": "药园资源可支撑短期恢复", "kind": "support"},
        ],
        "potentials": [
            {"text": "外援是否来得及仍不确定", "kind": "potential", "status": "potential"},
        ],
        "factors": [
            {"text": "七玄门", "name": "七玄门", "type": "organization"},
            {"text": "药园灵药", "name": "药园灵药", "type": "resource"},
        ],
    },
]


def seed_supplement_demo(db: Session) -> int:
    world = db.query(models.World).filter(models.World.is_official.is_(True)).first()
    if not world:
        return 0
    event = db.query(models.Event).filter(
        models.Event.world_id == world.id,
        models.Event.name == "墨居仁图谋夺舍",
        models.Event.branch_id.is_(None),
    ).first()
    if not event:
        return 0
    from multipath import create_branch
    created = 0
    for spec in DEMOS:
        branch = db.query(models.SimulationBranch).filter(
            models.SimulationBranch.world_id == world.id,
            models.SimulationBranch.root_event_id == event.id,
            models.SimulationBranch.name == spec["branch"],
        ).first()
        if not branch:
            row = create_branch({
                "root_event_id": event.id, "name": spec["branch"],
                "note": "补充整改演示：同一事件的分支沙盒差异",
            }, db)
            branch = db.query(models.SimulationBranch).filter(models.SimulationBranch.id == row["id"]).first()
            created += 1
        scenario = db.query(models.EventSandboxScenario).filter(
            models.EventSandboxScenario.event_id == event.id,
            models.EventSandboxScenario.title == spec["scenario"],
        ).first()
        if not scenario:
            db.add(models.EventSandboxScenario(
                world_id=world.id, event_id=event.id, title=spec["scenario"], note=spec["note"],
                preset_options=spec["preset_options"], constraints=spec["constraints"],
                supports=spec["supports"], potentials=spec["potentials"], factors=spec["factors"],
                branch_id=branch.id if branch else None, status="active",
            ))
            created += 1
        elif branch and scenario.branch_id != branch.id:
            scenario.branch_id = branch.id
            db.add(scenario)
        for axis, name, category, description, value in spec["axis"]:
            exists = db.query(models.AxisObject).filter(
                models.AxisObject.world_id == world.id,
                models.AxisObject.branch_id == branch.id,
                models.AxisObject.axis == axis,
                models.AxisObject.name == name,
            ).first()
            if exists:
                continue
            db.add(models.AxisObject(
                world_id=world.id, axis=axis, name=name, category=category,
                description=description, value=value, scope_type="branch",
                scope_id=branch.id, branch_id=branch.id, source="initial",
            ))
            created += 1
    if created:
        db.commit()
    return created
