"""为《凡人修仙传》官方演示故事生成真实故事树（幂等）。

只引用既有 05 事件和人物；不复制事件，不生成新剧情文本。
"""

from sqlalchemy.orm import Session

import models


BRANCHES = [
    {
        "title": "凡人修仙传 · 七玄门篇",
        "kind": "main",
        "character": "韩立",
        "events": [
            "韩立入七玄门", "墨居仁收韩立为记名弟子", "韩立初得掌天瓶",
            "墨居仁毒害张铁", "墨居仁图谋夺舍", "韩立反杀墨居仁",
            "韩立离开七玄门", "韩立通过黄枫谷入门测试",
        ],
        "pending": "待填充：主线后续",
    },
    {
        "title": "韩立人物线",
        "kind": "side",
        "character": "韩立",
        "events": ["韩立入七玄门", "韩立反杀墨居仁", "韩立离开七玄门"],
        "pending": "待填充：韩立人物线",
    },
    {
        "title": "七玄门入门（副本）",
        "kind": "copy",
        "character": "韩立",
        "events": ["韩立入七玄门", "墨居仁收韩立为记名弟子", "韩立初得掌天瓶"],
        "pending": "待填充：七玄门入门副本",
    },
    {
        "title": "墨居仁夺舍暗线",
        "kind": "shadow",
        "character": "墨居仁",
        "events": ["墨居仁收韩立为记名弟子", "墨居仁毒害张铁", "墨居仁图谋夺舍"],
        "pending": "待填充：夺舍暗线",
    },
    {
        "title": "出逃线（副本）",
        "kind": "copy",
        "character": "韩立",
        "events": ["墨居仁图谋夺舍", "韩立连夜出逃", "韩立坊市藏身", "墨居仁旧部追查"],
        "pending": "待填充：出逃后续",
    },
]


def seed_official_tree(db: Session) -> int:
    story = db.query(models.StoryProject).filter(models.StoryProject.official_key == "fanren-main").first()
    if not story:
        return 0
    wid = story.world_id
    events = {
        event.name: event
        for event in db.query(models.Event).filter(models.Event.world_id == wid).all()
    }
    characters = {
        char.name: char
        for char in db.query(models.Character).filter(models.Character.world_id == wid).all()
    }
    existing_threads = {
        thread.title: thread
        for thread in db.query(models.StoryThread).filter(models.StoryThread.story_id == story.id).all()
    }
    created = 0
    trunk = existing_threads.get(BRANCHES[0]["title"])
    if not trunk:
        trunk = models.StoryThread(
            story_id=story.id, world_id=wid,
            character_id=(characters.get(BRANCHES[0]["character"]).id if characters.get(BRANCHES[0]["character"]) else None),
            kind="main", title=BRANCHES[0]["title"], order_index=0,
            meta={"official_demo": True},
        )
        db.add(trunk); db.flush(); existing_threads[trunk.title] = trunk; created += 1

    for branch_index, spec in enumerate(BRANCHES):
        thread = existing_threads.get(spec["title"])
        if not thread:
            char = characters.get(spec["character"])
            thread = models.StoryThread(
                story_id=story.id, world_id=wid,
                character_id=char.id if char else None,
                parent_thread_id=trunk.id if spec["kind"] != "main" else None,
                kind=spec["kind"], title=spec["title"], order_index=branch_index,
                meta={"official_demo": True},
            )
            db.add(thread); db.flush(); existing_threads[thread.title] = thread; created += 1
        exists = {
            node.event_id
            for node in db.query(models.StoryTreeNode).filter(models.StoryTreeNode.thread_id == thread.id).all()
        }
        order = 0
        for name in spec["events"]:
            event = events.get(name)
            if not event or event.id in exists:
                continue
            db.add(models.StoryTreeNode(
                world_id=wid, story_id=story.id, thread_id=thread.id,
                event_id=event.id, title=event.name, node_status="filled",
                order_index=order, meta={"official_demo": True},
            ))
            exists.add(event.id); order += 1; created += 1
        pending = db.query(models.StoryTreeNode).filter(
            models.StoryTreeNode.thread_id == thread.id,
            models.StoryTreeNode.event_id.is_(None),
            models.StoryTreeNode.title == spec["pending"],
        ).first()
        if not pending:
            db.add(models.StoryTreeNode(
                world_id=wid, story_id=story.id, thread_id=thread.id,
                event_id=None, title=spec["pending"], node_status="pending",
                order_index=order, meta={"official_demo": True},
            ))
            created += 1
    if created:
        db.commit()
    return created
