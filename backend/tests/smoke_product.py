"""I1 本地账号 / 世界归属 / 产品场景。"""

import uuid

from fastapi.testclient import TestClient

import main
import models
from database import SessionLocal

client = TestClient(main.app)
passed = 0
failed = 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} {detail}")


def main_test():
    global passed, failed
    cfg = client.get("/api/products/config").json()
    products = {row["key"]: row for row in cfg.get("products", [])}
    check("产品矩阵包含四大创作产品与云宝", set(products) == {"game", "literature", "companion", "diary", "yunbao"}, list(products))
    check("游戏首页保留 01 世界总览", products["game"]["home"] == "overview", products["game"]["home"])
    check("文学首页为 02 世界管理", products["literature"]["home"] == "world-management", products["literature"]["home"])
    check("文学移除 01 世界总览", "overview" not in products["literature"]["allowed_modules"], products["literature"]["allowed_modules"])
    lit_nav = [item["page"] for group in products["literature"]["nav_groups"] for item in group["items"]]
    check("文学侧栏不出现世界总览", "overview" not in lit_nav, lit_nav)
    check("四产品描述逐字一致", [products[key]["description"] for key in ("game", "literature", "companion", "diary")] == [
        "人物、NPC、世界规则、任务事件与多结局。",
        "人物关系、事件、故事线、平行空间与写作。",
        "私人角色、长期记忆、私聊与群聊。",
        "独立日记、人生经历、来源标签与传记。",
    ], [products[key]["description"] for key in ("game", "literature", "companion", "diary")])
    companion_nav = [item for group in products["companion"]["nav_groups"] for item in group["items"]]
    check("AI 伴侣侧栏不再出现云宝人格", not any(item["page"] == "personas" for item in companion_nav), companion_nav)
    yunbao = products["yunbao"]
    yunbao_nav = [item["page"] for group in yunbao["nav_groups"] for item in group["items"]]
    check("云宝工作台为独立首页", yunbao["home"] == "yunbao" and yunbao["auto_workspace"] is True, yunbao)
    check("云宝拥有游戏文学日记专业能力", all(page in yunbao["allowed_modules"] for page in (
        "world-management", "character-management", "writing", "diary", "storyline", "simulation",
        "personas", "memories")), yunbao["allowed_modules"])
    check("云宝侧栏包含世界与人物管理", "world-management" in yunbao_nav and "character-management" in yunbao_nav, yunbao_nav)

    me = client.get("/api/users/me")
    check("本地用户可读取", me.status_code == 200 and me.json()["id"] == "local", me.text)

    db = SessionLocal()
    official = db.query(models.World).filter(models.World.is_official.is_(True)).first()
    check("官方世界归属本地用户", bool(official and official.owner_id == "local"), official.owner_id if official else None)
    db.close()

    name = f"产品场景测试-{uuid.uuid4().hex[:6]}"
    created = client.post("/api/worlds", json={
        "name": name, "type": "fiction", "product_scene": "literature",
    })
    check("创建文学场景世界", created.status_code == 200 and created.json().get("product_scene") == "literature", created.text)
    wid = created.json()["id"]

    lit = client.get("/api/worlds?product_scene=literature").json()
    check("按场景筛选命中", any(w["id"] == wid for w in lit))
    game = client.get("/api/worlds?product_scene=game").json()
    check("按场景筛选排除", all(w["id"] != wid for w in game))

    bad = client.post("/api/worlds", json={"name": f"bad-{uuid.uuid4().hex[:6]}", "product_scene": "unknown"})
    check("非法场景被拒", bad.status_code == 422, bad.text)

    client.delete(f"/api/worlds/{wid}")
    from world_lifecycle import _cascade_delete_world
    db = SessionLocal()
    row = db.query(models.World).filter(models.World.id == wid).first()
    if row:
        _cascade_delete_world(db, wid)
        db.delete(row)
        db.commit()
    db.close()
    print(f"\n===== {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main_test())
