"""《凡人修仙传》五个人物的种子档案数据。

供 seed_fanren.py 调用：build(ids) 返回 姓名 -> PUT /characters/{id} 的载荷。
"""


def E(val, definition, behavior, over, under, desire="", threat="", resources="", needs="", impact=""):
    return {
        "val": val,
        "definition": definition,
        "desire": desire,
        "threat": threat,
        "resources": resources,
        "needs": needs,
        "impact": impact,
        "behavior": behavior,
        "over": over,
        "under": under,
        "custom": "",
    }


def M(actual, **specific):
    return {"actualPerformance": actual, "custom": "", "specificData": specific}


def box(actual, overload="", **fields):
    return {
        "fields": fields,
        "actualPerformance": actual,
        "overloadPerformance": overload,
        "custom": "",
        "relations": [],
    }


def imprint(figure, thoughts, level, opposed, source, principles, taboos):
    return {
        "id": f"imprint-{figure}",
        "figure": figure,
        "thoughts": thoughts,
        "level": level,
        "opposed": opposed,
        "source": source,
        "principles": principles,
        "taboos": taboos,
    }


def empty_event(**kw):
    data = {
        "source_event_id": "",
        "id": "",
        "name": "",
        "startTime": "",
        "endTime": "",
        "age": "",
        "lifeStage": "",
        "location": "",
        "relatedPeople": "",
        "domain": [],
        "polarity": "",
        "intensity": "",
        "facts": "",
        "custom": "",
        "cognition": "",
        "meaning": "",
        "meaningType": "",
        "certainty": "",
        "cognitionCustom": "",
        "attribution": [],
        "attributionCustom": "",
        "emotions": [],
        "emotionDuration": "",
        "psychologicalImpact": "",
        "recurringEmotion": "",
        "emotionCustom": "",
        "firstReaction": "",
        "actualAction": "",
        "defenseAvoidance": "",
        "confrontation": "",
        "helpSeeking": "",
        "finalResponse": "",
        "behaviorCustom": "",
        "directResult": "",
        "lifeImpact": "",
        "relationshipImpact": "",
        "beliefImpact": "",
        "longTermImpact": "",
        "followUpEvents": "",
        "resultCustom": "",
    }
    data.update(kw)
    return data


def dep(**kw):
    keys = [
        "repeatedPatterns", "relationshipPatterns", "recurringDifficulties",
        "opportunitiesAndRewards", "chronicStress", "historicalUnderstanding",
        "coreBeliefs", "longTermObsession", "psychologicalBoundaries",
        "defenseTendencies", "behavioralHabits", "relationshipModels",
        "riskJudgment",
    ]
    data = {key: "" for key in keys}
    data["trajectory"] = []
    data["currentInfluences"] = []
    data.update(kw)
    return data


def initial(**kw):
    data = {
        "energyState": "", "energyDescription": "", "energyConsumption": "",
        "energyRecovery": "", "pressureState": "", "pressureSource": "",
        "pressureDuration": "", "pressureImpact": "", "loadState": "",
        "responsibilities": "", "taskComplexity": "", "isOverloaded": "",
        "loadSource": "", "primaryEmotion": [], "secondaryEmotion": "",
        "emotionDuration": "", "emotionTrigger": "", "emotionManifestation": "",
        "mainDilemma": "", "dilemmaDomain": "", "dilemmaCause": "",
        "dilemmaProgress": "", "dilemmaAwareness": "", "dilemmaResponse": "",
        "primaryEngine": "", "secondaryEngine": "", "engineRelation": "",
        "engineManifestation": "", "engineTrigger": "", "engineCustom": "",
        "snapshotName": "", "snapshotTime": "", "lifeStage": "",
        "overallDescription": "", "snapshotNotes": "",
    }
    data.update(kw)
    return data


def goal(id, name, priority, reason, expected, action, obstacles, custom=""):
    return {
        "id": id, "name": name, "priority": priority, "reason": reason,
        "expectedResult": expected, "currentAction": action,
        "obstacles": obstacles, "custom": custom,
    }


def relation(id, person, type_, nature, stability, conflict, support, feeling, custom=""):
    return {
        "id": id, "person": person, "type": type_, "nature": nature,
        "stability": stability, "conflict": conflict, "support": support,
        "subjectiveFeeling": feeling, "custom": custom,
    }


def resource_item(id, name, owned, external, limitation, scarcity, stability, impact):
    return {
        "id": id, "name": name, "owned": owned, "external": external,
        "limitation": limitation, "scarcity": scarcity,
        "stability": stability, "impact": impact, "custom": "",
    }


def light_mechanisms(traits):
    return {
        "L0": M(traits["env"], externalPressure=traits["pressure"], mainResistance=traits["resistance"]),
        "L1": M(traits["energy"]),
        "L2": M(traits["body"]),
        "L2.5": M(traits["defense"], defenseTypes=traits["defenseType"], triggerSignals=traits["trigger"]),
        "L3": M(traits["thinking"], fastPath=traits["fast"], slowPath=traits["slow"]),
        "L4": M(traits["action"]),
        "L5": M(traits["script"], oldScript=traits["oldScript"], scriptImpact=traits["scriptImpact"]),
        "L6": M(traits["sovereignty"], vetoConditions=traits["veto"]),
        "L7": M(traits["cut"]),
    }


def light_individual(presets, texts, imprints):
    return {
        "timePresets": presets["time"], "dailyRoutine": texts["routine"],
        "workTime": texts["work"], "restStyle": texts["rest"],
        "timeAutonomy": texts["autonomy"], "paceDesc": texts["pace"],
        "timePressure": texts["pressure"], "timeCustom": "",
        "marriagePresets": presets["marriage"], "marriageUnderstand": texts["marriage"],
        "loveUnderstand": texts["love"], "sexAttitude": texts["sex"],
        "mateStandard": texts["mate"], "intimacyBoundary": texts["intimacy"],
        "loyaltyDuty": texts["loyalty"], "marriageCustom": "",
        "speciesPresets": presets["species"], "speciesType": texts["species"],
        "groupRelation": texts["group"], "isIndependent": texts["independent"],
        "lifeDeathView": texts["death"], "breedingMechanism": texts["breeding"],
        "intimacyMechanism": texts["intimacyMech"], "attitudeToOthers": texts["others"],
        "speciesCustom": "",
        "religionPresets": presets["religion"], "faithTarget": texts["faith"],
        "coreDogma": texts["dogma"], "absoluteTaboo": texts["taboo"],
        "salvationView": texts["salvation"], "hereticAttitude": texts["heretic"],
        "hasMissionary": texts["missionary"], "forceBelieve": texts["force"],
        "religionCustom": "",
        "imprints": imprints,
        "aestheticPresets": presets["aesthetic"], "dressStyle": texts["dress"],
        "archPref": texts["arch"], "colorPref": texts["color"],
        "artMusicPref": texts["art"], "aestheticTaboo": texts["aestheticTaboo"],
        "languageTone": texts["tone"], "aestheticCustom": "",
        "prefPresets": presets["pref"], "cogPresets": presets["cog"],
        "mostImportantStandard": texts["standard"],
        "secondaryStandard": texts["secondary"],
        "unacceptableResult": texts["unacceptable"],
        "conflictResolution": texts["conflict"],
        "typicalCase": texts["case"], "cognitiveCustom": "",
    }


HIST_KEYS = None


def build(ids):
    chars = ids["chars"]
    ev = ids["events"]

    # ==================================================================
    # 韩立
    # ==================================================================
    hanli_engines = {
        "O": E(
            85, "对资源、机会与生存空间的占有欲",
            "先观察、试探、留底牌，确认安全后才出手",
            "过度算计，错过必须冒险才能拿到的机缘",
            "该争时不争，把机会让给更狠的人",
            desire="攒灵石、囤丹药、给自己留尽可能多的退路",
            threat="被强者随手碾死，或资源被一纸命令夺走",
            resources="掌天瓶、药园辨药知识、谨慎的名声",
            needs="基本安全与一条可验证的上升通道",
            impact="资源不足时更保守，资源充足时更敢赌",
        ),
        "V": E(
            70, "对长期目标（筑基、长生）的执念",
            "把长线目标拆成眼前可做的小事，日复一日地推进",
            "为了长远目标过度压抑当下，活得像一台机器",
            "目标受挫时陷入短期的虚无",
            desire="活得比凡人久，走到更高的地方",
            threat="寿元耗尽、资质不足、功法断绝",
            resources="长春功、药园灵药、掌天瓶催熟能力",
            needs="一个值得投入几十年而不后悔的方向",
            impact="能让他在枯燥修炼中保持耐心",
        ),
        "D": E(
            90, "对风险的警觉与延迟满足能力",
            "先假定最坏结果，再决定要不要做；能忍很久",
            "因为怕风险而错过窗口，或把亲近的人也当风险",
            "被逼到墙角时突然走极端",
            desire="把不确定性压到可控范围",
            threat="一次误判就丢命",
            resources="对药性的了解、对人性恶意的经验",
            needs="可验证的信息与退路",
            impact="决定了他“先保命再谈机缘”的行事顺序",
        ),
        "E": E(
            55, "社交能量与关系维护的投入度",
            "重质不重量，只维护少数经得起生死的关系",
            "对关系投入过少，显得冷淡寡情",
            "需要支持时才发现无人可求",
            desire="有几个能托付后背的人",
            threat="被亲近的人出卖",
            resources="张铁、厉飞雨等少数信任关系",
            needs="不被群体排斥的最低归属",
            impact="在门派中保持边缘位置，减少被注意",
        ),
        "T": E(
            80, "对规则、功法与因果的拆解能力",
            "遇到事先找规律和漏洞，再设计步骤",
            "把人也当机制来算，忽略情感变量",
            "过度分析导致行动迟缓",
            desire="看懂这个世界真正的运行规则",
            threat="规则被强者随意改写",
            resources="入门功法、药园实践、墨大夫的教材",
            needs="可复用的方法论",
            impact="让他能从细节推断墨大夫的异常",
        ),
    }
    hanli_dominance = {
        "mode": ["主引擎", "辅助引擎"],
        "engines": ["D", "T"],
        "description": "生存警觉（D）压过一切，拆解（T）负责找路；占有（O）只在确认安全后启动。",
    }
    hanli_mechanisms = {
        "L0": M(
            "七玄门是凡俗武林门派，资源被上层垄断；外门弟子没有人身自由，却也没有真正的人身危险，直到墨大夫露出獠牙。",
            physEnv="彩霞山多雾，药园湿冷，山路陡峭",
            socialEnv="外门弟子之间竞争有限，真正决定命运的是管事的态度",
            legalConstraints="门规大于国法，管事可以决定弟子的去留与生死",
            classLimits="记名弟子没有资格接触核心功法",
            externalPressure="墨大夫以师徒名分施压，要求随叫随到",
            mainResistance="没有背景、没有灵石、没有可信任的长辈",
            conditions="药园职务提供了接触灵药与独处的条件",
        ),
        "L1": M(
            "能量长期偏紧：白天杂役消耗体力，夜间才有时间修炼；一旦受伤，恢复要按周计算。",
            shallowEnergy="白天杂役后所剩不多，靠年轻硬撑",
            deepEnergy="夜间修炼可积累少量，但常被杂事打断",
            autoPilot="抄方、采药、巡园可以不经思考完成",
            highEngagement="推演墨大夫意图、试验小瓶时进入高投入",
            energyConsumption="紧张时反而更清醒，事后会明显疲惫",
            energyRecovery="睡眠、进食、短暂独处",
        ),
        "L2": M(
            "身体是本钱：能扛住高强度杂役，但经不起真正的修士一击。",
            bodyLoad="长期劳作打下的底子，耐力好于同门",
            neuroLoad="警觉状态持续过久会失眠",
            sensorySensitivity="对药味、血腥味和杀气敏感",
            overload="连续失眠后判断力下降，容易疑神疑鬼",
            l2Crash="先垮的是身体：发热、手抖、站不稳",
            l3Crash="先垮的是判断：反复推演同一个问题",
            bodyRecovery="规律作息与药膳比丹药更可靠",
        ),
        "L2.5": M(
            "防御以“装傻”和“留后手”为主：先让对方低估自己，再准备反制。",
            internalAttribution="出事先反省自己哪里露了破绽",
            externalAttribution="确认对方恶意后，迅速把责任归到对方",
            defenseTypes="伪装顺从、信息隔离、提前布置退路",
            triggerSignals="对方突然示好、追问隐私、限制自由",
            misrendering="把善意也读成算计，错过真诚",
            defenseCost="长期伪装导致孤独与过度警觉",
            releaseConditions="确认对方愿意承担风险且不求回报",
        ),
        "L3": M(
            "快路径用于日常杂役与社交应付；慢路径用于功法推演和生死判断。",
            fastPath="见人说人话，先顺着对方说",
            slowPath="夜里把白天所有异常逐条复盘",
            suspension="拿不准时先不表态，拖到信息足够",
            spinning="对墨大夫的动机反复推演，消耗大量精力",
            entanglement="既想相信师徒情分，又无法忽略杀意",
            rectification="用“先保命”把纠结强行收束",
            internalFriction="表面平静，内里一直在打仗",
            meaningCutoff="长期压抑后短暂失去修炼动力",
            workspaceOverflow="同时处理药园、修炼、伪装三件事时明显吃力",
            handling="写下来、分优先级、只保留可执行项",
        ),
        "L4": M(
            "行动谨慎而有效：不轻易承诺，答应的事会做到底。",
            maintenance="按时巡园、抄方、给墨大夫送药",
            displacement="从山村走到七玄门，再从七玄门走向黄枫谷",
            binding="与张铁、厉飞雨建立少量稳定关系",
            monotony="日复一日的杂役与修炼",
            executionResistance="对没有把握的事会拖延",
            failureSignals="开始频繁检查退路时，说明他准备动手了",
            actualAction="反杀墨大夫前，先下毒、再补刀、最后处理痕迹",
        ),
        "L5": M(
            "历史沉积：山村生活的匮乏、墨大夫的教导、张铁之死，共同写成了他的旧脚本。",
            historicalAssets="辨药、采药、基础功法、对人性的经验",
            personaIndex="谨慎、隐忍、记仇、不欠人情",
            wasteResidue="对贫穷的羞耻、对强者的恐惧",
            inaccessible="童年某些记忆被有意封存",
            oldScript="遇到强者先低头，遇到机会先观望",
            oldScriptTrigger="被居高临下地施舍时",
            isScriptValid="仍然有效，但正在被“掌天瓶”带来的底气改写",
            scriptImpact="让他在黄枫谷初期继续隐藏实力",
        ),
        "L6": M(
            "主权边界清晰：身体、秘密、修炼功法不可让渡；其他都可以谈。",
            hardSovereignty="身体与性命",
            softSovereignty="少数几个被允许靠近的人",
            radiantSovereignty="掌天瓶的秘密覆盖他的全部社交行为",
            consistencyAudit="任何可能暴露小瓶的场合都会提前规避",
            boundaryAudit="别人可以命令他做事，但不能替他做决定",
            energyAudit="不值得的关系不投入",
            timelinessAudit="对“现在就必须表态”的场合高度警惕",
            passConditions="对方尊重边界、不追问秘密、愿意等价交换",
            vetoConditions="要求交出小瓶、要求无条件效忠",
            failureManifestation="边界被反复突破后会直接消失，不再解释",
        ),
        "L7": M(
            "最后断路器：当自由与性命同时被剥夺时，他会选择先下手。",
            triggerBackground="墨大夫的夺舍图谋被确认",
            cutConnection="切断师徒名分与对七玄门的最后一点归属",
            auditRecord="确认对方先动杀心，自己只是反击",
            postCutState="墨居仁死，韩立离开七玄门",
            feedback="短期内有效，长期留下对“信任”的阴影",
        ),
    }
    hanli_reality = {
        "PN": box(
            "住外门弟子通铺，吃门中大锅饭；靠药园职务获得少量额外资源。",
            "连续加班后身体报警，靠药膳硬撑。",
            basicResources="外门弟子居所、门中饭食、几件换洗衣物",
            bodyRoutine="卯时起，巡园、采药、抄方；夜间修炼两个时辰",
            economy="每月少量银钱与灵石，几乎没有积蓄",
            resourceStability="紧张",
            livingSpace="稳定",
            pressure="墨大夫随时可能收回药园职务",
            availableResources="药园灵药、掌天瓶、张铁与厉飞雨的人情",
        ),
        "AN": box(
            "能独立完成采药、辨药、基础吐纳和简单的毒理判断；缺少系统功法。",
            eduBg="山村私塾识字，七玄门入门功法",
            profSkill="辨药、采药、炮制、基础吐纳",
            pracExp="药园杂役两年，熟悉灵药生长与药性",
            independentTask="独立管理一小片药园、判断常见药材真假",
            methodology="先看环境，再查药性，最后小剂量验证",
            strengths="耐心、观察细、能吃苦",
            weaknesses="缺少高阶功法与实战经验",
            growthDir="系统修炼与实战",
            bottleneck="没有筑基功法与足够灵石",
            feedback="灵药长势、修炼时的气感",
        ),
        "RN": box(
            "深度关系很少：张铁、厉飞雨；与墨大夫是伪装出来的亲近。",
            "张铁死后，他把更多话咽回肚子里。",
            relDistribution="同门泛泛之交十余，真正信任的只有两人",
            trustTargets="张铁、厉飞雨",
            relStability="存在裂痕",
            mutualSupport="礼尚往来",
            boundary="不追问对方的秘密，也不交出全部底牌",
            mainPressure="不敢交心，怕连累对方",
            availableSupport="厉飞雨愿意为他冒险，张铁曾为他挡事",
        ),
        "IN": box(
            "七玄门外门记名弟子，社会位置边缘；在药园有一点小权力，但没有话语权。",
            socialId="七玄门外门弟子 / 药园杂役",
            orgBelonging="七玄门（外门）",
            classPos="记名弟子，低于正式弟子",
            circle="外门弟子、药园杂役",
            influence="透明边缘",
            publicEval="老实、能干、不爱说话",
            powerPos="被管理者",
            socialPressure="必须对管事保持顺从",
        ),
        "MN": box(
            "核心目标是活下去并走得更远；为此可以忍受枯燥、伪装和孤独。",
            "若必须用别人的命换自己的命，他会犹豫，但最终会动手。",
            coreValues="活着、自由、不欠人情",
            lifeGoal="筑基，离开越国，看看更大的世界",
            longVision="长生不是幻想，而是一条需要一步步验证的路",
            ultimateQuest="找到一条不依赖他人施舍的修行路径",
            uncompromise="身体与秘密",
            beliefs="人心可测，规则可用，但都要留后手",
            spiritSupport="对山外世界的想象",
            meaningSource="每天比昨天多活一点、多懂一点",
            valueConflict="想做个好人，但更想活下去",
            currentDilemma="是否继续隐藏掌天瓶，还是用它换取资源",
        ),
        "FN": box(
            "生活围绕药园与修炼运转；用固定流程降低决策成本。",
            "事务突然增多时会先砍掉社交和休息。",
            dailyRoutine="巡园→采药→抄方→夜间修炼→复盘",
            workflow="先处理墨大夫交代的事，再做自己的事",
            decisionProc="列出最坏结果→找退路→小步试探",
            timeMgmt="把整块时间留给修炼，碎片时间处理杂役",
            taskMgmt="按危险程度排序，不按紧急程度",
            collab="只与信得过的人合作",
            fixedHabits="睡前检查门窗与随身物品",
            ruleExecution="遵守明规则，利用潜规则",
            systemStability="一般稳定",
            systemBottleneck="没有可靠的信息来源",
        ),
    }
    hanli_individual = light_individual(
        {
            "time": ["fragmented", "night_owl"],
            "marriage": ["equal", "romantic"],
            "species": ["xianxia"],
            "religion": ["xianxia", "ascetic"],
            "aesthetic": ["xianxia", "minimalist"],
            "pref": ["S", "T", "J"],
            "cog": ["Si", "Te"],
        },
        {
            "routine": "卯时起，先巡药园，再按墨大夫的方子采药；午后抄方，夜里修炼。",
            "work": "药园杂役与修炼各占一半，杂役优先。",
            "rest": "睡前独处一炷香，不与人交谈。",
            "autonomy": "时间被职务切碎，只有深夜属于自己。",
            "pace": "慢而稳，宁可少做也不做错。",
            "pressure": "寿元、墨大夫的期限、没有筑基功法。",
            "marriage": "若结道侣，应是能并肩作战、互不拖累的人。",
            "love": "不轻易动心，动心则长久。",
            "sex": "谨慎，认为亲密关系也是风险。",
            "mate": "不拖累、能保守秘密、愿意一起走远。",
            "intimacy": "身体与秘密是最后边界。",
            "loyalty": "承诺了就会做到，但不会轻易承诺。",
            "species": "人族，无特殊血脉。",
            "group": "在群体中保持边缘，避免被注意。",
            "independent": "能独立生存，但不拒绝可靠的合作。",
            "death": "死亡是默认结局，修行是逆天改命。",
            "breeding": "顺其自然，不把传承当作必须。",
            "intimacyMech": "以信任为前提，以边界为底线。",
            "others": "先假设对方有恶意，再用行为验证。",
            "faith": "大道",
            "dogma": "活下去，才有资格谈道。",
            "taboo": "拿命换不确定的机缘。",
            "salvation": "自我救赎，不靠神佛。",
            "heretic": "不排斥，但保持距离。",
            "missionary": "否",
            "force": "否",
            "dress": "青布衣，耐脏、便于活动。",
            "arch": "实用、隐蔽、易守难攻。",
            "color": "青、灰、墨绿。",
            "art": "喜欢山水与药草，不听靡靡之音。",
            "aestheticTaboo": "铺张与炫耀。",
            "tone": "话少，语气平。",
            "standard": "生存概率",
            "secondary": "长期收益",
            "unacceptable": "被人控制或夺走身体",
            "conflict": "先退一步，再找机会；退无可退则先下手。",
            "case": "面对墨大夫的夺舍图谋，表面顺从，暗中下毒反杀。",
        },
        [
            imprint("墨居仁", "师徒情分可以是伪装，善意背后可能是杀意。", "强", "曾真心想相信一次", "被夺舍图谋击碎", "先保命，再谈情分", "不把身体交给任何人"),
            imprint("张铁之死", "信任会让人露出破绽，也会让敌人找到你的软肋。", "强", "想为朋友报仇", "张铁被墨大夫害死", "可以为朋友冒险，但不能让朋友替自己死", "不再让无辜者卷入自己的秘密"),
            imprint("掌天瓶", "秘密就是底牌，底牌不能给任何人看。", "极强", "曾想用瓶子换资源", "小瓶催熟灵药的能力", "宁可慢一点，也不暴露", "不在外人面前使用"),
        ],
    )
    hanli_history = [
        empty_event(
            source_event_id=ev["e1"], id="hist-hanli-e1", name="入七玄门",
            startTime="1023-03-01", age="17", lifeStage="少年",
            location="彩霞山·七玄门", relatedPeople="墨居仁、张铁、厉飞雨",
            domain=["机会变化"], polarity="奖赏", intensity="中",
            facts="韩立通过七玄门入门测试，成为外门记名弟子，被分到药园做杂役。",
            cognition="这是我离开山村、改变命运的唯一机会。",
            meaning="命运转折", meaningType="机会", certainty="确信",
            attribution=["自身", "外部偶然因素"], emotions=["兴奋", "焦虑"],
            emotionDuration="数日", psychologicalImpact="中",
            recurringEmotion="对失去机会的焦虑",
            firstReaction="攥紧拳头，告诉自己要抓住",
            actualAction="认真完成测试，主动争取药园差事",
            defenseAvoidance="隐藏自己识字与算学的基础",
            confrontation="无", helpSeeking="向引路师兄打听门规",
            finalResponse="接受记名弟子身份",
            directResult="成为七玄门外门弟子",
            lifeImpact="正式踏入修仙界", relationshipImpact="结识张铁、厉飞雨",
            beliefImpact="努力可以换来机会", longTermImpact="开始有意识地隐藏资质",
        ),
        empty_event(
            source_event_id=ev["e2"], id="hist-hanli-e2", name="被墨居仁收为记名弟子",
            startTime="1023-03-05", age="17", lifeStage="少年",
            location="七玄门·药园", relatedPeople="墨居仁",
            domain=["关系扰动"], polarity="稳定", intensity="中",
            facts="墨大夫看中韩立的资质，收其为记名弟子，亲自教授功法与药理。",
            cognition="他对我好得不正常，但我需要他的功法。",
            meaning="危险的馈赠", meaningType="转折", certainty="怀疑",
            attribution=["他人"], emotions=["困惑", "焦虑"],
            emotionDuration="持续", psychologicalImpact="中",
            recurringEmotion="被特别对待时的不安",
            firstReaction="先答应，再观察",
            actualAction="表面恭敬，暗中记录墨大夫的言行",
            defenseAvoidance="不透露自己真正的修炼进度",
            confrontation="无", helpSeeking="向张铁侧面打听墨大夫的旧事",
            finalResponse="接受师徒名分",
            directResult="获得长春功入门篇与药园权限",
            lifeImpact="修炼速度加快，也进入墨大夫的掌控",
            relationshipImpact="与墨大夫形成师徒名分",
            beliefImpact="善意需要验证", longTermImpact="开始准备退路",
        ),
        empty_event(
            source_event_id=ev["e5"], id="hist-hanli-e5", name="初得掌天瓶",
            startTime="1023-04-15", age="17", lifeStage="少年",
            location="七玄门·药园", relatedPeople="无",
            domain=["机会变化"], polarity="奖赏", intensity="高",
            facts="韩立在药园角落得到一只墨绿小瓶，发现瓶内液体能催熟灵药。",
            cognition="这东西绝不能让别人知道。",
            meaning="底牌", meaningType="机会", certainty="确信",
            attribution=["外部偶然因素"], emotions=["喜悦", "恐惧"],
            emotionDuration="长期", psychologicalImpact="高",
            recurringEmotion="怕秘密暴露的紧张",
            firstReaction="立刻藏进怀里，假装什么都没发生",
            actualAction="夜间独自试验，记录催熟效果",
            defenseAvoidance="不在任何人面前取出小瓶",
            confrontation="无", helpSeeking="无",
            finalResponse="把秘密咽下去",
            directResult="获得掌天瓶与催熟灵药的能力",
            lifeImpact="拥有了不依赖门派的资源来源",
            relationshipImpact="对所有人更加保留",
            beliefImpact="底牌比承诺可靠", longTermImpact="为离开七玄门提供底气",
        ),
        empty_event(
            source_event_id=ev["e3"], id="hist-hanli-e3", name="察觉墨居仁的夺舍图谋",
            startTime="1023-09-01", age="18", lifeStage="青年",
            location="七玄门·药园", relatedPeople="墨居仁",
            domain=["存在转变", "控制失效"], polarity="威胁", intensity="高",
            facts="韩立发现墨大夫身负重伤，并逐渐意识到对方收徒的真实目的是夺舍。",
            cognition="他要的不是徒弟，是我的身体。",
            meaning="生死危机", meaningType="威胁", certainty="怀疑",
            attribution=["他人"], emotions=["恐惧", "愤怒"],
            emotionDuration="数日", psychologicalImpact="高",
            recurringEmotion="被注视时的寒意",
            firstReaction="装作不知，先确认",
            actualAction="试探墨大夫的伤势与底牌，准备反制",
            defenseAvoidance="继续扮演听话的徒弟",
            confrontation="尚未公开", helpSeeking="不敢告诉任何人",
            finalResponse="决定先下手",
            directResult="确认夺舍图谋",
            lifeImpact="从被动求生转为主动反击",
            relationshipImpact="师徒关系名存实亡",
            beliefImpact="退无可退时必须先动手", longTermImpact="留下对强者的深层警惕",
        ),
        empty_event(
            source_event_id=ev["e4"], id="hist-hanli-e4", name="反杀墨居仁",
            startTime="1023-09-10", age="18", lifeStage="青年",
            location="七玄门·药园", relatedPeople="墨居仁",
            domain=["存在转变"], polarity="威胁", intensity="高",
            facts="韩立以毒计反杀墨居仁，处理尸体后对外称墨大夫外出未归。",
            cognition="不是你死，就是我活。",
            meaning="生存代价", meaningType="转折", certainty="确信",
            attribution=["自身", "他人"], emotions=["恐惧", "释然", "厌恶"],
            emotionDuration="数月", psychologicalImpact="高",
            recurringEmotion="杀人后的麻木与警觉",
            firstReaction="下毒后补刀，确认彻底死亡",
            actualAction="清理现场，制造墨大夫外出的假象",
            defenseAvoidance="不回想细节",
            confrontation="正面摊牌后动手", helpSeeking="无",
            finalResponse="离开药园，回到外门",
            directResult="墨居仁身死，韩立摆脱控制",
            lifeImpact="获得自由，也背上第一条人命",
            relationshipImpact="控制与师生关系终结",
            beliefImpact="善良需要牙齿", longTermImpact="对“师徒”二字不再轻信",
        ),
        empty_event(
            source_event_id=ev["e6"], id="hist-hanli-e6", name="离开七玄门",
            startTime="1023-09-20", age="18", lifeStage="青年",
            location="彩霞山", relatedPeople="厉飞雨",
            domain=["机会变化"], polarity="扩张", intensity="中",
            facts="了结墨居仁之事后，韩立辞别七玄门，前往黄枫谷求取仙途。",
            cognition="七玄门容不下我，黄枫谷或许有筑基的机会。",
            meaning="主动选择", meaningType="机会", certainty="确信",
            attribution=["自身"], emotions=["释然", "兴奋"],
            emotionDuration="数日", psychologicalImpact="中",
            recurringEmotion="对未知的谨慎兴奋",
            firstReaction="收拾行李，只带走必要之物",
            actualAction="向厉飞雨告别，独自下山",
            defenseAvoidance="不告诉任何人掌天瓶的事",
            confrontation="无", helpSeeking="向厉飞雨打听黄枫谷的入门路径",
            finalResponse="离开",
            directResult="脱离七玄门",
            lifeImpact="从凡俗武林走向修仙门派",
            relationshipImpact="与七玄门、彩霞山的关系结束",
            beliefImpact="路要自己选", longTermImpact="开始以散修身份面对修仙界",
        ),
    ]
    hanli_deposits = dep(
        repeatedPatterns="每次被特别对待，背后都跟着一个陷阱；每次获得资源，都要先想好怎么藏。",
        relationshipPatterns="先观察、再试探、最后才交心；一旦被背叛，会彻底切断。",
        recurringDifficulties="缺少功法与灵石；没有可靠的长辈；秘密不能分享。",
        opportunitiesAndRewards="药园职务、掌天瓶、黄枫谷入门机会。",
        chronicStress="对墨大夫的恐惧、对秘密暴露的焦虑、对寿元的紧迫感。",
        historicalUnderstanding="修仙界不是讲道理的地方，规则由强者书写。",
        coreBeliefs="活着最重要；底牌不能交；承诺要兑现。",
        longTermObsession="筑基与长生。",
        psychologicalBoundaries="身体、掌天瓶、修炼功法不可让渡。",
        defenseTendencies="伪装顺从、信息隔离、提前布置退路。",
        behavioralHabits="睡前检查门窗；出门带毒药与解药；不喝别人递的茶。",
        relationshipModels="少数深度关系 + 大量泛泛之交；对深度关系愿意冒险。",
        riskJudgment="先算最坏结果；能承受才做；不能承受就换路。",
        trajectory=[
            {
                "id": "traj-hanli-1", "period": "1023-03 至 1023-09",
                "beforeState": "山村少年，谨慎但仍有幻想",
                "afterState": "手上有第一条人命的修士",
                "relatedExperience": "拜师、得瓶、夺舍、反杀",
                "behaviorChange": "从被动顺从转为主动布局",
                "engineChange": "D 与 T 成为主导，O 被压制",
                "stableParts": "对生存的执念、对少数人的忠诚",
                "selfUnderstanding": "我不是好人，但我想活下去",
            },
            {
                "id": "traj-hanli-2", "period": "1023-09 之后",
                "beforeState": "七玄门外门弟子",
                "afterState": "黄枫谷求道者",
                "relatedExperience": "离开七玄门、通过黄枫谷测试",
                "behaviorChange": "开始主动争取资源，不再只做杂役",
                "engineChange": "V 上升，愿意为长期目标承担更大风险",
                "stableParts": "谨慎、隐藏底牌",
                "selfUnderstanding": "路要自己选，代价也要自己付",
            },
        ],
        currentInfluences=[
            {
                "id": "inf-hanli-1", "domain": "关系",
                "sourceEvent": "墨居仁夺舍与反杀",
                "currentManifestation": "对权威人物保持距离，先观察再服从",
                "isOngoing": "是", "hasChanged": "部分改变",
                "currentView": "师徒名分可以是工具，也可能是陷阱",
            },
            {
                "id": "inf-hanli-2", "domain": "资源",
                "sourceEvent": "获得掌天瓶",
                "currentManifestation": "习惯隐藏真正底牌，用普通资源示人",
                "isOngoing": "是", "hasChanged": "未改变",
                "currentView": "秘密就是命",
            },
        ],
    )
    hanli_initial = {
        "initialData": initial(
            energyState="偏低", energyDescription="长期杂役与夜间修炼，睡眠不足",
            energyConsumption="推演与伪装最耗神", energyRecovery="睡眠、药膳、独处",
            pressureState="高", pressureSource="墨居仁的夺舍图谋与寿元压力",
            pressureDuration="数月", pressureImpact="警觉升高，睡眠变浅",
            loadState="接近上限", responsibilities="药园杂役、伪装徒弟、准备反制",
            taskComplexity="多线并行", isOverloaded="是",
            loadSource="同时应付墨大夫、门规与自己的秘密",
            primaryEmotion=["焦虑", "恐惧"], secondaryEmotion="愤怒",
            emotionDuration="持续", emotionTrigger="墨大夫的注视",
            emotionManifestation="话更少，检查退路的频率更高",
            mainDilemma="先动手还是继续等证据",
            dilemmaDomain="生存", dilemmaCause="墨大夫随时可能夺舍",
            dilemmaProgress="已确认意图，尚未摊牌", dilemmaAwareness="完全清楚",
            dilemmaResponse="准备毒药与退路",
            primaryEngine="D", secondaryEngine="T",
            engineRelation="D 踩刹车，T 找路径",
            engineManifestation="白天顺从，夜里推演",
            engineTrigger="被限制自由或追问秘密",
            snapshotName="反杀前夜", snapshotTime="1023-09-09",
            lifeStage="青年", overallDescription="外表平静、内里绷紧的求生者",
            snapshotNotes="已决定先下手，但仍在评估失败后的退路",
        ),
        "initialGoals": [
            goal("goal-hanli-1", "活着离开七玄门", "最高", "墨大夫要夺舍", "摆脱控制并保住秘密", "准备毒药、试探底牌", "墨大夫的修为高于自己", ""),
            goal("goal-hanli-2", "找到筑基功法", "高", "没有功法就无法走远", "进入黄枫谷或获得完整传承", "打听黄枫谷入门路径", "缺少灵石与推荐", ""),
            goal("goal-hanli-3", "隐藏掌天瓶", "最高", "秘密暴露会招来杀身之祸", "不让任何人知道小瓶的存在", "只在夜间独自使用", "催熟灵药需要时间与地点", ""),
        ],
        "initialRelations": [
            relation("rel-hanli-1", "墨居仁", "师徒（伪装）", "控制与反控制", "随时断裂", "夺舍图谋", "功法与药园权限", "既怕又恨", ""),
            relation("rel-hanli-2", "张铁", "朋友", "同门互助", "已断裂", "张铁被墨大夫害死", "曾互相照应", "愧疚与怀念", ""),
            relation("rel-hanli-3", "厉飞雨", "朋友", "患难之交", "相对稳定", "韩立即将离开", "情报与送别", "信任", ""),
            relation("rel-hanli-4", "南宫婉", "未来的道侣", "尚未相识", "未知", "无", "无", "陌生", "此时尚未相遇"),
        ],
        "initialResources": [
            resource_item("res-hanli-1", "掌天瓶", "完全私有", "无", "不能示人", "唯一", "稳定", "核心底牌"),
            resource_item("res-hanli-2", "下品灵石", "私有", "无", "数量有限", "稀缺", "波动", "修炼与交易"),
            resource_item("res-hanli-3", "药园灵药", "职务便利", "门中财产", "不能私采", "较稀缺", "稳定", "炼制与自用"),
        ],
    }

    # ==================================================================
    # 墨居仁
    # ==================================================================
    mo_engines = {
        "O": E(70, "对续命资源与躯壳的占有欲", "先以恩义绑定，再逐步收紧控制", "把所有人都当资源，最终众叛亲离", "该果断时犹豫，错失夺舍时机", desire="一具合适的年轻躯壳", threat="伤势恶化、计划暴露", resources="药园、丹药、功法", needs="续命", impact="为达目的不断加码"),
        "V": E(65, "对活下去的执念", "把续命拆成可执行的步骤", "执念压过判断，低估韩立", "失去执念后迅速崩溃", desire="活下去", threat="死亡", resources="医术与丹药", needs="希望", impact="能忍受长期伪装"),
        "D": E(75, "对风险的控制", "先布局再收网", "过度自信，忽略变量的变化", "被动时反应迟缓", desire="可控的夺舍", threat="被反杀", resources="对韩立的了解", needs="信息优势", impact="选择最安全的时机"),
        "E": E(40, "社交投入低，关系多为工具", "维持必要的人设", "孤立无援", "需要帮助时无人可用", desire="不被干扰", threat="被看穿", resources="管事身份", needs="掩护", impact="减少无谓社交"),
        "T": E(85, "对医术、药性与人性的拆解", "把人也当药材来配", "算计过度，忽略情感", "遇到不按常理出牌的人会失灵", desire="掌控变量", threat="变量失控", resources="医书与经验", needs="验证", impact="能设计复杂的控制方案"),
    }
    mo_mechanisms = light_mechanisms({
        "env": "七玄门药园是他的独立王国，门规给他空间，也给他掩护。",
        "pressure": "伤势恶化，时间不多",
        "resistance": "修为受损，无法强夺",
        "energy": "靠丹药吊住精力，外强中干。",
        "body": "旧伤未愈，动一次手要缓很久。",
        "defense": "以长辈姿态掩盖算计。",
        "defenseType": "合理化、投射、控制",
        "trigger": "韩立表现出超出预期的能力",
        "thinking": "习惯把一切纳入计划，讨厌意外。",
        "fast": "用现成话术稳住对方",
        "slow": "反复推演夺舍时机与风险",
        "action": "以教导、给药、安排杂役来推进控制。",
        "script": "旧经验告诉他：年轻人好骗。",
        "oldScript": "先施恩，再收网",
        "scriptImpact": "低估了韩立的警觉",
        "sovereignty": "自己的命高于一切。",
        "veto": "任何威胁续命的方案",
        "cut": "计划暴露时，会选择灭口而不是解释。",
    })
    mo_reality = {
        "PN": box("药园管事，有独立居所与丹药储备，生活优于普通弟子。", basicResources="药园居所、丹药、医书", bodyRoutine="昼伏夜出，靠丹药维持", economy="掌控药园资源", resourceStability="稳定", livingSpace="有序", pressure="伤势与时间"),
        "AN": box("医术与药性知识深厚，能独立炼制常用丹药。", eduBg="家传医术与七玄门功法", profSkill="医术、炼丹、药性辨别", pracExp="多年药园管事", independentTask="诊断与炼制常见丹药", methodology="先诊断，再配方，再试药", strengths="经验丰富、耐心", weaknesses="修为受损、缺少信任的人", growthDir="夺舍后重修", bottleneck="身体"),
        "RN": box("几乎没有真正信任的关系，所有人都是棋子。", relDistribution="表面熟人不少，深度关系为零", trustTargets="无", relStability="随时断裂", mutualSupport="单向付出", boundary="不允许任何人进入私人领域", mainPressure="秘密不能分享", availableSupport="无"),
        "IN": box("七玄门药园管事，地位高于外门弟子，但受门规约束。", socialId="药园管事", orgBelonging="七玄门", classPos="中层管事", circle="药园、外门", influence="小有名气", publicEval="医术好、脾气怪", powerPos="基层管理者", socialPressure="必须维持长辈体面"),
        "MN": box("活下去是唯一意义；为此可以放弃身份、道德与师徒名分。", coreValues="生存", lifeGoal="夺舍续命", longVision="换一具身体重新修炼", ultimateQuest="不死", uncompromise="自己的命", beliefs="人皆可为药", spiritSupport="对死亡的恐惧", meaningSource="活着本身", valueConflict="曾想体面地死，但更想活", currentDilemma="是否提前动手"),
        "FN": box("生活围绕药园与夺舍计划运转，流程高度私密。", dailyRoutine="诊病、配药、观察韩立", workflow="先稳住韩立，再寻找时机", decisionProc="评估风险→准备退路→收网", timeMgmt="按伤势恶化速度安排", taskMgmt="只做与续命有关的事", collab="不需要合作", fixedHabits="每日检查丹药存量", ruleExecution="利用门规漏洞", systemStability="经常变动", systemBottleneck="身体"),
    }
    mo_individual = light_individual(
        {"time": ["clan"], "marriage": ["clan"], "species": ["xianxia"], "religion": ["xianxia"], "aesthetic": ["xianxia", "gothic"], "pref": ["N", "T", "J"], "cog": ["Ni", "Te"]},
        {
            "routine": "白天诊病配药，夜里观察韩立并推演夺舍时机。", "work": "药园事务与夺舍计划各占一半。", "rest": "靠打坐代替睡眠。", "autonomy": "极高，几乎不受门规约束。", "pace": "慢，但每一步都有目的。", "pressure": "伤势恶化。", "marriage": "婚姻是家族与传承的工具。", "love": "不信任感情。", "sex": "克制。", "mate": "能延续血脉或带来资源的人。", "intimacy": "不允许任何人靠近。", "loyalty": "对死人守诺，对活人算计。", "species": "人族，无特殊血脉。", "group": "游离于群体之外。", "independent": "习惯独行。", "death": "死亡是失败，不是归宿。", "breeding": "传承重要，但不如自己活着重要。", "intimacyMech": "以控制代替亲密。", "others": "先找可利用之处。", "faith": "长生", "dogma": "活着才有资格谈道。", "taboo": "为别人牺牲自己。", "salvation": "靠自己。", "heretic": "蔑视。", "missionary": "否", "force": "否", "dress": "灰袍，整洁。", "arch": "封闭、幽暗。", "color": "灰、墨。", "art": "医书与药谱。", "aestheticTaboo": "喧闹。", "tone": "温和而疏离。", "standard": "续命概率", "secondary": "控制成本", "unacceptable": "计划暴露且无法收网", "conflict": "先稳住，再灭口。", "case": "收韩立为徒，实为夺舍做准备。",
        },
        [imprint("死亡", "身体会背叛人，只有换一具身体才能继续。", "极强", "曾想坦然赴死", "重伤濒死", "为活下去可以不择手段", "不把命交给任何人")],
    )
    mo_history = [
        empty_event(source_event_id=ev["e2"], id="hist-mo-e2", name="收韩立为记名弟子", startTime="1023-03-05", age="六十余", lifeStage="暮年", location="七玄门·药园", relatedPeople="韩立", domain=["关系扰动"], polarity="稳定", intensity="中", facts="墨居仁以师徒名分将韩立纳入药园，开始观察其体质。", cognition="这具身体或许能用。", meaning="续命的希望", meaningType="机会", certainty="怀疑", attribution=["自身"], emotions=["兴奋", "麻木"], firstReaction="示好并传授基础功法", actualAction="安排韩立住进药园、随叫随到", directResult="韩立成为记名弟子", lifeImpact="夺舍计划启动", relationshipImpact="建立师徒名分", beliefImpact="年轻人可以被恩义控制"),
        empty_event(source_event_id=ev["e3"], id="hist-mo-e3", name="图谋夺舍", startTime="1023-09-01", age="六十余", lifeStage="暮年", location="七玄门·药园", relatedPeople="韩立", domain=["存在转变", "控制失效"], polarity="威胁", intensity="高", facts="墨居仁伤势恶化，决定提前对韩立实施夺舍。", cognition="不能再等了。", meaning="最后的机会", meaningType="威胁", certainty="确信", attribution=["自身"], emotions=["焦虑", "兴奋"], firstReaction="准备阵法与丹药", actualAction="试探韩立并布置夺舍条件", directResult="暴露意图", lifeImpact="走向死亡", relationshipImpact="师徒关系破裂", beliefImpact="时间不站在自己这边"),
        empty_event(source_event_id=ev["e4"], id="hist-mo-e4", name="被韩立反杀", startTime="1023-09-10", age="六十余", lifeStage="暮年", location="七玄门·药园", relatedPeople="韩立", domain=["存在转变"], polarity="威胁", intensity="高", facts="墨居仁在夺舍前夕被韩立下毒并补刀，身死道消。", cognition="我看错了他。", meaning="终局", meaningType="损失", certainty="确信", attribution=["自身", "他人"], emotions=["愤怒", "恐惧"], firstReaction="试图反击", actualAction="挣扎后死亡", directResult="身死", lifeImpact="计划彻底失败", relationshipImpact="控制关系终结", beliefImpact="轻敌是致命的"),
    ]
    mo_deposits = dep(
        repeatedPatterns="先施恩，再收网；把亲近的人变成棋子。",
        relationshipPatterns="表面温和，内里控制；不允许任何人真正靠近。",
        recurringDifficulties="伤势反复、时间不够、找不到合适躯壳。",
        opportunitiesAndRewards="韩立的资质、药园的资源。",
        chronicStress="对死亡的恐惧。",
        historicalUnderstanding="修仙界只认实力，体面是奢侈品。",
        coreBeliefs="活着高于一切。",
        longTermObsession="续命。",
        psychologicalBoundaries="自己的命与秘密。",
        defenseTendencies="合理化、投射、控制。",
        behavioralHabits="每日检查丹药；观察弟子的作息。",
        relationshipModels="工具关系。",
        riskJudgment="只要收益足够大，风险可以承受。",
    )
    mo_initial = {
        "initialData": initial(
            energyState="低", energyDescription="靠丹药吊命", pressureState="极高",
            pressureSource="伤势与寿元", pressureDuration="持续", pressureImpact="判断变急",
            loadState="超载", responsibilities="药园管事、夺舍计划", taskComplexity="高",
            isOverloaded="是", primaryEmotion=["焦虑", "兴奋"], secondaryEmotion="恐惧",
            mainDilemma="提前夺舍还是再等", dilemmaDomain="生存",
            dilemmaCause="身体撑不住", dilemmaProgress="已开始布置",
            dilemmaAwareness="清楚", dilemmaResponse="加速计划",
            primaryEngine="T", secondaryEngine="O",
            snapshotName="夺舍前夜", snapshotTime="1023-09-09", lifeStage="暮年",
            overallDescription="外强中干、孤注一掷的老修士",
        ),
        "initialGoals": [
            goal("goal-mo-1", "夺舍韩立", "最高", "身体即将崩溃", "换一具年轻躯壳", "布置阵法与丹药", "韩立的警觉", ""),
            goal("goal-mo-2", "恢复修为", "高", "修为受损", "重新筑基", "夺舍后重修", "功法与资源", ""),
        ],
        "initialRelations": [
            relation("rel-mo-1", "韩立", "师徒（伪装）", "控制", "随时断裂", "夺舍", "功法与资源", "工具", ""),
            relation("rel-mo-2", "张铁", "同门", "无足轻重", "已断裂", "灭口", "无", "弃子", ""),
            relation("rel-mo-3", "七玄门", "隶属", "相互利用", "稳定", "门规约束", "身份掩护", "栖身之所", ""),
        ],
        "initialResources": [
            resource_item("res-mo-1", "药园", "管理权", "门中财产", "不能公开私用", "唯一", "稳定", "掩护与资源"),
            resource_item("res-mo-2", "丹药", "私有", "无", "数量有限", "稀缺", "波动", "续命"),
        ],
    }

    # ==================================================================
    # 张铁
    # ==================================================================
    zhang_engines = {
        "O": E(45, "对安稳生活与朋友的占有欲", "先照顾身边的人，再考虑自己", "为了朋友过度冒险", "该争取时退缩", desire="在门派站稳脚跟", threat="被淘汰、被欺负", resources="体力与憨厚", needs="归属", impact="愿意为朋友挡事"),
        "V": E(40, "对简单目标的坚持", "认准的事就做到底", "固执", "目标不清时随波逐流", desire="吃饱、练功、和朋友一起", threat="被赶出门派", resources="年轻与力气", needs="方向", impact="不容易被诱惑"),
        "D": E(50, "对风险的判断一般", "先做了再说", "容易被人利用", "遇到危险反应慢", desire="不出事", threat="被人算计", resources="直觉", needs="提醒", impact="需要韩立这样的人把关"),
        "E": E(70, "社交需求高，重感情", "主动帮人、爱热闹", "被人情绑架", "孤独时容易消沉", desire="被需要", threat="被朋友抛弃", resources="人缘", needs="朋友", impact="愿意为朋友两肋插刀"),
        "T": E(45, "对复杂事物拆解能力一般", "靠经验和直觉", "想不通就硬扛", "容易被话术骗", desire="简单明白", threat="复杂骗局", resources="生活经验", needs="可信的人", impact="对墨大夫的异常不敏感"),
    }
    zhang_mechanisms = light_mechanisms({
        "env": "七玄门外门，规矩多、资源少，但同龄人多。",
        "pressure": "想留在门派",
        "resistance": "没有背景与天赋",
        "energy": "年轻体力好，恢复快。",
        "body": "壮实，耐造。",
        "defense": "用憨厚和退让化解冲突。",
        "defenseType": "退让、讨好",
        "trigger": "被管事或师兄训斥",
        "thinking": "直线思维，认死理。",
        "fast": "凭直觉行动",
        "slow": "很少慢下来想",
        "action": "多干活、少说话。",
        "script": "从小被教导要老实。",
        "oldScript": "吃亏是福",
        "scriptImpact": "对恶意缺乏防备",
        "sovereignty": "朋友与尊严。",
        "veto": "出卖朋友",
        "cut": "被逼到绝境时会硬拼。",
    })
    zhang_reality = {
        "PN": box("外门弟子通铺，饭能吃饱，几乎没有余钱。", basicResources="通铺、饭食、旧衣", bodyRoutine="早起练功、白天杂役", economy="无积蓄", resourceStability="稳定", livingSpace="拥挤", pressure="怕被赶出门派"),
        "AN": box("体力活和基础拳脚扎实，缺少高阶功法。", eduBg="七玄门入门功法", profSkill="拳脚、杂役、采药", pracExp="外门杂役", independentTask="完成体力活与简单巡山", strengths="力气大、耐劳", weaknesses="不识字、不会算计", growthDir="练好基本功", bottleneck="天赋"),
        "RN": box("把韩立当兄弟，和厉飞雨也合得来。", relDistribution="朋友不多但交心", trustTargets="韩立、厉飞雨", relStability="相对稳定", mutualSupport="极度互助", boundary="朋友的事就是自己的事", mainPressure="怕连累朋友", availableSupport="韩立与厉飞雨"),
        "IN": box("外门弟子，边缘但合群。", socialId="七玄门外门弟子", orgBelonging="七玄门", classPos="外门弟子", circle="外门", influence="透明边缘", publicEval="老实、肯干", powerPos="被管理者", socialPressure="怕被看不起"),
        "MN": box("想让家人过得好，也想和朋友一起走下去。", coreValues="义气、安稳", lifeGoal="留在七玄门、照顾家人", longVision="没想太远", ultimateQuest="活得踏实", uncompromise="不出卖朋友", beliefs="好人有好报", spiritSupport="朋友", meaningSource="被需要", valueConflict="想帮朋友又怕帮倒忙", currentDilemma="要不要把墨大夫的异常告诉韩立"),
        "FN": box("生活简单：练功、干活、和朋友吃饭。", dailyRoutine="早起练功、白天杂役、晚上聊天", workflow="听安排", decisionProc="凭直觉", timeMgmt="跟着门派作息", taskMgmt="一件件做", collab="愿意帮人", fixedHabits="吃饭很快", ruleExecution="老实遵守", systemStability="极其稳定", systemBottleneck="不会拒绝"),
    }
    zhang_individual = light_individual(
        {"time": ["clan"], "marriage": ["clan", "equal"], "species": ["xianxia"], "religion": ["xianxia"], "aesthetic": ["xianxia"], "pref": ["S", "F", "P"], "cog": ["Se", "Fi"]},
        {
            "routine": "跟着门中作息，早起练功，白天干活。", "work": "杂役为主。", "rest": "和朋友聊天。", "autonomy": "低。", "pace": "快而直。", "pressure": "怕被淘汰。", "marriage": "想找个踏实的人过日子。", "love": "认定就不变。", "sex": "羞涩。", "mate": "善良、能过日子。", "intimacy": "朋友可以勾肩搭背，心事不轻易说。", "loyalty": "极重承诺。", "species": "人族。", "group": "外门弟子。", "independent": "不太能独处。", "death": "怕死，但更怕朋友死。", "breeding": "顺其自然。", "intimacyMech": "用行动表达。", "others": "先当好人。", "faith": "好人有好报", "dogma": "不能出卖朋友。", "taboo": "背后捅刀。", "salvation": "靠朋友。", "heretic": "不关心。", "missionary": "否", "force": "否", "dress": "短打。", "arch": "热闹。", "color": "土黄。", "art": "听人说书。", "aestheticTaboo": "矫情。", "tone": "大嗓门。", "standard": "对得起朋友", "secondary": "安稳", "unacceptable": "出卖朋友", "conflict": "先让，让不了就硬扛。", "case": "替韩立挡下师兄的刁难。",
        },
        [imprint("韩立", "朋友就是要有难同当。", "强", "曾被人提醒别多管闲事", "韩立帮他解围", "不让朋友一个人扛", "不出卖朋友")],
    )
    zhang_history = [
        empty_event(source_event_id=ev["e1"], id="hist-zhang-e1", name="入七玄门", startTime="1023-03-01", age="17", lifeStage="少年", location="彩霞山·七玄门", relatedPeople="韩立、厉飞雨", domain=["机会变化"], polarity="奖赏", intensity="中", facts="张铁通过入门测试，成为外门弟子，与韩立、厉飞雨结识。", cognition="终于有地方可去了。", meaning="新生活", meaningType="机会", certainty="确信", attribution=["自身"], emotions=["兴奋"], firstReaction="咧嘴笑", actualAction="主动帮同门搬东西", directResult="成为外门弟子", lifeImpact="有了落脚处", relationshipImpact="结识韩立与厉飞雨", beliefImpact="只要肯干就能留下"),
        empty_event(source_event_id=ev["e7"], id="hist-zhang-e7", name="被墨居仁毒害", startTime="1023-08-20", age="17", lifeStage="少年", location="七玄门·药园", relatedPeople="墨居仁", domain=["存在转变"], polarity="威胁", intensity="高", facts="张铁发现墨大夫的秘密，被灭口。", cognition="我不该多嘴。", meaning="终点", meaningType="损失", certainty="确信", attribution=["他人"], emotions=["恐惧", "愤怒"], firstReaction="想跑", actualAction="挣扎后被毒杀", directResult="身死", lifeImpact="生命终止", relationshipImpact="与韩立、厉飞雨的关系被迫中断", beliefImpact="好人未必有好报"),
    ]
    zhang_deposits = dep(
        repeatedPatterns="因为多管闲事惹上麻烦。",
        relationshipPatterns="把朋友的事当自己的事。",
        recurringDifficulties="不会拒绝、不会算计。",
        opportunitiesAndRewards="遇到韩立与厉飞雨。",
        chronicStress="怕被赶出门派。",
        historicalUnderstanding="门派里也有坏人。",
        coreBeliefs="义气最重要。",
        longTermObsession="和朋友一起站稳脚跟。",
        psychologicalBoundaries="不出卖朋友。",
        defenseTendencies="退让、讨好。",
        behavioralHabits="先帮别人。",
        relationshipModels="兄弟式关系。",
        riskJudgment="为了朋友可以冒险。",
    )
    zhang_initial = {
        "initialData": initial(
            energyState="正常", pressureState="中", pressureSource="门派竞争",
            primaryEmotion=["焦虑"], secondaryEmotion="期待",
            mainDilemma="要不要把墨大夫的异常说出去", dilemmaDomain="关系",
            primaryEngine="E", secondaryEngine="O",
            snapshotName="发现秘密之后", snapshotTime="1023-08-19",
            lifeStage="少年", overallDescription="憨厚、讲义气的外门弟子",
        ),
        "initialGoals": [
            goal("goal-zhang-1", "留在七玄门", "高", "家里需要他", "成为正式弟子", "多干活", "天赋不足", ""),
            goal("goal-zhang-2", "帮韩立站稳脚跟", "高", "把韩立当兄弟", "韩立不被欺负", "替韩立挡事", "自己能力有限", ""),
        ],
        "initialRelations": [
            relation("rel-zhang-1", "韩立", "朋友", "兄弟", "极其稳固", "无", "互相照应", "信任", ""),
            relation("rel-zhang-2", "厉飞雨", "朋友", "同门", "相对稳定", "偶尔斗嘴", "一起玩", "亲近", ""),
        ],
        "initialResources": [
            resource_item("res-zhang-1", "外门弟子身份", "门中给予", "可被收回", "低阶", "常见", "稳定", "落脚处"),
        ],
    }

    # ==================================================================
    # 厉飞雨
    # ==================================================================
    li_engines = {
        "O": E(55, "对机会与刺激的追求", "先冲上去再说", "冒进", "错过机会", desire="出人头地", threat="一辈子做外门", resources="机灵与身手", needs="机会", impact="敢闯"),
        "V": E(60, "对变强的执念", "练功、找门路", "急功近利", "受挫后易怒", desire="成为正式弟子", threat="被淘汰", resources="功法与身手", needs="上升通道", impact="愿意冒险"),
        "D": E(55, "对风险的判断中等", "边做边看", "低估危险", "危险来临时反应快", desire="赢", threat="输", resources="反应速度", needs="提醒", impact="需要韩立把关"),
        "E": E(75, "社交需求高，朋友多", "讲义气、爱热闹", "被人情拖累", "孤独时焦躁", desire="朋友与热闹", threat="被孤立", resources="人缘", needs="伙伴", impact="愿意为朋友出头"),
        "T": E(50, "拆解能力中等偏上", "靠小聪明", "聪明反被聪明误", "遇到真正的算计会吃亏", desire="看透局面", threat="被利用", resources="江湖经验", needs="可信的军师", impact="能提供情报"),
    }
    li_mechanisms = light_mechanisms({
        "env": "七玄门外门，机会少、竞争多。",
        "pressure": "想出人头地",
        "resistance": "没有背景",
        "energy": "精力旺盛。", "body": "灵活，耐打。",
        "defense": "用玩笑和义气化解冲突。",
        "defenseType": "幽默、转移、出头",
        "trigger": "朋友被欺负",
        "thinking": "反应快，喜欢走捷径。", "fast": "先出手", "slow": "很少深想",
        "action": "练功、结交、找门路。",
        "script": "江湖经验告诉他：撑死胆大的。",
        "oldScript": "有机会就上",
        "scriptImpact": "容易被人当枪使",
        "sovereignty": "朋友与面子。", "veto": "出卖朋友",
        "cut": "被逼急了会拼命。",
    })
    li_reality = {
        "PN": box("外门弟子，生活紧巴但过得热闹。", basicResources="通铺、饭食", bodyRoutine="练功、巡山、聚会", economy="偶尔接私活", resourceStability="波动", livingSpace="拥挤", pressure="想出头"),
        "AN": box("身手灵活，会来事，实战经验多于张铁。", eduBg="七玄门入门功法", profSkill="拳脚、轻功、打听消息", pracExp="外门巡山", independentTask="巡山、传话、处理小冲突", strengths="机灵、反应快", weaknesses="沉不住气", growthDir="正式弟子", bottleneck="功法"),
        "RN": box("朋友多，真正交心的有韩立、张铁。", relDistribution="泛交广、深交少", trustTargets="韩立、张铁", relStability="相对稳定", mutualSupport="礼尚往来", boundary="朋友的事会管", mainPressure="怕朋友出事", availableSupport="韩立、张铁"),
        "IN": box("外门活跃分子，消息灵通。", socialId="七玄门外门弟子", orgBelonging="七玄门", classPos="外门弟子", circle="外门与杂役", influence="透明边缘", publicEval="机灵、够义气", powerPos="被管理者", socialPressure="要面子"),
        "MN": box("想混出个人样，也想和朋友一起混出个人样。", coreValues="义气、出头", lifeGoal="成为正式弟子", longVision="走出七玄门", ultimateQuest="不被人看不起", uncompromise="不出卖朋友", beliefs="胆子大才有机会", spiritSupport="朋友", meaningSource="被认可", valueConflict="想稳又想赌", currentDilemma="要不要离开七玄门去闯"),
        "FN": box("生活热闹，靠人脉和消息运转。", dailyRoutine="练功、巡山、和朋友吃饭", workflow="先打听再行动", decisionProc="凭经验和义气", timeMgmt="跟着门派", taskMgmt="先做有趣的", collab="喜欢组队", fixedHabits="睡前聊几句", ruleExecution="灵活遵守", systemStability="一般稳定", systemBottleneck="沉不住气"),
    }
    li_individual = light_individual(
        {"time": ["night_owl", "fragmented"], "marriage": ["free_love", "equal"], "species": ["xianxia"], "religion": ["xianxia"], "aesthetic": ["xianxia"], "pref": ["S", "F", "P"], "cog": ["Se", "Fi"]},
        {
            "routine": "白天练功巡山，晚上和朋友聚。", "work": "巡山与跑腿。", "rest": "聊天、喝酒。", "autonomy": "中等。", "pace": "快。", "pressure": "想出人头地。", "marriage": "想找个合得来的人。", "love": "热烈但未必长久。", "sex": "开放。", "mate": "有趣、讲义气。", "intimacy": "朋友可以很近，恋人要自由。", "loyalty": "对朋友忠诚。", "species": "人族。", "group": "外门活跃分子。", "independent": "能独处但更喜欢热闹。", "death": "怕死，但不服输。", "breeding": "以后再说。", "intimacyMech": "用行动和陪伴。", "others": "先交朋友。", "faith": "义气", "dogma": "朋友不能卖。", "taboo": "背后捅刀。", "salvation": "靠兄弟。", "heretic": "无所谓。", "missionary": "否", "force": "否", "dress": "利落短打。", "arch": "开阔。", "color": "亮色。", "art": "听曲、看热闹。", "aestheticTaboo": "死气沉沉。", "tone": "贫嘴。", "standard": "义气", "secondary": "机会", "unacceptable": "被朋友出卖", "conflict": "先出头，再讲理。", "case": "替张铁打抱不平。",
        },
        [imprint("张铁", "朋友出事不能不管。", "强", "曾被人劝少管闲事", "张铁被欺负", "该出手就出手", "不出卖朋友")],
    )
    li_history = [
        empty_event(source_event_id=ev["e1"], id="hist-li-e1", name="入七玄门", startTime="1023-03-01", age="18", lifeStage="少年", location="彩霞山·七玄门", relatedPeople="韩立、张铁", domain=["机会变化"], polarity="奖赏", intensity="中", facts="厉飞雨通过入门测试，成为外门弟子。", cognition="这里比家里有意思。", meaning="新生活", meaningType="机会", certainty="确信", attribution=["自身"], emotions=["兴奋"], firstReaction="四处结交", actualAction="主动认识同门", directResult="成为外门弟子", lifeImpact="进入门派", relationshipImpact="结识韩立与张铁", beliefImpact="朋友多了路好走"),
        empty_event(source_event_id=ev["e6"], id="hist-li-e6", name="送别韩立", startTime="1023-09-20", age="18", lifeStage="青年", location="彩霞山", relatedPeople="韩立", domain=["关系扰动"], polarity="稳定", intensity="中", facts="韩立离开七玄门，厉飞雨送到山下。", cognition="他跟我们不是一路人。", meaning="分别", meaningType="转折", certainty="确信", attribution=["他人"], emotions=["悲伤", "释然"], firstReaction="拍肩", actualAction="送到山门，约定后会有期", directResult="韩立离开", lifeImpact="少了一个朋友", relationshipImpact="友谊保留", beliefImpact="有些人留不住"),
    ]
    li_deposits = dep(
        repeatedPatterns="为朋友出头，惹上麻烦。", relationshipPatterns="先交朋友，再看能不能交心。",
        recurringDifficulties="沉不住气、缺少功法。", opportunitiesAndRewards="外门巡山、消息灵通。",
        chronicStress="怕一辈子做外门。", historicalUnderstanding="门派里关系比规矩重要。",
        coreBeliefs="义气第一。", longTermObsession="出头。", psychologicalBoundaries="不出卖朋友。",
        defenseTendencies="幽默、转移、出头。", behavioralHabits="先打听再行动。",
        relationshipModels="兄弟式。", riskJudgment="敢赌。",
    )
    li_initial = {
        "initialData": initial(
            energyState="正常", pressureState="中", pressureSource="前途",
            primaryEmotion=["焦虑", "兴奋"], mainDilemma="留在门派还是出去闯",
            dilemmaDomain="前途", primaryEngine="E", secondaryEngine="V",
            snapshotName="韩立离山后", snapshotTime="1023-09-20",
            lifeStage="青年", overallDescription="机灵、讲义气、想出头的外门弟子",
        ),
        "initialGoals": [
            goal("goal-li-1", "成为正式弟子", "高", "不想一辈子做外门", "获得内门资格", "找门路、练功", "缺少推荐", ""),
            goal("goal-li-2", "照顾张铁与韩立", "中", "朋友", "朋友都好好的", "多照应", "自己能力有限", ""),
        ],
        "initialRelations": [
            relation("rel-li-1", "韩立", "朋友", "兄弟", "相对稳定", "韩立离山", "情报与送别", "信任", ""),
            relation("rel-li-2", "张铁", "朋友", "兄弟", "已断裂", "张铁遇害", "互相照应", "怀念", ""),
        ],
        "initialResources": [
            resource_item("res-li-1", "外门弟子身份", "门中给予", "可被收回", "低阶", "常见", "稳定", "落脚处"),
        ],
    }

    # ==================================================================
    # 南宫婉
    # ==================================================================
    ng_engines = {
        "O": E(60, "对资源与宗门地位的占有欲", "先确保宗门利益", "过于强势", "该争取时退让", desire="宗门强盛、自身精进", threat="宗门衰落", resources="掩月宗资源", needs="安全感", impact="决策以宗门为先"),
        "V": E(80, "对长生的执念", "把修炼放在第一位", "忽视情感", "目标受挫时封闭自己", desire="结丹、长生", threat="寿元与瓶颈", resources="宗门功法", needs="更高境界", impact="能忍受长期孤独"),
        "D": E(70, "对风险的警觉", "先评估再出手", "过于谨慎", "被动时犹豫", desire="可控的冒险", threat="被魔道算计", resources="宗门情报", needs="信息", impact="不轻易下注"),
        "E": E(45, "社交投入克制", "保持礼貌距离", "显得冷漠", "需要支持时无人可依", desire="少数知己", threat="被情感牵制", resources="宗门同门", needs="理解", impact="对亲近的人格外珍惜"),
        "T": E(75, "对功法与局势的拆解", "找规律、算长远", "把感情也当变量", "遇到意外会短暂失序", desire="看透大道", threat="规则被扭曲", resources="宗门典籍", needs="验证", impact="能独立判断"),
    }
    ng_mechanisms = light_mechanisms({
        "env": "掩月宗是越国七派之一，资源丰厚但规矩森严。",
        "pressure": "结丹瓶颈",
        "resistance": "宗门政治与资源分配",
        "energy": "修炼资源充足，但心神消耗大。", "body": "修士体魄，远胜凡人。",
        "defense": "用清冷和规矩保持距离。",
        "defenseType": "隔离、合理化、升华",
        "trigger": "有人试图越过边界",
        "thinking": "习惯从长远与宗门利益出发。", "fast": "用规矩挡回", "slow": "独自推演功法",
        "action": "修炼、处理宗门事务。",
        "script": "从小被教导：修士要断情。",
        "oldScript": "情感是修行的障碍",
        "scriptImpact": "面对真实情感时会退缩",
        "sovereignty": "道心与身体。", "veto": "背叛宗门",
        "cut": "道心受损时会闭关。",
    })
    ng_reality = {
        "PN": box("掩月宗内门弟子，居所清静，资源充足。", basicResources="独立洞府、丹药、灵石", bodyRoutine="打坐、练剑、处理宗门事务", economy="宗门供给", resourceStability="稳定", livingSpace="有序", pressure="结丹瓶颈"),
        "AN": box("掩月宗真传，功法与剑术扎实。", eduBg="掩月宗内门传承", profSkill="剑术、功法、炼丹基础", pracExp="宗门任务与闭关", independentTask="独立处理宗门事务与战斗", strengths="天赋高、道心稳", weaknesses="缺少世俗经验", growthDir="结丹", bottleneck="心境"),
        "RN": box("同门众多，真正亲近的很少。", relDistribution="同门多、知己少", trustTargets="少数同门", relStability="相对稳定", mutualSupport="礼尚往来", boundary="不轻易让人进入私人领域", mainPressure="宗门期待", availableSupport="宗门"),
        "IN": box("掩月宗内门弟子，有身份与话语权。", socialId="掩月宗内门弟子", orgBelonging="掩月宗", classPos="内门", circle="七派年轻一辈", influence="小有名气", publicEval="清冷、天赋高", powerPos="被培养者", socialPressure="不能给宗门丢脸"),
        "MN": box("求大道，也求一个能并肩的人。", coreValues="道心、宗门、少数真情", lifeGoal="结丹", longVision="走出越国", ultimateQuest="长生", uncompromise="道心", beliefs="大道无情，但人可以有情", spiritSupport="对大道的向往", meaningSource="修炼与守护", valueConflict="宗门责任与个人情感", currentDilemma="是否为一个人动心"),
        "FN": box("生活围绕修炼与宗门任务。", dailyRoutine="晨课、练剑、处理事务、夜间打坐", workflow="按宗门优先级", decisionProc="先宗门后个人", timeMgmt="大块时间闭关", taskMgmt="按重要性", collab="与同门协作", fixedHabits="每日练剑", ruleExecution="严守门规", systemStability="极其稳定", systemBottleneck="心境"),
    }
    ng_individual = light_individual(
        {"time": ["clan", "fragmented"], "marriage": ["romantic", "equal"], "species": ["xianxia"], "religion": ["xianxia"], "aesthetic": ["xianxia", "minimalist"], "pref": ["N", "F", "J"], "cog": ["Ni", "Fe"]},
        {
            "routine": "晨课、练剑、处理宗门事务，夜间打坐。", "work": "修炼与宗门任务。", "rest": "独自抚琴或看山。", "autonomy": "较高。", "pace": "从容。", "pressure": "结丹瓶颈与宗门期待。", "marriage": "若结道侣，必须是能并肩的人。", "love": "慢热而专一。", "sex": "克制。", "mate": "道心坚定、尊重边界。", "intimacy": "身体与道心不可轻付。", "loyalty": "承诺后极重。", "species": "人族，资质上佳。", "group": "七派年轻一辈。", "independent": "习惯独处。", "death": "死亡是大道的一部分。", "breeding": "不急。", "intimacyMech": "以信任与并肩为基础。", "others": "先观察。", "faith": "大道", "dogma": "道心不可破。", "taboo": "以情乱道。", "salvation": "自渡。", "heretic": "警惕。", "missionary": "否", "force": "否", "dress": "月白长裙。", "arch": "清雅。", "color": "月白、青。", "art": "琴与剑。", "aestheticTaboo": "俗艳。", "tone": "清冷。", "standard": "道心", "secondary": "宗门", "unacceptable": "道心被破", "conflict": "先讲理，再出手。", "case": "面对宗门压力仍坚持自己的判断。",
        },
        [imprint("宗门", "修士先属于宗门，再属于自己。", "强", "曾想只为自己活", "从小被宗门培养", "守护宗门", "不背叛宗门")],
    )
    ng_history = [
        empty_event(source_event_id=ev["e8"], id="hist-ng-e1", name="筑基成功", startTime="1023-07-01", age="二十余", lifeStage="青年", location="掩月宗", relatedPeople="掩月宗同门", domain=["存在转变", "机会变化"], polarity="奖赏", intensity="高", facts="南宫婉在掩月宗闭关筑基成功，成为内门重点培养的年轻修士。", cognition="这只是开始。", meaning="修行里程碑", meaningType="机会", certainty="确信", attribution=["自身", "组织或制度"], emotions=["喜悦", "释然"], firstReaction="向师尊复命", actualAction="继续闭关稳固境界", directResult="筑基成功", lifeImpact="获得更多宗门资源", relationshipImpact="同门态度变化", beliefImpact="道心可期"),
    ]
    ng_deposits = dep(
        repeatedPatterns="在宗门责任与个人意愿之间反复权衡。",
        relationshipPatterns="保持距离，慢热。",
        recurringDifficulties="心境瓶颈、宗门政治。",
        opportunitiesAndRewards="筑基成功、宗门资源。",
        chronicStress="宗门期待。",
        historicalUnderstanding="修仙界以实力与宗门为后盾。",
        coreBeliefs="道心不可破。",
        longTermObsession="结丹。",
        psychologicalBoundaries="身体与道心。",
        defenseTendencies="隔离、合理化、升华。",
        behavioralHabits="每日练剑。",
        relationshipModels="并肩而非依附。",
        riskJudgment="先评估再下注。",
    )
    ng_initial = {
        "initialData": initial(
            energyState="充沛", pressureState="中", pressureSource="结丹瓶颈",
            primaryEmotion=["释然", "焦虑"], mainDilemma="是否为情所动",
            dilemmaDomain="情感", primaryEngine="V", secondaryEngine="D",
            snapshotName="筑基之后", snapshotTime="1023-07-01",
            lifeStage="青年", overallDescription="清冷自持、道心坚定的年轻修士",
        ),
        "initialGoals": [
            goal("goal-ng-1", "结丹", "最高", "大道", "突破结丹", "闭关", "心境瓶颈", ""),
            goal("goal-ng-2", "守护掩月宗", "高", "宗门培养", "宗门强盛", "处理宗门事务", "宗门政治", ""),
        ],
        "initialRelations": [
            relation("rel-ng-1", "掩月宗", "成员", "归属", "极其稳固", "宗门规矩", "资源与庇护", "归属感", ""),
            relation("rel-ng-2", "韩立", "未来的道侣", "尚未相识", "未知", "无", "无", "陌生", "此时尚未相遇"),
        ],
        "initialResources": [
            resource_item("res-ng-1", "掩月宗资源", "宗门供给", "需完成任务", "有限", "较稀缺", "稳定", "修炼"),
        ],
    }

    return {
        "韩立": {
            "name": "韩立",
            "basic_profile": {
                "name": "韩立", "code": "HAN-LI", "avatar": "", "species": "人族",
                "age": "18", "gender": "男", "world": "凡人修仙传", "nation": "越国",
                "org": "七玄门·外门（后入黄枫谷）", "socialClass": "记名弟子",
                "profession": "修士（炼气初期）", "role": "主角",
                "appearance": "皮肤微黑，相貌普通，眼神沉静；常穿青布衣。",
                "education": "山村私塾识字，七玄门入门功法",
                "degree": "七玄门外门记名弟子",
                "intro": "出身山村，资质普通，靠谨慎与耐心在修仙界求生。",
                "background": "因七玄门入门测试离开山村，在药园做杂役；被墨居仁收为记名弟子，察觉夺舍图谋后反杀，随后离山赴黄枫谷。",
            },
            "engines": {"ovtde": hanli_engines, "dominance": hanli_dominance},
            "defense_mechanisms": hanli_mechanisms,
            "reality_conditions": hanli_reality,
            "thought_imprints": hanli_individual,
            "life_history": {"events": hanli_history, "deposits": hanli_deposits},
            "initial_state": hanli_initial,
        },
        "墨居仁": {
            "name": "墨居仁",
            "basic_profile": {
                "name": "墨居仁", "code": "MO-JU-REN", "avatar": "", "species": "人族",
                "age": "六十余", "gender": "男", "world": "凡人修仙传", "nation": "越国",
                "org": "七玄门·药园", "socialClass": "药园管事",
                "profession": "医师 / 修士（修为受损）", "role": "反派",
                "appearance": "清瘦老者，灰袍整洁，面色苍白，眼神温和而疏离。",
                "education": "家传医术与七玄门功法",
                "degree": "药园管事",
                "intro": "七玄门药园管事，医术高明，因重伤将死而图谋夺舍。",
                "background": "长期掌管药园，暗中寻找合适躯壳；收韩立为记名弟子，实为夺舍布局，最终被韩立反杀。",
            },
            "engines": {"ovtde": mo_engines, "dominance": {"mode": ["主引擎", "辅助引擎"], "engines": ["T", "O"], "description": "拆解（T）负责设计控制方案，占有（O）驱动续命。"}},
            "defense_mechanisms": mo_mechanisms,
            "reality_conditions": mo_reality,
            "thought_imprints": mo_individual,
            "life_history": {"events": mo_history, "deposits": mo_deposits},
            "initial_state": mo_initial,
        },
        "张铁": {
            "name": "张铁",
            "basic_profile": {
                "name": "张铁", "code": "ZHANG-TIE", "avatar": "", "species": "人族",
                "age": "17", "gender": "男", "world": "凡人修仙传", "nation": "越国",
                "org": "七玄门·外门", "socialClass": "外门弟子",
                "profession": "武者 / 外门弟子", "role": "配角",
                "appearance": "身材壮实，皮肤黝黑，笑容憨厚。",
                "education": "七玄门入门功法",
                "degree": "外门弟子",
                "intro": "韩立在七玄门结交的朋友，憨厚讲义气。",
                "background": "与韩立、厉飞雨同期入门；因发现墨大夫的秘密被灭口。",
            },
            "engines": {"ovtde": zhang_engines, "dominance": {"mode": ["主引擎", "辅助引擎"], "engines": ["E", "O"], "description": "关系（E）驱动他行动，生存（O）让他想站稳脚跟。"}},
            "defense_mechanisms": zhang_mechanisms,
            "reality_conditions": zhang_reality,
            "thought_imprints": zhang_individual,
            "life_history": {"events": zhang_history, "deposits": zhang_deposits},
            "initial_state": zhang_initial,
        },
        "厉飞雨": {
            "name": "厉飞雨",
            "basic_profile": {
                "name": "厉飞雨", "code": "LI-FEI-YU", "avatar": "", "species": "人族",
                "age": "18", "gender": "男", "world": "凡人修仙传", "nation": "越国",
                "org": "七玄门·外门", "socialClass": "外门弟子",
                "profession": "武者 / 外门弟子", "role": "配角",
                "appearance": "瘦削精干，眉眼灵活，常带笑。",
                "education": "七玄门入门功法",
                "degree": "外门弟子",
                "intro": "韩立在七玄门的朋友，机灵、讲义气、消息灵通。",
                "background": "外门活跃分子，与韩立、张铁交好；韩立离山时送到山下。",
            },
            "engines": {"ovtde": li_engines, "dominance": {"mode": ["主引擎", "辅助引擎"], "engines": ["E", "V"], "description": "关系（E）与变强（V）共同驱动，敢闯敢赌。"}},
            "defense_mechanisms": li_mechanisms,
            "reality_conditions": li_reality,
            "thought_imprints": li_individual,
            "life_history": {"events": li_history, "deposits": li_deposits},
            "initial_state": li_initial,
        },
        "南宫婉": {
            "name": "南宫婉",
            "basic_profile": {
                "name": "南宫婉", "code": "NAN-GONG-WAN", "avatar": "", "species": "人族",
                "age": "二十余", "gender": "女", "world": "凡人修仙传", "nation": "越国",
                "org": "掩月宗·内门", "socialClass": "内门弟子",
                "profession": "修士（筑基期）", "role": "重要配角",
                "appearance": "清冷绝美，常穿月白长裙，气质疏离。",
                "education": "掩月宗内门传承",
                "degree": "掩月宗内门弟子",
                "intro": "掩月宗天才修士，道心坚定，后来与韩立结缘。",
                "background": "越国七派之一掩月宗的内门弟子，1023 年筑基成功；此时尚未与韩立相识。",
            },
            "engines": {"ovtde": ng_engines, "dominance": {"mode": ["主引擎", "辅助引擎"], "engines": ["V", "D"], "description": "长生（V）是方向，警觉（D）是护栏。"}},
            "defense_mechanisms": ng_mechanisms,
            "reality_conditions": ng_reality,
            "thought_imprints": ng_individual,
            "life_history": {"events": ng_history, "deposits": ng_deposits},
            "initial_state": ng_initial,
        },
    }
