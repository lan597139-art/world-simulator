"""四产品配置层、权限、产品工作空间与数据隔离。"""

import uuid

from fastapi.testclient import TestClient

import main
import models
from database import SessionLocal
from world_lifecycle import _cascade_delete_world

client = TestClient(main.app)
passed = failed = 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} {str(detail)[:400]}")


def run():
    global passed, failed
    suffix = uuid.uuid4().hex[:6]

    # 1. 配置矩阵
    matrix = client.get("/api/products/config")
    check("产品配置矩阵可读", matrix.status_code == 200, matrix.text)
    body = matrix.json()
    keys = [p["key"] for p in body["products"]]
    check("四种产品齐全", keys == ["game", "literature", "companion", "diary"], keys)
    by_key = {p["key"]: p for p in body["products"]}
    check("游戏开放完整世界与故事线",
          all(m in by_key["game"]["allowed_modules"] for m in (
              "world-management", "world-structure", "world-data",
              "simulation", "storyline", "writing", "character-management")), by_key["game"])
    check("文学保留模拟但标记辅助模式",
          by_key["literature"]["modes"]["simulation"] == "auxiliary"
          and "simulation" in by_key["literature"]["allowed_modules"], by_key["literature"]["modes"])
    for forbidden in ("world-management", "world-structure", "world-data", "storyline", "simulation"):
        check(f"AI伴侣不开放 {forbidden}", forbidden not in by_key["companion"]["allowed_modules"],
              by_key["companion"]["allowed_modules"])
    for forbidden in ("world-management", "world-structure", "world-data", "simulation", "storyline"):
        check(f"日记不开放 {forbidden}", forbidden not in by_key["diary"]["allowed_modules"],
              by_key["diary"]["allowed_modules"])
    check("伴侣开放人格/记忆/人格运行",
          all(m in by_key["companion"]["allowed_modules"] for m in (
              "personas", "memories", "companion-runtime", "chat")), by_key["companion"])
    check("日记开放信息来源管理",
          "information-sources" in by_key["diary"]["allowed_modules"], by_key["diary"])

    access = client.get("/api/products/companion/access/world-management")
    check("模块权限接口拒绝未开放模块", access.status_code == 200 and access.json()["allowed"] is False,
          access.text)
    access2 = client.get("/api/products/game/access/storyline")
    check("模块权限接口允许游戏故事线", access2.json()["allowed"] is True, access2.text)

    # 2. 世界产品隔离
    game_world = client.post("/api/worlds", json={
        "name": f"产品游戏世界-{suffix}", "type": "fiction", "product_scene": "game",
    }).json()
    lit_world = client.post("/api/worlds", json={
        "name": f"产品文学世界-{suffix}", "type": "fiction", "product_scene": "literature",
    }).json()
    game_rows = client.get("/api/worlds?product_scene=game").json()
    lit_rows = client.get("/api/worlds?product_scene=literature").json()
    check("世界按产品隔离：游戏", any(w["id"] == game_world["id"] for w in game_rows)
          and all(w["id"] != lit_world["id"] for w in game_rows))
    check("世界按产品隔离：文学", any(w["id"] == lit_world["id"] for w in lit_rows)
          and all(w["id"] != game_world["id"] for w in lit_rows))

    # 3. 自动工作空间（伴侣/日记），且重复调用不新建
    comp_before = client.get("/api/products/companion/workspace").json().get("world")
    diary_before = client.get("/api/products/diary/workspace").json().get("world")
    comp = client.post("/api/products/companion/workspace")
    check("伴侣自动工作空间", comp.status_code == 200 and comp.json()["world"]["is_product_workspace"] is True,
          comp.text)
    comp_id = comp.json()["world"]["id"]
    if comp_before:
        check("伴侣工作空间读取已有空间", comp_id == comp_before["id"], comp_before)
    comp2 = client.post("/api/products/companion/workspace")
    check("伴侣工作空间幂等", comp2.json()["world"]["id"] == comp_id, comp2.text)
    diary_ws = client.post("/api/products/diary/workspace")
    check("日记自动工作空间", diary_ws.status_code == 200 and diary_ws.json()["world"]["product_scene"] == "diary",
          diary_ws.text)
    diary_id = diary_ws.json()["world"]["id"]
    check("产品工作空间不出现在普通世界列表",
          all(w["id"] != comp_id for w in client.get("/api/worlds?include_workspace=false").json()))
    no_auto = client.post("/api/products/game/workspace")
    check("游戏/文学不创建隐藏工作空间", no_auto.status_code == 409, no_auto.text)
    bad_world = client.post("/api/worlds", json={
        "name": f"错误产品世界-{suffix}", "type": "fiction", "product_scene": "companion",
    })
    check("伴侣产品拒绝普通世界创建", bad_world.status_code == 403, bad_world.text)

    # 4. 人物/角色挂在产品世界下，工作空间人物不进入文学世界
    gc = client.post("/api/characters", json={"world_id": game_world["id"], "name": f"游戏人物-{suffix}"}).json()
    lc = client.post("/api/characters", json={"world_id": lit_world["id"], "name": f"文学人物-{suffix}"}).json()
    check("人物按世界隔离", gc["world_id"] != lc["world_id"])

    # 5. 人格产品隔离
    persona = client.post("/api/personas", json={
        "name": f"伴侣人格-{suffix}", "identity": "伴侣产品个人 AI", "product_key": "companion",
    })
    check("伴侣人格创建", persona.status_code == 200 and persona.json()["product_key"] == "companion",
          persona.text)
    pid = persona.json()["id"]
    bad_persona = client.post("/api/personas", json={"name": "错误产品人格", "product_key": "game"})
    check("非伴侣产品拒绝创建人格", bad_persona.status_code == 403, bad_persona.text)
    check("伴侣人格列表可读", any(p["id"] == pid for p in client.get("/api/personas?product=companion").json()))
    check("游戏产品不能读取人格", client.get("/api/personas?product=game").status_code == 403)

    # 6. 日记产品隔离与来源类型
    diary_entry = client.post("/api/diary/entries", json={
        "content": "日记产品测试", "entry_date": "2026-11-12", "source_type": "self_memory",
        "product_key": "diary",
    })
    check("日记记录带产品与来源", diary_entry.status_code == 200
          and diary_entry.json()["product_key"] == "diary"
          and diary_entry.json()["source_type"] == "self_memory", diary_entry.text)
    did = diary_entry.json()["id"]
    check("日记列表按产品隔离", any(e["id"] == did for e in client.get("/api/diary/entries?product=diary").json()))
    check("游戏产品不能读取日记", client.get("/api/diary/entries?product=game").status_code == 403)
    bad_diary = client.post("/api/diary/entries", json={
        "content": "错误产品日记", "product_key": "literature",
    })
    check("非日记产品拒绝写日记", bad_diary.status_code == 403, bad_diary.text)

    # 7. 信息来源管理 + AI 推断不自动成事实
    presets = client.get("/api/information-sources/presets").json()
    check("来源类型包含本人/他人/证据/AI推断",
          {x["key"] for x in presets["source_types"]} >= {"self_memory", "other_account", "evidence", "ai_inference"},
          presets)
    inference = client.post("/api/information-sources", json={
        "product_key": "diary", "title": "AI 推测的旧事", "content": "可能是 1998 年发生",
        "source_type": "ai_inference", "character_id": lc["id"],
    })
    check("AI 推断默认未确认且状态 inference", inference.status_code == 200
          and inference.json()["status"] == "inference" and inference.json()["confirmed"] is False,
          inference.text)
    iid = inference.json()["id"]
    bad_confirm = client.patch(f"/api/information-sources/{iid}", json={"status": "confirmed"})
    check("AI 推断不能直接改成事实", bad_confirm.status_code == 409, bad_confirm.text)
    promoted = client.post(f"/api/information-sources/{iid}/confirm")
    check("用户显式确认后可成事实", promoted.status_code == 200
          and promoted.json()["status"] == "confirmed" and promoted.json()["confirmed"] is True,
          promoted.text)
    evidence = client.post("/api/information-sources", json={
        "product_key": "diary", "title": "旧照片", "content": "照片背面日期",
        "source_type": "evidence", "status": "confirmed",
    })
    check("他人叙述/资料证据可保存", evidence.status_code == 200, evidence.text)
    eid = evidence.json()["id"]
    check("信息来源按人物筛选", all(x["character_id"] == lc["id"]
          for x in client.get(f"/api/information-sources?character_id={lc['id']}").json()))
    check("游戏产品不能读取信息来源",
          client.get("/api/information-sources?product=game").status_code == 403)
    check("删除信息来源", client.delete(f"/api/information-sources/{eid}").status_code == 200)

    # cleanup：只删测试数据，保留用户正式数据。
    client.delete(f"/api/diary/entries/{did}")
    client.delete(f"/api/personas/{pid}")
    db = SessionLocal()
    db.query(models.InformationSource).filter(models.InformationSource.id == iid).delete()
    db.commit()
    if bad_world.status_code == 200:
        created_bad_world = db.query(models.World).filter(
            models.World.name == f"错误产品世界-{suffix}"
        ).first()
        if created_bad_world:
            cleanup_worlds_extra = [created_bad_world.id]
        else:
            cleanup_worlds_extra = []
    else:
        cleanup_worlds_extra = []
    cleanup_worlds = [game_world["id"], lit_world["id"], *cleanup_worlds_extra]
    if not comp_before:
        cleanup_worlds.append(comp_id)
    if not diary_before:
        cleanup_worlds.append(diary_id)
    # 清理历史失败运行可能留下的测试世界，不触碰正式世界。
    for stale in db.query(models.World).filter(models.World.name.like("错误产品世界-%")).all():
        if stale.id not in cleanup_worlds:
            cleanup_worlds.append(stale.id)
    for wid in cleanup_worlds:
        row = db.query(models.World).filter(models.World.id == wid).first()
        if row:
            _cascade_delete_world(db, wid)
            db.delete(row)
    db.commit()
    db.close()

    print(f"\n===== {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(run())
