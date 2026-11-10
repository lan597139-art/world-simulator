"""官方故事线演示数据验收：幂等、结构、独立事件、六轴。"""

import models
from database import SessionLocal
from official_storyline import ensure_official_storyline

passed = 0
failed = 0


def check(name, condition, extra=None):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} extra={extra}")


db = SessionLocal()
try:
    world = db.query(models.World).filter(models.World.is_official.is_(True)).first()
    check("官方世界存在", world is not None, world)
    wid = world.id

    story = db.query(models.StoryProject).filter(models.StoryProject.official_key == "fanren-main").first()
    check("官方故事已导入", story is not None and story.world_id == wid, story)

    spaces = db.query(models.StorySpace).filter(models.StorySpace.story_id == story.id).all()
    names = {space.name for space in spaces}
    check("正史与出逃线空间", names == {"正史", "出逃线"}, names)
    original = next((space for space in spaces if space.is_original), None)
    escape = next((space for space in spaces if space.name == "出逃线"), None)
    check("正史空间不绑分支", original is not None and original.branch_id is None, original)
    check("出逃线绑定分支", escape is not None and bool(escape.branch_id), escape)

    escape_events = (
        db.query(models.Event)
        .filter(models.Event.world_id == wid, models.Event.branch_id == escape.branch_id)
        .all()
    )
    check("出逃线有 3 条独立事件", len(escape_events) == 3, [e.name for e in escape_events])

    links = (
        db.query(models.StoryUnitEvent)
        .filter(models.StoryUnitEvent.unit_id.in_([unit.id for unit in db.query(models.StoryUnit).filter(models.StoryUnit.space_id == escape.id).all()]))
        .all()
    )
    check("出逃线事件已挂单元", len(links) == 4, len(links))

    endings = db.query(models.StoryEnding).filter(models.StoryEnding.story_id == story.id).all()
    kinds = {(ending.name, ending.kind) for ending in endings}
    check("正史最终结局", ("反杀后入黄枫谷", "final") in kinds, kinds)
    check("出逃线开放结局", ("亡命未定", "open") in kinds, kinds)

    empty_participants = [
        event.name for event in db.query(models.Event).filter(models.Event.world_id == wid).all()
        if not (event.participants or [])
    ]
    check("事件参与者已回填", empty_participants == [], empty_participants)

    empty_chapters = (
        db.query(models.Story)
        .filter(models.Story.world_id == wid, models.Story.title == "第 3 章", models.Story.word_count == 0)
        .count()
    )
    check("空章节已清理", empty_chapters == 0, empty_chapters)

    axis = (world.settings or {}).get("six_axis") or {}
    check("演示六轴已填", len(axis) == 6, axis)

    again = ensure_official_storyline(db)
    count = db.query(models.StoryProject).filter(models.StoryProject.official_key == "fanren-main").count()
    check("重复导入幂等", again.get("status") == "exists" and count == 1, (again, count))
finally:
    db.close()

print(f"===== {passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)
