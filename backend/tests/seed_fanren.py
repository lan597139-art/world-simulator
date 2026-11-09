"""《凡人修仙传》验收数据种子（完整版）。

覆盖世界结构的八个分支 + 世界建设配置 + 五个人物的种子档案：
  世界 → 时间/时代 → 地理 → 组织/职位/任职 → 社会/群体 → 规则
  → 资源/持有/流水 → 人物 → 事件/因果/认知/影响 → 关系 → 目录节点 → 时间线

运行：
  python3 backend/tests/seed_fanren.py          # 已存在同名世界则退出
  python3 backend/tests/seed_fanren.py --reset  # 删除同名世界后重建

只通过公开 API 写入，不直接改数据库。
"""

import json
import sys
import urllib.error
import urllib.request

from fanren_characters import build as build_characters

BASE = "http://127.0.0.1:8000/api"
WORLD_NAME = "凡人修仙传"


def call(method: str, path: str, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            payload = resp.read().decode()
            code = resp.status
    except urllib.error.HTTPError as exc:
        code = exc.code
        payload = exc.read().decode()
    try:
        parsed = json.loads(payload) if payload else None
    except ValueError:
        parsed = payload
    if code >= 400:
        raise RuntimeError(f"{method} {path} -> {code}: {parsed}")
    return parsed


# ======================================================================
# 世界建设配置：121 个字段，全部使用界面里真实存在的选项 id
# ======================================================================
WORLD_SELECTIONS = {
    "era": ["stable_growth"],
    "growth_tailwind": ["neutral"],
    "future_believability": ["high"],
    "elite_capture": ["high"],
    "future_expectation": ["cautious"],
    "ideologies": ["traditionalism", "collectivism", "imperialism"],
    "philosophy": ["daoism", "cultivation", "legalism"],
    "thought_control": ["orthodox"],
    "orthodoxy_strength": ["strong"],
    "scapegoat_a3": ["medium"],
    "speech_domain": ["narrow"],
    "geo_culture": ["china"],
    "aesthetics_style": ["xianxia", "classical"],
    "mass_affect": ["anxious"],
    "contagion_strength": ["high"],
    "crisis": ["war_crisis"],
    "crisis_intensity": ["high"],
    "norm_flip_rate": ["low"],
    "requisition_risk": ["high"],
    "terrain": ["mountains", "plains", "wetlands"],
    "climate": ["temperate"],
    "anomaly_climate": ["magic_tide"],
    "time_cycle": ["standard"],
    "seasons": ["four_seasons"],
    "night_rules": ["monsters"],
    "flora": ["staples", "cash_crops", "magic_plants", "giant_trees"],
    "fauna": ["livestock", "beasts", "sea_monsters"],
    "resources": ["water", "minerals", "magic_crystal"],
    "disasters": ["earthquake", "landslide", "plague"],
    "supernatural_rules": ["learning"],
    "strategic_resources": ["magic_crystal", "soul_stone"],
    "historical_events": ["great_war", "dynasty_change", "natural_disaster"],
    "regime": ["oligarchy"],
    "power_concentration": ["decentralized"],
    "class_rigidity": ["highly_rigid"],
    "impunity_gap": ["significant"],
    "purge_risk": ["medium"],
    "classes": ["cultivator", "noble", "commoner", "merchant", "farmer"],
    "global_politics": ["multipolar"],
    "succession_law": ["meritocracy"],
    "class_mobility": ["exam"],
    "legal_systems": ["sect_rules", "customary_law", "feudal_law"],
    "selective_enforcement": ["severe"],
    "rule_stability": ["stable"],
    "due_process": ["incomplete"],
    "economy": ["magic_trade"],
    "currency": ["magic_currency"],
    "economy_env": ["stable"],
    "inflation_risk": ["medium"],
    "inequality": ["high"],
    "credit_stability": ["partial"],
    "info_tech": ["oral", "courier", "magic_msg"],
    "info_env": ["tiered"],
    "info_truth": ["mixed"],
    "transparency": ["low"],
    "rumor": ["high"],
    "insider_gap": ["large"],
    "censorship": ["light"],
    "education": ["apprentice"],
    "edu_popularity": ["elite_only"],
    "mobility_env": ["special_channel"],
    "edu_access": ["class_based"],
    "training_cost": ["high"],
    "credential_barrier": ["strict"],
    "upward_path": ["narrow"],
    "tech": ["magic"],
    "tech_diffusion": ["minority"],
    "industry": ["handicraft"],
    "infrastructure": ["maintained"],
    "medical": ["alchemy"],
    "medical_resources": ["few_access"],
    "medical_access": ["class"],
    "recovery_speed": ["slow"],
    "rehab": ["basic"],
    "force_orgs": ["magic_combat", "local"],
    "violence": ["frequent"],
    "weapon_availability": ["specific_class"],
    "policing_capacity": ["moderate"],
    "war_intensity": ["regional"],
    "violent_norms": ["normalized"],
    "governance_types": ["sect_territory"],
    "settlement_governance": ["gentry_town"],
    "urban_rural_relations": ["siphon"],
    "orgs": ["sect", "clan_org"],
    "informal_rules": ["strong"],
    "record_binding": ["high"],
    "scapegoat_frequency": ["medium"],
    "labor": ["sect_chores", "family_labor"],
    "exploitation_level": ["medium"],
    "mobility_promise_gap": ["large"],
    "deplatform_risk": ["medium"],
    "repair_mechanisms": ["clan_mediation", "duel_judgment", "blood_revenge", "karma_reckoning"],
    "second_chance": ["few"],
    "record_expiry": ["permanent"],
    "stigma_residue": ["high"],
    "family": ["patriarchy", "clan", "extended"],
    "marriage": ["monogamy", "family_alliance"],
    "kinship_control": ["strong"],
    "marriage_cost": ["high"],
    "divorce_penalty": ["high"],
    "festivals": ["traditional", "natural"],
    "life_rituals": ["birth", "adulthood_m", "adulthood_f", "wedding", "funeral"],
    "folk_customs": ["totem", "taboo", "folk_belief"],
    "aesthetics": ["xianxia"],
    "art_supply": ["spiritual_art", "traditional_art"],
    "social_styles": ["guanxi"],
    "addictions": ["alcohol"],
    "culture_env": ["conservative"],
    "innovation_state": ["slow"],
    "innovation_rate": ["slow"],
    "idea_freedom": ["restricted"],
    "novelty_supply": ["low"],
    "job_types": ["ancient_high_job", "ancient_farm_job"],
    "disease_types": ["physical", "scifi_fantasy_dis"],
    "dietary_habits": ["regional_diet", "etiquette"],
    "lifestyle_habits": ["agrarian_schedule", "monk_schedule"],
    "housing_styles": ["traditional_house", "manor_castle"],
    "clothing_styles": ["noble_clothing", "job_clothing", "ethnic_clothing"],
    "transport_types": ["walking", "middle_transport"],
    "entertainment_types": ["poor_fun", "rich_fun"],
    "consumption_habits": ["survival_consumption", "luxury_consumption"],
}

WORLD_PARAMETERS = {
    "灵气浓度": "稀薄，灵脉被七派垄断",
    "世界基调": "凡人流修仙，资源稀缺、寿元有限",
    "当前主线": "韩立离七玄门，入黄枫谷",
}


def main():
    reset = "--reset" in sys.argv
    worlds = call("GET", "/worlds")
    existing = [w for w in worlds if w.get("name") == WORLD_NAME]
    if existing:
        if not reset:
            print(f"世界《{WORLD_NAME}》已存在：{existing[0]['id']}")
            print("如需重建，运行：python3 backend/tests/seed_fanren.py --reset")
            return
        for world_row in existing:
            call("DELETE", f"/worlds/{world_row['id']}")
        print(f"已删除 {len(existing)} 个旧世界《{WORLD_NAME}》")

    # ---------------- 世界与时间 ----------------
    world = call(
        "POST",
        "/worlds",
        {
            "name": WORLD_NAME,
            "description": "天南越国，青牛镇彩霞山七玄门。凡人韩立由此踏入修仙之路。",
            "type": "fiction",
            "background": "灵根决定仙途，门派垄断功法；散修与凡人夹缝求生。越国七派并立，魔道虎视眈眈。",
            "world_scale": "nation",
        },
    )
    wid = world["id"]
    call(
        "PUT",
        f"/worlds/{wid}/time-settings",
        {
            "calendar_type": "天南历",
            "time_unit": "日",
            "time_mode": "manual",
            "current_time": "1023-03-01T08:00:00",
        },
    )
    call("POST", f"/worlds/{wid}/eras", {
        "name": "七派并立", "start_time": "800-01-01", "end_time": "1000-01-01",
        "description": "越国七派成形，凡人王朝退居幕后，灵脉分配格局延续至今。", "sort_order": 1,
    })
    era_now = call("POST", f"/worlds/{wid}/eras", {
        "name": "灵潮渐衰", "start_time": "1000-01-01",
        "description": "灵气缓慢衰减，七派争夺灵石矿脉，散修生存空间被挤压。", "sort_order": 2,
    })

    # ---------------- 地理：天南 → 越国 → 岚州 → 城镇 → 门派 ----------------
    tiannan = call("POST", "/locations", {"world_id": wid, "name": "天南", "location_type_id": "lt-continent", "description": "越国所在的大陆区域，修仙界通称天南。"})
    yue = call("POST", "/locations", {"world_id": wid, "name": "越国", "location_type_id": "lt-country", "parent_location_id": tiannan["id"], "description": "七派并立的凡人国度，王室名存实亡。"})
    lanzhou = call("POST", "/locations", {"world_id": wid, "name": "岚州", "location_type_id": "lt-province", "parent_location_id": yue["id"], "description": "越国北部州府，灵脉与矿脉集中。"})
    qingniu = call("POST", "/locations", {"world_id": wid, "name": "青牛镇", "location_type_id": "lt-city", "parent_location_id": lanzhou["id"], "description": "七玄门山脚下的凡人集镇，弟子采买多在此处。"})
    jiayuan = call("POST", "/locations", {"world_id": wid, "name": "嘉元城", "location_type_id": "lt-city", "parent_location_id": lanzhou["id"], "description": "岚州首府，散修坊市与拍卖会所在。"})
    caixia = call("POST", "/locations", {"world_id": wid, "name": "彩霞山", "location_type_id": "lt-district", "parent_location_id": qingniu["id"], "description": "七玄门总坛所在的山区。"})
    qixuan_gate = call("POST", "/locations", {"world_id": wid, "name": "七玄门", "location_type_id": "lt-building", "parent_location_id": caixia["id"], "description": "七玄门山门、演武场与各堂口。"})
    yaoyuan = call("POST", "/locations", {"world_id": wid, "name": "药园", "location_type_id": "lt-room", "parent_location_id": qixuan_gate["id"], "description": "墨大夫掌管的山间药园，种有常见与低阶灵药。"})
    han_room = call("POST", "/locations", {"world_id": wid, "name": "韩立居所", "location_type_id": "lt-room", "parent_location_id": qixuan_gate["id"], "description": "外门弟子通铺角落里的一张床。"})
    mo_room = call("POST", "/locations", {"world_id": wid, "name": "墨大夫居所", "location_type_id": "lt-room", "parent_location_id": qixuan_gate["id"], "description": "药园旁的独立小院，常年药味不散。"})
    call("POST", "/locations", {"world_id": wid, "name": "议事厅", "location_type_id": "lt-room", "parent_location_id": qixuan_gate["id"], "description": "掌门与各堂管事议事之处。"})
    taishan = call("POST", "/locations", {"world_id": wid, "name": "太南山", "location_type_id": "lt-district", "parent_location_id": jiayuan["id"], "description": "嘉元城外的灵脉山地，黄枫谷与掩月宗在此设坛。"})
    huangfeng_gate = call("POST", "/locations", {"world_id": wid, "name": "黄枫谷", "location_type_id": "lt-building", "parent_location_id": taishan["id"], "description": "越国七派之一黄枫谷的山门与洞府。"})
    hf_hall = call("POST", "/locations", {"world_id": wid, "name": "黄枫谷山门", "location_type_id": "lt-room", "parent_location_id": huangfeng_gate["id"], "description": "接引弟子与入门测试之处。"})
    yanyue_gate = call("POST", "/locations", {"world_id": wid, "name": "掩月宗", "location_type_id": "lt-building", "parent_location_id": taishan["id"], "description": "越国七派之一掩月宗的山门，以剑术与月华功法著称。"})

    # ---------------- 组织、部门、职位 ----------------
    qixuan = call("POST", "/organizations", {"world_id": wid, "name": "七玄门", "organization_type": "other", "description": "彩霞山上的凡俗武林门派，暗中与修仙界有牵连。", "headquarters_location_id": qixuan_gate["id"], "status": "normal"})
    huangfeng = call("POST", "/organizations", {"world_id": wid, "name": "黄枫谷", "organization_type": "other", "description": "越国七大修仙门派之一，以炼丹与灵植见长。", "headquarters_location_id": huangfeng_gate["id"], "status": "normal"})
    yanyue = call("POST", "/organizations", {"world_id": wid, "name": "掩月宗", "organization_type": "other", "description": "越国七大修仙门派之一，剑术与月华功法独树一帜。", "headquarters_location_id": yanyue_gate["id"], "status": "normal"})

    qx_outer = call("POST", "/organization-units", {"world_id": wid, "organization_id": qixuan["id"], "name": "外门", "unit_type": "department"})
    qx_herb = call("POST", "/organization-units", {"world_id": wid, "organization_id": qixuan["id"], "name": "药园", "unit_type": "department"})
    qx_inner = call("POST", "/organization-units", {"world_id": wid, "organization_id": qixuan["id"], "name": "内门", "unit_type": "department"})
    qx_law = call("POST", "/organization-units", {"world_id": wid, "organization_id": qixuan["id"], "name": "执法堂", "unit_type": "department"})
    hf_outer = call("POST", "/organization-units", {"world_id": wid, "organization_id": huangfeng["id"], "name": "外门", "unit_type": "department"})
    yy_inner = call("POST", "/organization-units", {"world_id": wid, "organization_id": yanyue["id"], "name": "内门", "unit_type": "department"})

    pos_outer = call("POST", "/organization-positions", {"world_id": wid, "unit_id": qx_outer["id"], "name": "外门弟子", "position_level": "记名"})
    pos_herb = call("POST", "/organization-positions", {"world_id": wid, "unit_id": qx_herb["id"], "name": "药园管事", "position_level": "管事"})
    call("POST", "/organization-positions", {"world_id": wid, "unit_id": qx_inner["id"], "name": "内门弟子", "position_level": "正式"})
    call("POST", "/organization-positions", {"world_id": wid, "unit_id": qx_law["id"], "name": "执法长老", "position_level": "长老"})
    pos_hf = call("POST", "/organization-positions", {"world_id": wid, "unit_id": hf_outer["id"], "name": "外门弟子", "position_level": "记名"})
    pos_yy = call("POST", "/organization-positions", {"world_id": wid, "unit_id": yy_inner["id"], "name": "内门长老", "position_level": "长老"})

    # ---------------- 社会与群体 ----------------
    society = call("POST", f"/worlds/{wid}/societies", {
        "name": "越国", "society_type": "nation",
        "government_form": "世俗王朝与七派共治",
        "territory_location_id": yue["id"],
        "description": "王室管凡人，七派管灵脉；凡人与修士被灵根划成两个世界。",
        "founded_at": "800-01-01",
    })
    groups = {}
    for key, name, gtype, desc in [
        ("xiushi", "修士", "class", "拥有灵根、能吐纳灵气的人，地位高于凡人。"),
        ("fanren", "凡人", "class", "无灵根的普通人，构成世俗王朝的劳动力与税基。"),
        ("sanxiu", "散修", "profession", "无门派依靠的修士，靠坊市任务与冒险获取资源。"),
        ("qipai", "七派弟子", "profession", "越国七派登记在册的弟子，享有功法与灵脉配额。"),
        ("modao", "魔道修士", "class", "修习魔道功法者，被七派通缉，多藏于南疆。"),
    ]:
        groups[key] = call("POST", f"/worlds/{wid}/social-groups", {
            "name": name, "group_type": gtype, "society_id": society["id"], "description": desc,
        })

    # ---------------- 规则 ----------------
    rules = {}
    rules["iron"] = call("POST", f"/worlds/{wid}/rules", {
        "name": "修仙界铁律：不得以法术屠戮凡人",
        "rule_category": "legal",
        "description": "修士对凡人出手会引来七派联合追缉，是越国修仙界少数被共同承认的底线。",
        "conditions": "以法术、法器或灵兽直接杀害无灵根凡人",
        "consequences": "被七派通缉，剥夺坊市交易资格，重者就地格杀",
        "priority": 100,
        "scopes": [{"scope_type": "world", "scope_id": wid}],
    })
    rules["qixuan"] = call("POST", f"/worlds/{wid}/rules", {
        "name": "七玄门门规",
        "rule_category": "social",
        "description": "外门弟子不得私斗、不得私采药园灵药、不得顶撞管事；违者逐出山门。",
        "conditions": "七玄门在册弟子",
        "consequences": "杖责、降为杂役或逐出山门",
        "priority": 60,
        "scopes": [{"scope_type": "organization", "scope_id": qixuan["id"]}],
    })
    rules["herb"] = call("POST", f"/worlds/{wid}/rules", {
        "name": "药园灵药不得私采",
        "rule_category": "economic",
        "description": "药园灵药归门中所有，采摘要登记；私采按盗窃论处。",
        "conditions": "进入药园的非管事人员",
        "consequences": "按市价十倍赔偿，重者废去修为",
        "priority": 40,
        "scopes": [{"scope_type": "location", "scope_id": yaoyuan["id"]}],
    })
    rules["root"] = call("POST", f"/worlds/{wid}/rules", {
        "name": "灵根择优录取",
        "rule_category": "social",
        "description": "黄枫谷入门测试以灵根品质为先，凡根者只能做杂役。",
        "conditions": "参加黄枫谷入门测试者",
        "consequences": "灵根低劣者遣返，优异者进入外门",
        "priority": 50,
        "scopes": [{"scope_type": "organization", "scope_id": huangfeng["id"]}],
    })
    rules["demon"] = call("POST", f"/worlds/{wid}/rules", {
        "name": "魔道功法侵蚀心神",
        "rule_category": "special",
        "description": "魔道功法进境快，但会放大贪嗔痴；修习者需以秘法压制，否则走火入魔。",
        "conditions": "修习魔道功法",
        "consequences": "心境失衡、寿元折损、被七派通缉",
        "priority": 80,
        "scopes": [{"scope_type": "world", "scope_id": wid}],
    })

    # ---------------- 资源、持有、流水 ----------------
    rtypes = call("GET", f"/worlds/{wid}/resource-types")
    by_cat = {t["category"]: t["id"] for t in rtypes}
    bottle = call("POST", f"/worlds/{wid}/resources", {"name": "掌天瓶", "resource_type_id": by_cat["material"], "quantity": 1, "unit": "件", "description": "墨绿小瓶，可催熟灵药；韩立的底牌。", "location_id": yaoyuan["id"]})
    stone = call("POST", f"/worlds/{wid}/resources", {"name": "下品灵石", "resource_type_id": by_cat["financial"], "quantity": 50, "unit": "块", "description": "修仙界通用货币，也是修炼与布阵的消耗品。"})
    herb_res = call("POST", f"/worlds/{wid}/resources", {"name": "百年黄精", "resource_type_id": by_cat["material"], "quantity": 12, "unit": "株", "description": "药园里少见的百年灵药，可用于炼丹。", "location_id": yaoyuan["id"]})
    book = call("POST", f"/worlds/{wid}/resources", {"name": "《长春功》", "resource_type_id": by_cat["information"], "quantity": 1, "unit": "部", "description": "七玄门入门功法，只传记名弟子。", "location_id": qixuan_gate["id"]})
    mine = call("POST", f"/worlds/{wid}/resources", {"name": "灵石矿脉", "resource_type_id": by_cat["natural"], "quantity": 1, "unit": "处", "description": "太南山中的小型灵石矿脉，七玄门与黄枫谷争夺的焦点。", "location_id": taishan["id"]})

    # ---------------- 人物（先建空档案，事件后回填种子） ----------------
    created = {}
    for name, profile in [
        ("韩立", {"称号": "韩跑跑", "身份": "七玄门记名弟子", "境界": "炼气初期"}),
        ("墨居仁", {"称号": "墨大夫", "身份": "七玄门药园管事", "境界": "凡人武者"}),
        ("张铁", {"身份": "七玄门弟子"}),
        ("厉飞雨", {"身份": "七玄门弟子"}),
        ("南宫婉", {"身份": "掩月宗修士", "境界": "筑基期"}),
    ]:
        created[name] = call("POST", "/characters", {
            "world_id": wid, "name": name, "basic_profile": profile,
        })
    chars = {name: row["id"] for name, row in created.items()}

    call("POST", "/resource-holdings", {"world_id": wid, "resource_id": bottle["id"], "holder_type": "character", "holder_id": chars["韩立"], "role": "holder"})
    call("POST", "/resource-holdings", {"world_id": wid, "resource_id": stone["id"], "holder_type": "character", "holder_id": chars["韩立"], "role": "holder"})
    call("POST", "/resource-holdings", {"world_id": wid, "resource_id": herb_res["id"], "holder_type": "organization", "holder_id": qixuan["id"], "role": "holder"})
    call("POST", "/resource-holdings", {"world_id": wid, "resource_id": book["id"], "holder_type": "organization", "holder_id": qixuan["id"], "role": "holder"})
    call("POST", "/resource-holdings", {"world_id": wid, "resource_id": mine["id"], "holder_type": "organization", "holder_id": qixuan["id"], "role": "manager"})
    call("POST", "/resource-transactions", {"world_id": wid, "resource_id": stone["id"], "amount": -10, "reason": "购买丹方与符纸", "occurred_at": "1023-06-10 12:00:00"})
    call("POST", "/resource-transactions", {"world_id": wid, "resource_id": herb_res["id"], "amount": -3, "reason": "为墨大夫炼制疗伤丹", "occurred_at": "1023-07-15 09:00:00"})

    # ---------------- 群体成员 ----------------
    for member, group_key, role in [
        ("韩立", "xiushi", "炼气修士"), ("墨居仁", "xiushi", "受损修士"),
        ("张铁", "fanren", "外门武者"), ("厉飞雨", "xiushi", "炼气修士"),
        ("南宫婉", "xiushi", "筑基修士"),
    ]:
        call("POST", "/group-memberships", {"world_id": wid, "group_id": groups[group_key]["id"], "member_type": "character", "member_id": chars[member], "role": role})

    # ---------------- 事件 ----------------
    def event(name, desc, occurred, domain, polarity, intensity, location_id=None, org_id=None):
        return call("POST", "/events", {
            "world_id": wid, "name": name, "description": desc,
            "occurred_at": occurred, "domain": domain,
            "polarity": polarity, "intensity": intensity,
            "location_id": location_id, "organization_id": org_id,
            "storyline": "主线", "scale": "微观",
        })

    e1 = event("韩立入七玄门", "韩立通过入门测试，成为七玄门记名弟子，被分到药园做杂役。", "1023-03-01T09:00:00", ["机会变化"], "奖赏", "中", caixia["id"], qixuan["id"])
    e2 = event("墨居仁收韩立为记名弟子", "墨大夫看中韩立的资质，收其为记名弟子并教授功法，实为夺舍布局。", "1023-03-05T10:00:00", ["关系扰动"], "稳定", "中", yaoyuan["id"], qixuan["id"])
    e5 = event("韩立初得掌天瓶", "韩立在药园角落得到墨绿小瓶，发现其催熟灵药之能。", "1023-04-15T18:00:00", ["机会变化"], "奖赏", "高", yaoyuan["id"], qixuan["id"])
    e8 = event("南宫婉筑基成功", "南宫婉在掩月宗闭关筑基成功，成为内门重点培养的年轻修士。", "1023-07-01T12:00:00", ["存在转变", "机会变化"], "奖赏", "高", yanyue_gate["id"], yanyue["id"])
    e7 = event("墨居仁毒害张铁", "张铁发现墨大夫的秘密，被灭口于药园。", "1023-08-20T21:00:00", ["存在转变"], "威胁", "高", yaoyuan["id"], qixuan["id"])
    e3 = event("墨居仁图谋夺舍", "墨居仁身负重伤，欲夺舍韩立以延续性命。", "1023-09-01T20:00:00", ["存在转变", "控制失效"], "威胁", "高", yaoyuan["id"], qixuan["id"])
    e4 = event("韩立反杀墨居仁", "韩立识破夺舍图谋，以毒计反杀墨居仁。", "1023-09-10T21:00:00", ["存在转变"], "威胁", "高", yaoyuan["id"], qixuan["id"])
    e6 = event("韩立离开七玄门", "了结墨居仁之事后，韩立离开七玄门，前往黄枫谷求取仙途。", "1023-09-20T07:00:00", ["机会变化"], "扩张", "中", caixia["id"], qixuan["id"])
    e9 = event("韩立通过黄枫谷入门测试", "韩立以散修身份参加黄枫谷测试，凭灵根与药理进入外门。", "1023-10-05T10:00:00", ["机会变化"], "奖赏", "中", hf_hall["id"], huangfeng["id"])

    def participant(event_id, etype, eid, role, desc=""):
        call("POST", f"/events/{event_id}/participants", {"entity_type": etype, "entity_id": eid, "participant_role": role, "description": desc})

    def impact(event_id, etype, eid, impact_type, level, confirmed=True, desc=""):
        call("POST", f"/events/{event_id}/impacts", {"entity_type": etype, "entity_id": eid, "impact_type": impact_type, "impact_level": level, "is_confirmed": confirmed, "description": desc})

    participant(e1["id"], "character", chars["韩立"], "发起者", "主动参加入门测试")
    participant(e1["id"], "organization", qixuan["id"], "见证者")
    impact(e1["id"], "character", chars["韩立"], "收益", "中", desc="获得修炼机会")

    participant(e2["id"], "character", chars["墨居仁"], "决策者")
    participant(e2["id"], "character", chars["韩立"], "受益者")
    impact(e2["id"], "character", chars["韩立"], "机会", "中", desc="得到功法指点")

    participant(e5["id"], "character", chars["韩立"], "受益者")
    impact(e5["id"], "character", chars["韩立"], "机会", "高", desc="获得催熟灵药之宝")
    impact(e5["id"], "resource", bottle["id"], "状态改变", "中", desc="从药园遗物变为韩立私藏")

    participant(e8["id"], "character", chars["南宫婉"], "发起者")
    impact(e8["id"], "character", chars["南宫婉"], "状态改变", "高", desc="筑基成功")
    impact(e8["id"], "organization", yanyue["id"], "收益", "中", desc="获得重点培养弟子")

    participant(e7["id"], "character", chars["墨居仁"], "发起者")
    participant(e7["id"], "character", chars["张铁"], "反对者")
    impact(e7["id"], "character", chars["张铁"], "损失", "高", desc="身死")
    impact(e7["id"], "character", chars["韩立"], "认知冲击", "中", desc="意识到墨大夫的危险")

    participant(e3["id"], "character", chars["墨居仁"], "发起者")
    participant(e3["id"], "character", chars["韩立"], "反对者")
    impact(e3["id"], "character", chars["韩立"], "风险", "高", desc="性命受威胁")
    impact(e3["id"], "character", chars["墨居仁"], "状态改变", "高", desc="暴露真实意图")

    participant(e4["id"], "character", chars["韩立"], "执行者")
    participant(e4["id"], "character", chars["墨居仁"], "反对者")
    impact(e4["id"], "character", chars["韩立"], "状态改变", "高", desc="摆脱控制，获得自由")
    impact(e4["id"], "character", chars["墨居仁"], "损失", "高", desc="身死道消")

    participant(e6["id"], "character", chars["韩立"], "发起者")
    impact(e6["id"], "character", chars["韩立"], "机会", "中", desc="进入修仙界")
    impact(e6["id"], "organization", qixuan["id"], "损失", "低", desc="失去一名弟子")

    participant(e9["id"], "character", chars["韩立"], "发起者")
    participant(e9["id"], "organization", huangfeng["id"], "见证者")
    impact(e9["id"], "character", chars["韩立"], "机会", "中", desc="进入黄枫谷外门")

    # ---------------- 因果链 ----------------
    def causal(src, tgt, rtype, confidence, desc=""):
        call("POST", "/event-relations", {
            "world_id": wid, "source_event_id": src, "target_event_id": tgt,
            "relation_type": rtype, "confidence": confidence,
            "description": desc, "evidence": "由事件序列与人物动机推定",
        })

    causal(e1["id"], e2["id"], "contributes_to", 0.8, "入门后才被墨大夫看中")
    causal(e2["id"], e3["id"], "contributes_to", 0.7, "拜师使韩立进入墨大夫掌控范围")
    causal(e2["id"], e7["id"], "contributes_to", 0.6, "墨大夫为保守秘密灭口张铁")
    causal(e7["id"], e4["id"], "contributes_to", 0.6, "张铁之死让韩立确认墨大夫会杀人")
    causal(e3["id"], e4["id"], "causes", 0.95, "夺舍图谋直接引发反杀")
    causal(e5["id"], e6["id"], "contributes_to", 0.6, "掌天瓶是韩立离山求仙的底气")
    causal(e4["id"], e6["id"], "triggers", 0.8, "了结墨居仁后才能脱身")
    causal(e6["id"], e9["id"], "causes", 0.7, "离开七玄门后才有黄枫谷之行")

    # ---------------- 认知 ----------------
    call("POST", f"/events/{e3['id']}/perceptions", {"character_id": chars["韩立"], "perceived_content": "墨大夫要夺舍我，必须先下手", "perceived_polarity": "威胁", "perceived_intensity": "高", "attribution_target": chars["墨居仁"], "certainty": 0.7, "information_source": "亲历察觉与试探", "perceived_at": "1023-09-05T22:00:00"})
    call("POST", f"/events/{e3['id']}/perceptions", {"character_id": chars["墨居仁"], "perceived_content": "韩立只是合适的躯壳，一切仍在掌控中", "perceived_polarity": "机会", "perceived_intensity": "中", "attribution_target": chars["韩立"], "certainty": 0.9, "information_source": "自身判断", "perceived_at": "1023-09-01T20:30:00"})
    call("POST", f"/events/{e7['id']}/perceptions", {"character_id": chars["韩立"], "perceived_content": "张铁不是失踪，是被墨大夫灭口", "perceived_polarity": "威胁", "perceived_intensity": "高", "attribution_target": chars["墨居仁"], "certainty": 0.6, "information_source": "药园血迹与墨大夫的谎言", "perceived_at": "1023-08-25T23:00:00"})
    call("POST", f"/events/{e7['id']}/perceptions", {"character_id": chars["厉飞雨"], "perceived_content": "张铁可能受不了苦，偷偷下山了", "perceived_polarity": "稳定", "perceived_intensity": "低", "attribution_target": chars["张铁"], "certainty": 0.3, "information_source": "同门传言", "perceived_at": "1023-08-23T12:00:00"})
    call("POST", f"/events/{e4['id']}/perceptions", {"character_id": chars["厉飞雨"], "perceived_content": "墨大夫再没回来，韩立也走了，事情不简单", "perceived_polarity": "威胁", "perceived_intensity": "中", "attribution_target": chars["韩立"], "certainty": 0.4, "information_source": "事后观察", "perceived_at": "1023-09-21T10:00:00"})

    # ---------------- 任职 ----------------
    def appoint(name, pos, start, note=""):
        return call("POST", "/appointments", {
            "world_id": wid, "character_id": chars[name], "position_id": pos["id"],
            "start_time": start, "note": note,
        })

    appt_han_qx = appoint("韩立", pos_outer, "1023-03-01 09:00:00", "通过入门测试，成为记名弟子")
    appoint("韩立", pos_hf, "1023-10-05 10:00:00", "通过黄枫谷入门测试")
    appt_mo = appoint("墨居仁", pos_herb, "1022-01-01 00:00:00", "长期掌管药园")
    appt_zhang = appoint("张铁", pos_outer, "1023-03-01 09:00:00", "与韩立同期入门")
    appoint("厉飞雨", pos_outer, "1023-03-01 09:00:00", "与韩立同期入门")
    appoint("南宫婉", pos_yy, "1018-01-01 00:00:00", "掩月宗内门长老")

    # ---------------- 关系 ----------------
    def rel(src_type, src, tgt_type, tgt, rtype, desc="", valid_from=None, occurred_at=None):
        payload = {
            "world_id": wid,
            "source_type": src_type, "source_id": src,
            "target_type": tgt_type, "target_id": tgt,
            "relation_type": rtype, "description": desc,
        }
        if valid_from:
            payload["valid_from"] = valid_from
        if occurred_at:
            payload["occurred_at"] = occurred_at
        return call("POST", "/relationships", payload)

    def rel_update(rel_id, occurred_at, **fields):
        payload = dict(fields)
        payload["occurred_at"] = occurred_at
        return call("PATCH", f"/relationships/{rel_id}", payload)

    r_teacher = rel("character", chars["韩立"], "character", chars["墨居仁"], "师生",
                    "墨大夫传授韩立功法，实为图谋其身体", "1023-03-05 10:00:00", "1023-03-05 10:00:00")
    r_control = rel("character", chars["墨居仁"], "character", chars["韩立"], "控制",
                    "墨大夫以功法与药物控制韩立", "1023-03-05 10:00:00", "1023-03-05 10:00:00")
    r_friend_zhang = rel("character", chars["韩立"], "character", chars["张铁"], "朋友",
                         "同门好友，互相照应", "1023-03-01 08:00:00", "1023-03-01 08:00:00")
    rel("character", chars["韩立"], "character", chars["厉飞雨"], "朋友",
        "同门好友，厉飞雨为韩立送行", "1023-03-01 08:00:00", "1023-03-01 08:00:00")
    rel("character", chars["韩立"], "character", chars["南宫婉"], "恋人",
        "后来结缘；此时尚未相识", "1023-09-20 00:00:00", "1023-09-20 00:00:00")
    r_qx_member = rel("character", chars["韩立"], "organization", qixuan["id"], "成员",
                      "七玄门外门弟子", "1023-03-01 09:00:00", "1023-03-01 09:00:00")
    r_live = rel("character", chars["韩立"], "location", caixia["id"], "居住于",
                 "住在七玄门外门通铺", "1023-03-01 09:00:00", "1023-03-01 09:00:00")
    rel("organization", qixuan["id"], "location", caixia["id"], "总部位于", "七玄门总坛在彩霞山")
    rel("character", chars["韩立"], "resource", bottle["id"], "持有",
        "掌天瓶由韩立私下持有，不为人知", "1023-04-15 18:00:00", "1023-04-15 18:00:00")
    r_zhang_enemy = rel("character", chars["张铁"], "character", chars["墨居仁"], "敌对",
                        "张铁发现墨大夫的秘密后被灭口", "1023-08-20 21:00:00", "1023-08-20 21:00:00")
    rel("character", chars["厉飞雨"], "organization", qixuan["id"], "成员", "七玄门外门弟子")
    rel("character", chars["南宫婉"], "organization", yanyue["id"], "成员", "掩月宗内门长老")
    rel("character", chars["韩立"], "organization", huangfeng["id"], "成员",
        "黄枫谷外门弟子", "1023-10-05 10:00:00", "1023-10-05 10:00:00")
    rel("organization", qixuan["id"], "resource", herb_res["id"], "拥有", "药园灵药归门中所有")
    rel("organization", qixuan["id"], "resource", mine["id"], "控制", "七玄门控制太南山小型矿脉")

    rel_update(r_teacher["id"], "1023-09-05 22:00:00", status="strained", description="韩立察觉墨大夫意图，师徒关系名存实亡")
    rel_update(r_teacher["id"], "1023-09-20 07:00:00", status="ended", valid_until="1023-09-20 07:00:00")
    rel_update(r_control["id"], "1023-09-10 21:30:00", status="ended", valid_until="1023-09-10 21:30:00")
    rel_update(r_friend_zhang["id"], "1023-08-20 21:00:00", status="ended", valid_until="1023-08-20 21:00:00", description="张铁遇害，友谊被迫中断")
    rel_update(r_zhang_enemy["id"], "1023-08-20 21:00:00", status="ended", valid_until="1023-08-20 21:00:00")
    rel_update(r_qx_member["id"], "1023-09-20 07:00:00", status="ended", valid_until="1023-09-20 07:00:00")
    rel_update(r_live["id"], "1023-09-20 07:00:00", status="ended", valid_until="1023-09-20 07:00:00")

    call("PATCH", f"/appointments/{appt_han_qx['id']}/end", {"end_time": "1023-09-20 07:00:00", "reason": "离开七玄门"})
    call("PATCH", f"/appointments/{appt_mo['id']}/end", {"end_time": "1023-09-10 21:30:00", "reason": "墨居仁身死，任职终止"})
    call("PATCH", f"/appointments/{appt_zhang['id']}/end", {"end_time": "1023-08-20 21:00:00", "reason": "张铁遇害"})

    # ---------------- 人物种子档案回填 ----------------
    payloads = build_characters({"chars": chars, "events": {
        "e1": e1["id"], "e2": e2["id"], "e3": e3["id"], "e4": e4["id"],
        "e5": e5["id"], "e6": e6["id"], "e7": e7["id"], "e8": e8["id"], "e9": e9["id"],
    }})
    for name, payload in payloads.items():
        call("PUT", f"/characters/{chars[name]}", payload)

    # ---------------- 世界目录节点 ----------------
    def node(branch, name, node_type="folder", parent=None, ref_type=None, ref_id=None, desc=""):
        payload = {
            "branch": branch if parent is None else None,
            "parent_id": parent["id"] if parent else None,
            "node_type": node_type, "name": name, "description": desc,
        }
        if node_type == "entity_ref":
            payload["ref_type"] = ref_type
            payload["ref_id"] = ref_id
        return call("POST", f"/worlds/{wid}/nodes", payload)

    def branch_root(branch):
        rows = call("GET", f"/worlds/{wid}/nodes?branch={branch}")
        return next(row for row in rows if not row.get("parent_id"))

    world_root = branch_root("world_profile")
    people_root = branch_root("people_groups")

    node("world_profile", "世界概览", "note", world_root, desc="天南越国，七派并立；灵根决定仙途，资源被门派垄断。")
    system = node("world_profile", "修仙体系", None, world_root, desc="灵根、境界、丹药与法器构成的力量体系。")
    node("world_profile", "灵根与资质", "note", system, desc="灵根分五行与伪灵根；资质决定吐纳效率与筑基可能。")
    node("world_profile", "境界体系", "note", system, desc="炼气 → 筑基 → 结丹 → 元婴；越国以筑基为门派中坚。")
    node("world_profile", "丹药与法器", "note", system, desc="丹药分疗伤、辅助、突破三类；法器以飞剑、护盾、储物袋最常见。")
    powers = node("world_profile", "主要势力", None, world_root, desc="越国七派与凡俗王朝。")
    node("world_profile", "越国七派", "note", powers, desc="黄枫谷、掩月宗等七派共治灵脉；七玄门只是凡俗附庸。")
    node("world_profile", "七玄门", "entity_ref", powers, "organization", qixuan["id"], "凡俗武林门派，药园与入门功法是其根基。")
    node("world_profile", "黄枫谷", "entity_ref", powers, "organization", huangfeng["id"], "七派之一，以炼丹与灵植见长。")
    node("world_profile", "掩月宗", "entity_ref", powers, "organization", yanyue["id"], "七派之一，剑术与月华功法著称。")
    node("world_profile", "时代背景", "entity_ref", world_root, "era", era_now["id"], "灵潮渐衰，七派争夺灵石矿脉。")
    node("world_profile", "规则总纲", "entity_ref", world_root, "rule", rules["iron"]["id"], "不得以法术屠戮凡人。")

    people = node("people_groups", "主要人物", None, people_root, desc="当前主线涉及的核心人物。")
    node("people_groups", "韩立", "entity_ref", people, "character", chars["韩立"], "山村少年，七玄门外门弟子，后入黄枫谷。")
    node("people_groups", "墨居仁", "entity_ref", people, "character", chars["墨居仁"], "药园管事，图谋夺舍韩立，被反杀。")
    node("people_groups", "南宫婉", "entity_ref", people, "character", chars["南宫婉"], "掩月宗内门长老，筑基修士。")
    qx_people = node("people_groups", "七玄门弟子", None, people_root, desc="与韩立同期入门的外门弟子。")
    node("people_groups", "张铁", "entity_ref", qx_people, "character", chars["张铁"], "韩立好友，被墨大夫灭口。")
    node("people_groups", "厉飞雨", "entity_ref", qx_people, "character", chars["厉飞雨"], "韩立好友，外门活跃分子。")
    social = node("people_groups", "社会群体", None, people_root, desc="越国的阶层与职业群体。")
    node("people_groups", "修士", "entity_ref", social, "social_group", groups["xiushi"]["id"], "拥有灵根、能吐纳灵气的人。")
    node("people_groups", "凡人", "entity_ref", social, "social_group", groups["fanren"]["id"], "无灵根的普通人。")
    node("people_groups", "散修", "entity_ref", social, "social_group", groups["sanxiu"]["id"], "无门派依靠的修士。")

    # ---------------- 世界建设配置 ----------------
    settings = call("PUT", f"/worlds/{wid}/settings", {
        "selections": WORLD_SELECTIONS,
        "parameters": WORLD_PARAMETERS,
    })

    # 世界时间推进到主线当前
    call("PUT", f"/worlds/{wid}/time-settings", {"current_time": "1023-10-10T08:00:00"})

    # ---------------- 验收读数 ----------------
    locs = call("GET", f"/worlds/{wid}/locations")
    orgs = call("GET", f"/worlds/{wid}/organizations")
    appointments = call("GET", f"/worlds/{wid}/appointments")
    rels = call("GET", f"/worlds/{wid}/relationships")
    events = call("GET", f"/events?world_id={wid}")
    perceptions = []
    for ev in events:
        perceptions += call("GET", f"/events/{ev['id']}/perceptions")
    nodes_world = call("GET", f"/worlds/{wid}/nodes?branch=world_profile")
    nodes_people = call("GET", f"/worlds/{wid}/nodes?branch=people_groups")
    eras = call("GET", f"/worlds/{wid}/eras")
    all_rules = call("GET", f"/worlds/{wid}/rules")
    societies = call("GET", f"/worlds/{wid}/societies")
    social_groups = call("GET", f"/worlds/{wid}/social-groups")
    memberships = call("GET", f"/worlds/{wid}/group-memberships")
    resources = call("GET", f"/worlds/{wid}/resources")
    holdings = call("GET", f"/worlds/{wid}/resource-holdings")
    timeline = call("GET", f"/worlds/{wid}/timeline")
    settings_now = call("GET", f"/worlds/{wid}/settings")
    hanli_tl = call("GET", f"/worlds/{wid}/timeline?scope=character&entity_id={chars['韩立']}")
    qx_tree = call("GET", f"/organizations/{qixuan['id']}/tree")
    org_trees = [call("GET", f"/organizations/{org['id']}/tree") for org in orgs]
    unit_total = sum(tree["unit_count"] for tree in org_trees)
    position_total = sum(tree["position_count"] for tree in org_trees)

    print("\n===== 《凡人修仙传》完整验收数据已创建 =====")
    print(f"世界 ID：{wid}")
    print("\n[世界结构]")
    print(f"  世界基础目录：{len(nodes_world)} 个节点（含绑定实体）")
    print(f"  世界规则：{len(all_rules)} 条；时代：{len(eras)} 个")
    print(f"  地理：{len(locs)} 个地点（大陆→国家→州→城镇→门派→房间）")
    print(f"  组织：{len(orgs)} 个 · 部门 {unit_total} · 职位 {position_total} · 任职 {len(appointments)}")
    print(f"  文明社会：{len(societies)} 个社会实体 · {len(social_groups)} 个群体 · {len(memberships)} 条成员")
    print(f"  人物与群体目录：{len(nodes_people)} 个节点")
    print(f"  资源经济：{len(resources)} 种资源 · {len(holdings)} 条持有 · 2 条流水")
    print("\n[人物种子]")
    for name in ["韩立", "墨居仁", "张铁", "厉飞雨", "南宫婉"]:
        detail = call("GET", f"/characters/{chars[name]}")
        engines = detail.get("engines") or {}
        ovtde = engines.get("ovtde") or {}
        mechanisms = detail.get("defense_mechanisms") or {}
        reality = detail.get("reality_conditions") or {}
        thought = detail.get("thought_imprints") or {}
        history = detail.get("life_history") or {}
        initial_state = detail.get("initial_state") or {}
        filled_engines = sum(1 for v in ovtde.values() if isinstance(v, dict) and v.get("definition"))
        filled_layers = sum(1 for v in mechanisms.values() if isinstance(v, dict) and v.get("actualPerformance"))
        filled_boxes = sum(1 for v in reality.values() if isinstance(v, dict) and any(v.get("fields", {}).values()))
        print(f"  {name}: 引擎 {filled_engines}/5 · 机制层 {filled_layers}/9 · 沙盒 {filled_boxes}/6"
              f" · 钢印 {len(thought.get('imprints') or [])} · 履历 {len(history.get('events') or [])}"
              f" · 目标 {len(initial_state.get('initialGoals') or [])}")
    print("\n[事件与关系]")
    print(f"  事件 {len(events)} · 因果 {len(call('GET', f'/worlds/{wid}/event-relations'))} · 认知 {len(perceptions)}")
    print(f"  关系 {len(rels)} 条（含已结束）")
    print(f"  时间线：事件 {timeline['counts']['event']} · 变化 {timeline['counts']['history']} · 流水 {timeline['counts']['transaction']}")
    print(f"  韩立时间线：事件 {hanli_tl['counts']['event']} · 变化 {hanli_tl['counts']['history']}")
    print(f"  七玄门：{qx_tree['unit_count']} 部门 · {qx_tree['position_count']} 职位 · {qx_tree['active_appointments']} 在任")
    print(f"\n[世界建设配置] revision={settings_now.get('revision')} · {len(WORLD_SELECTIONS)} 个字段已写入")
    print("\n界面验收顺序：")
    print("  1. 世界管理 → 进入《凡人修仙传》 → 世界建设：宏观/中观/微观各标签页应有选项")
    print("  2. 世界结构：世界基础/规则/时空/地理/文明社会/组织/人物与群体/资源经济 八分支均有数据")
    print("  3. 人物管理 → 人物种子编辑器：逐个打开五人，检查引擎、机制、沙盒、钢印、履历、初始状态")
    print("  4. 事件：展开张铁之死、夺舍、反杀，查看参与方/影响/因果/认知")
    print("  5. 时间线：世界与韩立，按 1023 年顺序查看完整主线")


if __name__ == "__main__":
    main()
