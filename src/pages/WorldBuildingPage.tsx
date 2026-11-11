import { useState, useEffect } from 'react'
import { initializeWorldBuildingConfig, getWorldBuildingConfig } from '../services/worldBuildingService'
import { getWorldById } from '../services/worldService'
import { createWorld, updateWorld, deleteWorld } from '../services/worldService'
import AxisObjectsPanel from '../components/AxisObjectsPanel'

// =========================================================
// 1. 数据字典 (已按宏观-中观-微观重新梳理，去除了所有序号)
// =========================================================

// ---- A. 宏观：时代、生态与危机 ----
const ERA_STAGES = [
  { id: 'fast_growth', name_zh: '高速增长期', name_en: 'Fast Growth' },
  { id: 'stable_growth', name_zh: '稳定发展期', name_en: 'Stable Growth' },
  { id: 'slow_growth', name_zh: '缓慢增长期', name_en: 'Slow Growth' },
  { id: 'stagnation', name_zh: '经济停滞期', name_en: 'Stagnation' },
  { id: 'decline', name_zh: '长期衰退期', name_en: 'Decline' },
  { id: 'doomsday', name_zh: '末法/衰败期', name_en: 'Doomsday' },
  { id: 'post_war', name_zh: '战后重建期', name_en: 'Post War' },
  { id: 'transformation', name_zh: '转型变革期', name_en: 'Transformation' }
];
const GROWTH_TAILWIND = [{ id: 'headwind', name_zh: '逆风', name_en: 'Headwind' }, { id: 'neutral', name_zh: '中性', name_en: 'Neutral' }, { id: 'tailwind', name_zh: '顺风', name_en: 'Tailwind' }];
const FUTURE_BELIEVABILITY = [{ id: 'very_low', name_zh: '极低', name_en: 'Very Low' }, { id: 'low', name_zh: '低', name_en: 'Low' }, { id: 'medium', name_zh: '中', name_en: 'Medium' }, { id: 'high', name_zh: '高', name_en: 'High' }, { id: 'very_high', name_zh: '极高', name_en: 'Very High' }];
const ELITE_CAPTURE = [{ id: 'low', name_zh: '低(通道开放)', name_en: 'Low' }, { id: 'medium', name_zh: '中(机会部分被控)', name_en: 'Medium' }, { id: 'high', name_zh: '高(少数人掌握)', name_en: 'High' }, { id: 'extreme', name_zh: '极高(通道封死)', name_en: 'Extreme' }];
const FUTURE_EXPECTATION = [{ id: 'optimistic', name_zh: '乐观', name_en: 'Optimistic' }, { id: 'cautious', name_zh: '谨慎乐观', name_en: 'Cautious' }, { id: 'neutral', name_zh: '中性', name_en: 'Neutral' }, { id: 'pessimistic', name_zh: '悲观', name_en: 'Pessimistic' }, { id: 'despair', name_zh: '绝望', name_en: 'Despair' }];
const IDEOLOGIES = [
  { id: 'liberalism', name_zh: '自由主义', name_en: 'Liberalism' }, { id: 'conservatism', name_zh: '保守主义', name_en: 'Conservatism' },
  { id: 'nationalism', name_zh: '民族主义', name_en: 'Nationalism' }, { id: 'socialism', name_zh: '社会主义', name_en: 'Socialism' },
  { id: 'communism', name_zh: '共产主义', name_en: 'Communism' }, { id: 'capitalism', name_zh: '资本主义', name_en: 'Capitalism' },
  { id: 'religious', name_zh: '宗教主义', name_en: 'Religious' }, { id: 'imperialism', name_zh: '帝国主义', name_en: 'Imperialism' },
  { id: 'collectivism', name_zh: '集体主义', name_en: 'Collectivism' }, { id: 'individualism', name_zh: '个人主义', name_en: 'Individualism' },
  { id: 'scientism', name_zh: '科学主义', name_en: 'Scientism' }, { id: 'traditionalism', name_zh: '传统主义', name_en: 'Traditionalism' },
  { id: 'nihilism', name_zh: '虚无主义', name_en: 'Nihilism' }
];
const THOUGHT_CONTROL = [{ id: 'pluralistic', name_zh: '思想多元', name_en: 'Pluralistic' }, { id: 'guided', name_zh: '主流引导', name_en: 'Guided' }, { id: 'orthodox', name_zh: '正统主导', name_en: 'Orthodox' }, { id: 'high_pressure', name_zh: '高压统一', name_en: 'High Pressure' }, { id: 'extreme_orthodox', name_zh: '极端正统', name_en: 'Extreme Orthodox' }];
const ORTHODOXY_STRENGTH = [{ id: 'weak', name_zh: '弱', name_en: 'Weak' }, { id: 'medium', name_zh: '中', name_en: 'Medium' }, { id: 'strong', name_zh: '强', name_en: 'Strong' }, { id: 'extreme', name_zh: '极强', name_en: 'Extreme' }];
const SCAPEGOAT_NEED_A3 = [{ id: 'weak', name_zh: '弱(寻找真实原因)', name_en: 'Weak' }, { id: 'medium', name_zh: '中(偶尔找替身)', name_en: 'Medium' }, { id: 'strong', name_zh: '强(经常归咎特定群体)', name_en: 'Strong' }, { id: 'extreme', name_zh: '极强(需制造敌人)', name_en: 'Extreme' }];
const SPEECH_DOMAIN = [{ id: 'very_wide', name_zh: '极宽', name_en: 'Very Wide' }, { id: 'wide', name_zh: '较宽', name_en: 'Wide' }, { id: 'medium', name_zh: '中等', name_en: 'Medium' }, { id: 'narrow', name_zh: '较窄', name_en: 'Narrow' }, { id: 'very_narrow', name_zh: '极窄', name_en: 'Very Narrow' }];
const MASS_AFFECT_MODE = [{ id: 'optimistic', name_zh: '乐观', name_en: 'Optimistic' }, { id: 'anxious', name_zh: '焦虑', name_en: 'Anxious' }, { id: 'panic', name_zh: '恐慌', name_en: 'Panic' }, { id: 'grief', name_zh: '悲痛', name_en: 'Grief' }, { id: 'numb', name_zh: '麻木', name_en: 'Numb' }, { id: 'fanatical', name_zh: '狂热', name_en: 'Fanatical' }];
const CONTAGION_STRENGTH = [{ id: 'low', name_zh: '低', name_en: 'Low' }, { id: 'medium', name_zh: '中', name_en: 'Medium' }, { id: 'high', name_zh: '高', name_en: 'High' }, { id: 'extreme', name_zh: '极高', name_en: 'Extreme' }];
const MACRO_CRISES = [{ id: 'revolution', name_zh: '革命', name_en: 'Revolution' }, { id: 'purge', name_zh: '政治清洗', name_en: 'Purge' }, { id: 'plague', name_zh: '瘟疫', name_en: 'Plague' }, { id: 'war_crisis', name_zh: '战争', name_en: 'War' }, { id: 'crash', name_zh: '经济崩盘', name_en: 'Economic Crash' }];
const CRISIS_INTENSITY = [{ id: 'low', name_zh: '低', name_en: 'Low' }, { id: 'medium', name_zh: '中', name_en: 'Medium' }, { id: 'high', name_zh: '高', name_en: 'High' }, { id: 'extreme', name_zh: '极高', name_en: 'Extreme' }];
const NORM_FLIP_RATE = [{ id: 'low', name_zh: '低(稳定)', name_en: 'Low' }, { id: 'medium', name_zh: '中', name_en: 'Medium' }, { id: 'high', name_zh: '高(经常变化)', name_en: 'High' }, { id: 'extreme', name_zh: '极高(随时成罪)', name_en: 'Extreme' }];
const REQUISITION_RISK = [{ id: 'low', name_zh: '低(受保护)', name_en: 'Low' }, { id: 'medium', name_zh: '中', name_en: 'Medium' }, { id: 'high', name_zh: '高(经常征用)', name_en: 'High' }, { id: 'extreme', name_zh: '极高(随时没收)', name_en: 'Extreme' }];

const TERRAIN_TYPES = [{ id: 'mountains', name_zh: '崇山峻岭', name_en: 'Mountains' }, { id: 'plains', name_zh: '平原草原', name_en: 'Plains' }, { id: 'desert', name_zh: '广袤沙漠', name_en: 'Desert' }, { id: 'rainforest', name_zh: '热带雨林', name_en: 'Rainforest' }, { id: 'polar', name_zh: '极地冰原', name_en: 'Polar Ice' }, { id: 'ocean', name_zh: '群岛海洋', name_en: 'Oceans' }, { id: 'wetlands', name_zh: '沼泽湿地', name_en: 'Wetlands' }, { id: 'volcanic', name_zh: '火山地带', name_en: 'Volcanic' }, { id: 'underground', name_zh: '地下洞穴', name_en: 'Underground' }, { id: 'floating', name_zh: '悬浮空岛', name_en: 'Floating Islands' }, { id: 'wasteland', name_zh: '辐射废土', name_en: 'Wasteland' }, { id: 'space_meteor', name_zh: '太空陨石带', name_en: 'Space Asteroids' }, { id: 'magic_chaos', name_zh: '魔法紊乱区', name_en: 'Magic Chaos' }];
const CLIMATE_TYPES = [{ id: 'tropical', name_zh: '热带酷暑', name_en: 'Tropical' }, { id: 'temperate', name_zh: '温带四季', name_en: 'Temperate' }, { id: 'polar_climate', name_zh: '寒带极地', name_en: 'Polar Climate' }, { id: 'arid', name_zh: '干旱荒漠', name_en: 'Arid' }, { id: 'hurricane', name_zh: '台风飓风', name_en: 'Hurricanes' }, { id: 'blizzard', name_zh: '暴雪冰雹', name_en: 'Blizzards' }, { id: 'flood', name_zh: '特大洪涝', name_en: 'Floods' }, { id: 'drought', name_zh: '百年大旱', name_en: 'Droughts' }, { id: 'sandstorm', name_zh: '沙尘暴', name_en: 'Sandstorms' }];
const ANOMALY_CLIMATE = [{ id: 'acid_rain', name_zh: '酸雨', name_en: 'Acid Rain' }, { id: 'radiation', name_zh: '高辐射风暴', name_en: 'Radiation Storm' }, { id: 'magic_tide', name_zh: '魔力潮汐', name_en: 'Magic Tide' }, { id: 'blood_moon', name_zh: '血月日食', name_en: 'Blood Moon' }];
const TIME_CYCLES = [{ id: 'standard', name_zh: '标准24小时', name_en: 'Standard' }, { id: 'polar_day', name_zh: '极昼/极夜', name_en: 'Polar Day/Night' }, { id: 'tidal_lock', name_zh: '潮汐锁定', name_en: 'Tidal Lock' }];
const SEASONS = [{ id: 'four_seasons', name_zh: '春夏秋冬', name_en: 'Four Seasons' }, { id: 'wet_dry', name_zh: '雨季/旱季', name_en: 'Wet/Dry' }, { id: 'cataclysm', name_zh: '灾变期', name_en: 'Cataclysm' }];
const NIGHT_RULES = [{ id: 'curfew', name_zh: '宵禁', name_en: 'Curfew' }, { id: 'gang_active', name_zh: '黑帮活跃', name_en: 'Gang Active' }, { id: 'monsters', name_zh: '魔物出没', name_en: 'Monsters' }];
const FLORA_TYPES = [{ id: 'staples', name_zh: '主粮作物', name_en: 'Staple Crops' }, { id: 'cash_crops', name_zh: '经济作物', name_en: 'Cash Crops' }, { id: 'magic_plants', name_zh: '奇幻植物', name_en: 'Magic Plants' }, { id: 'giant_trees', name_zh: '巨树森林', name_en: 'Giant Trees' }];
const FAUNA_TYPES = [{ id: 'livestock', name_zh: '家畜驮兽', name_en: 'Livestock' }, { id: 'beasts', name_zh: '野生猛兽', name_en: 'Wild Beasts' }, { id: 'mutants', name_zh: '变异巨兽', name_en: 'Mutants' }, { id: 'dragons', name_zh: '巨龙', name_en: 'Dragons' }, { id: 'sea_monsters', name_zh: '深海海怪', name_en: 'Sea Monsters' }];
const RESOURCE_TYPES = [{ id: 'water', name_zh: '水源(河流/绿洲)', name_en: 'Water' }, { id: 'minerals', name_zh: '矿产(金/铁/煤)', name_en: 'Minerals' }, { id: 'magic_crystal', name_zh: '魔法水晶', name_en: 'Magic Crystal' }, { id: 'oil_gas', name_zh: '石油天然气', name_en: 'Oil & Gas' }, { id: 'nuclear_fuel', name_zh: '核燃料', name_en: 'Nuclear Fuel' }];
const DISASTER_TYPES = [{ id: 'earthquake', name_zh: '地震', name_en: 'Earthquakes' }, { id: 'volcano', name_zh: '火山爆发', name_en: 'Volcanic' }, { id: 'landslide', name_zh: '泥石流', name_en: 'Landslides' }, { id: 'locust', name_zh: '蝗灾', name_en: 'Locust' }, { id: 'plague', name_zh: '瘟疫', name_en: 'Plague' }];

// 哲学流派与思想钢印
const PHILOSOPHY_SCHOOLS = [
  { id: 'stoicism', name_zh: '斯多葛主义 (顺应自然/克制)' }, { id: 'epicureanism', name_zh: '伊壁鸠鲁主义 (隐退避世)' },
  { id: 'platonism', name_zh: '柏拉图主义 (理念至上)' }, { id: 'cynicism', name_zh: '犬儒主义 (蔑视世俗)' },
  { id: 'confucianism', name_zh: '儒家 (仁义礼智信)' }, { id: 'daoism', name_zh: '道家 (无为而治)' },
  { id: 'legalism', name_zh: '法家 (严刑峻法)' }, { id: 'buddhism', name_zh: '释家/佛学 (因果涅槃)' },
  { id: 'rationalism', name_zh: '理性主义 (逻辑至上)' }, { id: 'utilitarianism', name_zh: '功利主义 (最大幸福)' },
  { id: 'existentialism', name_zh: '存在主义 (自由选择)' }, { id: 'nihilism', name_zh: '虚无主义 (无意义)' },
  { id: 'pragmatism', name_zh: '实用主义 (有用即真理)' }, { id: 'romanticism', name_zh: '浪漫主义 (情感解放)' },
  { id: 'transhumanism', name_zh: '超人类主义 (突破肉体)' }, { id: 'mechanism', name_zh: '机械飞升 (机械永恒)' },
  { id: 'cultivation', name_zh: '修仙飞升主义 (逆天求长生)' }
];

// 地缘国家与文明性格
const GEO_CULTURES = [
  { id: 'china', name_zh: '中华 (大一统/实用/差序格局)' }, { id: 'japan', name_zh: '日本 (耻感文化/极致主义)' },
  { id: 'india', name_zh: '印度 (种姓宿命/轮回观)' }, { id: 'west', name_zh: '欧美 (契约精神/个人英雄)' },
  { id: 'middle_east', name_zh: '中东 (部族荣誉/宗教狂热)' }, { id: 'nordic', name_zh: '北欧 (生存主义/末日宿命)' },
  { id: 'russia', name_zh: '俄罗斯 (弥赛亚情结/苦难崇拜)' }, { id: 'nomad', name_zh: '游牧民族 (劫掠法则)' },
  { id: 'island', name_zh: '海岛文明 (海洋法则/契约)' }
];

// 美学与艺术流派
const AESTHETICS_STYLES = [
  { id: 'classical', name_zh: '古典/巴洛克 (奢华/神性)' }, { id: 'wasteland', name_zh: '废土/拼凑主义 (实用/废铁)' },
  { id: 'minimalist', name_zh: '极简/实用主义 (高效/白墙)' }, { id: 'cyber', name_zh: '赛博/全息复古 (霓虹/虚幻)' },
  { id: 'xianxia', name_zh: '仙侠/飘逸主义 (古风/自然)' }, { id: 'gothic', name_zh: '暗黑/哥特式 (阴森/恐怖)' }
];

// ---- B. 中观：政治、经济、法律、工业与公共系统 ----
const REGIME_TYPES = [{ id: 'absolute_monarchy', name_zh: '君主专制', name_en: 'Absolute Monarchy' }, { id: 'constitutional_monarchy', name_zh: '君主立宪', name_en: 'Constitutional Monarchy' }, { id: 'republic', name_zh: '共和制', name_en: 'Republic' }, { id: 'presidential', name_zh: '总统制', name_en: 'Presidential' }, { id: 'parliamentary', name_zh: '议会制', name_en: 'Parliamentary' }, { id: 'semi_presidential', name_zh: '半总统制', name_en: 'Semi-Presidential' }, { id: 'council', name_zh: '委员会制', name_en: 'Council' }, { id: 'peoples_congress', name_zh: '人民代表大会制', name_en: "People's Congress" }, { id: 'noble_republic', name_zh: '贵族共和制', name_en: 'Noble Republic' }, { id: 'oligarchy', name_zh: '寡头政治', name_en: 'Oligarchy' }, { id: 'federal', name_zh: '联邦制', name_en: 'Federal' }, { id: 'unitary', name_zh: '单一制', name_en: 'Unitary' }, { id: 'city_state', name_zh: '城邦制', name_en: 'City-State' }, { id: 'colonial', name_zh: '殖民地', name_en: 'Colonial' }, { id: 'transitional', name_zh: '过渡政府', name_en: 'Transitional' }, { id: 'corporate', name_zh: '企业统治', name_en: 'Corporate' }, { id: 'technocracy', name_zh: '技术官僚', name_en: 'Technocracy' }, { id: 'ai_rule', name_zh: 'AI托管', name_en: 'AI Rule' }, { id: 'direct_democracy', name_zh: '直接民主', name_en: 'Direct Democracy' }, { id: 'military_junta', name_zh: '军政府', name_en: 'Military Junta' }, { id: 'theocracy', name_zh: '神权政体', name_en: 'Theocracy' }, { id: 'feudalism', name_zh: '封建制', name_en: 'Feudalism' }, { id: 'tribal_alliance', name_zh: '部落联盟', name_en: 'Tribal Alliance' }, { id: 'elder_council', name_zh: '长老议会', name_en: 'Elder Council' }, { id: 'clan_system', name_zh: '氏族血统', name_en: 'Clan' }, { id: 'nomadic_empire', name_zh: '游牧汗国', name_en: 'Nomadic Empire' }, { id: 'totalitarian', name_zh: '极权主义', name_en: 'Totalitarian' }, { id: 'anarchy', name_zh: '无政府', name_en: 'Anarchy' }];
const CLASS_STRUCTURES = [{ id: 'noble', name_zh: '贵族阶层', name_en: 'Noble' }, { id: 'bureaucrat', name_zh: '官僚阶层', name_en: 'Bureaucrat' }, { id: 'military_cls', name_zh: '军事阶层', name_en: 'Military' }, { id: 'religious_cls', name_zh: '宗教阶层', name_en: 'Religious' }, { id: 'landlord', name_zh: '地主阶层', name_en: 'Landlord' }, { id: 'farmer', name_zh: '农民阶层', name_en: 'Farmer' }, { id: 'worker', name_zh: '工人阶层', name_en: 'Worker' }, { id: 'merchant', name_zh: '商人阶层', name_en: 'Merchant' }, { id: 'slave', name_zh: '奴隶阶层', name_en: 'Slave' }, { id: 'clan_grade', name_zh: '宗族等级', name_en: 'Clan Grade' }, { id: 'capitalist', name_zh: '资本家阶层', name_en: 'Capitalist' }, { id: 'tech_elite', name_zh: '技术精英', name_en: 'Tech Elite' }, { id: 'middle_class', name_zh: '中产阶级', name_en: 'Middle Class' }, { id: 'intellectual', name_zh: '知识分子', name_en: 'Intellectual' }, { id: 'scholar_official', name_zh: '士大夫阶层', name_en: 'Scholar-Official' }, { id: 'mage', name_zh: '施法者', name_en: 'Mage' }, { id: 'cultivator', name_zh: '修仙者', name_en: 'Cultivator' }, { id: 'commoner', name_zh: '平民凡人', name_en: 'Commoner' }, { id: 'cyborg', name_zh: '义体人', name_en: 'Cyborg' }, { id: 'clone', name_zh: '克隆人', name_en: 'Clone' }, { id: 'hacker', name_zh: '黑客', name_en: 'Hacker' }, { id: 'scavenger', name_zh: '拾荒者', name_en: 'Scavenger' }, { id: 'caste', name_zh: '种姓阶层', name_en: 'Caste' }, { id: 'untouchable', name_zh: '贱民', name_en: 'Untouchable' }, { id: 'underworld', name_zh: '地下势力', name_en: 'Underworld' }, { id: 'refugee', name_zh: '流民难民', name_en: 'Refugee' }, { id: 'no_class', name_zh: '无阶级结构', name_en: 'No Class' }];
const POWER_CONCENTRATION = [{ id: 'decentralized', name_zh: '分散', name_en: 'Decentralized' }, { id: 'medium', name_zh: '中等', name_en: 'Medium' }, { id: 'centralized', name_zh: '高度集中', name_en: 'Centralized' }];
const CLASS_RIGIDITY = [{ id: 'fluid', name_zh: '流动', name_en: 'Fluid' }, { id: 'partially_fixed', name_zh: '部分固化', name_en: 'Partially Fixed' }, { id: 'highly_rigid', name_zh: '高度固化', name_en: 'Highly Rigid' }];
const IMPUNITY_GAP = [{ id: 'none', name_zh: '无差异', name_en: 'None' }, { id: 'exists', name_zh: '存在差异', name_en: 'Exists' }, { id: 'significant', name_zh: '特权显著', name_en: 'Significant' }];
const PURGE_RISK = [{ id: 'low', name_zh: '低', name_en: 'Low' }, { id: 'medium', name_zh: '中', name_en: 'Medium' }, { id: 'high', name_zh: '高', name_en: 'High' }];

// 地缘政治与权力游戏
const GLOBAL_POLITICS = [
  { id: 'unipolar', name_zh: '单极霸权 (一超多强)' }, { id: 'bipolar', name_zh: '两极冷战 (阵营对立)' },
  { id: 'multipolar', name_zh: '多极纷乱 (群雄割据)' }, { id: 'feudal', name_zh: '诸侯割据 (中央势微)' },
  { id: 'utopia', name_zh: '天下大同 (星际联邦)' }, { id: 'isolation', name_zh: '孤立主义 (闭关锁国)' }
];

const SUCCESSION_LAWS = [
  { id: 'primogeniture', name_zh: '长子继承制 (血统嫡长)' }, { id: 'election', name_zh: '选举制 (民主票选)' },
  { id: 'meritocracy', name_zh: '强者为尊 (武力夺权)' }, { id: 'divine', name_zh: '神谕指定 (转世灵童/教皇)' },
  { id: 'abdication', name_zh: '禅让制 (推举贤能)' }, { id: 'coup', name_zh: '政变暗杀 (成王败寇)' }
];

const CLASS_MOBILITY = [
  { id: 'exam', name_zh: '科举/考试 (学而优则仕)' }, { id: 'military', name_zh: '军功 (拿命换阶级)' },
  { id: 'wealth', name_zh: '商业暴富 (金钱买地位)' }, { id: 'marriage', name_zh: '联姻 (攀高枝)' },
  { id: 'cyber_genetic', name_zh: '基因改造/赛博飞升 (超越凡人)' }, { id: 'religion', name_zh: '宗教神职 (神权特许)' },
  { id: 'revolution', name_zh: '暴力革命 (推翻旧秩序)' }
];

// 神秘法则与历史渊源
const SUPERNATURAL_RULES = [
  { id: 'bloodline', name_zh: '血脉觉醒 (天赋决定论)' }, { id: 'learning', name_zh: '刻苦学习 (凡人皆可修仙)' },
  { id: 'divine_gift', name_zh: '神明赐福 (信仰换取力量)' }, { id: 'tech_ether', name_zh: '科技提取 (以太/魔导科技)' },
  { id: 'contract', name_zh: '契约交易 (与恶魔/高维存在签约)' }, { id: 'none', name_zh: '无超自然力量 (纯现实或硬科幻)' }
];

const STRATEGIC_RESOURCES = [
  { id: 'water', name_zh: '纯净水源 (末世硬通货)' }, { id: 'magic_crystal', name_zh: '高纯度魔力水晶' },
  { id: 'antimatter', name_zh: '反物质/核燃料 (星际命脉)' }, { id: 'gene_serum', name_zh: '稀有基因药剂 (永生/进化)' },
  { id: 'cyber_tech', name_zh: '黑市尖端义体/核心芯片' }, { id: 'soul_stone', name_zh: '灵魂石/贤者之石' }
];

const HISTORICAL_EVENTS = [
  { id: 'great_war', name_zh: '灭世大战 (文明断层)' }, { id: 'plague', name_zh: '大瘟疫/丧尸危机 (人口锐减)' },
  { id: 'gods_fall', name_zh: '神祇陨落 (信仰崩塌)' }, { id: 'tech_singularity', name_zh: '科技奇点爆炸 (AI叛乱)' },
  { id: 'dynasty_change', name_zh: '朝代更迭/旧帝国崩溃' }, { id: 'natural_disaster', name_zh: '大灾难 (大洪水/陨石撞击)' }
];

const LEGAL_SYSTEMS = [{ id: 'civil_law', name_zh: '成文法/大陆法系', name_en: 'Civil Law' }, { id: 'common_law', name_zh: '判例法/普通法系', name_en: 'Common Law' }, { id: 'religious_law', name_zh: '宗教法体系', name_en: 'Religious Law' }, { id: 'customary_law', name_zh: '习惯法体系', name_en: 'Customary Law' }, { id: 'clan_law', name_zh: '宗族家法', name_en: 'Clan Law' }, { id: 'military_law', name_zh: '军事法', name_en: 'Military Law' }, { id: 'feudal_law', name_zh: '封建法', name_en: 'Feudal Law' }, { id: 'revolutionary_law', name_zh: '革命法制', name_en: 'Revolutionary Law' }, { id: 'mixed_law', name_zh: '混合法律', name_en: 'Mixed Law' }, { id: 'collapsed_law', name_zh: '法律失效', name_en: 'Collapsed' }, { id: 'ai_law', name_zh: '算法法/AI裁决', name_en: 'AI Judgment' }, { id: 'corporate_law', name_zh: '企业私法', name_en: 'Corporate Law' }, { id: 'interstellar_law', name_zh: '星际法', name_en: 'Interstellar Law' }, { id: 'genetic_segregation', name_zh: '基因隔离法', name_en: 'Genetic Segregation' }, { id: 'divine_judgment', name_zh: '神谕裁决', name_en: 'Divine Judgment' }, { id: 'sect_rules', name_zh: '宗门戒律', name_en: 'Sect Rules' }, { id: 'blood_contract', name_zh: '血统契约法', name_en: 'Blood Contract' }, { id: 'jungle_law', name_zh: '丛林法则', name_en: 'Jungle Law' }, { id: 'absolute_dictatorship', name_zh: '独裁法令', name_en: 'Dictatorship' }];
const SELECTIVE_ENFORCEMENT = [{ id: 'uniform', name_zh: '普遍一致', name_en: 'Uniform' }, { id: 'partial', name_zh: '部分选择', name_en: 'Partial' }, { id: 'severe', name_zh: '严重选择', name_en: 'Severe' }];
const RULE_STABILITY = [{ id: 'volatile', name_zh: '经常变化', name_en: 'Volatile' }, { id: 'stable', name_zh: '相对稳定', name_en: 'Stable' }, { id: 'highly_stable', name_zh: '高度稳定', name_en: 'Highly Stable' }];
const DUE_PROCESS = [{ id: 'absent', name_zh: '缺失', name_en: 'Absent' }, { id: 'incomplete', name_zh: '不完整', name_en: 'Incomplete' }, { id: 'perfect', name_zh: '完善', name_en: 'Perfect' }];

const ECONOMY_TYPES = [{ id: 'barter', name_zh: '物物交换', name_en: 'Barter' }, { id: 'traditional_market', name_zh: '传统市场', name_en: 'Traditional Market' }, { id: 'capitalism', name_zh: '资本主义', name_en: 'Capitalism' }, { id: 'planned', name_zh: '计划经济', name_en: 'Planned' }, { id: 'collective', name_zh: '集体经济', name_en: 'Collective' }, { id: 'feudal', name_zh: '封建领主', name_en: 'Feudal' }, { id: 'slavery', name_zh: '奴隶制经济', name_en: 'Slavery' }, { id: 'state_monopoly', name_zh: '国家垄断', name_en: 'State Monopoly' }, { id: 'mixed', name_zh: '混合经济', name_en: 'Mixed' }, { id: 'interstellar', name_zh: '星际贸易', name_en: 'Interstellar' }, { id: 'magic_trade', name_zh: '魔法资源交易', name_en: 'Magic Trade' }];
const CURRENCY_TYPES = [{ id: 'none', name_zh: '无统一货币', name_en: 'No Currency' }, { id: 'metal', name_zh: '贵金属', name_en: 'Precious Metals' }, { id: 'paper', name_zh: '纸币', name_en: 'Paper' }, { id: 'credit', name_zh: '信用货币', name_en: 'Credit' }, { id: 'digital', name_zh: '数字货币', name_en: 'Digital' }, { id: 'ration', name_zh: '资源配给', name_en: 'Rationing' }, { id: 'points', name_zh: '身份积分', name_en: 'Identity Points' }, { id: 'magic_currency', name_zh: '魔法货币', name_en: 'Magic Currency' }, { id: 'barter_mixed', name_zh: '以物易物并存', name_en: 'Barter Mixed' }];
const ECONOMY_ENV = [{ id: 'prosperity', name_zh: '长期繁荣', name_en: 'Prosperity' }, { id: 'stable', name_zh: '稳定运行', name_en: 'Stable' }, { id: 'stagnation', name_zh: '经济停滞', name_en: 'Stagnation' }, { id: 'inflation', name_zh: '高通胀', name_en: 'High Inflation' }, { id: 'inequality', name_zh: '严重贫富分化', name_en: 'Severe Inequality' }, { id: 'crisis', name_zh: '经济危机', name_en: 'Crisis' }, { id: 'collapse', name_zh: '经济体系崩溃', name_en: 'Collapse' }];
const INFLATION_RISK = [{ id: 'low', name_zh: '低波动', name_en: 'Low' }, { id: 'medium', name_zh: '中波动', name_en: 'Medium' }, { id: 'high', name_zh: '高波动', name_en: 'High' }, { id: 'extreme', name_zh: '恶性通胀', name_en: 'Extreme' }];
const INEQUALITY = [{ id: 'low', name_zh: '差距小', name_en: 'Low' }, { id: 'medium', name_zh: '差距中', name_en: 'Medium' }, { id: 'high', name_zh: '差距大', name_en: 'High' }, { id: 'extreme', name_zh: '极端两极分化', name_en: 'Extreme' }];
const CREDIT_STABILITY = [{ id: 'unstable', name_zh: '极不稳定', name_en: 'Unstable' }, { id: 'partial', name_zh: '部分稳定', name_en: 'Partial' }, { id: 'stable', name_zh: '稳定', name_en: 'Stable' }, { id: 'perfect', name_zh: '完美契约', name_en: 'Perfect' }];

const INFO_TECHS = [{ id: 'oral', name_zh: '口耳相传', name_en: 'Oral' }, { id: 'courier', name_zh: '信使驿站', name_en: 'Courier' }, { id: 'print', name_zh: '印刷出版', name_en: 'Print' }, { id: 'broadcast', name_zh: '报纸广播', name_en: 'Broadcast' }, { id: 'telecom', name_zh: '电话电信', name_en: 'Telecom' }, { id: 'internet', name_zh: '互联网', name_en: 'Internet' }, { id: 'social_media', name_zh: '社交媒体', name_en: 'Social Media' }, { id: 'global_net', name_zh: '全球网络', name_en: 'Global Net' }, { id: 'ai_net', name_zh: 'AI信息网络', name_en: 'AI Net' }, { id: 'interstellar', name_zh: '星际通信', name_en: 'Interstellar' }, { id: 'magic_msg', name_zh: '魔法传讯', name_en: 'Magic Msg' }, { id: 'telepathy', name_zh: '心灵感应', name_en: 'Telepathy' }];
const INFO_ENV = [{ id: 'highly_open', name_zh: '高度开放', name_en: 'Highly Open' }, { id: 'mostly_open', name_zh: '基本开放', name_en: 'Mostly Open' }, { id: 'tiered', name_zh: '分层传播', name_en: 'Tiered' }, { id: 'monopoly', name_zh: '信息垄断', name_en: 'Monopoly' }, { id: 'strict_censorship', name_zh: '严格审查', name_en: 'Strict Censorship' }, { id: 'blackout', name_zh: '全面封锁', name_en: 'Blackout' }, { id: 'rumor_driven', name_zh: '谣言主导', name_en: 'Rumor Driven' }];
const INFO_TRUTH = [{ id: 'transparent', name_zh: '高度透明', name_en: 'Transparent' }, { id: 'trustworthy', name_zh: '总体可信', name_en: 'Trustworthy' }, { id: 'mixed', name_zh: '真假混杂', name_en: 'Mixed' }, { id: 'rumors', name_zh: '谣言广泛', name_en: 'Rumors' }, { id: 'manipulated', name_zh: '系统操纵', name_en: 'Manipulated' }];
const TRANSPARENCY = [{ id: 'opaque', name_zh: '极度不透明', name_en: 'Opaque' }, { id: 'low', name_zh: '低可见度', name_en: 'Low' }, { id: 'medium', name_zh: '中可见度', name_en: 'Medium' }, { id: 'high', name_zh: '高可见度', name_en: 'High' }, { id: 'transparent', name_zh: '绝对透明', name_en: 'Transparent' }];
const RUMOR_INTENSITY = [{ id: 'none', name_zh: '无谣言', name_en: 'None' }, { id: 'low', name_zh: '低', name_en: 'Low' }, { id: 'medium', name_zh: '中', name_en: 'Medium' }, { id: 'high', name_zh: '高', name_en: 'High' }, { id: 'extreme', name_zh: '满天飞', name_en: 'Extreme' }];
const INSIDER_GAP = [{ id: 'none', name_zh: '无信息差', name_en: 'None' }, { id: 'small', name_zh: '较小', name_en: 'Small' }, { id: 'large', name_zh: '较大', name_en: 'Large' }, { id: 'absolute', name_zh: '绝对隔离', name_en: 'Absolute' }];
const CENSORSHIP_LEVEL = [{ id: 'none', name_zh: '无审查', name_en: 'None' }, { id: 'light', name_zh: '轻度', name_en: 'Light' }, { id: 'heavy', name_zh: '重度', name_en: 'Heavy' }, { id: 'total', name_zh: '全面封锁', name_en: 'Total' }];

const EDU_SYSTEMS = [{ id: 'family', name_zh: '家庭教育', name_en: 'Family' }, { id: 'apprentice', name_zh: '师徒传承', name_en: 'Apprentice' }, { id: 'private_school', name_zh: '私塾教育', name_en: 'Private School' }, { id: 'religious_edu', name_zh: '宗教教育', name_en: 'Religious' }, { id: 'public', name_zh: '公立教育', name_en: 'Public' }, { id: 'private_edu', name_zh: '私立教育', name_en: 'Private' }, { id: 'elite_edu', name_zh: '精英教育', name_en: 'Elite' }, { id: 'vocational', name_zh: '职业教育', name_en: 'Vocational' }, { id: 'higher_edu', name_zh: '高等教育', name_en: 'Higher Edu' }, { id: 'universal_edu', name_zh: '全民教育', name_en: 'Universal' }, { id: 'magic_school', name_zh: '魔法学院', name_en: 'Magic School' }, { id: 'tech_school', name_zh: '科技学院', name_en: 'Tech School' }, { id: 'ai_edu', name_zh: '人工智能教育', name_en: 'AI Edu' }];
const EDU_POPULARITY = [{ id: 'ruling_only', name_zh: '仅统治阶层', name_en: 'Ruling Only' }, { id: 'elite_only', name_zh: '少数精英', name_en: 'Elites' }, { id: 'urban', name_zh: '城市居民', name_en: 'Urban' }, { id: 'basic', name_zh: '基础普及', name_en: 'Basic' }, { id: 'higher', name_zh: '高等教育普及', name_en: 'Higher' }, { id: 'lifelong', name_zh: '终身教育', name_en: 'Lifelong' }];
const MOBILITY_ENV = [{ id: 'rigid', name_zh: '完全固化', name_en: 'Rigid' }, { id: 'extremely_hard', name_zh: '极难改变', name_en: 'Hard' }, { id: 'special_channel', name_zh: '特殊渠道', name_en: 'Special Channel' }, { id: 'limited', name_zh: '有限通道', name_en: 'Limited' }, { id: 'free', name_zh: '较为自由', name_en: 'Free' }, { id: 'highly_fluid', name_zh: '高度流动', name_en: 'Highly Fluid' }];
const EDU_ACCESS = [{ id: 'ruling_only', name_zh: '仅统治阶层', name_en: 'Ruling Only' }, { id: 'elite', name_zh: '少数精英', name_en: 'Elites' }, { id: 'class_based', name_zh: '按阶级分配', name_en: 'Class Based' }, { id: 'universal', name_zh: '普遍可达', name_en: 'Universal' }, { id: 'equal', name_zh: '完全平等', name_en: 'Equal' }];
const TRAINING_COST = [{ id: 'extreme', name_zh: '极高', name_en: 'Extreme' }, { id: 'high', name_zh: '较高', name_en: 'High' }, { id: 'medium', name_zh: '中等', name_en: 'Medium' }, { id: 'low', name_zh: '较低', name_en: 'Low' }, { id: 'free', name_zh: '免费', name_en: 'Free' }];
const CREDENTIAL_BARRIER = [{ id: 'extreme', name_zh: '极其森严', name_en: 'Extreme' }, { id: 'strict', name_zh: '严格', name_en: 'Strict' }, { id: 'normal', name_zh: '一般', name_en: 'Normal' }, { id: 'loose', name_zh: '宽松', name_en: 'Loose' }, { id: 'none', name_zh: '无门槛', name_en: 'None' }];
const UPWARD_PATH = [{ id: 'sealed', name_zh: '完全封死', name_en: 'Sealed' }, { id: 'narrow', name_zh: '极其狭窄', name_en: 'Narrow' }, { id: 'limited', name_zh: '有限', name_en: 'Limited' }, { id: 'wide', name_zh: '较为宽阔', name_en: 'Wide' }, { id: 'infinite', name_zh: '无限可能', name_en: 'Infinite' }];

const TECH_STAGES = [{ id: 'primitive', name_zh: '原始社会', name_en: 'Primitive' }, { id: 'agri', name_zh: '农业社会', name_en: 'Agrarian' }, { id: 'classic', name_zh: '古典文明', name_en: 'Classical' }, { id: 'steam', name_zh: '蒸汽工业', name_en: 'Steam' }, { id: 'electric', name_zh: '电气工业', name_en: 'Electric' }, { id: 'info', name_zh: '信息社会', name_en: 'Info' }, { id: 'smart', name_zh: '智能社会', name_en: 'Smart' }, { id: 'future', name_zh: '未来科技', name_en: 'Future' }, { id: 'magic', name_zh: '魔法文明', name_en: 'Magic' }, { id: 'hybrid', name_zh: '混合文明', name_en: 'Hybrid' }];
const TECH_DIFFUSION = [{ id: 'extreme_monopoly', name_zh: '极度垄断', name_en: 'Extreme Monopoly' }, { id: 'minority', name_zh: '少数阶层普及', name_en: 'Minority' }, { id: 'partial', name_zh: '部分阶层普及', name_en: 'Partial' }, { id: 'widespread', name_zh: '大众普遍普及', name_en: 'Widespread' }, { id: 'universal', name_zh: '全民无死角', name_en: 'Universal' }];
const INDUSTRY_STATUS = [{ id: 'none', name_zh: '几乎无工业', name_en: 'None' }, { id: 'handicraft', name_zh: '手工业为主', name_en: 'Handicraft' }, { id: 'initial', name_zh: '初步工业化', name_en: 'Initial' }, { id: 'mature', name_zh: '工业体系成熟', name_en: 'Mature' }, { id: 'auto', name_zh: '高度自动化', name_en: 'Auto' }, { id: 'extreme', name_zh: '极端先进', name_en: 'Extreme' }, { id: 'collapse', name_zh: '工业衰退', name_en: 'Collapse' }];
const INFRASTRUCTURE_STABILITY = [{ id: 'collapsed', name_zh: '极度崩溃', name_en: 'Collapsed' }, { id: 'degraded', name_zh: '衰退/不稳定', name_en: 'Degraded' }, { id: 'maintained', name_zh: '基本维持', name_en: 'Maintained' }, { id: 'advanced', name_zh: '高度发达', name_en: 'Advanced' }, { id: 'perfect', name_zh: '完美稳定', name_en: 'Perfect' }];

const INDUSTRY_GROUPS = [
  {
    id: 'group1', title_zh: '1. 资源开采与第一产业', title_en: '1. Primary Industry',
    options: [
      { id: 'open_pit', name_zh: '露天采掘', name_en: 'Open Pit' }, { id: 'underground_mine', name_zh: '地下矿洞', name_en: 'Underground Mine' },
      { id: 'deep_sea_drill', name_zh: '深海钻井', name_en: 'Deep Sea Drill' }, { id: 'space_mining', name_zh: '太空采矿', name_en: 'Space Mining' },
      { id: 'magic_vein', name_zh: '魔力矿脉', name_en: 'Magic Vein' }, { id: 'manual_farming', name_zh: '人力农耕', name_en: 'Manual Farming' },
      { id: 'mech_farm', name_zh: '机械化农场', name_en: 'Mech Farm' }, { id: 'hydroponics', name_zh: '无土栽培', name_en: 'Hydroponics' },
      { id: 'gene_crop', name_zh: '基因改造作物', name_en: 'GMO Crops' }, { id: 'magic_plant', name_zh: '灵植/魔法草药', name_en: 'Magic Plants' },
      { id: 'ind_livestock', name_zh: '工业化养殖', name_en: 'Ind. Livestock' }, { id: 'deep_sea_fish', name_zh: '远洋捕捞', name_en: 'Deep Sea Fishing' },
      { id: 'space_hunt', name_zh: '星际巨兽狩猎', name_en: 'Space Hunt' }
    ]
  },
  {
    id: 'group2', title_zh: '2. 基础材料与重工业', title_en: '2. Heavy Industry',
    options: [
      { id: 'bronze', name_zh: '青铜作坊', name_en: 'Bronze' }, { id: 'steel', name_zh: '钢铁冶炼', name_en: 'Steel' },
      { id: 'alloy', name_zh: '特种合金', name_en: 'Special Alloy' }, { id: 'nano_material', name_zh: '纳米材料', name_en: 'Nano Material' },
      { id: 'superconductor', name_zh: '超导材料', name_en: 'Superconductor' }, { id: 'mithril', name_zh: '秘银提纯', name_en: 'Mithril' },
      { id: 'chem_ind', name_zh: '基础化学', name_en: 'Chem Industry' }, { id: 'oil_refine', name_zh: '石油炼化', name_en: 'Oil Refining' },
      { id: 'bio_material', name_zh: '生物材料', name_en: 'Bio Materials' }, { id: 'magic_potion', name_zh: '魔法药剂量产', name_en: 'Magic Potions' },
      { id: 'nuclear_fuel', name_zh: '核燃料提纯', name_en: 'Nuclear Fuel' }, { id: 'steam_engine', name_zh: '蒸汽机', name_en: 'Steam Engine' },
      { id: 'mech_assembly', name_zh: '重型机械组装', name_en: 'Heavy Machinery' }, { id: 'mech_golem', name_zh: '魔像与巨构', name_en: 'Mech Golem' }
    ]
  },
  {
    id: 'group3', title_zh: '3. 轻工业与民生制造', title_en: '3. Light Industry',
    options: [
      { id: 'tailor', name_zh: '传统裁缝', name_en: 'Tailor' }, { id: 'modern_textile', name_zh: '现代服装流水线', name_en: 'Modern Textile' },
      { id: 'ballistic_material', name_zh: '防弹/防化材料', name_en: 'Ballistic Material' }, { id: 'holographic_fashion', name_zh: '全息时装', name_en: 'Holo Fashion' },
      { id: 'magic_robe', name_zh: '魔法长袍附魔', name_en: 'Magic Robe' }, { id: 'food_workshop', name_zh: '传统食品作坊', name_en: 'Food Workshop' },
      { id: 'ind_food', name_zh: '工业化食品加工', name_en: 'Ind. Food' }, { id: 'cold_chain', name_zh: '冷链仓储', name_en: 'Cold Chain' },
      { id: 'nutrient_paste', name_zh: '合成营养膏', name_en: 'Nutrient Paste' }, { id: 'magic_wine', name_zh: '魔药/灵酒酿造', name_en: 'Magic Wine' },
      { id: 'ceramics', name_zh: '陶瓷与玻璃', name_en: 'Ceramics' }, { id: 'daily_cyber', name_zh: '义体保养品', name_en: 'Cyber Maintenance' }
    ]
  },
  {
    id: 'group4', title_zh: '4. 交通、能源与信息基建', title_en: '4. Infrastructure',
    options: [
      { id: 'steam_power', name_zh: '煤炭与蒸汽', name_en: 'Steam Power' }, { id: 'grid', name_zh: '高压电网', name_en: 'Power Grid' },
      { id: 'nuclear', name_zh: '核裂变/聚变', name_en: 'Nuclear' }, { id: 'antimatter', name_zh: '反物质引擎', name_en: 'Antimatter' },
      { id: 'magic_hub', name_zh: '魔力枢纽网', name_en: 'Magic Hub' }, { id: 'dirt_road', name_zh: '泥土路与驿道', name_en: 'Dirt Road' },
      { id: 'railway', name_zh: '铁路网', name_en: 'Railway' }, { id: 'highway', name_zh: '现代公路', name_en: 'Highway' },
      { id: 'airport', name_zh: '机场与航空枢纽', name_en: 'Airport' }, { id: 'spaceport', name_zh: '星际港口/轨道电梯', name_en: 'Spaceport' },
      { id: 'teleport', name_zh: '传送阵与魔法飞艇', name_en: 'Teleport/Magic Airship' }, { id: 'beacon', name_zh: '烽火台与飞鸽', name_en: 'Beacon/Pigeon' },
      { id: 'telegram', name_zh: '电报与电话线', name_en: 'Telegraph' }, { id: 'internet', name_zh: '互联网与数据中心', name_en: 'Internet' },
      { id: 'quantum_comm', name_zh: '量子通信网', name_en: 'Quantum Comm' }, { id: 'telepathy', name_zh: '心灵感应基站', name_en: 'Telepathy' }
    ]
  },
  {
    id: 'group5', title_zh: '5. 军工、医疗与城建', title_en: '5. Military/Medical/City',
    options: [
      { id: 'cold_weapon', name_zh: '冷兵器作坊', name_en: 'Cold Weapon' }, { id: 'firearms', name_zh: '火器与火药', name_en: 'Firearms' },
      { id: 'tanks', name_zh: '现代枪炮坦克', name_en: 'Tanks' }, { id: 'nuclear_weapon', name_zh: '核武器与导弹', name_en: 'Nuclear Weapon' },
      { id: 'mech_armor', name_zh: '机甲与动力装甲', name_en: 'Mech Armor' }, { id: 'star_dock', name_zh: '星际战舰船坞', name_en: 'Star Dock' },
      { id: 'magic_cannon', name_zh: '魔力巨炮', name_en: 'Magic Cannon' }, { id: 'herb_clinic', name_zh: '草药医馆', name_en: 'Herb Clinic' },
      { id: 'pharma', name_zh: '化学制药厂', name_en: 'Pharma' }, { id: 'gene_clone', name_zh: '基因工程与克隆舱', name_en: 'Gene/Clone' },
      { id: 'cyber_shop', name_zh: '义体改造车间', name_en: 'Cyber Shop' }, { id: 'revival_altar', name_zh: '复活祭坛', name_en: 'Revival Altar' },
      { id: 'sewer', name_zh: '下水道与排污', name_en: 'Sewer' }, { id: 'water_plant', name_zh: '自来水厂', name_en: 'Water Plant' },
      { id: 'gas_network', name_zh: '城市燃气管网', name_en: 'Gas Network' }, { id: 'purifier', name_zh: '环境净化塔', name_en: 'Purifier' },
      { id: 'shelter', name_zh: '大型防灾掩体', name_en: 'Shelter' }
    ]
  },
  {
    id: 'group6', title_zh: '6. 科研与边缘循环', title_en: '6. R&D & Edge',
    options: [
      { id: 'private_lab', name_zh: '私人实验室', name_en: 'Private Lab' }, { id: 'academy', name_zh: '国家科学院', name_en: 'Academy' },
      { id: 'supercomputer', name_zh: '超级计算机中心', name_en: 'Supercomputer' }, { id: 'magic_tower', name_zh: '魔法塔与奥术实验室', name_en: 'Magic Tower' },
      { id: 'recycle_plant', name_zh: '废品回收厂', name_en: 'Recycle Plant' }, { id: 'scavenger_camp', name_zh: '拾荒者营地', name_en: 'Scavenger Camp' },
      { id: 'black_market_shop', name_zh: '黑市改装工坊', name_en: 'Black Market Shop' }, { id: 'matter_reorganizer', name_zh: '物质重组机', name_en: 'Matter Reorganizer' }
    ]
  },
  {
    id: 'group7', title_zh: '7. 传统非遗与手工技艺', title_en: '7. Traditional Crafts',
    options: [
      { id: 'porcelain', name_zh: '陶瓷与瓷器', name_en: 'Porcelain' }, { id: 'glass_blowing', name_zh: '琉璃与玻璃吹制', name_en: 'Glass Blowing' },
      { id: 'traditional_sword', name_zh: '传统铸剑', name_en: 'Traditional Sword' }, { id: 'embroidery', name_zh: '手工刺绣', name_en: 'Embroidery' },
      { id: 'silk_weaving', name_zh: '丝绸织造', name_en: 'Silk Weaving' }, { id: 'tie_dye', name_zh: '印染与扎染', name_en: 'Tie Dye' },
      { id: 'mortise_tenon', name_zh: '榫卯木作', name_en: 'Mortise & Tenon' }, { id: 'ancient_arch', name_zh: '古法营造(斗拱)', name_en: 'Ancient Architecture' },
      { id: 'lacquerware', name_zh: '漆器与雕漆', name_en: 'Lacquerware' }, { id: 'traditional_brew', name_zh: '传统酿酒/酿醋', name_en: 'Traditional Brew' },
      { id: 'rice_paper', name_zh: '宣纸制造', name_en: 'Rice Paper' }, { id: 'seal_carving', name_zh: '金石篆刻与玉雕', name_en: 'Seal Carving' },
      { id: 'book_restore', name_zh: '古籍修复', name_en: 'Book Restore' }
    ]
  },
  {
    id: 'group8', title_zh: '8. 生活家具与家居制造', title_en: '8. Furniture & Home',
    options: [
      { id: 'solid_wood', name_zh: '原木/实木家具', name_en: 'Solid Wood' }, { id: 'bamboo_rattan', name_zh: '竹编/藤编家具', name_en: 'Bamboo/Rattan' },
      { id: 'metal_furn', name_zh: '金属/铁艺家具', name_en: 'Metal Furniture' }, { id: 'particle_board', name_zh: '板材与塑料拼装', name_en: 'Particle Board' },
      { id: 'ergonomic', name_zh: '人体工学家具', name_en: 'Ergonomic' }, { id: 'redwood', name_zh: '红木/名贵木材', name_en: 'Redwood' },
      { id: 'leather_sofa', name_zh: '真皮沙发/手工地毯', name_en: 'Leather Sofa' }, { id: 'ivory_inlay', name_zh: '金银/象牙镶嵌', name_en: 'Ivory Inlay' },
      { id: 'holographic_furn', name_zh: '全息/悬浮智能家具', name_en: 'Holographic Furn' }, { id: 'bio_furn', name_zh: '生物塑形家具', name_en: 'Bio Furniture' },
      { id: 'magic_furn', name_zh: '魔法造物(恒温壁炉)', name_en: 'Magic Furn' }
    ]
  },
  {
    id: 'group9', title_zh: '9. 精密仪器与特种工艺', title_en: '9. Precision Instruments',
    options: [
      { id: 'microscope', name_zh: '光学镜片与显微镜', name_en: 'Microscope' }, { id: 'clockwork', name_zh: '钟表与精密齿轮', name_en: 'Clockwork' },
      { id: 'surveying', name_zh: '测量与测绘仪器', name_en: 'Surveying' }, { id: 'surgical_tool', name_zh: '手术器械锻造', name_en: 'Surgical Tool' },
      { id: 'prosthetic', name_zh: '假肢/机械义体精加工', name_en: 'Prosthetic' }, { id: 'gene_sequencer', name_zh: '基因测序仪', name_en: 'Gene Sequencer' },
      { id: 'holy_relic', name_zh: '圣器锻造', name_en: 'Holy Relic' }, { id: 'rune_inscription', name_zh: '符文刻印与附魔', name_en: 'Rune Inscription' },
      { id: 'crystal_polish', name_zh: '魔法水晶打磨', name_en: 'Crystal Polish' }
    ]
  }
];

const MEDICAL_SYSTEMS = [{ id: 'western', name_zh: '现代西医', name_en: 'Western' }, { id: 'tcm', name_zh: '中医', name_en: 'TCM' }, { id: 'ethnic', name_zh: '传统民族医学', name_en: 'Ethnic' }, { id: 'folk', name_zh: '民间草药', name_en: 'Folk' }, { id: 'mixed_med', name_zh: '混合医疗', name_en: 'Mixed' }, { id: 'shaman', name_zh: '巫医', name_en: 'Shaman' }, { id: 'religious_heal', name_zh: '宗教治疗', name_en: 'Religious' }, { id: 'magic_heal', name_zh: '魔法治疗', name_en: 'Magic' }, { id: 'alchemy', name_zh: '炼金术治疗', name_en: 'Alchemy' }, { id: 'cyber_repair', name_zh: '科技义体', name_en: 'Cyber' }, { id: 'bio_eng', name_zh: '生物基因', name_en: 'Bio' }, { id: 'nano', name_zh: '纳米医疗', name_en: 'Nano' }, { id: 'revival', name_zh: '复活', name_en: 'Revival' }];
const MEDICAL_RESOURCES = [{ id: 'extreme_lack', name_zh: '极度匮乏', name_en: 'Extreme Lack' }, { id: 'few_access', name_zh: '少数人获得', name_en: 'Few Access' }, { id: 'basic', name_zh: '基础普及', name_en: 'Basic' }, { id: 'sufficient', name_zh: '较为充足', name_en: 'Sufficient' }, { id: 'high_end', name_zh: '高度普及', name_en: 'High-End' }, { id: 'near_immortal', name_zh: '近乎不死', name_en: 'Near Immortal' }];
const MEDICAL_ACCESS = [{ id: 'elite', name_zh: '仅统治阶层', name_en: 'Elite Only' }, { id: 'urban', name_zh: '仅城市居民', name_en: 'Urban Only' }, { id: 'wealth', name_zh: '按财富', name_en: 'By Wealth' }, { id: 'class', name_zh: '按阶级', name_en: 'By Class' }, { id: 'universal', name_zh: '普遍获得', name_en: 'Universal' }, { id: 'equal', name_zh: '完全平等', name_en: 'Equal' }];
const RECOVERY_SPEED = [{ id: 'extremely_slow', name_zh: '极慢', name_en: 'Extremely Slow' }, { id: 'slow', name_zh: '缓慢', name_en: 'Slow' }, { id: 'normal', name_zh: '正常', name_en: 'Normal' }, { id: 'fast', name_zh: '迅速', name_en: 'Fast' }, { id: 'instant', name_zh: '瞬间', name_en: 'Instant' }];
const REHAB = [{ id: 'none', name_zh: '无', name_en: 'None' }, { id: 'basic', name_zh: '基础安抚', name_en: 'Basic' }, { id: 'professional', name_zh: '专业心理治疗', name_en: 'Professional' }, { id: 'advanced', name_zh: '高科技重塑', name_en: 'Advanced' }];
const VIOLENCE_ENV = [{ id: 'peace', name_zh: '极度和平', name_en: 'Peaceful' }, { id: 'low', name_zh: '低暴力', name_en: 'Low' }, { id: 'normal', name_zh: '普通治安', name_en: 'Normal' }, { id: 'frequent', name_zh: '冲突频发', name_en: 'Frequent' }, { id: 'gang_control', name_zh: '黑帮控制', name_en: 'Gang Control' }, { id: 'war', name_zh: '战争社会', name_en: 'War' }, { id: 'collapse', name_zh: '文明崩溃', name_en: 'Collapse' }];
const FORCE_ORGS = [{ id: 'military', name_zh: '正规军队', name_en: 'Military' }, { id: 'local', name_zh: '地方武装', name_en: 'Local' }, { id: 'private', name_zh: '私人武装', name_en: 'Private' }, { id: 'noble', name_zh: '贵族武装', name_en: 'Noble' }, { id: 'gang', name_zh: '黑帮', name_en: 'Gang' }, { id: 'religious', name_zh: '宗教武装', name_en: 'Religious' }, { id: 'mercenary', name_zh: '雇佣兵', name_en: 'Mercenary' }, { id: 'magic_combat', name_zh: '魔法战斗', name_en: 'Magic' }, { id: 'auto_military', name_zh: '自动化军事', name_en: 'Auto Military' }];
const WEAPON_AVAILABILITY = [{ id: 'strict_control', name_zh: '严格管制', name_en: 'Strict Control' }, { id: 'military_only', name_zh: '仅军队', name_en: 'Military Only' }, { id: 'specific_class', name_zh: '特定阶层', name_en: 'Specific Class' }, { id: 'partial', name_zh: '部分居民', name_en: 'Partial' }, { id: 'common', name_zh: '普遍持有', name_en: 'Common' }, { id: 'overflow', name_zh: '武器泛滥', name_en: 'Overflow' }];
const POLICING_CAPACITY = [{ id: 'none', name_zh: '无治安', name_en: 'None' }, { id: 'weak', name_zh: '薄弱', name_en: 'Weak' }, { id: 'moderate', name_zh: '基本维持', name_en: 'Moderate' }, { id: 'strong', name_zh: '强力', name_en: 'Strong' }, { id: 'omniscient', name_zh: '全知全能', name_en: 'Omniscient' }];
const WAR_INTENSITY = [{ id: 'none', name_zh: '无战争', name_en: 'None' }, { id: 'localized', name_zh: '局部冲突', name_en: 'Localized' }, { id: 'regional', name_zh: '区域战争', name_en: 'Regional' }, { id: 'global', name_zh: '世界大战', name_en: 'Global' }, { id: 'total', name_zh: '末日战争', name_en: 'Total' }];
const VIOLENT_NORMS = [{ id: 'rare', name_zh: '极其罕见', name_en: 'Rare' }, { id: 'uncommon', name_zh: '少见', name_en: 'Uncommon' }, { id: 'normalized', name_zh: '习以为常', name_en: 'Normalized' }, { id: 'endemic', name_zh: '普遍存在', name_en: 'Endemic' }];


// ---- C. 微观：个体生活、习俗与基层社会 ----
const SOCIAL_STYLES = [{ id: 'involution', name_zh: '内卷互害 (互相举报/踩踏)' }, { id: 'guanxi', name_zh: '人情社会 (送礼/拼关系)' }, { id: 'atomized', name_zh: '原子化冷漠 (谁也不管谁)' }, { id: 'street_violence', name_zh: '街头暴力 (能动手不吵吵)' }, { id: 'cyberbully', name_zh: '网络审判 (网暴/开盒)' }];
const ADDICTION_TYPES = [{ id: 'alcohol', name_zh: '烈酒/劣质酒精' }, { id: 'chemical_drugs', name_zh: '致幻剂/化学毒品' }, { id: 'cyber_drugs', name_zh: '赛博神经毒品 (脑机刺激)' }, { id: 'combat_stimulant', name_zh: '非法战斗兴奋剂' }, { id: 'happy_water', name_zh: '合法精神安抚剂 (快乐水)' }, { id: 'death_game', name_zh: '赌命娱乐 (地下死斗)' }];
const ORG_TYPES = [{ id: 'bureaucracy', name_zh: '官僚行政组织', name_en: 'Bureaucracy' }, { id: 'corporate_org', name_zh: '企业组织', name_en: 'Corporate' }, { id: 'military_org', name_zh: '军事组织', name_en: 'Military' }, { id: 'religious_org', name_zh: '宗教组织', name_en: 'Religious' }, { id: 'clan_org', name_zh: '宗族组织', name_en: 'Clan' }, { id: 'guild', name_zh: '行会与工会', name_en: 'Guild' }, { id: 'noble_org', name_zh: '贵族领主组织', name_en: 'Noble Lord' }, { id: 'loose_autonomy', name_zh: '松散自治', name_en: 'Loose Autonomy' }, { id: 'ai_algo_org', name_zh: 'AI/算法管理', name_en: 'AI Algo' }, { id: 'ngo', name_zh: 'NGO/基金会', name_en: 'NGO' }, { id: 'academic', name_zh: '学术与研究机构', name_en: 'Academic' }, { id: 'intelligence', name_zh: '情报与特务机构', name_en: 'Intelligence' }, { id: 'political_party', name_zh: '政党派系', name_en: 'Political Party' }, { id: 'terrorist', name_zh: '恐怖组织/极端教派', name_en: 'Terrorist' }, { id: 'sect', name_zh: '修仙宗门/魔法学院', name_en: 'Sect' }, { id: 'adventurer_guild', name_zh: '冒险者公会/佣兵团', name_en: 'Adventurer Guild' }, { id: 'inquisition', name_zh: '异端审判庭/圣殿骑士团', name_en: 'Inquisition' }, { id: 'secret_society', name_zh: '秘密结社/暗杀组织', name_en: 'Secret Society' }, { id: 'starfleet', name_zh: '星际舰队/殖民地', name_en: 'Starfleet' }, { id: 'hacker_group', name_zh: '黑客团体/数据黑帮', name_en: 'Hacker Group' }, { id: 'clone_army', name_zh: '克隆兵团/合成人产线', name_en: 'Clone Army' }, { id: 'megacorp', name_zh: '星际财团/巨型企业', name_en: 'Megacorp' }, { id: 'underworld', name_zh: '地下组织', name_en: 'Underworld' }, { id: 'pirates', name_zh: '海盗/废土掠夺者', name_en: 'Pirates' }, { id: 'bounty_hunter', name_zh: '游侠/赏金猎人', name_en: 'Bounty Hunter' }];
const INFORMAL_RULES = [{ id: 'weak', name_zh: '弱(按规章)', name_en: 'Weak' }, { id: 'medium', name_zh: '中(人情与规则)', name_en: 'Medium' }, { id: 'strong', name_zh: '强(关系网)', name_en: 'Strong' }];
const RECORD_BINDING = [{ id: 'low', name_zh: '低(能重开)', name_en: 'Low' }, { id: 'medium', name_zh: '中(本地影响)', name_en: 'Medium' }, { id: 'high', name_zh: '高(跟随一生)', name_en: 'High' }];
const SCAPEGOAT_FREQUENCY = [{ id: 'low', name_zh: '低(实事求是)', name_en: 'Low' }, { id: 'medium', name_zh: '中(偶尔找替身)', name_en: 'Medium' }, { id: 'high', name_zh: '高(习惯性甩锅)', name_en: 'High' }];

const LABOR_TYPES = [{ id: 'slavery', name_zh: '奴隶劳动', name_en: 'Slavery' }, { id: 'serfdom', name_zh: '农奴劳动', name_en: 'Serfdom' }, { id: 'corvee', name_zh: '封建徭役', name_en: 'Corvee' }, { id: 'military_labor', name_zh: '军事劳动', name_en: 'Military Labor' }, { id: 'family_labor', name_zh: '家庭劳动', name_en: 'Family Labor' }, { id: 'employment', name_zh: '雇佣劳动', name_en: 'Employment' }, { id: 'freelance', name_zh: '自由职业', name_en: 'Freelance' }, { id: 'gig', name_zh: '零工经济', name_en: 'Gig Economy' }, { id: 'debt_bondage', name_zh: '债务奴役/卖身契', name_en: 'Debt Bondage' }, { id: 'internship', name_zh: '学徒/实习生', name_en: 'Internship' }, { id: 'collective_labor', name_zh: '集体劳动', name_en: 'Collective' }, { id: 'planned_labor', name_zh: '计划分配', name_en: 'Planned' }, { id: 'volunteer', name_zh: '义务/公益劳动', name_en: 'Volunteer' }, { id: 'automation', name_zh: '自动化生产', name_en: 'Automation' }, { id: 'algo_forced', name_zh: '算法强制劳动', name_en: 'Algo Forced' }, { id: 'clone_service', name_zh: '克隆人服役', name_en: 'Clone Service' }, { id: 'matrix_farming', name_zh: '意识上传剥削', name_en: 'Matrix Farming' }, { id: 'magic_contract_labor', name_zh: '魔法契约强劳', name_en: 'Magic Contract' }, { id: 'undead_driven', name_zh: '傀儡亡灵驱使', name_en: 'Undead Driven' }, { id: 'sect_chores', name_zh: '宗门杂役', name_en: 'Sect Chores' }, { id: 'prison_labor', name_zh: '监狱强制劳动', name_en: 'Prison Labor' }, { id: 'sweatshop', name_zh: '血汗工厂', name_en: 'Sweatshop' }, { id: 'mixed_labor', name_zh: '混合劳动', name_en: 'Mixed Labor' }];
const EXPLOITATION_LEVEL = [{ id: 'low', name_zh: '低(劳有所得)', name_en: 'Low' }, { id: 'medium', name_zh: '中(常规压榨)', name_en: 'Medium' }, { id: 'high', name_zh: '高(敲骨吸髓)', name_en: 'High' }];
const MOBILITY_PROMISE_GAP = [{ id: 'small', name_zh: '小(有回报)', name_en: 'Small' }, { id: 'medium', name_zh: '中(有机会)', name_en: 'Medium' }, { id: 'large', name_zh: '大(纯画大饼)', name_en: 'Large' }];
const DEPLATFORM_RISK = [{ id: 'low', name_zh: '低', name_en: 'Low' }, { id: 'medium', name_zh: '中', name_en: 'Medium' }, { id: 'high', name_zh: '高(随时失业)', name_en: 'High' }];

const REPAIR_MECHANISMS = [
  { id: 'legal_appeal', name_zh: '法律申诉', name_en: 'Legal Appeal' },
  { id: 'admin_review', name_zh: '行政复核', name_en: 'Admin Review' },
  { id: 'judicial_rehab', name_zh: '司法平反', name_en: 'Judicial Rehab' },
  { id: 'internal_appeal', name_zh: '组织内部申诉', name_en: 'Internal Appeal' },
  { id: 'clan_mediation', name_zh: '宗族调解', name_en: 'Clan Mediation' },
  { id: 'religious_absolution', name_zh: '宗教赎罪', name_en: 'Religious Absolution' },
  { id: 'financial_comp', name_zh: '经济赔偿', name_en: 'Financial Comp' },
  { id: 'reputation_repair', name_zh: '社会声誉修复', name_en: 'Reputation Repair' },
  { id: 'blood_revenge', name_zh: '血亲复仇/同态复仇', name_en: 'Blood Revenge' },
  { id: 'duel_judgment', name_zh: '决斗审判/生死状', name_en: 'Duel Judgment' },
  { id: 'vigilante_justice', name_zh: '私刑/地下制裁', name_en: 'Vigilante Justice' },
  { id: 'exile', name_zh: '流放/驱逐出境', name_en: 'Exile' },
  { id: 'memory_wipe', name_zh: '记忆修改/强制洗脑', name_en: 'Memory Wipe' },
  { id: 'data_cleansing', name_zh: '数据清洗/赛博恢复', name_en: 'Data Cleansing' },
  { id: 'clone_compensation', name_zh: '克隆替身代偿', name_en: 'Clone Comp' },
  { id: 'ai_arbitration', name_zh: 'AI 算法仲裁', name_en: 'AI Arbitration' },
  { id: 'divine_vindication', name_zh: '神谕昭雪/神明仲裁', name_en: 'Divine Vindication' },
  { id: 'magic_backlash', name_zh: '魔法契约反噬', name_en: 'Magic Backlash' },
  { id: 'karma_reckoning', name_zh: '因果报应/轮回清算', name_en: 'Karma Reckoning' },
  { id: 'necromancy_comm', name_zh: '向死灵/灵体沟通', name_en: 'Necromancy Comm' },
  { id: 'silencing', name_zh: '物理消灭/灭口', name_en: 'Silencing' },
  { id: 'class_exemption', name_zh: '阶级豁免/刑不上大夫', name_en: 'Class Exemption' },
  { id: 'social_credit_drop', name_zh: '社会信用降级', name_en: 'Social Credit Drop' },
  { id: 'no_repair', name_zh: '无有效修复通道', name_en: 'No Repair' }
];
const SECOND_CHANCE = [{ id: 'few', name_zh: '少', name_en: 'Few' }, { id: 'medium', name_zh: '中', name_en: 'Medium' }, { id: 'many', name_zh: '多', name_en: 'Many' }];
const RECORD_EXPIRY = [{ id: 'permanent', name_zh: '永久保留', name_en: 'Permanent' }, { id: 'conditional', name_zh: '有条件过期', name_en: 'Conditional' }, { id: 'regular_clear', name_zh: '定期清除', name_en: 'Regular Clear' }];
const STIGMA_RESIDUE = [{ id: 'low', name_zh: '低', name_en: 'Low' }, { id: 'medium', name_zh: '中', name_en: 'Medium' }, { id: 'high', name_zh: '高', name_en: 'High' }];

const FAMILY_STRUCTURES = [{ id: 'patriarchy', name_zh: '父权制', name_en: 'Patriarchy' }, { id: 'matriarchy', name_zh: '母权制', name_en: 'Matriarchy' }, { id: 'bilateral', name_zh: '双系家庭', name_en: 'Bilateral' }, { id: 'nuclear', name_zh: '核心家庭', name_en: 'Nuclear' }, { id: 'extended', name_zh: '扩展家庭', name_en: 'Extended' }, { id: 'clan', name_zh: '宗族制', name_en: 'Clan' }, { id: 'tribal', name_zh: '部落家族制', name_en: 'Tribal' }, { id: 'commune', name_zh: '集体家庭', name_en: 'Commune' }, { id: 'state_intervention', name_zh: '国家介入型', name_en: 'State Intervention' }, { id: 'single_parent', name_zh: '单亲/原子化', name_en: 'Single Parent' }, { id: 'dink', name_zh: '丁克/无繁衍', name_en: 'DINK' }, { id: 'ai_parent', name_zh: 'AI/仿生人抚养', name_en: 'AI Parent' }, { id: 'genetic_design', name_zh: '基因定向培育', name_en: 'Genetic Design' }, { id: 'corporate_welfare', name_zh: '企业福利型家庭', name_en: 'Corporate Welfare' }, { id: 'cross_species', name_zh: '跨物种家庭', name_en: 'Cross Species' }, { id: 'blood_contract', name_zh: '血契/魔法契约', name_en: 'Blood Contract' }, { id: 'symbiotic', name_zh: '共生体家族', name_en: 'Symbiotic' }];
const MARRIAGE_TYPES = [{ id: 'monogamy', name_zh: '一夫一妻制', name_en: 'Monogamy' }, { id: 'polygyny', name_zh: '一夫多妻制', name_en: 'Polygyny' }, { id: 'polyandry', name_zh: '一妻多夫制', name_en: 'Polyandry' }, { id: 'polygamy', name_zh: '多配偶制', name_en: 'Polygamy' }, { id: 'arranged', name_zh: '包办婚姻', name_en: 'Arranged' }, { id: 'free_love', name_zh: '自由婚姻', name_en: 'Free Love' }, { id: 'family_alliance', name_zh: '家族联姻', name_en: 'Family Alliance' }, { id: 'political', name_zh: '政治婚姻', name_en: 'Political' }, { id: 'slave_marriage', name_zh: '奴隶婚姻制', name_en: 'Slave Marriage' }, { id: 'weakened_marriage', name_zh: '婚姻制度弱化', name_en: 'Weakened' }, { id: 'ai_partner', name_zh: '虚拟/AI伴侣', name_en: 'AI Partner' }, { id: 'contract_m', name_zh: '契约/期限婚姻', name_en: 'Contract' }, { id: 'soul_bound', name_zh: '灵魂绑定', name_en: 'Soul Bound' }, { id: 'forced_pairing', name_zh: '国家强制配对', name_en: 'Forced Pairing' }, { id: 'clone_pairing', name_zh: '克隆标准配对', name_en: 'Clone Pairing' }, { id: 'repro_contract', name_zh: '生育绑定合同', name_en: 'Repro Contract' }];
const KINSHIP_CONTROL = [{ id: 'weak', name_zh: '弱', name_en: 'Weak' }, { id: 'medium', name_zh: '中', name_en: 'Medium' }, { id: 'strong', name_zh: '强', name_en: 'Strong' }];
const MARRIAGE_COST = [{ id: 'low', name_zh: '低', name_en: 'Low' }, { id: 'medium', name_zh: '中', name_en: 'Medium' }, { id: 'high', name_zh: '高', name_en: 'High' }];
const DIVORCE_PENALTY = [{ id: 'low', name_zh: '低', name_en: 'Low' }, { id: 'medium', name_zh: '中', name_en: 'Medium' }, { id: 'high', name_zh: '高', name_en: 'High' }];

const GOVERNANCE_TYPES = [
  { id: 'province', name_zh: '行省制/郡县制', name_en: 'Province/County' },
  { id: 'feudal_lord', name_zh: '分封制/领主采邑制', name_en: 'Feudal Lord' },
  { id: 'colonial_governor', name_zh: '总督制/殖民地管辖', name_en: 'Colonial Governor' },
  { id: 'military_rule', name_zh: '军区制/军事管制', name_en: 'Military Rule' },
  { id: 'direct_control', name_zh: '垂直直管区', name_en: 'Direct Control' },
  { id: 'federal_state', name_zh: '联邦制州权', name_en: 'Federal State' },
  { id: 'high_autonomy', name_zh: '高度自治特区', name_en: 'High Autonomy' },
  { id: 'city_state_gov', name_zh: '城邦自治', name_en: 'City-State' },
  { id: 'tribal_clan_gov', name_zh: '部落/宗族自治', name_en: 'Tribal/Clan' },
  { id: 'anarchist_community', name_zh: '无政府社区/自发秩序', name_en: 'Anarchist Community' },
  { id: 'corporate_zone', name_zh: '企业代管区', name_en: 'Corporate Zone' },
  { id: 'ai_zone', name_zh: 'AI 算法辖区', name_en: 'AI Zone' },
  { id: 'star_sector', name_zh: '星际星区制', name_en: 'Star Sector' },
  { id: 'sect_territory', name_zh: '修仙宗门领地', name_en: 'Sect Territory' },
  { id: 'theocratic_diocese', name_zh: '神权教区', name_en: 'Theocratic Diocese' }
];

const SETTLEMENT_GOVERNANCE = [
  { id: 'direct_control_city', name_zh: '中央直辖/特别市', name_en: 'Direct Control City' },
  { id: 'provincial_capital', name_zh: '首位度极高的省会', name_en: 'Provincial Capital' },
  { id: 'corporate_city', name_zh: '巨型企业城邦', name_en: 'Corporate City-State' },
  { id: 'floating_city', name_zh: '浮空城/贵族上层区', name_en: 'Floating City' },
  { id: 'bureaucrat_town', name_zh: '流官治理/官僚代管', name_en: 'Bureaucrat Town' },
  { id: 'gentry_town', name_zh: '乡绅/财阀共治', name_en: 'Gentry Town' },
  { id: 'military_fort', name_zh: '军事堡垒/边防重镇', name_en: 'Military Fort' },
  { id: 'baojia', name_zh: '保甲制/连坐制', name_en: 'Baojia System' },
  { id: 'clan_village', name_zh: '宗族自治/乡老议事', name_en: 'Clan Village' },
  { id: 'manor', name_zh: '庄园制/农奴制', name_en: 'Manor System' },
  { id: 'wasteland_camp', name_zh: '废土游民营地', name_en: 'Wasteland Camp' },
  { id: 'grid_community', name_zh: '网格化管理/居委会', name_en: 'Grid Community' },
  { id: 'property_security', name_zh: '物业/安保外包', name_en: 'Property Security' },
  { id: 'gang_zone', name_zh: '地下帮派管辖区', name_en: 'Gang Zone' }
];
const URBAN_RURAL_RELATIONS = [
  { id: 'siphon', name_zh: '剪刀差与虹吸效应', name_en: 'Siphon Effect' },
  { id: 'subsidy', name_zh: '资源反哺与转移支付', name_en: 'Subsidy' },
  { id: 'isolation', name_zh: '绝对割裂与物理隔离', name_en: 'Isolation' },
  { id: 'mutual_benefit', name_zh: '互惠互利与贸易互补', name_en: 'Mutual Benefit' },
  { id: 'black_market', name_zh: '黑市与地下供应链', name_en: 'Black Market' }
];

const JOB_TYPES = [
  { id: 'primitive_job', name_zh: '狩猎者/采集者/萨满', name_en: 'Primitive' },
  { id: 'ancient_farm_job', name_zh: '农夫/更夫/绣娘/衙役', name_en: 'Ancient Farming' },
  { id: 'ancient_high_job', name_zh: '国师/太医/画师/船商', name_en: 'Ancient High' },
  { id: 'industrial_job', name_zh: '纺织女工/矿工/报童', name_en: 'Industrial' },
  { id: 'modern_job', name_zh: '程序员/外卖员/主播/公关', name_en: 'Modern' },
  { id: 'illegal_job', name_zh: '盗贼/黑医/赏金猎人', name_en: 'Illegal' },
  { id: 'scifi_fantasy_job', name_zh: '义体医生/机甲维修/御兽师', name_en: 'Sci-Fi/Fantasy' }
];
const DISEASE_TYPES = [
  { id: 'physical', name_zh: '风寒/瘟疫/尘肺病/营养不良', name_en: 'Physical' },
  { id: 'mental', name_zh: '抑郁/躁郁/PTSD/赛博精神病', name_en: 'Mental' },
  { id: 'scifi_fantasy_dis', name_zh: '魔力枯竭症/石化病/基因崩溃', name_en: 'Sci-Fi/Fantasy' }
];
const DIETARY_HABITS = [
  { id: 'poor_diet', name_zh: '贫民粗粮/合成营养膏', name_en: 'Poor Diet' },
  { id: 'rich_diet', name_zh: '贵族精米白面/山珍海味', name_en: 'Rich Diet' },
  { id: 'regional_diet', name_zh: '南甜北咸/东辣西酸', name_en: 'Regional Diet' },
  { id: 'nomad_diet', name_zh: '游牧吃肉喝奶/沿海生食', name_en: 'Nomad/Coastal Diet' },
  { id: 'etiquette', name_zh: '繁琐餐桌礼仪/分餐制', name_en: 'Etiquette' }
];
const LIFESTYLE_HABITS = [
  { id: 'agrarian_schedule', name_zh: '日出而作日落而息', name_en: 'Agrarian Schedule' },
  { id: 'modern_schedule', name_zh: '朝九晚五', name_en: 'Modern Schedule' },
  { id: 'nightlife_schedule', name_zh: '夜夜笙歌', name_en: 'Nightlife Schedule' },
  { id: 'monk_schedule', name_zh: '闭关打坐', name_en: 'Monk Schedule' },
  { id: 'no_bath', name_zh: '终生不洗澡/卫生极差', name_en: 'No Bath' },
  { id: 'public_bath', name_zh: '公共浴池/香汤沐浴', name_en: 'Public Bath' },
  { id: 'street_social', name_zh: '走街串巷/茶馆听书', name_en: 'Street Social' },
  { id: 'salon_social', name_zh: '沙龙/舞会', name_en: 'Salon Social' }
];
const HOUSING_STYLES = [
  { id: 'slum', name_zh: '棚户区/贫民窟/胶囊公寓', name_en: 'Slum/Capsule' },
  { id: 'traditional_house', name_zh: '四合院/筒子楼', name_en: 'Traditional House' },
  { id: 'manor_castle', name_zh: '庄园城堡/太空站/树屋', name_en: 'Manor/Castle' },
  { id: 'dirt_bed', name_zh: '泥砖土炕', name_en: 'Dirt Bed' },
  { id: 'luxury_furniture', name_zh: '实木/红木/真皮', name_en: 'Luxury Furniture' },
  { id: 'holographic_furniture', name_zh: '全息虚拟家具/悬浮床', name_en: 'Holographic Furniture' }
];
const CLOTHING_STYLES = [
  { id: 'poor_clothing', name_zh: '粗布麻衣/原色', name_en: 'Poor Clothing' },
  { id: 'noble_clothing', name_zh: '丝绸/皮草/金银配饰', name_en: 'Noble Clothing' },
  { id: 'gender_age_clothing', name_zh: '长袍/西装/旗袍/肚兜', name_en: 'Gender/Age Clothing' },
  { id: 'job_clothing', name_zh: '铠甲/长袍/紧身衣/外骨骼', name_en: 'Job Clothing' },
  { id: 'ethnic_clothing', name_zh: '汉服/和服/阿拉伯长袍', name_en: 'Ethnic Clothing' }
];
const TRANSPORT_TYPES = [
  { id: 'walking', name_zh: '步行/赤脚/挤公交', name_en: 'Walking/Public Transit' },
  { id: 'middle_transport', name_zh: '自行车/私家车/高铁', name_en: 'Middle Transport' },
  { id: 'elite_transport', name_zh: '八抬大轿/私人飞机/星舰', name_en: 'Elite Transport' },
  { id: 'regional_transport', name_zh: '乘船/骆驼/雪橇/索道', name_en: 'Regional Transport' }
];
const ENTERTAINMENT_TYPES = [
  { id: 'poor_fun', name_zh: '斗蛐蛐/赌博/听评书', name_en: 'Poor Fun' },
  { id: 'rich_fun', name_zh: '听歌剧/赛马/高尔夫', name_en: 'Rich Fun' },
  { id: 'kid_fun', name_zh: '泥巴/木剑/电子游戏', name_en: 'Kid Fun' },
  { id: 'youth_fun', name_zh: '酒吧/极限运动/追星', name_en: 'Youth Fun' },
  { id: 'elder_fun', name_zh: '下棋/广场舞/养生', name_en: 'Elder Fun' },
  { id: 'sports', name_zh: '摔跤/击剑/机甲格斗/御剑', name_en: 'Sports' }
];
const CONSUMPTION_HABITS = [
  { id: 'survival_consumption', name_zh: '生存消费(只买必需品)', name_en: 'Survival Consumption' },
  { id: 'luxury_consumption', name_zh: '面子消费(追求品牌/奢侈品)', name_en: 'Luxury Consumption' },
  { id: 'virtual_consumption', name_zh: '超前/虚拟消费(信贷/打赏)', name_en: 'Virtual Consumption' }
];

const FESTIVALS = [{ id: 'natural', name_zh: '自然与农业节令', name_en: 'Nature' }, { id: 'religious', name_zh: '宗教与信仰节日', name_en: 'Religious' }, { id: 'political', name_zh: '政治与国家纪念日', name_en: 'Political' }, { id: 'traditional', name_zh: '传统与民族节日', name_en: 'Traditional' }, { id: 'class_prof', name_zh: '阶层职业专属节', name_en: 'Class' }, { id: 'scifi_fantasy', name_zh: '科幻奇幻特色节', name_en: 'Sci-Fi' }];
const LIFE_RITUALS = [{ id: 'birth', name_zh: '诞生礼', name_en: 'Birth' }, { id: 'adulthood_m', name_zh: '男性成年礼', name_en: 'Male Adulthood' }, { id: 'adulthood_f', name_zh: '女性成年礼', name_en: 'Female Adulthood' }, { id: 'wedding', name_zh: '婚礼仪式', name_en: 'Wedding' }, { id: 'funeral', name_zh: '丧葬仪式', name_en: 'Funeral' }];
const FOLK_CUSTOMS = [{ id: 'totem', name_zh: '图腾与自然崇拜', name_en: 'Totemism' }, { id: 'taboo', name_zh: '行为禁忌', name_en: 'Taboos' }, { id: 'language_taboo', name_zh: '语言与避讳', name_en: 'Language Taboos' }, { id: 'folk_belief', name_zh: '民间信仰(占卜)', name_en: 'Folk Beliefs' }];
const AESTHETICS = [{ id: 'plump', name_zh: '丰腴/古典', name_en: 'Plump' }, { id: 'skinny', name_zh: '白幼瘦/现代', name_en: 'Skinny' }, { id: 'cyber', name_zh: '机械义体化', name_en: 'Cyberized' }, { id: 'xianxia', name_zh: '仙风道骨', name_en: 'Xianxia' }];

const CULTURE_ENV = [{ id: 'conservative', name_zh: '极度保守', name_en: 'Conservative' }, { id: 'mixed', name_zh: '传统与创新并存', name_en: 'Mixed' }, { id: 'encouraging', name_zh: '鼓励创新', name_en: 'Encouraging' }, { id: 'open', name_zh: '思想高度开放', name_en: 'Open' }, { id: 'restricted', name_zh: '思想严格限制', name_en: 'Restricted' }, { id: 'collapse', name_zh: '创新体系崩溃', name_en: 'Collapse' }];
const ART_SUPPLY = [{ id: 'folk', name_zh: '民间艺术', name_en: 'Folk' }, { id: 'religious', name_zh: '宗教艺术', name_en: 'Religious' }, { id: 'noble', name_zh: '贵族艺术', name_en: 'Noble' }, { id: 'mass', name_zh: '大众娱乐', name_en: 'Mass' }, { id: 'commercial', name_zh: '商业文化', name_en: 'Commercial' }, { id: 'digital', name_zh: '数字娱乐', name_en: 'Digital' }, { id: 'vr', name_zh: '虚拟现实娱乐', name_en: 'VR' }, { id: 'magic', name_zh: '魔法艺术', name_en: 'Magic' }, { id: 'immersive', name_zh: '沉浸式娱乐', name_en: 'Immersive' }, { id: 'academic', name_zh: '学院艺术', name_en: 'Academic' }, { id: 'traditional_art', name_zh: '传统文化艺术', name_en: 'Traditional' }, { id: 'spiritual_art', name_zh: '文化精神习俗艺术', name_en: 'Spiritual' }];
const INNOVATION_STATE = [{ id: 'scarce', name_zh: '创新资源匮乏', name_en: 'Scarce' }, { id: 'slow', name_zh: '创新缓慢', name_en: 'Slow' }, { id: 'stable', name_zh: '稳定创新', name_en: 'Stable' }, { id: 'active', name_zh: '创新活跃', name_en: 'Active' }, { id: 'boom', name_zh: '技术爆发', name_en: 'Boom' }, { id: 'excess', name_zh: '创新过剩', name_en: 'Excess' }];
const INNOVATION_RATE = [{ id: 'stagnant', name_zh: '停滞', name_en: 'Stagnant' }, { id: 'slow', name_zh: '缓慢', name_en: 'Slow' }, { id: 'moderate', name_zh: '中等', name_en: 'Moderate' }, { id: 'fast', name_zh: '快速', name_en: 'Fast' }];
const IDEA_FREEDOM = [{ id: 'oppressed', name_zh: '压抑', name_en: 'Oppressed' }, { id: 'restricted', name_zh: '受限', name_en: 'Restricted' }, { id: 'free', name_zh: '自由', name_en: 'Free' }, { id: 'absolute', name_zh: '极度自由', name_en: 'Absolute' }];
const NOVELTY_SUPPLY = [{ id: 'low', name_zh: '低', name_en: 'Low' }, { id: 'medium', name_zh: '中等', name_en: 'Medium' }, { id: 'high', name_zh: '高', name_en: 'High' }, { id: 'infinite', name_zh: '无限', name_en: 'Infinite' }];


// =========================================================
// 2. 通用组件
// =========================================================
function SelectField({ label, value, options, onChange, lang }: { label: string, value: string, options: any[], onChange: (val: string) => void, lang: string }) {
  return (
    <div style={{ marginBottom: '1.2rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}>
        <option value="">{lang === 'zh' ? '-- 请选择 --' : '-- Select --'}</option>
        {options.map(opt => <option key={opt.id} value={opt.id}>{lang === 'zh' ? opt.name_zh : opt.name_en}</option>)}
      </select>
    </div>
  );
}

function TagGroup({ label, selected, options, onChange, lang }: { label: string, selected: string[], options: any[], onChange: (id: string) => void, lang: string }) {
  return (
    <div style={{ marginBottom: '1.2rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {options.map(opt => {
          const isActive = selected.includes(opt.id);
          return (
            <button key={opt.id} onClick={() => onChange(opt.id)} style={{ 
              padding: '0.4rem 0.8rem', 
              borderRadius: '20px', 
              border: `1px solid ${isActive ? 'var(--primary-color)' : 'var(--card-border)'}`, 
              background: isActive ? 'rgba(128, 128, 128, 0.16)' : 'transparent', 
              color: isActive ? 'var(--primary-color)' : 'var(--text-muted)', 
              cursor: 'pointer', 
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}>
              {lang === 'zh' ? opt.name_zh : opt.name_en}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =========================================================
// 3. 页面主体 (宏观 -> 中观 -> 微观 排布)
// =========================================================
export default function WorldBuildingPage({ worldId, onBack, lang }: { worldId: string, onBack?: () => void, lang: string }) {
  const [activeSubTab, setActiveSubTab] = useState<string>('era')
  const [config, setConfig] = useState<any>(null)
  const [worldName, setWorldName] = useState('')
  const [inputId, setInputId] = useState(worldId || crypto.randomUUID().slice(0, 8))
  
  // ✅ 新增：控制当前显示宏观、中观还是微观
  const [activeLevel, setActiveLevel] = useState<'macro' | 'meso' | 'micro'>('macro')

  useEffect(() => {
    async function init() {
      if (worldId) {
        const w = await getWorldById(worldId)
        if (w) setWorldName(w.name)
        let cfg = await getWorldBuildingConfig(worldId)
        if (!cfg) cfg = await initializeWorldBuildingConfig(worldId)
        setConfig(cfg)
      } else {
        setInputId(crypto.randomUUID().slice(0, 8))
        setConfig({ id: crypto.randomUUID(), worldId: 'temp-id', selections: {}, parameters: {}, updatedAt: new Date().toISOString() })
      }
    }
    init().catch((error) => {
      // IndexedDB 不可用（隐私模式 / 存储被禁用）时不要让页面卡在 Loading
      console.error('世界建设配置加载失败，使用临时配置', error)
      setConfig({
        id: crypto.randomUUID(),
        worldId: worldId || 'temp-id',
        selections: {},
        parameters: {},
        updatedAt: new Date().toISOString(),
      })
    })
  }, [worldId])

  if (!config) return <div style={{ padding: '2rem' }}>Loading...</div>

  const handleSingle = (field: string, val: string) => setConfig({ ...config, selections: { ...config.selections, [field]: [val] } })
  const handleMulti = (field: string, val: string) => {
    const current = config.selections[field] || []
    const updated = current.includes(val) ? current.filter((i: string) => i !== val) : [...current, val]
    setConfig({ ...config, selections: { ...config.selections, [field]: updated } })
  }

    const handleSave = async () => {
    if (!worldName.trim()) return alert(lang === 'zh' ? '❌ 请填写世界名称！' : '❌ Please enter world name!')

    try {
      const configData = {
        selections: config.selections,
        parameters: config.parameters || {}
      }
      const backgroundStr = JSON.stringify(configData)

      // 👇 修改：用 worldId 来判断是新建还是更新，而不是 inputId
      if (!worldId) {
        // 如果是新建，调用后端生成 UUID
        await createWorld({
          name: worldName,
          description: 'Custom World',
          type: 'fiction',
          background: backgroundStr,
          product_scene: sessionStorage.getItem('ws.productScene') || undefined
        })
      } else {
        // 如果是编辑现有世界，用 worldId 去更新
        await updateWorld(worldId, {
          name: worldName,
          background: backgroundStr
        })
      }

      alert(lang === 'zh' ? '世界保存成功！' : 'World saved successfully!')
      
      if (typeof onBack === 'function') {
        onBack()
      } else {
        window.location.reload()
      }

    } catch (error) {
      console.error("保存失败:", error)
      alert("保存失败，请查看控制台")
    }
  }

    const handleDelete = async () => {
    if (!worldId) return alert(lang === 'zh' ? '当前是新建状态，无需删除。' : 'Unsaved world, nothing to delete.')
    try {
      // 👇 修改：调用后端的删除接口
      await deleteWorld(worldId)
      alert(lang === 'zh' ? '🗑️ 世界已彻底删除！' : '🗑️ World deleted!')
      if (onBack) onBack()
    } catch (err) {
      console.error(err)
      alert('❌ Delete failed')
    }
  }

    return (
    <div style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* 1. 顶部头部区域 */}
        <header className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flex: 1 }}>
            {onBack && (
              <button onClick={onBack} type="button" style={{ padding: '8px 16px', background: 'rgba(128,128,128,0.1)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', height: 'fit-content', marginTop: '4px' }}>
                ← 返回
              </button>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
             <input value={worldName} onChange={e => setWorldName(e.target.value)} placeholder={lang === 'zh' ? '请输入世界名称' : 'Enter World Name'} style={{ fontSize: '20px', fontWeight: 500, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', padding: 0, width: '100%', maxWidth: '400px' }} />
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {lang === 'zh' ? '世界 ID:' : 'World ID:'} <span style={{ background: 'rgba(128,128,128,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{inputId}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={handleDelete} style={{ padding: '8px 20px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
              {lang === 'zh' ? '删除世界' : 'Delete'}
            </button>
            <button onClick={handleSave} style={{ padding: '8px 24px', background: 'var(--primary-color)', color: 'var(--bg-color)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s' }}>
              {lang === 'zh' ? '保存设定' : 'Save'}
            </button>
          </div>
        </header>

        {worldId && (
          <section className="glass-card" style={{ padding: '1.1rem 1.3rem' }}>
            <AxisObjectsPanel worldId={worldId} title="六轴压强 · 世界基础配置" />
          </section>
        )}

        {/* 2. 母导航 (宏观-中观-微观) */}
        <div style={{ display: 'flex', gap: '1rem', position: 'sticky', top: 0, zIndex: 25, padding: '10px 0', background: 'var(--bg-color)' }}>
          {[
            { id: 'macro', num: '01', title: '宏观：世界基底' },
            { id: 'meso', num: '02', title: '中观：社会运转' },
            { id: 'micro', num: '03', title: '微观：生活与治理' }
          ].map(level => (
           <button key={level.id} type="button" onClick={() => { setActiveLevel(level.id as any); if (level.id === 'macro') setActiveSubTab('era'); if (level.id === 'meso') setActiveSubTab('regime'); if (level.id === 'micro') setActiveSubTab('governance'); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', background: activeLevel === level.id ? 'rgba(128, 128, 128, 0.15)' : 'transparent', border: activeLevel === level.id ? '1px solid var(--text-main)' : '1px solid var(--card-border)', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: activeLevel === level.id ? 'var(--primary-color)' : 'var(--text-muted)', marginBottom: '4px' }}>{level.num}</span>
              <span style={{ fontSize: '16px', fontWeight: 600, color: activeLevel === level.id ? 'var(--primary-color)' : 'var(--text-main)' }}>{level.title}</span>
            </button>
          ))}
        </div>

                {/* 3. 子导航 (具体模块) */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem', overflowX: 'auto' }}>
          {activeLevel === 'macro' && [{ id: 'era', label: '时代与思想' }, { id: 'nature', label: '自然与生态' }, { id: 'supernatural', label: '法则与历史' }].map(tab => (
            <button key={tab.id} onClick={() => setActiveSubTab(tab.id)} style={{ padding: '8px 16px', background: activeSubTab === tab.id ? 'var(--text-main)' : 'transparent', borderRadius: '8px', border: 'none', color: activeSubTab === tab.id ? 'var(--bg-color)' : 'var(--text-main)', fontWeight: activeSubTab === tab.id ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', opacity: activeSubTab === tab.id ? 1 : 0.6 }}>{tab.label}</button>
          ))}
          
          {activeLevel === 'meso' && [{ id: 'regime', label: '政体与阶级' }, { id: 'law', label: '地缘与法律' }, { id: 'economy', label: '经济与信息' }, { id: 'education', label: '教育与流动' }, { id: 'tech', label: '科技与工业' }, { id: 'medical', label: '医疗与治安' }].map(tab => (
            <button key={tab.id} onClick={() => setActiveSubTab(tab.id)} style={{ padding: '8px 16px', background: activeSubTab === tab.id ? 'var(--text-main)' : 'transparent', borderRadius: '8px', border: 'none', color: activeSubTab === tab.id ? 'var(--bg-color)' : 'var(--text-main)', fontWeight: activeSubTab === tab.id ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', opacity: activeSubTab === tab.id ? 1 : 0.6 }}>{tab.label}</button>
          ))}
          
          {activeLevel === 'micro' && [{ id: 'governance', label: '治理与聚落' }, { id: 'org', label: '组织与劳动' }, { id: 'family', label: '修复与家庭' }, { id: 'culture', label: '文化与生活' }].map(tab => (
            <button key={tab.id} onClick={() => setActiveSubTab(tab.id)} style={{ padding: '8px 16px', background: activeSubTab === tab.id ? 'var(--text-main)' : 'transparent', borderRadius: '8px', border: 'none', color: activeSubTab === tab.id ? 'var(--bg-color)' : 'var(--text-main)', fontWeight: activeSubTab === tab.id ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', opacity: activeSubTab === tab.id ? 1 : 0.6 }}>{tab.label}</button>
          ))}
        </div>

        {/* 4. 内容区域 (全垂直单列排版) */}
        <div style={{ minHeight: '400px' }}>
          
          {/* ================= 宏观层级 ================= */}
          {activeLevel === 'macro' && activeSubTab === 'era' && (
            <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>⏳ 时代区间与未来预期</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <SelectField lang={lang} label="时代发展阶段" value={(config.selections['era']?.[0] as string) || ''} options={ERA_STAGES} onChange={v => handleSingle('era', v)} />
                  <SelectField lang={lang} label="增长顺风" value={(config.selections['growth_tailwind']?.[0] as string) || ''} options={GROWTH_TAILWIND} onChange={v => handleSingle('growth_tailwind', v)} />
                  <SelectField lang={lang} label="未来可信度" value={(config.selections['future_believability']?.[0] as string) || ''} options={FUTURE_BELIEVABILITY} onChange={v => handleSingle('future_believability', v)} />
                  <SelectField lang={lang} label="精英俘获" value={(config.selections['elite_capture']?.[0] as string) || ''} options={ELITE_CAPTURE} onChange={v => handleSingle('elite_capture', v)} />
                  <SelectField lang={lang} label="未来预期" value={(config.selections['future_expectation']?.[0] as string) || ''} options={FUTURE_EXPECTATION} onChange={v => handleSingle('future_expectation', v)} />
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>🏛️ 意识形态与道德气候</h4>
                <TagGroup lang={lang} label="主流意识形态 (多选)" selected={(config.selections['ideologies'] as string[]) || []} options={IDEOLOGIES} onChange={v => handleMulti('ideologies', v)} />
                <TagGroup lang={lang} label="时代哲学流派" selected={(config.selections['philosophy'] as string[]) || []} options={PHILOSOPHY_SCHOOLS} onChange={v => handleMulti('philosophy', v)} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <SelectField lang={lang} label="思想控制程度" value={(config.selections['thought_control']?.[0] as string) || ''} options={THOUGHT_CONTROL} onChange={v => handleSingle('thought_control', v)} />
                  <SelectField lang={lang} label="正统强度" value={(config.selections['orthodoxy_strength']?.[0] as string) || ''} options={ORTHODOXY_STRENGTH} onChange={v => handleSingle('orthodoxy_strength', v)} />
                  <SelectField lang={lang} label="替罪羊机制" value={(config.selections['scapegoat_a3']?.[0] as string) || ''} options={SCAPEGOAT_NEED_A3} onChange={v => handleSingle('scapegoat_a3', v)} />
                  <SelectField lang={lang} label="公共表达空间" value={(config.selections['speech_domain']?.[0] as string) || ''} options={SPEECH_DOMAIN} onChange={v => handleSingle('speech_domain', v)} />
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>🌍 地缘性格与美学流派</h4>
                <TagGroup lang={lang} label="地缘国家与文明性格" selected={(config.selections['geo_culture'] as string[]) || []} options={GEO_CULTURES} onChange={v => handleMulti('geo_culture', v)} />
                <TagGroup lang={lang} label="美学与艺术流派" selected={(config.selections['aesthetics_style'] as string[]) || []} options={AESTHETICS_STYLES} onChange={v => handleMulti('aesthetics_style', v)} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <SelectField lang={lang} label="群体情绪底色" value={(config.selections['mass_affect']?.[0] as string) || ''} options={MASS_AFFECT_MODE} onChange={v => handleSingle('mass_affect', v)} />
                  <SelectField lang={lang} label="情绪传染强度" value={(config.selections['contagion_strength']?.[0] as string) || ''} options={CONTAGION_STRENGTH} onChange={v => handleSingle('contagion_strength', v)} />
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>💥 宏观事件与危机</h4>
                <TagGroup lang={lang} label="宏观事件类型" selected={(config.selections['crisis'] as string[]) || []} options={MACRO_CRISES} onChange={v => handleMulti('crisis', v)} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <SelectField lang={lang} label="危机烈度" value={(config.selections['crisis_intensity']?.[0] as string) || ''} options={CRISIS_INTENSITY} onChange={v => handleSingle('crisis_intensity', v)} />
                  <SelectField lang={lang} label="规则翻转率" value={(config.selections['norm_flip_rate']?.[0] as string) || ''} options={NORM_FLIP_RATE} onChange={v => handleSingle('norm_flip_rate', v)} />
                  <SelectField lang={lang} label="资源征用风险" value={(config.selections['requisition_risk']?.[0] as string) || ''} options={REQUISITION_RISK} onChange={v => handleSingle('requisition_risk', v)} />
                </div>
              </div>
            </div>
          )}

          {activeLevel === 'macro' && activeSubTab === 'nature' && (
             <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
               <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>🗺️ 地形与气候</h4>
                  <TagGroup lang={lang} label="地形与地貌 (多选)" selected={(config.selections['terrain'] as string[]) || []} options={TERRAIN_TYPES} onChange={v => handleMulti('terrain', v)} />
                  <TagGroup lang={lang} label="常规与极端气候 (多选)" selected={(config.selections['climate'] as string[]) || []} options={CLIMATE_TYPES} onChange={v => handleMulti('climate', v)} />
                  <TagGroup lang={lang} label="异常气候 (科幻/奇幻)" selected={(config.selections['anomaly_climate'] as string[]) || []} options={ANOMALY_CLIMATE} onChange={v => handleMulti('anomaly_climate', v)} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <SelectField lang={lang} label="昼夜循环" value={(config.selections['time_cycle']?.[0] as string) || ''} options={TIME_CYCLES} onChange={v => handleSingle('time_cycle', v)} />
                    <SelectField lang={lang} label="季节划分" value={(config.selections['seasons']?.[0] as string) || ''} options={SEASONS} onChange={v => handleSingle('seasons', v)} />
                    <SelectField lang={lang} label="夜间限制" value={(config.selections['night_rules']?.[0] as string) || ''} options={NIGHT_RULES} onChange={v => handleSingle('night_rules', v)} />
                  </div>
               </div>
               <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>🌿 生态、资源与灾害</h4>
                  <TagGroup lang={lang} label="植物生态 (多选)" selected={(config.selections['flora'] as string[]) || []} options={FLORA_TYPES} onChange={v => handleMulti('flora', v)} />
                  <TagGroup lang={lang} label="动物生态 (多选)" selected={(config.selections['fauna'] as string[]) || []} options={FAUNA_TYPES} onChange={v => handleMulti('fauna', v)} />
                  <TagGroup lang={lang} label="核心自然资源 (多选)" selected={(config.selections['resources'] as string[]) || []} options={RESOURCE_TYPES} onChange={v => handleMulti('resources', v)} />
                  <TagGroup lang={lang} label="常见自然灾害 (多选)" selected={(config.selections['disasters'] as string[]) || []} options={DISASTER_TYPES} onChange={v => handleMulti('disasters', v)} />
               </div>
             </div>
          )}

          {activeLevel === 'macro' && activeSubTab === 'supernatural' && (
            <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>✨ 超凡法则与核心资源</h4>
                <SelectField lang={lang} label="魔法/超凡力量的运行规则" value={(config.selections['supernatural_rules']?.[0] as string) || ''} options={SUPERNATURAL_RULES} onChange={v => handleSingle('supernatural_rules', v)} />
                <TagGroup lang={lang} label="引发战争与冲突的战略资源" selected={(config.selections['strategic_resources'] as string[]) || []} options={STRATEGIC_RESOURCES} onChange={v => handleMulti('strategic_resources', v)} />
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>📜 历史创伤与未解之谜</h4>
                <TagGroup lang={lang} label="影响至今的历史大事件 (多选)" selected={(config.selections['historical_events'] as string[]) || []} options={HISTORICAL_EVENTS} onChange={v => handleMulti('historical_events', v)} />
              </div>
            </div>
          )}

          {/* ================= 中观层级 ================= */}
          {activeLevel === 'meso' && activeSubTab === 'regime' && (
            <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              <div>
                 <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>政体与权力参数</h4>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                   <SelectField lang={lang} label="政体形式 (单选)" value={(config.selections['regime']?.[0] as string) || ''} options={REGIME_TYPES} onChange={v => handleSingle('regime', v)} />
                   <SelectField lang={lang} label="权力集中度" value={(config.selections['power_concentration']?.[0] as string) || ''} options={POWER_CONCENTRATION} onChange={v => handleSingle('power_concentration', v)} />
                   <SelectField lang={lang} label="阶级固化度" value={(config.selections['class_rigidity']?.[0] as string) || ''} options={CLASS_RIGIDITY} onChange={v => handleSingle('class_rigidity', v)} />
                   <SelectField lang={lang} label="特权免罚差" value={(config.selections['impunity_gap']?.[0] as string) || ''} options={IMPUNITY_GAP} onChange={v => handleSingle('impunity_gap', v)} />
                   <SelectField lang={lang} label="清算风险" value={(config.selections['purge_risk']?.[0] as string) || ''} options={PURGE_RISK} onChange={v => handleSingle('purge_risk', v)} />
                 </div>
              </div>
              <div>
                 <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>阶级结构 (可多选共存)</h4>
                 <TagGroup lang={lang} label="阶级结构" selected={(config.selections['classes'] as string[]) || []} options={CLASS_STRUCTURES} onChange={v => handleMulti('classes', v)} />
              </div>
            </div>
          )}

          {activeLevel === 'meso' && activeSubTab === 'law' && (
            <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
               <div>
                 <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>地缘政治与权力游戏</h4>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                   <SelectField lang={lang} label="国际阵营格局" value={(config.selections['global_politics']?.[0] as string) || ''} options={GLOBAL_POLITICS} onChange={v => handleSingle('global_politics', v)} />
                   <SelectField lang={lang} label="权力继承与交接法则" value={(config.selections['succession_law']?.[0] as string) || ''} options={SUCCESSION_LAWS} onChange={v => handleSingle('succession_law', v)} />
                 </div>
                 <TagGroup lang={lang} label="阶层跨越通道 (多选)" selected={(config.selections['class_mobility'] as string[]) || []} options={CLASS_MOBILITY} onChange={v => handleMulti('class_mobility', v)} />
               </div>
               <div>
                 <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>法律与执法</h4>
                 <TagGroup lang={lang} label="法律体系类型 (允许混合共存)" selected={(config.selections['legal_systems'] as string[]) || []} options={LEGAL_SYSTEMS} onChange={v => handleMulti('legal_systems', v)} />
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                   <SelectField lang={lang} label="选择性执法" value={(config.selections['selective_enforcement']?.[0] as string) || ''} options={SELECTIVE_ENFORCEMENT} onChange={v => handleSingle('selective_enforcement', v)} />
                   <SelectField lang={lang} label="规则稳定度" value={(config.selections['rule_stability']?.[0] as string) || ''} options={RULE_STABILITY} onChange={v => handleSingle('rule_stability', v)} />
                   <SelectField lang={lang} label="程序正义" value={(config.selections['due_process']?.[0] as string) || ''} options={DUE_PROCESS} onChange={v => handleSingle('due_process', v)} />
                 </div>
               </div>
            </div>
          )}

          {activeLevel === 'meso' && activeSubTab === 'economy' && (
             <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
               <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>经济与金融网络</h4>
                  <TagGroup lang={lang} label="经济运行方式 (多选)" selected={(config.selections['economy'] as string[]) || []} options={ECONOMY_TYPES} onChange={v => handleMulti('economy', v)} />
                  <TagGroup lang={lang} label="货币与交易体系 (多选)" selected={(config.selections['currency'] as string[]) || []} options={CURRENCY_TYPES} onChange={v => handleMulti('currency', v)} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <SelectField lang={lang} label="经济环境" value={(config.selections['economy_env']?.[0] as string) || ''} options={ECONOMY_ENV} onChange={v => handleSingle('economy_env', v)} />
                    <SelectField lang={lang} label="物价波动" value={(config.selections['inflation_risk']?.[0] as string) || ''} options={INFLATION_RISK} onChange={v => handleSingle('inflation_risk', v)} />
                    <SelectField lang={lang} label="贫富差距" value={(config.selections['inequality']?.[0] as string) || ''} options={INEQUALITY} onChange={v => handleSingle('inequality', v)} />
                    <SelectField lang={lang} label="信用稳定" value={(config.selections['credit_stability']?.[0] as string) || ''} options={CREDIT_STABILITY} onChange={v => handleSingle('credit_stability', v)} />
                  </div>
               </div>
               <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>信息网络与传播</h4>
                  <TagGroup lang={lang} label="信息传播技术 (多选)" selected={(config.selections['info_tech'] as string[]) || []} options={INFO_TECHS} onChange={v => handleMulti('info_tech', v)} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <SelectField lang={lang} label="信息环境" value={(config.selections['info_env']?.[0] as string) || ''} options={INFO_ENV} onChange={v => handleSingle('info_env', v)} />
                    <SelectField lang={lang} label="信息真实性" value={(config.selections['info_truth']?.[0] as string) || ''} options={INFO_TRUTH} onChange={v => handleSingle('info_truth', v)} />
                    <SelectField lang={lang} label="真实信息可见度" value={(config.selections['transparency']?.[0] as string) || ''} options={TRANSPARENCY} onChange={v => handleSingle('transparency', v)} />
                    <SelectField lang={lang} label="谣言强度" value={(config.selections['rumor']?.[0] as string) || ''} options={RUMOR_INTENSITY} onChange={v => handleSingle('rumor', v)} />
                    <SelectField lang={lang} label="阶级信息差" value={(config.selections['insider_gap']?.[0] as string) || ''} options={INSIDER_GAP} onChange={v => handleSingle('insider_gap', v)} />
                    <SelectField lang={lang} label="审查封锁" value={(config.selections['censorship']?.[0] as string) || ''} options={CENSORSHIP_LEVEL} onChange={v => handleSingle('censorship', v)} />
                  </div>
               </div>
             </div>
          )}

          {activeLevel === 'meso' && activeSubTab === 'education' && (
             <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
               <div>
                 <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>教育与阶层流动</h4>
                 <TagGroup lang={lang} label="教育体系 (多选)" selected={(config.selections['education'] as string[]) || []} options={EDU_SYSTEMS} onChange={v => handleMulti('education', v)} />
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <SelectField lang={lang} label="教育普及程度" value={(config.selections['edu_popularity']?.[0] as string) || ''} options={EDU_POPULARITY} onChange={v => handleSingle('edu_popularity', v)} />
                    <SelectField lang={lang} label="阶层流动环境" value={(config.selections['mobility_env']?.[0] as string) || ''} options={MOBILITY_ENV} onChange={v => handleSingle('mobility_env', v)} />
                    <SelectField lang={lang} label="教育可达" value={(config.selections['edu_access']?.[0] as string) || ''} options={EDU_ACCESS} onChange={v => handleSingle('edu_access', v)} />
                    <SelectField lang={lang} label="学习成本" value={(config.selections['training_cost']?.[0] as string) || ''} options={TRAINING_COST} onChange={v => handleSingle('training_cost', v)} />
                    <SelectField lang={lang} label="证书门槛" value={(config.selections['credential_barrier']?.[0] as string) || ''} options={CREDENTIAL_BARRIER} onChange={v => handleSingle('credential_barrier', v)} />
                    <SelectField lang={lang} label="上升通道宽度" value={(config.selections['upward_path']?.[0] as string) || ''} options={UPWARD_PATH} onChange={v => handleSingle('upward_path', v)} />
                 </div>
               </div>
             </div>
          )}

          {activeLevel === 'meso' && activeSubTab === 'tech' && (
             <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
               <div>
                 <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>技术与工业体系</h4>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <SelectField lang={lang} label="技术高度" value={(config.selections['tech']?.[0] as string) || ''} options={TECH_STAGES} onChange={v => handleSingle('tech', v)} />
                    <SelectField lang={lang} label="技术普及度" value={(config.selections['tech_diffusion']?.[0] as string) || ''} options={TECH_DIFFUSION} onChange={v => handleSingle('tech_diffusion', v)} />
                    <SelectField lang={lang} label="工业宏观状态" value={(config.selections['industry']?.[0] as string) || ''} options={INDUSTRY_STATUS} onChange={v => handleSingle('industry', v)} />
                    <SelectField lang={lang} label="基建稳定度" value={(config.selections['infrastructure']?.[0] as string) || ''} options={INFRASTRUCTURE_STABILITY} onChange={v => handleSingle('infrastructure', v)} />
                 </div>
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {INDUSTRY_GROUPS.map(group => (
                      <div key={group.id}>
                        <TagGroup lang={lang} label={group.title_zh} selected={(config.selections[group.id] as string[]) || []} options={group.options} onChange={v => handleMulti(group.id, v)} />
                      </div>
                    ))}
                  </div>
               </div>
             </div>
          )}

          {activeLevel === 'meso' && activeSubTab === 'medical' && (
             <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
               <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>医疗体系</h4>
                  <TagGroup lang={lang} label="医疗体系 (多选共存)" selected={(config.selections['medical'] as string[]) || []} options={MEDICAL_SYSTEMS} onChange={v => handleMulti('medical', v)} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <SelectField lang={lang} label="医疗资源状态" value={(config.selections['medical_resources']?.[0] as string) || ''} options={MEDICAL_RESOURCES} onChange={v => handleSingle('medical_resources', v)} />
                    <SelectField lang={lang} label="医疗可达性" value={(config.selections['medical_access']?.[0] as string) || ''} options={MEDICAL_ACCESS} onChange={v => handleSingle('medical_access', v)} />
                    <SelectField lang={lang} label="康复速度" value={(config.selections['recovery_speed']?.[0] as string) || ''} options={RECOVERY_SPEED} onChange={v => handleSingle('recovery_speed', v)} />
                    <SelectField lang={lang} label="心理康复" value={(config.selections['rehab']?.[0] as string) || ''} options={REHAB} onChange={v => handleSingle('rehab', v)} />
                  </div>
               </div>
               <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>武力与治安</h4>
                  <TagGroup lang={lang} label="武力组织形式 (多选)" selected={(config.selections['force_orgs'] as string[]) || []} options={FORCE_ORGS} onChange={v => handleMulti('force_orgs', v)} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <SelectField lang={lang} label="社会暴力环境" value={(config.selections['violence']?.[0] as string) || ''} options={VIOLENCE_ENV} onChange={v => handleSingle('violence', v)} />
                    <SelectField lang={lang} label="武器普及度" value={(config.selections['weapon_availability']?.[0] as string) || ''} options={WEAPON_AVAILABILITY} onChange={v => handleSingle('weapon_availability', v)} />
                    <SelectField lang={lang} label="治安能力" value={(config.selections['policing_capacity']?.[0] as string) || ''} options={POLICING_CAPACITY} onChange={v => handleSingle('policing_capacity', v)} />
                    <SelectField lang={lang} label="战争烈度" value={(config.selections['war_intensity']?.[0] as string) || ''} options={WAR_INTENSITY} onChange={v => handleSingle('war_intensity', v)} />
                    <SelectField lang={lang} label="暴力常态化" value={(config.selections['violent_norms']?.[0] as string) || ''} options={VIOLENT_NORMS} onChange={v => handleSingle('violent_norms', v)} />
                  </div>
               </div>
             </div>
          )}

          {/* ================= 微观层级 ================= */}
          {activeLevel === 'micro' && activeSubTab === 'governance' && (
             <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
               <div>
                 <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>地区治理与聚落</h4>
                 <TagGroup lang={lang} label="地区治法 / 地方行政制度 (多选)" selected={(config.selections['governance_types'] as string[]) || []} options={GOVERNANCE_TYPES} onChange={v => handleMulti('governance_types', v)} />
                 <TagGroup lang={lang} label="聚落层级与治法 (多选)" selected={(config.selections['settlement_governance'] as string[]) || []} options={SETTLEMENT_GOVERNANCE} onChange={v => handleMulti('settlement_governance', v)} />
                 <TagGroup lang={lang} label="城乡互动关系 (多选)" selected={(config.selections['urban_rural_relations'] as string[]) || []} options={URBAN_RURAL_RELATIONS} onChange={v => handleMulti('urban_rural_relations', v)} />
               </div>
             </div>
          )}

          {activeLevel === 'micro' && activeSubTab === 'org' && (
             <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
               <div>
                 <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>组织与劳动</h4>
                 <TagGroup lang={lang} label="组织运行形式 (多选共存)" selected={(config.selections['orgs'] as string[]) || []} options={ORG_TYPES} onChange={v => handleMulti('orgs', v)} />
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                   <SelectField lang={lang} label="潜规则强度" value={(config.selections['informal_rules']?.[0] as string) || ''} options={INFORMAL_RULES} onChange={v => handleSingle('informal_rules', v)} />
                   <SelectField lang={lang} label="档案绑定程度" value={(config.selections['record_binding']?.[0] as string) || ''} options={RECORD_BINDING} onChange={v => handleSingle('record_binding', v)} />
                   <SelectField lang={lang} label="替罪羊频率" value={(config.selections['scapegoat_frequency']?.[0] as string) || ''} options={SCAPEGOAT_FREQUENCY} onChange={v => handleSingle('scapegoat_frequency', v)} />
                 </div>
                 <TagGroup lang={lang} label="劳动制度 (多选共存)" selected={(config.selections['labor'] as string[]) || []} options={LABOR_TYPES} onChange={v => handleMulti('labor', v)} />
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                   <SelectField lang={lang} label="剥削强度" value={(config.selections['exploitation_level']?.[0] as string) || ''} options={EXPLOITATION_LEVEL} onChange={v => handleSingle('exploitation_level', v)} />
                   <SelectField lang={lang} label="上升承诺差距" value={(config.selections['mobility_promise_gap']?.[0] as string) || ''} options={MOBILITY_PROMISE_GAP} onChange={v => handleSingle('mobility_promise_gap', v)} />
                   <SelectField lang={lang} label="生计剥夺风险" value={(config.selections['deplatform_risk']?.[0] as string) || ''} options={DEPLATFORM_RISK} onChange={v => handleSingle('deplatform_risk', v)} />
                 </div>
               </div>
             </div>
          )}

          {activeLevel === 'micro' && activeSubTab === 'family' && (
             <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
               <div>
                 <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>修复与家庭</h4>
                 <TagGroup lang={lang} label="社会修复机制 (可多选共存)" selected={(config.selections['repair_mechanisms'] as string[]) || []} options={REPAIR_MECHANISMS} onChange={v => handleMulti('repair_mechanisms', v)} />
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <SelectField lang={lang} label="第二次机会" value={(config.selections['second_chance']?.[0] as string) || ''} options={SECOND_CHANCE} onChange={v => handleSingle('second_chance', v)} />
                    <SelectField lang={lang} label="档案过期机制" value={(config.selections['record_expiry']?.[0] as string) || ''} options={RECORD_EXPIRY} onChange={v => handleSingle('record_expiry', v)} />
                    <SelectField lang={lang} label="污名残留" value={(config.selections['stigma_residue']?.[0] as string) || ''} options={STIGMA_RESIDUE} onChange={v => handleSingle('stigma_residue', v)} />
                 </div>
                 <TagGroup lang={lang} label="家庭与权力结构 (多选)" selected={(config.selections['family'] as string[]) || []} options={FAMILY_STRUCTURES} onChange={v => handleMulti('family', v)} />
                 <TagGroup lang={lang} label="婚姻制度 (多选)" selected={(config.selections['marriage'] as string[]) || []} options={MARRIAGE_TYPES} onChange={v => handleMulti('marriage', v)} />
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <SelectField lang={lang} label="宗族控制" value={(config.selections['kinship_control']?.[0] as string) || ''} options={KINSHIP_CONTROL} onChange={v => handleSingle('kinship_control', v)} />
                    <SelectField lang={lang} label="婚姻成本" value={(config.selections['marriage_cost']?.[0] as string) || ''} options={MARRIAGE_COST} onChange={v => handleSingle('marriage_cost', v)} />
                    <SelectField lang={lang} label="退出代价" value={(config.selections['divorce_penalty']?.[0] as string) || ''} options={DIVORCE_PENALTY} onChange={v => handleSingle('divorce_penalty', v)} />
                 </div>
               </div>
             </div>
          )}

          {activeLevel === 'micro' && activeSubTab === 'culture' && (
             <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
               <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>习俗与审美</h4>
                  <TagGroup lang={lang} label="节假日体系 (多选)" selected={(config.selections['festivals'] as string[]) || []} options={FESTIVALS} onChange={v => handleMulti('festivals', v)} />
                  <TagGroup lang={lang} label="人生礼仪与生命周期" selected={(config.selections['life_rituals'] as string[]) || []} options={LIFE_RITUALS} onChange={v => handleMulti('life_rituals', v)} />
                  <TagGroup lang={lang} label="日常民俗与禁忌 (多选)" selected={(config.selections['folk_customs'] as string[]) || []} options={FOLK_CUSTOMS} onChange={v => handleMulti('folk_customs', v)} />
                  <TagGroup lang={lang} label="主流审美观" selected={(config.selections['aesthetics'] as string[]) || []} options={AESTHETICS} onChange={v => handleMulti('aesthetics', v)} />
                  <TagGroup lang={lang} label="艺术与娱乐供给 (多选)" selected={(config.selections['art_supply'] as string[]) || []} options={ART_SUPPLY} onChange={v => handleMulti('art_supply', v)} />
                  <TagGroup lang={lang} label="社会人际关系风格 (多选)" selected={(config.selections['social_styles'] as string[]) || []} options={SOCIAL_STYLES} onChange={v => handleMulti('social_styles', v)} />
                  <TagGroup lang={lang} label="流行成瘾物与地下娱乐 (多选)" selected={(config.selections['addictions'] as string[]) || []} options={ADDICTION_TYPES} onChange={v => handleMulti('addictions', v)} />
               </div>
               <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>创新与生活</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <SelectField lang={lang} label="文化与创新环境" value={(config.selections['culture_env']?.[0] as string) || ''} options={CULTURE_ENV} onChange={v => handleSingle('culture_env', v)} />
                    <SelectField lang={lang} label="创新资源状态" value={(config.selections['innovation_state']?.[0] as string) || ''} options={INNOVATION_STATE} onChange={v => handleSingle('innovation_state', v)} />
                    <SelectField lang={lang} label="创新速度" value={(config.selections['innovation_rate']?.[0] as string) || ''} options={INNOVATION_RATE} onChange={v => handleSingle('innovation_rate', v)} />
                    <SelectField lang={lang} label="思想自由度" value={(config.selections['idea_freedom']?.[0] as string) || ''} options={IDEA_FREEDOM} onChange={v => handleSingle('idea_freedom', v)} />
                    <SelectField lang={lang} label="新奇供给度" value={(config.selections['novelty_supply']?.[0] as string) || ''} options={NOVELTY_SUPPLY} onChange={v => handleSingle('novelty_supply', v)} />
                  </div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>职业、健康与衣食住行</h4>
                  <TagGroup lang={lang} label="职业岗位与行业" selected={(config.selections['job_types'] as string[]) || []} options={JOB_TYPES} onChange={v => handleMulti('job_types', v)} />
                  <TagGroup lang={lang} label="主要疾病类型" selected={(config.selections['disease_types'] as string[]) || []} options={DISEASE_TYPES} onChange={v => handleMulti('disease_types', v)} />
                  <TagGroup lang={lang} label="饮食习惯" selected={(config.selections['dietary_habits'] as string[]) || []} options={DIETARY_HABITS} onChange={v => handleMulti('dietary_habits', v)} />
                  <TagGroup lang={lang} label="生活习惯与作息" selected={(config.selections['lifestyle_habits'] as string[]) || []} options={LIFESTYLE_HABITS} onChange={v => handleMulti('lifestyle_habits', v)} />
                  <TagGroup lang={lang} label="居住与家具" selected={(config.selections['housing_styles'] as string[]) || []} options={HOUSING_STYLES} onChange={v => handleMulti('housing_styles', v)} />
                  <TagGroup lang={lang} label="服装风格" selected={(config.selections['clothing_styles'] as string[]) || []} options={CLOTHING_STYLES} onChange={v => handleMulti('clothing_styles', v)} />
                  <TagGroup lang={lang} label="出行习惯" selected={(config.selections['transport_types'] as string[]) || []} options={TRANSPORT_TYPES} onChange={v => handleMulti('transport_types', v)} />
                  <TagGroup lang={lang} label="娱乐与运动" selected={(config.selections['entertainment_types'] as string[]) || []} options={ENTERTAINMENT_TYPES} onChange={v => handleMulti('entertainment_types', v)} />
                  <TagGroup lang={lang} label="消费习惯" selected={(config.selections['consumption_habits'] as string[]) || []} options={CONSUMPTION_HABITS} onChange={v => handleMulti('consumption_habits', v)} />
               </div>
             </div>
          )}

        </div>
      </div>
    </div>
  )
}