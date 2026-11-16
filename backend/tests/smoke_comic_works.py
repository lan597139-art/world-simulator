"""H 首版：漫画章节、图片页、排序、作品图片库与场景校验。"""

import uuid

from fastapi.testclient import TestClient

import main
import models
from database import SessionLocal

client = TestClient(main.app)
passed = failed = 0
work_id = ""


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} {detail}")


def run():
    global work_id
    suffix = uuid.uuid4().hex[:6]
    created = client.post("/api/creative-works", json={
        "scene": "comic", "title": f"漫画验收-{suffix}", "category": "条漫", "status": "draft",
    })
    check("创建漫画作品", created.status_code == 200, created.text)
    work_id = created.json()["id"]
    empty = client.get(f"/api/comic-works/{work_id}")
    check("工作台空态", empty.status_code == 200 and empty.json()["chapters"] == [], empty.text)

    chapter = client.post(f"/api/comic-works/{work_id}/chapters", json={"title": "第一话", "summary": "开场"})
    check("创建章节", chapter.status_code == 200 and chapter.json()["title"] == "第一话", chapter.text)
    chapter_id = chapter.json()["id"]

    page1 = client.post(f"/api/comic-works/{work_id}/chapters/{chapter_id}/pages", json={
        "image_url": "/uploads/test/p1.svg", "caption": "第一页", "kind": "page",
    })
    page2 = client.post(f"/api/comic-works/{work_id}/chapters/{chapter_id}/pages", json={
        "image_url": "/uploads/test/p2.svg", "caption": "第二页", "kind": "strip",
    })
    check("上传两张页面", page1.status_code == 200 and page2.status_code == 200, page1.text + page2.text)
    p1, p2 = page1.json()["id"], page2.json()["id"]

    updated = client.patch(f"/api/comic-works/{work_id}/pages/{p1}", json={"caption": "改后的图注", "kind": "panel"})
    check("编辑页面说明/类型", updated.status_code == 200 and updated.json()["caption"] == "改后的图注", updated.text)
    reordered = client.post(f"/api/comic-works/{work_id}/chapters/{chapter_id}/pages/reorder", json={"page_ids": [p2, p1]})
    check("页面排序", reordered.status_code == 200 and reordered.json()["chapters"][0]["pages"][0]["id"] == p2, reordered.text)

    asset = client.post(f"/api/comic-works/{work_id}/assets", json={
        "title": "角色立绘", "file_url": "/uploads/test/char.svg", "kind": "character",
    })
    check("作品图片库入库", asset.status_code == 200 and asset.json()["kind"] == "character", asset.text)
    asset_id = asset.json()["id"]

    chapter_order = client.post(f"/api/comic-works/{work_id}/chapters/reorder", json={"chapter_ids": [chapter_id]})
    check("章节排序", chapter_order.status_code == 200, chapter_order.text)
    bad_kind = client.post(f"/api/comic-works/{work_id}/chapters/{chapter_id}/pages", json={"image_url": "/x.png", "kind": "video"})
    check("非法页面类型", bad_kind.status_code == 422, bad_kind.text)
    no_image = client.post(f"/api/comic-works/{work_id}/chapters/{chapter_id}/pages", json={"caption": "无图"})
    check("页面必须有图片", no_image.status_code == 422, no_image.text)

    other = client.post("/api/creative-works", json={"scene": "literature", "title": "不是漫画", "category": "短篇小说"})
    not_comic = client.get(f"/api/comic-works/{other.json()['id']}")
    check("非漫画作品拒绝进入", not_comic.status_code == 422, not_comic.text)

    deleted_chapter = client.delete(f"/api/comic-works/{work_id}/chapters/{chapter_id}")
    check("删除章节", deleted_chapter.status_code == 200, deleted_chapter.text)
    after = client.get(f"/api/comic-works/{work_id}")
    check("章节删除后页面清零", after.status_code == 200 and after.json()["page_count"] == 0, after.text)

    client.delete(f"/api/comic-works/{work_id}/assets/{asset_id}")
    client.delete(f"/api/creative-works/{work_id}")
    client.delete(f"/api/creative-works/{other.json()['id']}")


try:
    run()
finally:
    if work_id:
        db = SessionLocal()
        db.query(models.ComicPage).filter(models.ComicPage.work_id == work_id).delete(synchronize_session=False)
        db.query(models.ComicChapter).filter(models.ComicChapter.work_id == work_id).delete(synchronize_session=False)
        db.query(models.ComicAsset).filter(models.ComicAsset.work_id == work_id).delete(synchronize_session=False)
        db.query(models.CreativeWork).filter(models.CreativeWork.id == work_id).delete(synchronize_session=False)
        db.commit()
        db.close()

print(f"===== {passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)
