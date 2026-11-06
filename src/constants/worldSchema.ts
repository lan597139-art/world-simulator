export interface OptionItem {
  id: string;
  name_zh: string;
  name_en: string;
}

// ============ 1. 技术与工业 ============
export const TECH_STAGES: OptionItem[] = [
  { id: 'primitive', name_zh: '原始社会', name_en: 'Primitive' }, { id: 'agri', name_zh: '农业社会', name_en: 'Agrarian' },
  { id: 'classic', name_zh: '古典文明', name_en: 'Classical' }, { id: 'steam', name_zh: '蒸汽工业', name_en: 'Steam' },
  { id: 'electric', name_zh: '电气工业', name_en: 'Electric' }, { id: 'info', name_zh: '信息社会', name_en: 'Info' },
  { id: 'smart', name_zh: '智能社会', name_en: 'Smart' }, { id: 'future', name_zh: '未来科技', name_en: 'Future' },
  { id: 'magic', name_zh: '魔法文明', name_en: 'Magic' }, { id: 'hybrid', name_zh: '混合文明', name_en: 'Hybrid' },
];

export const INDUSTRY_STATUS: OptionItem[] = [
  { id: 'none', name_zh: '几乎无工业', name_en: 'None' }, { id: 'handicraft', name_zh: '手工业为主', name_en: 'Handicraft' },
  { id: 'initial', name_zh: '初步工业化', name_en: 'Initial' }, { id: 'mature', name_zh: '工业成熟', name_en: 'Mature' },
  { id: 'auto', name_zh: '高度自动化', name_en: 'Auto' }, { id: 'extreme', name_zh: '极端先进', name_en: 'Extreme' },
  { id: 'collapse', name_zh: '工业衰退', name_en: 'Collapse' },
];

// ============ 2. 医疗与武力 ============
export const MEDICAL_SYSTEMS: OptionItem[] = [
  { id: 'western', name_zh: '现代西医', name_en: 'Western' }, { id: 'tcm', name_zh: '中医', name_en: 'TCM' },
  { id: 'folk', name_zh: '民间草药', name_en: 'Folk' }, { id: 'magic_heal', name_zh: '魔法治疗', name_en: 'Magic Heal' },
  { id: 'nano', name_zh: '纳米医疗', name_en: 'Nano' }, { id: 'cyber', name_zh: '机械义体', name_en: 'Cyberware' },
];

export const MEDICAL_ACCESS: OptionItem[] = [
  { id: 'elite_only', name_zh: '仅统治阶层', name_en: 'Elite Only' }, { id: 'urban_only', name_zh: '仅城市居民', name_en: 'Urban Only' },
  { id: 'by_wealth', name_zh: '按财富获得', name_en: 'By Wealth' }, { id: 'universal', name_zh: '所有人平等', name_en: 'Universal' },
];

export const VIOLENCE_ENV: OptionItem[] = [
  { id: 'peace', name_zh: '极度和平', name_en: 'Peaceful' }, { id: 'low', name_zh: '低暴力社会', name_en: 'Low Violence' },
  { id: 'normal', name_zh: '普通治安', name_en: 'Normal' }, { id: 'war', name_zh: '战争社会', name_en: 'War' },
  { id: 'anarchy', name_zh: '无政府崩溃', name_en: 'Anarchy' },
];

export const FORCE_ORGS: OptionItem[] = [
  { id: 'military', name_zh: '正规军队', name_en: 'Military' }, { id: 'private', name_zh: '私人武装', name_en: 'Private' },
  { id: 'gang', name_zh: '黑帮组织', name_en: 'Gang' }, { id: 'religious', name_zh: '宗教武装', name_en: 'Religious' },
  { id: 'mercenary', name_zh: '雇佣兵', name_en: 'Mercenary' }, { id: 'auto', name_zh: '自动化军事', name_en: 'Auto Military' },
];

// ============ 3. 经济与金融 ============
export const ECONOMY_TYPES: OptionItem[] = [
  { id: 'barter', name_zh: '物物交换', name_en: 'Barter' }, { id: 'market', name_zh: '传统市场', name_en: 'Market' },
  { id: 'capitalism', name_zh: '资本主义', name_en: 'Capitalism' }, { id: 'planned', name_zh: '计划经济', name_en: 'Planned' },
  { id: 'feudal', name_zh: '封建领主经济', name_en: 'Feudal' }, { id: 'mixed', name_zh: '混合经济', name_en: 'Mixed' },
];

export const CURRENCY_TYPES: OptionItem[] = [
  { id: 'none', name_zh: '无统一货币', name_en: 'None' }, { id: 'metal', name_zh: '贵金属', name_en: 'Metal' },
  { id: 'paper', name_zh: '纸币', name_en: 'Paper' }, { id: 'crypto', name_zh: '数字货币', name_en: 'Crypto' },
  { id: 'credit', name_zh: '信用点/积分', name_en: 'Credit' },
];

// ============ 4. 信息与教育 ============
export const INFO_TECHS: OptionItem[] = [
  { id: 'oral', name_zh: '口耳相传', name_en: 'Oral' }, { id: 'print', name_zh: '印刷出版', name_en: 'Print' },
  { id: 'radio', name_zh: '报纸与广播', name_en: 'Radio' }, { id: 'internet', name_zh: '互联网', name_en: 'Internet' },
  { id: 'quantum', name_zh: '量子/星际通信', name_en: 'Quantum' }, { id: 'magic_msg', name_zh: '魔法传讯', name_en: 'Magic Msg' },
];

export const INFO_ENV: OptionItem[] = [
  { id: 'open', name_zh: '高度开放', name_en: 'Open' }, { id: 'censored', name_zh: '严格审查', name_en: 'Censored' },
  { id: 'rumor', name_zh: '谣言主导', name_en: 'Rumor' }, { id: 'blackout', name_zh: '全面封锁', name_en: 'Blackout' },
];

export const EDU_SYSTEMS: OptionItem[] = [
  { id: 'family', name_zh: '家庭教育', name_en: 'Family' }, { id: 'public', name_zh: '公立教育', name_en: 'Public' },
  { id: 'private', name_zh: '私立/精英教育', name_en: 'Private' }, { id: 'magic_school', name_zh: '魔法学院', name_en: 'Magic School' },
  { id: 'ai_edu', name_zh: 'AI 教育', name_en: 'AI Education' },
];

export const MOBILITY_ENV: OptionItem[] = [
  { id: 'rigid', name_zh: '阶层完全固化', name_en: 'Rigid' }, { id: 'limited', name_zh: '存在有限上升通道', name_en: 'Limited' },
  { id: 'free', name_zh: '阶层流动自由', name_en: 'Free' }, { id: 'hyper', name_zh: '社会高度流动', name_en: 'Hyper' },
];

// ============ 5. 政体与法律 ============
export const REGIME_TYPES: OptionItem[] = [
  { id: 'monarchy', name_zh: '君主专制', name_en: 'Monarchy' }, { id: 'constitutional', name_zh: '君主立宪', name_en: 'Constitutional Monarchy' },
  { id: 'republic', name_zh: '共和制', name_en: 'Republic' }, { id: 'theocracy', name_zh: '神权政体', name_en: 'Theocracy' },
  { id: 'corporate', name_zh: '企业统治', name_en: 'Corporate' }, { id: 'ai_rule', name_zh: 'AI 托管制', name_en: 'AI Rule' },
  { id: 'anarchy', name_zh: '无政府状态', name_en: 'Anarchy' },
];

export const CLASS_STRUCTURES: OptionItem[] = [
  { id: 'noble', name_zh: '贵族阶层', name_en: 'Noble' }, { id: 'bureaucrat', name_zh: '官僚阶层', name_en: 'Bureaucrat' },
  { id: 'military', name_zh: '军事阶层', name_en: 'Military' }, { id: 'religious', name_zh: '宗教阶层', name_en: 'Religious' },
  { id: 'capitalist', name_zh: '资本家阶层', name_en: 'Capitalist' }, { id: 'worker', name_zh: '工人阶层', name_en: 'Worker' },
  { id: 'farmer', name_zh: '农民阶层', name_en: 'Farmer' }, { id: 'tech_elite', name_zh: '技术精英', name_en: 'Tech Elite' },
  { id: 'cyborg', name_zh: '义体人阶层', name_en: 'Cyborg' }, { id: 'mage', name_zh: '施法者/法师', name_en: 'Mage' },
];

export const LEGAL_SYSTEMS: OptionItem[] = [
  { id: 'civil_law', name_zh: '成文法体系', name_en: 'Civil Law' }, { id: 'common_law', name_zh: '判例法体系', name_en: 'Common Law' },
  { id: 'religious_law', name_zh: '宗教法体系', name_en: 'Religious Law' }, { id: 'ai_law', name_zh: 'AI 裁决体系', name_en: 'AI Law' },
  { id: 'jungle_law', name_zh: '丛林法则', name_en: 'Jungle Law' },
];

// ============ 6. 组织与劳动 ============
export const ORG_TYPES: OptionItem[] = [
  { id: 'bureaucracy', name_zh: '官僚行政组织', name_en: 'Bureaucracy' }, { id: 'corporate_org', name_zh: '企业组织', name_en: 'Corporate Org' },
  { id: 'military_org', name_zh: '军事组织', name_en: 'Military Org' }, { id: 'religious_org', name_zh: '宗教组织', name_en: 'Religious Org' },
  { id: 'ngo', name_zh: '非政府组织 (NGO)', name_en: 'NGO' }, { id: 'intelligence', name_zh: '情报/特务机构', name_en: 'Intelligence' },
  { id: 'underworld', name_zh: '地下组织', name_en: 'Underworld' },
];

export const LABOR_TYPES: OptionItem[] = [
  { id: 'slavery', name_zh: '奴隶劳动', name_en: 'Slavery' }, { id: 'serfdom', name_zh: '农奴劳动', name_en: 'Serfdom' },
  { id: 'employment', name_zh: '雇佣劳动', name_en: 'Employment' }, { id: 'gig', name_zh: '零工经济', name_en: 'Gig Economy' },
  { id: 'automation', name_zh: '自动化生产', name_en: 'Automation' }, { id: 'debt_bondage', name_zh: '债务奴役', name_en: 'Debt Bondage' },
];

// ============ 7. 修复与家庭 ============
export const REPAIR_MECHANISMS: OptionItem[] = [
  { id: 'legal_appeal', name_zh: '法律申诉', name_en: 'Legal Appeal' }, { id: 'revenge', name_zh: '血亲复仇', name_en: 'Revenge' },
  { id: 'compensation', name_zh: '经济赔偿', name_en: 'Compensation' }, { id: 'exile', name_zh: '流放/驱逐', name_en: 'Exile' },
  { id: 'none', name_zh: '无有效修复通道', name_en: 'None' },
];

export const FAMILY_STRUCTURES: OptionItem[] = [
  { id: 'patriarchy', name_zh: '父权制', name_en: 'Patriarchy' }, { id: 'matriarchy', name_zh: '母权制', name_en: 'Matriarchy' },
  { id: 'nuclear', name_zh: '核心家庭', name_en: 'Nuclear' }, { id: 'extended', name_zh: '扩展家庭', name_en: 'Extended' },
  { id: 'clan', name_zh: '宗族制', name_en: 'Clan' }, { id: 'commune', name_zh: '集体家庭', name_en: 'Commune' },
];

export const MARRIAGE_TYPES: OptionItem[] = [
  { id: 'monogamy', name_zh: '一夫一妻制', name_en: 'Monogamy' }, { id: 'polygyny', name_zh: '一夫多妻制', name_en: 'Polygyny' },
  { id: 'polyandry', name_zh: '一妻多夫制', name_en: 'Polyandry' }, { id: 'arranged', name_zh: '包办婚姻', name_en: 'Arranged' },
  { id: 'free_love', name_zh: '自由婚姻', name_en: 'Free Love' }, { id: 'political', name_zh: '政治婚姻', name_en: 'Political' },
];

// ============ 8. 地区与聚落 ============
export const GOVERNANCE_TYPES: OptionItem[] = [
  { id: 'province', name_zh: '行省/郡县制', name_en: 'Province' }, { id: 'feudal', name_zh: '分封/领主制', name_en: 'Feudal' },
  { id: 'federal_state', name_zh: '联邦制州权', name_en: 'Federal State' }, { id: 'city_state', name_zh: '城邦自治', name_en: 'City State' },
  { id: 'military_rule', name_zh: '军管区', name_en: 'Military Rule' }, { id: 'corporate_zone', name_zh: '企业代管区', name_en: 'Corporate Zone' },
];

export const URBAN_RURAL_RELATIONS: OptionItem[] = [
  { id: 'siphon', name_zh: '剪刀差/虹吸效应', name_en: 'Siphon Effect' }, { id: 'subsidy', name_zh: '资源反哺', name_en: 'Subsidy' },
  { id: 'isolated', name_zh: '绝对割裂/物理隔离', name_en: 'Isolated' }, { id: 'symbiosis', name_zh: '互惠互利/贸易互补', name_en: 'Symbiosis' },
];

// ============ 9. 微观生活与文化（节选关键选项，避免过长） ============
export const TERRAIN_TYPES: OptionItem[] = [
  { id: 'mountain', name_zh: '崇山峻岭', name_en: 'Mountains' }, { id: 'plain', name_zh: '平原草原', name_en: 'Plains' },
  { id: 'desert', name_zh: '广袤沙漠', name_en: 'Desert' }, { id: 'forest', name_zh: '热带雨林/森林', name_en: 'Forest' },
  { id: 'ocean', name_zh: '群岛海洋', name_en: 'Ocean' }, { id: 'wasteland', name_zh: '辐射废土', name_en: 'Wasteland' },
  { id: 'space', name_zh: '太空/异星', name_en: 'Space' },
];

export const CLIMATE_TYPES: OptionItem[] = [
  { id: 'normal', name_zh: '温带四季分明', name_en: 'Normal' }, { id: 'extreme_cold', name_zh: '极地冰原', name_en: 'Extreme Cold' },
  { id: 'extreme_hot', name_zh: '热带酷暑', name_en: 'Extreme Hot' }, { id: 'toxic', name_zh: '酸雨/高辐射', name_en: 'Toxic' },
  { id: 'magic_chaos', name_zh: '魔法元素紊乱', name_en: 'Magic Chaos' },
];

export const SOCIAL_TABOOS: OptionItem[] = [
  { id: 'caste', name_zh: '种姓隔离', name_en: 'Caste System' }, { id: 'blasphemy', name_zh: '不可亵渎神明', name_en: 'Blasphemy' },
  { id: 'taboo_food', name_zh: '食物禁忌', name_en: 'Food Taboo' }, { id: 'strict_gender', name_zh: '严苛的性别隔离', name_en: 'Strict Gender' },
];

// ============ 10. 时代与危机 ============
export const ERA_STAGES: OptionItem[] = [
  { id: 'fast_growth', name_zh: '高速增长期', name_en: 'Fast Growth' }, { id: 'stable', name_zh: '稳定发展期', name_en: 'Stable' },
  { id: 'stagnation', name_zh: '经济停滞期', name_en: 'Stagnation' }, { id: 'decline', name_zh: '长期衰退期', name_en: 'Decline' },
  { id: 'post_war', name_zh: '战后重建期', name_en: 'Post War' }, { id: 'doomsday', name_zh: '末法/衰败期', name_en: 'Doomsday' },
];

export const MACRO_CRISES: OptionItem[] = [
  { id: 'revolution', name_zh: '革命', name_en: 'Revolution' }, { id: 'purge', name_zh: '政治清洗', name_en: 'Purge' },
  { id: 'plague', name_zh: '瘟疫', name_en: 'Plague' }, { id: 'war', name_zh: '战争', name_en: 'War' },
  { id: 'crash', name_zh: '经济崩盘', name_en: 'Economic Crash' },
];

export const IDEOLOGIES: OptionItem[] = [
  { id: 'liberalism', name_zh: '自由主义', name_en: 'Liberalism' }, { id: 'conservatism', name_zh: '保守主义', name_en: 'Conservatism' },
  { id: 'nationalism', name_zh: '民族主义', name_en: 'Nationalism' }, { id: 'socialism', name_zh: '社会主义', name_en: 'Socialism' },
  { id: 'imperialism', name_zh: '帝国主义', name_en: 'Imperialism' }, { id: 'scientism', name_zh: '科学主义', name_en: 'Scientism' },
];