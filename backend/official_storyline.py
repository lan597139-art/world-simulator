"""官方演示故事线：把《凡人修仙传》既有事件整理为「正史 + 出逃线」。

- 只使用既有 9 个事件作为正史；出逃线 3 个事件为演示补充数据（G2 已确认）。
- 幂等：以 story_projects.official_key 为标记，已存在则跳过。
- 状态隔离：出逃线绑定推演分支，事件带 branch_id；正史空间不绑定分支。
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

import models
import multipath as mp

OFFICIAL_KEY = "fanren-main"

DEMO_SIX_AXIS = {
    "scarcity": 0.7,
    "threat": 0.8,
    "status": 0.6,
    "reputation": 0.5,
    "attachment": 0.4,
    "regulation": 0.5,
}


def _event_by_name(db: Session, world_id: str, name: str):
    return (
        db.query(models.Event)
        .filter(models.Event.world_id == world_id, models.Event.name == name, models.Event.branch_id.is_(None))
        .first()
    )


def ensure_official_storyline(db: Session) -> dict | None:
    world = db.query(models.World).filter(models.World.is_official.is_(True)).first()
    if not world or world.deleted_at is not None:
        return None
    existing = (
        db.query(models.StoryProject)
        .filter(models.StoryProject.official_key == OFFICIAL_KEY)
        .first()
    )
    if existing:
        return {"status": "exists", "story_id": existing.id}

    events = {}
    for name in (
        "韩立入七玄门",
        "墨居仁收韩立为记名弟子",
        "韩立初得掌天瓶",
        "南宫婉筑基成功",
        "墨居仁毒害张铁",
        "墨居仁图谋夺舍",
        "韩立反杀墨居仁",
        "韩立离开七玄门",
        "韩立通过黄枫谷入门测试",
    ):
        event = _event_by_name(db, world.id, name)
        if event:
            events[name] = event
    anchor = events.get("墨居仁图谋夺舍")
    if not anchor:
        return None

    settings = dict(world.settings or {})
    if not settings.get("six_axis"):
        settings["six_axis"] = dict(DEMO_SIX_AXIS)
        settings.setdefault("negentropy", 0.4)
        world.settings = settings

    story = models.StoryProject(
        world_id=world.id,
        title="凡人修仙传 · 七玄门篇",
        premise="一个凡人少年在七玄门药园起步，因墨居仁夺舍之局被迫做出生死抉择。",
        status="active",
        settings={"core_goal": "活下来，并找到可验证的上升通道", "core_conflict": "资源匮乏与强者随意改写规则"},
        official_key=OFFICIAL_KEY,
    )
    db.add(story)
    db.flush()

    original = models.StorySpace(
        story_id=story.id,
        world_id=world.id,
        name="正史",
        is_original=True,
        status="active",
        summary="按既有主线事件发展的原始空间。",
    )
    db.add(original)
    db.flush()

    def unit(space_id: str, kind: str, title: str, summary: str, order: int):
        row = models.StoryUnit(
            story_id=story.id,
            world_id=world.id,
            space_id=space_id,
            kind=kind,
            title=title,
            summary=summary,
            order_index=order,
            status="active",
        )
        db.add(row)
        db.flush()
        return row

    def link(unit_row, event, role: str = "normal", shared: bool = False):
        row = models.StoryUnitEvent(
            world_id=world.id,
            unit_id=unit_row.id,
            event_id=event.id,
            role=role,
            order_index=0,
            is_shared=shared,
        )
        db.add(row)
        return row

    intro = unit(original.id, "mainline", "七玄门入门", "凡人少年踏入修仙门槛。", 0)
    for name in ("韩立入七玄门", "墨居仁收韩立为记名弟子", "韩立初得掌天瓶"):
        if name in events:
            link(intro, events[name])

    side = unit(original.id, "side", "张铁之死", "药园同伴的灭口事件，构成韩立对墨居仁的警觉。", 1)
    if "墨居仁毒害张铁" in events:
        link(side, events["墨居仁毒害张铁"])

    climax = unit(original.id, "mainline", "夺舍与反杀", "墨居仁图谋夺舍，韩立反杀并离开七玄门。", 2)
    for name, role in (
        ("墨居仁图谋夺舍", "choice"),
        ("韩立反杀墨居仁", "climax"),
        ("韩立离开七玄门", "normal"),
        ("韩立通过黄枫谷入门测试", "ending"),
    ):
        if name in events:
            link(climax, events[name], role=role)

    choice = models.StoryChoice(
        story_id=story.id,
        world_id=world.id,
        space_id=original.id,
        anchor_event_id=anchor.id,
        title="夺舍之夜：反杀还是出逃",
        description="墨居仁身负重伤、图谋夺舍。韩立只有一次选择。",
        precondition={"anchor_event": anchor.name},
        allow_rejoin=False,
        status="open",
    )
    db.add(choice)
    db.flush()

    option_a = models.StoryChoiceOption(
        world_id=world.id,
        choice_id=choice.id,
        label="反杀",
        description="按正史：识破夺舍，以毒计反杀墨居仁。",
        consequence="进入正史空间，离开七玄门，赴黄枫谷。",
        target_space_id=original.id,
        source="user",
        confirmed=True,
        order_index=0,
    )
    option_b = models.StoryChoiceOption(
        world_id=world.id,
        choice_id=choice.id,
        label="出逃",
        description="不正面反杀，连夜逃离七玄门。",
        consequence="进入出逃线，开始亡命与藏身。",
        source="user",
        confirmed=True,
        order_index=1,
    )
    db.add_all([option_a, option_b])
    db.flush()

    # 出逃线：绑定分支，拥有独立后续事件。
    branch_info = mp.create_branch(
        {
            "root_event_id": anchor.id,
            "name": "凡人修仙传 · 出逃线",
            "note": "官方演示：夺舍之夜选择出逃",
        },
        db,
    )
    escape = models.StorySpace(
        story_id=story.id,
        world_id=world.id,
        name="出逃线",
        is_original=False,
        parent_space_id=original.id,
        fork_choice_id=choice.id,
        branch_id=branch_info["id"],
        status="active",
        summary="韩立没有反杀，而是连夜出逃；后续事件只属于本空间。",
    )
    db.add(escape)
    db.flush()
    option_b.target_space_id = escape.id
    choice.status = "resolved"
    choice.resolved_option_id = option_b.id

    hanli = db.query(models.Character).filter(models.Character.world_id == world.id, models.Character.name == "韩立").first()
    participants = [hanli.id] if hanli else []
    escape_events = [
        ("韩立连夜出逃", "韩立察觉夺舍意图后没有正面动手，趁夜色从药园后山逃离七玄门。", "威胁", "高", datetime(1023, 9, 1, 23, 30)),
        ("韩立坊市藏身", "韩立辗转至附近坊市，以杂役身份藏身，靠辨药手艺换取灵石。", "稳定", "中", datetime(1023, 9, 3, 10, 0)),
        ("墨居仁旧部追查", "墨居仁旧部循着药园线索追查失踪弟子，韩立被迫再次转移。", "威胁", "高", datetime(1023, 9, 5, 16, 0)),
    ]
    created_events = []
    for name, description, polarity, intensity, occurred_at in escape_events:
        event = models.Event(
            world_id=world.id,
            branch_id=branch_info["id"],
            name=name,
            description=description,
            polarity=polarity,
            intensity=intensity,
            occurred_at=occurred_at,
            story_time="1023年9月",
            participants=participants,
            domain=["生存", "逃亡"],
            scale="个人",
        )
        db.add(event)
        db.flush()
        created_events.append(event)

    escape_unit = unit(escape.id, "mainline", "亡命出逃", "出逃后的独立后续：逃亡、藏身、被追查。", 0)
    link(escape_unit, anchor, role="choice", shared=True)
    for event in created_events:
        link(escape_unit, event)

    db.add_all(
        [
            models.StoryEnding(
                story_id=story.id,
                world_id=world.id,
                space_id=original.id,
                name="反杀后入黄枫谷",
                content="韩立识破夺舍、反杀墨居仁，离开七玄门，最终通过黄枫谷入门测试。",
                kind="final",
                is_final=True,
                path_event_ids=[events[name].id for name in ("墨居仁图谋夺舍", "韩立反杀墨居仁", "韩立离开七玄门", "韩立通过黄枫谷入门测试") if name in events],
                precondition={"anchor": anchor.name},
            ),
            models.StoryEnding(
                story_id=story.id,
                world_id=world.id,
                space_id=escape.id,
                name="亡命未定",
                content="韩立逃离七玄门，藏身坊市，又被墨居仁旧部追查；前路未定。",
                kind="open",
                is_final=False,
                path_event_ids=[event.id for event in created_events],
                precondition={"anchor": anchor.name},
            ),
        ]
    )
    db.commit()
    return {"status": "created", "story_id": story.id, "escape_space_id": escape.id}
