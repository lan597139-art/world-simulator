import { useState, useEffect, useRef } from 'react'
import { getCharacterRuntime, updateCharacterRuntime, type CharacterLayer, type GrowthEntry } from '../api/characterRuntime'
// ================= 基础表单组件 =================
function TextField({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }} />
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string, rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', resize: 'vertical' }} />
    </div>
  )
}

function TagGroup({ label, options, selected, onChange }: { label: string, options: any[], selected?: string[], onChange: (v: string[]) => void }) {
  const safeSelected = Array.isArray(selected) ? selected : []; // ✅ 核心修复：如果是 undefined，自动变成空数组
  
  const toggle = (val: string) => {
    const arr = safeSelected.includes(val) ? safeSelected.filter(i => i !== val) : [...safeSelected, val]
    onChange(arr)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {options.map(opt => {
          const id = typeof opt === 'string' ? opt : opt.id
          const name = typeof opt === 'string' ? opt : opt.name
          const desc = typeof opt === 'string' ? '' : opt.desc
          
          const isActive = safeSelected.includes(id)
          return (
            <button 
              key={id} 
              type="button" 
              onClick={() => toggle(id)} 
              title={desc}
              style={{ 
                padding: '6px 14px', 
                borderRadius: '20px', 
                border: `1px solid ${isActive ? 'var(--primary-color)' : 'var(--card-border)'}`, 
                fontSize: '12px', 
                cursor: 'pointer', 
                transition: 'all 0.2s', 
                background: isActive ? 'rgba(128, 128, 128, 0.16)' : 'transparent', 
                color: isActive ? 'var(--primary-color)' : 'var(--text-muted)' 
              }}
            >
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RadioGroup({ label, options, value, onChange }: { label: string, options: string[], value: string, onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {options.map(opt => (
          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-main)' }}>
           <input type="radio" checked={(value || '') === opt} onChange={() => onChange(opt)} style={{ accentColor: 'var(--primary-color)' }} />
            {opt}
          </label>
        ))}
      </div>
    </div>
  )
}

// ================= 1. 模块与元数据定义 =================
const CHARACTER_MODULES = [
  { id: 'basic', number: '01', title: '基础档案', subtitle: 'Basic Profile', description: '人物身份、社会角色、基本背景与外在特征。' },
  { id: 'engines', number: '02', title: '人格动力结构', subtitle: 'Personality Dynamics', description: 'OVTDE 五大人格动力引擎及其主导关系。' },
  { id: 'mechanism', number: '03', title: '人格运行与防御机制', subtitle: 'Personality Mechanism', description: '人格运行结构、认知处理、防御机制与主权边界。' },
  { id: 'sandbox', number: '04', title: '现实承载条件', subtitle: 'Reality Foundation', description: '人物所处的现实环境、能力条件与资源基础。' },
  { id: 'individual', number: '05', title: '个体特征与思想钢印', subtitle: 'Individual Identity', description: '人物独特的生活方式、思想结构、审美与结果评价标准。' },
  { id: 'history', number: '06', title: '生命经历与历史沉积', subtitle: 'Life Experience', description: '成长经历、重要关系、历史事件与长期形成的经验脚本。' },
  { id: 'initial', number: '07', title: '人物初始状态', subtitle: 'Initial State', description: '人物进入世界模拟时的初始运行状态。' },
  { id: 'growth', number: '08', title: '运行态与成长', subtitle: 'Runtime & Growth', description: '种子保持底色，当前运行态随经历、认知与选择持续变化。' },
]

const cloneLayer = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

const ENGINE_LABELS: Record<string, string> = {
  V: '锚定 / 安全',
  O: '秩序 / 可控',
  D: '动能 / 突破',
  E: '扩张 / 资源',
  T: '超越 / 意义',
}

const OVTDE_META = {
  V: { label: '锚定 (Validation)', desc: '安全、归属、持续承载' },
  O: { label: '秩序 (Order)', desc: '可控、规则、闭环' },
  D: { label: '动能 (Dynamics)', desc: '突破、推进、跃迁' },
  E: { label: '扩张 (Expansion)', desc: '机会、资源、自由度' },
  T: { label: '超越 (Transcendence)', desc: '规律、真相、意义' }
}

const INITIAL_ENGINE_STATE = { val: 50, definition: '', desire: '', threat: '', resources: '', needs: '', impact: '', behavior: '', over: '', under: '', custom: '' }

const L_LAYERS_META = [
  { id: 'L0', name: '环境层', role: '外部规则、压强与阻力', duty: '提供压强、阻力和中断优先级。不是背景，是做功的边界。', rules: '物理极限、社会共识、法律、阶级惯性不可商量；逆着 L0 做功损耗剧增。', structures: '外部压强、不可改变的限制。', specificFields: [{ key: 'physEnv', label: '物理环境' }, { key: 'socialEnv', label: '社会环境' }, { key: 'legalConstraints', label: '法律与制度约束' }, { key: 'classLimits', label: '阶级与行业限制' }, { key: 'externalPressure', label: '外部压强' }, { key: 'mainResistance', label: '主要阻力' }, { key: 'conditions', label: '可借势、避让或换位的条件' }] },
  { id: 'L1', name: '势能层', role: '系统唯一的通用燃料池', duty: '提供生存与高级算力的能量，思考、忍痛、社交共用一个池子。', rules: '生存维护耗能多，高阶思维先停机。', structures: '浅层生理电量、深层核心势能。', specificFields: [{ key: 'shallowEnergy', label: '浅层生理电量' }, { key: 'deepEnergy', label: '深层核心势能' }, { key: 'autoPilot', label: '低能自动驾驶模式' }, { key: 'highEngagement', label: '高投入模式' }, { key: 'energyConsumption', label: '能量消耗表现' }, { key: 'energyRecovery', label: '能量恢复方式' }] },
  { id: 'L2', name: '硬件层', role: '身体与神经的承载极限', duty: '决定吞吐和精度。软件修不好过热的硬件。', rules: '睡眠是唯一的全面清理；情绪是硬件读数。', structures: '身体承载、神经承载、感官敏感。', specificFields: [{ key: 'bodyLoad', label: '身体承载能力' }, { key: 'neuroLoad', label: '神经承载能力' }, { key: 'sensorySensitivity', label: '感官敏感情况' }, { key: 'overload', label: '过载表现' }, { key: 'l2Crash', label: 'L2 先崩的表现' }, { key: 'l3Crash', label: 'L3 先崩的表现' }, { key: 'bodyRecovery', label: '身体恢复方式' }] },
  { id: 'L2.5', name: '防御层', role: '信号预渲染与防御反应', duty: '位于 L2 与 L3 之间，信号进入 L3 之前先做预渲染。', rules: '防御有预设方向（内/外归因），有代价。', structures: '内归因、外归因、防御机制类型。', specificFields: [{ key: 'internalAttribution', label: '内归因（自我审判）' }, { key: 'externalAttribution', label: '外归因（环境审判）' }, { key: 'defenseTypes', label: '防御机制类型' }, { key: 'triggerSignals', label: '防御触发信号' }, { key: 'misrendering', label: '信号误渲染表现' }, { key: 'defenseCost', label: '防御产生的代价' }, { key: 'releaseConditions', label: '防御解除条件' }] },
  { id: 'L3', name: '算力层', role: '审计、拆解、调度与路径选择', duty: '中央调度。把 L5 脚本转译成可执行动作。', rules: '快路径省电，慢路径耗能；受控悬置合法，空转是故障。', structures: '快慢路径、悬置、空转、内耗。', specificFields: [{ key: 'fastPath', label: '快路径' }, { key: 'slowPath', label: '慢路径' }, { key: 'suspension', label: '受控悬置' }, { key: 'spinning', label: '空转故障' }, { key: 'entanglement', label: '纠结' }, { key: 'rectification', label: '单向整流' }, { key: 'internalFriction', label: '内耗表现' }, { key: 'meaningCutoff', label: '意义断供' }, { key: 'workspaceOverflow', label: '工作台溢出' }, { key: 'handling', label: '处理方式' }] },
  { id: 'L4', name: '执行层', role: '与现实接触并产生实际位移', duty: '系统与现实碰撞的唯一接触面。', rules: '没有通过 L4 输出的，一律记为未发生。', structures: '维持、位移、绑定、单调。', specificFields: [{ key: 'maintenance', label: '维持表现' }, { key: 'displacement', label: '位移表现' }, { key: 'binding', label: '绑定表现' }, { key: 'monotony', label: '单调表现' }, { key: 'executionResistance', label: '执行阻力' }, { key: 'failureSignals', label: '执行失败信号' }, { key: 'actualAction', label: '人物实际行动案例' }] },
  { id: 'L5', name: '脚本层', role: '历史沉积与预制行为脚本', duty: '时间维度上的历史沉积，只存不做功。', rules: '一切来自 L5 的行为，实为 L3 为省电调用的预制脚本。', structures: '历史资产、人格索引、废渣残留、不可访问部分。', specificFields: [{ key: 'historicalAssets', label: '历史资产' }, { key: 'personaIndex', label: '人格索引' }, { key: 'wasteResidue', label: '废渣残留' }, { key: 'inaccessible', label: '不可访问部分' }, { key: 'oldScript', label: '旧脚本内容' }, { key: 'oldScriptTrigger', label: '旧脚本触发条件' }, { key: 'isScriptValid', label: '当前是否仍然有效' }, { key: 'scriptImpact', label: '对当前行为的影响' }] },
  { id: 'L6', name: '主权层', role: '身份边界、放行与否决', duty: '最高权限，不产生内容，只输出裁决。', rules: '只输出放行或否决，KPI 是身份不丢失。', structures: '硬主权、软主权、辐射主权。', specificFields: [{ key: 'hardSovereignty', label: '硬主权（排他）' }, { key: 'softSovereignty', label: '软主权（准入）' }, { key: 'radiantSovereignty', label: '辐射主权（覆盖）' }, { key: 'consistencyAudit', label: '自洽审计' }, { key: 'boundaryAudit', label: '边界审计' }, { key: 'energyAudit', label: '能量审计' }, { key: 'timelinessAudit', label: '时效审计' }, { key: 'passConditions', label: '放行条件' }, { key: 'vetoConditions', label: '否决条件' }, { key: 'failureManifestation', label: '主权失效表现' }] },
  { id: 'L7', name: '裁剪层', role: '连接切断与最后一道断路器', duty: '物理断路器，最后手段，不可回滚。', rules: '只因结构性危险启动，不因痛苦启动。', structures: '主权穿透、能量出血、非自洽运行、执行失效。', specificFields: [{ key: 'triggerBackground', label: '触发背景' }, { key: 'cutConnection', label: '被裁剪的连接方式' }, { key: 'auditRecord', label: '裁剪前的审计记录' }, { key: 'postCutState', label: '裁剪后的状态' }, { key: 'feedback', label: '裁剪有效性反馈' }] }
]

const SANDBOX_META = [
  {
    id: 'PN', name: '物理底盘', sub: '生理叙事', coreQuestion: '人物有没有足够的现实资源活下去，并且活得踏实？',
    theory: '人物作为生物体存在的物质基础，包括作息、饮食、睡眠、居所、金钱、现金流和现实资源。',
    stable: '物理底盘健康、稳固。现金流与现实资源处于可控状态，生活空间有序，为高级算力输出提供生物学防护基础。',
    overload: '持续疲惫、身体报警、资源紧张、生活空间失控。对额外消耗变得敏感、易怒和抗拒。',
    fields: [
      { key: 'basicResources', label: '基本生活资源', type: 'text', placeholder: '居所、饮食、衣物、交通、其他' },
      { key: 'bodyRoutine', label: '身体与作息', type: 'text', placeholder: '睡眠、饮食规律、日常活动、身体状态' },
      { key: 'economy', label: '经济条件', type: 'text', placeholder: '收入、现金流、储蓄、负债、经济自主程度' },
      { key: 'resourceStability', label: '资源稳定性', type: 'radio', options: ['稳定', '波动', '紧张', '严重不足'] },
      { key: 'livingSpace', label: '生活空间', type: 'radio', options: ['稳定', '有序', '拥挤', '失控', '频繁迁移'] },
      { key: 'pressure', label: '当前主要压力来源', type: 'text' },
      { key: 'availableResources', label: '可调用的现实资源', type: 'text' },
    ]
  },
  {
    id: 'AN', name: '能力进化', sub: '自我叙事 · 单机系统', coreQuestion: '脱离外部组织和身份标签之后，人物凭借自身能力能够独立完成什么？',
    theory: '人物个人能力的沉淀层，记录学过什么、做成过什么、项目和履历，以及对自己能否解决问题的能力判断。',
    stable: '技能沉淀稳定推进，依靠自身方法论和能力复用，从现实中获得确定的成长反馈。',
    overload: '能力焦虑、履历断层、自我怀疑、长期缺少正反馈，逃避需要证明自身能力的场合。',
    fields: [
      { key: 'eduBg', label: '教育背景', type: 'text' },
      { key: 'profSkill', label: '专业技能', type: 'text' },
      { key: 'pracExp', label: '实践经验', type: 'text' },
      { key: 'projExp', label: '项目经历', type: 'text' },
      { key: 'workExp', label: '工作履历', type: 'text' },
      { key: 'independentTask', label: '可独立完成的事务', type: 'text' },
      { key: 'methodology', label: '已形成的方法论', type: 'text' },
      { key: 'strengths', label: '能力优势', type: 'text' },
      { key: 'weaknesses', label: '能力短板', type: 'text' },
      { key: 'growthDir', label: '能力成长方向', type: 'text' },
      { key: 'bottleneck', label: '当前能力瓶颈', type: 'text' },
      { key: 'feedback', label: '正反馈来源', type: 'text' },
    ]
  },
  {
    id: 'RN', name: '深度连接', sub: '关系叙事 · 局域网', coreQuestion: '人物有哪些真正稳定、可信任、可以相互支持的深度关系？',
    theory: '人物与他人之间的深度信任网络，包括伴侣、密友、长期合伙人等愿意托付后背的关系，通过陪伴、共情和双向承诺维系。',
    stable: '深度信任网络运行顺畅，拥有低摩擦的亲密依附或长期合作关系，边界清晰，能够分享情感支持。',
    overload: '孤独、被误解、被困在消耗型关系中，过度付出得不到回应，或者为了维持关系形式而沉默。',
    fields: [
      { key: 'relDistribution', label: '关系数量与分布', type: 'text' },
      { key: 'trustTargets', label: '核心信任对象', type: 'text' },
      { key: 'relStability', label: '关系稳定程度', type: 'radio', options: ['极其稳固', '相对稳定', '存在裂痕', '随时断裂'] },
      { key: 'mutualSupport', label: '相互支持程度', type: 'radio', options: ['极度互助', '礼尚往来', '单向付出', '形同陌路'] },
      { key: 'boundary', label: '关系边界', type: 'text' },
      { key: 'mainPressure', label: '主要关系压力', type: 'text' },
      { key: 'availableSupport', label: '可获得的支持', type: 'text' },
    ]
  },
  {
    id: 'IN', name: '社会舞台', sub: '社会叙事 · 广域网', coreQuestion: '人物在社会结构中处于什么位置，拥有什么样的身份、影响力和社会资源？',
    theory: '人物在群体中的坐标和影响力，包括身份标签、话语权、人脉圈层、组织位置和公众评价。',
    stable: '能够在社会结构中定位自身位置，在组织中获得适当的生态位，并有效利用社会评价和影响力。',
    overload: '被边缘化、被贴错标签、被舆论裹挟，过度在意他人评价而反复修正行为，或因评价伤害而拒绝融入群体。',
    fields: [
      { key: 'socialId', label: '社会身份/职业身份', type: 'text' },
      { key: 'orgBelonging', label: '组织归属', type: 'text' },
      { key: 'classPos', label: '所处阶层或社会位置', type: 'text' },
      { key: 'circle', label: '所属圈层', type: 'text' },
      { key: 'connections', label: '人脉资源', type: 'text' },
      { key: 'influence', label: '社会影响力', type: 'radio', options: ['举足轻重', '小有名气', '透明边缘', '声名狼藉'] },
      { key: 'discourse', label: '话语权', type: 'radio', options: ['一锤定音', '有一席之地', '只能服从', '人微言轻'] },
      { key: 'publicEval', label: '公众评价/社会声誉', type: 'text' },
      { key: 'powerPos', label: '组织内的权力位置', type: 'text' },
      { key: 'socialPressure', label: '主要社会压力', type: 'text' },
    ]
  },
  {
    id: 'MN', name: '意义导航', sub: '宏大叙事 · 统摄层', coreQuestion: '人物为什么而活，什么值得投入，什么事情不能妥协？',
    theory: '人物精神世界的顶层设计，包括价值观、人生终极目标、值得做的事情和不可妥协的原则。',
    stable: '精神范式高度自洽，人生愿景清晰，为其他沙盒提供方向指引。',
    overload: '空虚、迷茫、原有目标失效，信念出现空窗期，可能抓住短期消费或其他替代目标填补空洞。',
    fields: [
      { key: 'coreValues', label: '核心价值观', type: 'text' },
      { key: 'lifeGoal', label: '人生目标', type: 'text' },
      { key: 'longVision', label: '长期愿景', type: 'text' },
      { key: 'ultimateQuest', label: '终极追求', type: 'text' },
      { key: 'uncompromise', label: '不可妥协的原则', type: 'text' },
      { key: 'beliefs', label: '重要信念', type: 'text' },
      { key: 'spiritSupport', label: '精神支撑来源', type: 'text' },
      { key: 'meaningSource', label: '人生意义来源', type: 'text' },
      { key: 'valueConflict', label: '价值冲突', type: 'text' },
      { key: 'currentDilemma', label: '当前意义困境', type: 'text' },
    ]
  },
  {
    id: 'FN', name: '系统运转', sub: '功能叙事 · 共识层', coreQuestion: '人物通过什么规则、流程和机制维持生活与工作稳定运行？',
    theory: '人物建立起来的规则和流程，包括工作方法、协作机制、商业模式、日常生活习惯等能够持续运行的客观结构。',
    stable: '功能结构低损耗运转，现实经验被编码为可复用机制，反馈闭环稳定。',
    overload: '混乱、低效，被旧规则困住。明知机制需要调整，却因为重建成本和不确定性迟迟无法改变。',
    fields: [
      { key: 'dailyRoutine', label: '日常生活机制', type: 'text' },
      { key: 'workflow', label: '工作流程', type: 'text' },
      { key: 'decisionProc', label: '决策流程', type: 'text' },
      { key: 'timeMgmt', label: '时间管理方式', type: 'text' },
      { key: 'taskMgmt', label: '任务管理方式', type: 'text' },
      { key: 'collab', label: '协作机制', type: 'text' },
      { key: 'orgMgmt', label: '组织管理机制', type: 'text' },
      { key: 'bizModel', label: '商业模式或经营机制', type: 'text' },
      { key: 'fixedHabits', label: '已形成的固定习惯', type: 'text' },
      { key: 'ruleExecution', label: '规则执行方式', type: 'text' },
      { key: 'systemStability', label: '机制稳定程度', type: 'radio', options: ['极其稳定', '一般稳定', '经常变动', '濒临崩溃'] },
      { key: 'systemBottleneck', label: '现有系统的主要瓶颈', type: 'text' },
    ]
  }
]

const TIME_PRESETS = [
  { id: 'poverty', name: '极度时间贫困', desc: '除工作外几乎没有私人时间' }, { id: 'redundancy', name: '极度时间冗余', desc: '每天大量时间无所事事' },
  { id: 'night_owl', name: '昼夜颠倒', desc: '夜间工作者、夜行动物' }, { id: 'racing', name: '分秒必争', desc: '精确到分钟的时间安排' },
  { id: 'fragmented', name: '碎片化生存', desc: '永远被打断，无法专心做一件事' }
]

const MARRIAGE_PRESETS = [
  { id: 'clan', name: '宗族婚制', desc: '家族契约' }, { id: 'honor', name: '部族荣誉婚', desc: '荣誉载体' }, { id: 'caste', name: '等级内婚制', desc: '种姓宿命' },
  { id: 'romantic', name: '浪漫爱神论', desc: '灵魂契合/为爱殉情' }, { id: 'equal', name: '伙伴式平等婚姻', desc: '平权契约' }, { id: 'free_love', name: '自由情欲论', desc: '性与爱分离' },
  { id: 'celibacy', name: '禁欲独身主义', desc: '情欲是枷锁' }, { id: 'anti_love', name: '厌爱独身主义', desc: '亲密带来伤害' }, { id: 'breeding', name: '生育至上主义', desc: '繁衍是唯一目的' },
  { id: 'open', name: '开放关系', desc: '知情同意' }, { id: 'commune', name: '群婚/公社共居制', desc: '财产与后代共有' }, { id: 'platonic_marriage', name: '情爱分离沙龙', desc: '精神恋爱与婚姻解绑' },
  { id: 'patriarchy_extreme', name: '父权原教旨主义', desc: '男尊女卑' }, { id: 'gender_separatism', name: '激进性别分离', desc: '两性隔绝' }, { id: 'anti_natalism', name: '反生育主义', desc: '繁衍是原罪' }, { id: 'fertility_cult', name: '生殖崇拜', desc: '生育神圣化' },
  { id: 'platonic', name: '柏拉图式纯爱', desc: '精神同频' }, { id: 'contract', name: '契约婚恋', desc: '彻底商业化' }, { id: 'queer', name: '酷儿谱系', desc: '性别连续光谱' }
]

const SPECIES_PRESETS = [
  { id: 'elf', name: '精灵/长生种', desc: '永恒主义/慢爱恋/千年羁绊' },
  { id: 'orc', name: '兽人/虫族', desc: '群体意识/族群优先/程序化繁衍' },
  { id: 'undead', name: '亡灵/吸血鬼', desc: '虚无永恒/嫉妒生者/占有欲' },
  { id: 'ai', name: '智械/AI', desc: '绝对逻辑/最优解/缺乏本能情欲' }
]

const RELIGION_PRESETS = [
  { id: 'doomsday', name: '末世论/审判日', desc: '天灾/战争/救世主/末世重建' },
  { id: 'ascetic', name: '苦修/受虐救赎', desc: '肉体痛苦/灵魂洗涤/苦难救赎' },
  { id: 'machine_cult', name: '机械神教', desc: '血肉不洁/机械神圣/技术崇拜' },
  { id: 'cthulhu', name: '克苏鲁/深渊信仰', desc: '人类渺小/不可名状/深渊崇拜' },
  { id: 'hedonism_extreme', name: '绝对享乐主义', desc: '极端刺激/感官享乐/反常规娱乐' }
]

const AESTHETICS_PRESETS = [
  { id: 'baroque', name: '古典/巴洛克', desc: '奢华、对称、繁复、追求神性' },
  { id: 'wasteland', name: '废土/拼凑主义', desc: '垃圾废铁造物、实用至上、油污与铁锈' },
  { id: 'minimalist', name: '极简/实用主义', desc: '白墙铁皮、高效无装饰' },
  { id: 'cyberpunk', name: '赛博/全息复古', desc: '霓虹灯、全息投影、虚幻感官' },
  { id: 'xianxia', name: '仙侠/飘逸主义', desc: '宽袍大袖、悬浮山、风水自然' },
  { id: 'gothic', name: '暗黑/哥特式', desc: '黑红配色、尖塔、阴森恐怖' }
]

const PREFERENCE_PRESETS = [
  { id: 'S', name: 'S 感觉', desc: '可靠性、实用性。结果是否真实有效。' },
  { id: 'N', name: 'N 直觉', desc: '可能性、意义性。结果是否创造新的可能。' },
  { id: 'T', name: 'T 思考', desc: '正确性、逻辑质量。结果是否合理符合规律。' },
  { id: 'F', name: 'F 情感', desc: '关系价值、互惠性。结果是否考虑人的需要。' },
  { id: 'J', name: 'J 判断', desc: '确定性、完成度。是否形成明确结论与秩序。' },
  { id: 'P', name: 'P 感知', desc: '开放性、适应性。是否保留调整空间应对变化。' }
]

const COGNITIVE_PRESETS = [
  { id: 'Si', name: 'Si 内倾感觉', desc: '稳定、符合经验。经过验证值得信赖。' },
  { id: 'Se', name: 'Se 外倾感觉', desc: '现实反馈、即时效果。现在能产生实际影响。' },
  { id: 'Ni', name: 'Ni 内倾直觉', desc: '深层方向、长期趋势。符合未来发展的核心方向。' },
  { id: 'Ne', name: 'Ne 外倾直觉', desc: '可能性、创新空间。能够产生更多可能。' },
  { id: 'Ti', name: 'Ti 内倾思考', desc: '逻辑一致。内部逻辑没有漏洞。' },
  { id: 'Te', name: 'Te 外倾思考', desc: '效率、客观成果。能够有效实现目标。' },
  { id: 'Fi', name: 'Fi 内倾情感', desc: '真实、自我一致。符合内在原则。' },
  { id: 'Fe', name: 'Fe 外倾情感', desc: '关系协调、群体价值。被人接受促进关系。' }
]


// ================= 2. 页面主体 =================
export default function CharacterBuildingPage({ 
  characterId, 
  worldId, 
  onBack,
  initialModule = 'basic',
  onNavigate,
}: { 
  characterId: string, 
  worldId?: string, 
  onBack?: () => void,
  initialModule?: string,
  onNavigate?: (page: string) => void,
}) {

// 在组件内部：
const [selectedWorldId, setSelectedWorldId] = useState(worldId || '') // 记录当前选择的世界
const [personaType, setPersonaType] = useState<'npc' | 'self'>('npc')
const [allWorlds, setAllWorlds] = useState<any[]>([]) // 记录所有世界的列表

// 在 useEffect 里加载所有世界：
useEffect(() => {
  // 从后端获取世界列表
  fetch("http://127.0.0.1:8000/api/worlds")
    .then(res => res.json())
    .then(data => setAllWorlds(data))
    .catch(err => console.error("获取世界列表失败", err))
}, [])
  // ✅ 新增：如果有 characterId，则从后端拉取详情并回填
  useEffect(() => {
    if (!characterId) return;

    fetch(`http://127.0.0.1:8000/api/characters/${characterId}`)
      .then(res => {
        if (!res.ok) throw new Error("获取人物详情失败");
        return res.json();
      })
      .then(data => {
        // 1. 基础档案
        if (data.basic_profile) setCharData(data.basic_profile);
        
        // 2. 绑定世界
        if (data.world_id) setSelectedWorldId(data.world_id);
        if (data.persona_type === 'self') setPersonaType('self');

        // 3. 五引擎与主导关系
        if (data.engines) {
          if (data.engines.ovtde) setOvtdeData(data.engines.ovtde);
          if (data.engines.dominance) setDominance(data.engines.dominance);
        }

        // 4. 机制层
        if (data.defense_mechanisms) setMechanismData(prev => ({ ...prev, ...data.defense_mechanisms }));

        // 5. 沙盒层
        if (data.reality_conditions) setSandboxData(prev => ({ ...prev, ...data.reality_conditions }));

        // 6. 思想钢印
        if (data.thought_imprints) setIndividualData(prev => ({ ...prev, ...data.thought_imprints }));

                // 7. 生命经历（安全校验，防止格式不全导致白屏）
        if (data.life_history) {
          const raw = data.life_history;
          const safeEvents = Array.isArray(raw.events) ? raw.events : (Array.isArray(raw) ? raw : []);
          setHistoryData({
            events: safeEvents,
            deposits: {
              repeatedPatterns: raw.deposits?.repeatedPatterns || '',
              relationshipPatterns: raw.deposits?.relationshipPatterns || '',
              recurringDifficulties: raw.deposits?.recurringDifficulties || '',
              opportunitiesAndRewards: raw.deposits?.opportunitiesAndRewards || '',
              chronicStress: raw.deposits?.chronicStress || '',
              historicalUnderstanding: raw.deposits?.historicalUnderstanding || '',
              coreBeliefs: raw.deposits?.coreBeliefs || '',
              longTermObsession: raw.deposits?.longTermObsession || '',
              psychologicalBoundaries: raw.deposits?.psychologicalBoundaries || '',
              defenseTendencies: raw.deposits?.defenseTendencies || '',
              behavioralHabits: raw.deposits?.behavioralHabits || '',
              relationshipModels: raw.deposits?.relationshipModels || '',
              riskJudgment: raw.deposits?.riskJudgment || '',
              trajectory: Array.isArray(raw.deposits?.trajectory) ? raw.deposits.trajectory : [],
              currentInfluences: Array.isArray(raw.deposits?.currentInfluences) ? raw.deposits.currentInfluences : []
            }
          });
        }

        // 8. 初始状态
        if (data.initial_state) {
          if (data.initial_state.initialData) setInitialData(data.initial_state.initialData);
          if (data.initial_state.initialGoals) setInitialGoals(data.initial_state.initialGoals);
          if (data.initial_state.initialRelations) setInitialRelations(data.initial_state.initialRelations);
          if (data.initial_state.initialResources) setInitialResources(data.initial_state.initialResources);
        }

        // 9. 稳定种子快照 + 当前运行态
        seedLayerRef.current = {
          engines: data.engines || {},
          defense_mechanisms: data.defense_mechanisms || {},
          reality_conditions: data.reality_conditions || {},
          thought_imprints: data.thought_imprints || {},
        }
        getCharacterRuntime(characterId)
          .then((view) => {
            runtimeLayerRef.current = {
              engines: view.runtime.engines || {},
              defense_mechanisms: view.runtime.defense_mechanisms || {},
              reality_conditions: view.runtime.reality_conditions || {},
              thought_imprints: view.runtime.thought_imprints || {},
            }
            setRuntimeInfo({
              main_color: view.runtime.main_color || 'O',
              version: view.runtime.version || 0,
              updated_at: view.runtime.updated_at || null,
              growth_log: view.runtime.growth_log || [],
            })
          })
          .catch((err) => console.error('加载人物运行态失败', err))
      })
      .catch(err => {
        console.error("加载人物详情失败", err);
        alert("加载人物详情失败，请检查后端是否正常");
      });
  }, [characterId]);
  const [activeModule, setActiveModule] = useState(initialModule)
  const [stateLayer, setStateLayer] = useState<'seed' | 'runtime'>('seed')
  const [runtimeInfo, setRuntimeInfo] = useState<{
    main_color: string
    version: number
    updated_at: string | null
    growth_log: GrowthEntry[]
  }>({ main_color: 'O', version: 0, updated_at: null, growth_log: [] })
  const [growthReason, setGrowthReason] = useState('')
  const [growthEvents, setGrowthEvents] = useState<string[]>([])
  const seedLayerRef = useRef<CharacterLayer | null>(null)
  const runtimeLayerRef = useRef<CharacterLayer | null>(null)
    // ✅ 新增：用于记录当前展开了哪些事件卡片
  const [expandedEvents, setExpandedEvents] = useState<string[]>([]);
  
  const toggleEvent = (id: string) => {
    setExpandedEvents(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
    // ✅ 新增：用于拉取 05 的全局事件，并在弹窗中展示
  const [globalEvents, setGlobalEvents] = useState<any[]>([]);
  const [isEventImportModalOpen, setIsEventImportModalOpen] = useState(false);

  // 拉取当前世界的全局事件
  const loadGlobalEvents = async () => {
    const wId = selectedWorldId || worldId;
    if (!wId) return alert("请先绑定世界");
    
    alert("准备拉取世界ID为: " + wId + " 的事件");
    
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/events?world_id=${wId}`);
      if (!res.ok) throw new Error(`网络请求失败，状态码: ${res.status}`);
      const data = await res.json();
      
      alert("拉取到 " + data.length + " 个事件");
      
      setGlobalEvents(data);
      setIsEventImportModalOpen(true); 
    } catch (err: any) {
      console.error("报错了:", err);
      alert("拉取失败：" + err.message);
    }
  };
  // 选中全局事件后，一键导入到人物履历中
  const handleImportGlobalEvent = (gEvent: any) => {
    alert("正在导入事件：" + gEvent.name);
    // 检查是否已经导入过（防止重复）
    const isExist = historyData.events.some(e => e.source_event_id === gEvent.id);
    if (isExist) return alert("该事件已存在于人物履历中");

        // 创建一条新的个人履历，基础信息从全局事件拿
    const newEvent = {
      ...createEvent(), // 用你原本的 createEvent() 初始化所有空白字段
      id: crypto.randomUUID(),
      name: gEvent.name,
      startTime: gEvent.story_time || '',
      facts: gEvent.description || '', // 客观事实
      domain: gEvent.domain || [],
      polarity: gEvent.polarity,
      intensity: gEvent.intensity,
      location: gEvent.location_id || '',
      source_event_id: gEvent.id // ✅ 核心：记录它关联了哪个全局事件！
    };

    setHistoryData(prev => ({
      ...prev,
      events: [...prev.events, newEvent]
    }));
    
    // 自动展开这个新导入的卡片
    setExpandedEvents(prev => [...prev, newEvent.id]);
    setIsEventImportModalOpen(false);
  };
  // ✅ 01 基础档案（必须放在函数体内的最上面）
  const [charData, setCharData] = useState({
    name: '', code: '', avatar: '', species: '', age: '', gender: '',
    world: '', nation: '', org: '', socialClass: '', profession: '', role: '',
    appearance: '', education: '', degree: '', intro: '', background: ''
  })
  const updateChar = (field: string, val: string) => setCharData(prev => ({ ...prev, [field]: val }))

  // 02 引擎
  const [ovtdeData, setOvtdeData] = useState<Record<string, typeof INITIAL_ENGINE_STATE>>({
    O: { ...INITIAL_ENGINE_STATE, val: 60 }, V: { ...INITIAL_ENGINE_STATE, val: 75 }, D: { ...INITIAL_ENGINE_STATE, val: 85 }, E: { ...INITIAL_ENGINE_STATE, val: 45 }, T: { ...INITIAL_ENGINE_STATE, val: 90 }
  })
  const defaultOvtdeRef = useRef(ovtdeData)
  const [activeEngine, setActiveEngine] = useState<string | null>('O')
  const updateOvtde = (key: string, field: string, val: any) => setOvtdeData(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }))
  const [dominance, setDominance] = useState({ mode: [] as string[], engines: [] as string[], description: '' })

  // 03 机制层
  const [mechanismData, setMechanismData] = useState<Record<string, any>>(
    L_LAYERS_META.reduce((acc, layer) => ({ ...acc, [layer.id]: { actualPerformance: '', custom: '', specificData: {} } }), {})
  )
  const defaultMechanismRef = useRef(mechanismData)
  const [activeLayer, setActiveLayer] = useState<string | null>('L0')
  const updateMechanism = (layerId: string, field: string, val: any, isSpecific = false) => {
    setMechanismData(prev => {
      const layer = prev[layerId]
      if (isSpecific) return { ...prev, [layerId]: { ...layer, specificData: { ...layer.specificData, [field]: val } } }
      return { ...prev, [layerId]: { ...layer, [field]: val } }
    })
  }

  // 04 沙盒层
  const [sandboxData, setSandboxData] = useState<Record<string, any>>(
    SANDBOX_META.reduce((acc, box) => ({ ...acc, [box.id]: { fields: {}, actualPerformance: '', overloadPerformance: '', custom: '', relations: [] } }), {})
  )
  const defaultSandboxRef = useRef(sandboxData)
  const [activeSandbox, setActiveSandbox] = useState<string | null>('PN')
  
  const updateSandboxField = (boxId: string, fieldKey: string, val: string) => {
    setSandboxData(prev => ({ ...prev, [boxId]: { ...prev[boxId], fields: { ...prev[boxId].fields, [fieldKey]: val } } }))
  }
  const updateSandboxText = (boxId: string, field: string, val: string) => {
    setSandboxData(prev => ({ ...prev, [boxId]: { ...prev[boxId], [field]: val } }))
  }
  const addRelation = (boxId: string) => {
    setSandboxData(prev => ({ ...prev, [boxId]: { ...prev[boxId], relations: [...prev[boxId].relations, { id: Date.now().toString(), name: '', type: '', desc: '' }] } }))
  }
  const updateRelation = (boxId: string, relId: string, field: string, val: string) => {
    setSandboxData(prev => ({ ...prev, [boxId]: { ...prev[boxId], relations: prev[boxId].relations.map((r: any) => r.id === relId ? { ...r, [field]: val } : r) } }))
  }
  const removeRelation = (boxId: string, relId: string) => {
    setSandboxData(prev => ({ ...prev, [boxId]: { ...prev[boxId], relations: prev[boxId].relations.filter((r: any) => r.id !== relId) } }))
  }
  const getSandboxStatus = (boxId: string) => {
    const data = sandboxData[boxId]
    const hasFields = Object.values(data.fields).some(v => v !== '')
    const hasTexts = data.actualPerformance !== '' || data.overloadPerformance !== '' || data.custom !== ''
    const hasRelations = data.relations && data.relations.length > 0
    if (hasFields || hasTexts || hasRelations) return '部分填写'
    return '未填写'
  }

     // 05 个体特征
  const [individualData, setIndividualData] = useState({
    timePresets: [] as string[], dailyRoutine: '', workTime: '', restStyle: '', timeAutonomy: '', paceDesc: '', timePressure: '', timeCustom: '',
    marriagePresets: [] as string[], marriageUnderstand: '', loveUnderstand: '', sexAttitude: '', mateStandard: '', intimacyBoundary: '', loyaltyDuty: '', marriageCustom: '',
    speciesPresets: [] as string[], speciesType: '', groupRelation: '', isIndependent: '', lifeDeathView: '', breedingMechanism: '', intimacyMechanism: '', attitudeToOthers: '', speciesCustom: '',
    religionPresets: [] as string[], faithTarget: '', coreDogma: '', absoluteTaboo: '', salvationView: '', hereticAttitude: '', hasMissionary: '', forceBelieve: '', religionCustom: '',
    imprints: [] as { id: string, figure: string, thoughts: string, level: string, opposed: string, source: string, principles: string, taboos: string }[],
    aestheticPresets: [] as string[], dressStyle: '', archPref: '', colorPref: '', artMusicPref: '', aestheticTaboo: '', languageTone: '', aestheticCustom: '',
    prefPresets: [] as string[], cogPresets: [] as string[], mostImportantStandard: '', secondaryStandard: '', unacceptableResult: '', conflictResolution: '', typicalCase: '', cognitiveCustom: ''
  })
  const defaultIndividualRef = useRef(individualData)
  const updateInd = (field: string, val: any) => setIndividualData(prev => ({ ...prev, [field]: val }))
  
  const addImprint = () => {
    updateInd('imprints', [...individualData.imprints, { id: Date.now().toString(), figure: '', thoughts: '', level: '', opposed: '', source: '', principles: '', taboos: '' }])
  }
  const updateImprint = (id: string, field: string, val: string) => {
    updateInd('imprints', individualData.imprints.map(item => item.id === id ? { ...item, [field]: val } : item))
  }
  const removeImprint = (id: string) => {
    updateInd('imprints', individualData.imprints.filter(item => item.id !== id))
  }

  const [openB, setOpenB] = useState<string | null>('B1')
    // ================= 06 生命经历与历史沉积 =================

  const createEvent = () => ({
    source_event_id: '', 
    id: crypto.randomUUID(),
    name: '',
    startTime: '',
    endTime: '',
    age: '',
    lifeStage: '',
    location: '',
    relatedPeople: '',
    domain: [] as string[],
    polarity: '',
    intensity: '',
    facts: '',
    custom: '',

    // B1 事件认知
    cognition: '',
    meaning: '',
    meaningType: '',
    certainty: '',
    cognitionCustom: '',

    // B2 归因对象
    attribution: [] as string[],
    attributionCustom: '',

    // B3 情绪与心理反应
    emotions: [] as string[],
    emotionDuration: '',
    psychologicalImpact: '',
    recurringEmotion: '',
    emotionCustom: '',

    // B4 行为反应
    firstReaction: '',
    actualAction: '',
    defenseAvoidance: '',
    confrontation: '',
    helpSeeking: '',
    finalResponse: '',
    behaviorCustom: '',

    // B5 事件结果与后续影响
    directResult: '',
    lifeImpact: '',
    relationshipImpact: '',
    beliefImpact: '',
    longTermImpact: '',
    followUpEvents: '',
    resultCustom: ''
  })

  const [historyData, setHistoryData] = useState<{
    events: ReturnType<typeof createEvent>[]
    deposits: {
      repeatedPatterns: string
      relationshipPatterns: string
      recurringDifficulties: string
      opportunitiesAndRewards: string
      chronicStress: string
      historicalUnderstanding: string

      coreBeliefs: string
      longTermObsession: string
      psychologicalBoundaries: string
      defenseTendencies: string
      behavioralHabits: string
      relationshipModels: string
      riskJudgment: string

      trajectory: {
        id: string
        period: string
        beforeState: string
        afterState: string
        relatedExperience: string
        behaviorChange: string
        engineChange: string
        stableParts: string
        selfUnderstanding: string
      }[]

      currentInfluences: {
        id: string
        domain: string
        sourceEvent: string
        currentManifestation: string
        isOngoing: string
        hasChanged: string
        currentView: string
      }[]
    }
  }>({
    events: [],
    deposits: {
      repeatedPatterns: '',
      relationshipPatterns: '',
      recurringDifficulties: '',
      opportunitiesAndRewards: '',
      chronicStress: '',
      historicalUnderstanding: '',

      coreBeliefs: '',
      longTermObsession: '',
      psychologicalBoundaries: '',
      defenseTendencies: '',
      behavioralHabits: '',
      relationshipModels: '',
      riskJudgment: '',

      trajectory: [],
      currentInfluences: []
    }
  })

  const updateHistoryEvent = (eventId: string, field: string, value: any) => {
    setHistoryData(prev => ({
      ...prev,
      events: prev.events.map(event =>
        event.id === eventId ? { ...event, [field]: value } : event
      )
    }))
  }

  const addHistoryEvent = () => {
    setHistoryData(prev => ({
      ...prev,
      events: [...prev.events, createEvent()]
    }))
  }

  const removeHistoryEvent = (eventId: string) => {
    setHistoryData(prev => ({
      ...prev,
      events: prev.events.filter(event => event.id !== eventId)
    }))
  }

  const updateDeposit = (field: string, value: any) => {
    setHistoryData(prev => ({
      ...prev,
      deposits: { ...prev.deposits, [field]: value }
    }))
  }

  const addTrajectory = () => {
    setHistoryData(prev => ({
      ...prev,
      deposits: {
        ...prev.deposits,
        trajectory: [
          ...prev.deposits.trajectory,
          {
            id: crypto.randomUUID(),
            period: '',
            beforeState: '',
            afterState: '',
            relatedExperience: '',
            behaviorChange: '',
            engineChange: '',
            stableParts: '',
            selfUnderstanding: ''
          }
        ]
      }
    }))
  }

  const updateTrajectory = (id: string, field: string, value: string) => {
    setHistoryData(prev => ({
      ...prev,
      deposits: {
        ...prev.deposits,
        trajectory: prev.deposits.trajectory.map(item =>
          item.id === id ? { ...item, [field]: value } : item
        )
      }
    }))
  }

  const removeTrajectory = (id: string) => {
    setHistoryData(prev => ({
      ...prev,
      deposits: {
        ...prev.deposits,
        trajectory: prev.deposits.trajectory.filter(item => item.id !== id)
      }
    }))
  }

  const addCurrentInfluence = () => {
    setHistoryData(prev => ({
      ...prev,
      deposits: {
        ...prev.deposits,
        currentInfluences: [
          ...prev.deposits.currentInfluences,
          {
            id: crypto.randomUUID(),
            domain: '',
            sourceEvent: '',
            currentManifestation: '',
            isOngoing: '',
            hasChanged: '',
            currentView: ''
          }
        ]
      }
    }))
  }

  const updateCurrentInfluence = (id: string, field: string, value: string) => {
    setHistoryData(prev => ({
      ...prev,
      deposits: {
        ...prev.deposits,
        currentInfluences: prev.deposits.currentInfluences.map(item =>
          item.id === id ? { ...item, [field]: value } : item
        )
      }
    }))
  }

  const removeCurrentInfluence = (id: string) => {
    setHistoryData(prev => ({
      ...prev,
      deposits: {
        ...prev.deposits,
        currentInfluences: prev.deposits.currentInfluences.filter(item => item.id !== id)
      }
    }))
  }


  // ================= 07 人物初始状态 =================

  const [initialData, setInitialData] = useState({
    // A. 内部状态
    energyState: '',
    energyDescription: '',
    energyConsumption: '',
    energyRecovery: '',
    pressureState: '',
    pressureSource: '',
    pressureDuration: '',
    pressureImpact: '',
    loadState: '',
    responsibilities: '',
    taskComplexity: '',
    isOverloaded: '',
    loadSource: '',
    primaryEmotion: [] as string[],
    secondaryEmotion: '',
    emotionDuration: '',
    emotionTrigger: '',
    emotionManifestation: '',

    // B. 行动状态
    mainDilemma: '',
    dilemmaDomain: '',
    dilemmaCause: '',
    dilemmaProgress: '',
    dilemmaAwareness: '',
    dilemmaResponse: '',

    primaryEngine: '',
    secondaryEngine: '',
    engineRelation: '',
    engineManifestation: '',
    engineTrigger: '',
    engineCustom: '',

    // D. 快照元信息
    snapshotName: '',
    snapshotTime: '',
    lifeStage: '',
    overallDescription: '',
    snapshotNotes: ''
  })

  const updateInitial = (field: string, value: any) => {
    setInitialData(prev => ({ ...prev, [field]: value }))
  }

  // 当前人物的多个目标
  const [initialGoals, setInitialGoals] = useState<
    { id: string; name: string; priority: string; reason: string; expectedResult: string; currentAction: string; obstacles: string; custom: string }[]
  >([])

  const addInitialGoal = () => {
    setInitialGoals(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        priority: '',
        reason: '',
        expectedResult: '',
        currentAction: '',
        obstacles: '',
        custom: ''
      }
    ])
  }

  const updateInitialGoal = (id: string, field: string, value: string) => {
    setInitialGoals(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const removeInitialGoal = (id: string) => {
    setInitialGoals(prev => prev.filter(item => item.id !== id))
  }

  // 当前重要关系
  const [initialRelations, setInitialRelations] = useState<
    { id: string; person: string; type: string; nature: string; stability: string; conflict: string; support: string; subjectiveFeeling: string; custom: string }[]
  >([])

  const addInitialRelation = () => {
    setInitialRelations(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        person: '',
        type: '',
        nature: '',
        stability: '',
        conflict: '',
        support: '',
        subjectiveFeeling: '',
        custom: ''
      }
    ])
  }

  const updateInitialRelation = (id: string, field: string, value: string) => {
    setInitialRelations(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const removeInitialRelation = (id: string) => {
    setInitialRelations(prev => prev.filter(item => item.id !== id))
  }

  // 当前资源
  const [initialResources, setInitialResources] = useState<
    { id: string; name: string; owned: string; external: string; limitation: string; scarcity: string; stability: string; impact: string; custom: string }[]
  >([])

  const addInitialResource = () => {
    setInitialResources(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        owned: '',
        external: '',
        limitation: '',
        scarcity: '',
        stability: '',
        impact: '',
        custom: ''
      }
    ])
  }

  const updateInitialResource = (id: string, field: string, value: string) => {
    setInitialResources(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const removeInitialResource = (id: string) => {
    setInitialResources(prev => prev.filter(item => item.id !== id))
  }

  const currentModule = CHARACTER_MODULES.find(item => item.id === activeModule)!

  const applyLayerSnapshot = (snap: CharacterLayer) => {
    const ovtde = (snap.engines?.ovtde || {}) as Record<string, typeof INITIAL_ENGINE_STATE>
    setOvtdeData({ ...cloneLayer(defaultOvtdeRef.current), ...cloneLayer(ovtde) })
    setDominance(cloneLayer((snap.engines?.dominance || { mode: [], engines: [], description: '' }) as { mode: string[]; engines: string[]; description: string }))
    setMechanismData({ ...cloneLayer(defaultMechanismRef.current), ...cloneLayer((snap.defense_mechanisms || {}) as Record<string, any>) })
    setSandboxData({ ...cloneLayer(defaultSandboxRef.current), ...cloneLayer((snap.reality_conditions || {}) as Record<string, any>) })
    setIndividualData({ ...cloneLayer(defaultIndividualRef.current), ...cloneLayer((snap.thought_imprints || {}) as any) })
  }

  const switchStateLayer = (layer: 'seed' | 'runtime') => {
    if (layer === stateLayer) return
    const target = layer === 'seed' ? seedLayerRef.current : runtimeLayerRef.current
    if (!target) {
      alert(layer === 'runtime' ? '当前运行态尚未加载完成，请稍后再试。' : '种子快照尚未加载完成。')
      return
    }
    if (!window.confirm('切换编辑层会放弃当前尚未保存的修改，继续吗？')) return
    applyLayerSnapshot(target)
    setStateLayer(layer)
    if (layer === 'runtime') setActiveModule('growth')
  }

  const handleRuntimeSave = async () => {
    if (!characterId || characterId === 'new') {
      alert('请先保存人物种子，再记录运行态成长。')
      return
    }
    try {
      const view = await updateCharacterRuntime(characterId, {
        engines: { ovtde: ovtdeData as any, dominance: dominance as any },
        defense_mechanisms: mechanismData,
        reality_conditions: sandboxData,
        thought_imprints: individualData,
        main_color: runtimeInfo.main_color,
        reason: growthReason.trim() || '作者校准当前运行态',
        source_event_ids: growthEvents,
        life_history: historyData,
      })
      runtimeLayerRef.current = {
        engines: view.runtime.engines || {},
        defense_mechanisms: view.runtime.defense_mechanisms || {},
        reality_conditions: view.runtime.reality_conditions || {},
        thought_imprints: view.runtime.thought_imprints || {},
      }
      setRuntimeInfo({
        main_color: view.runtime.main_color || 'O',
        version: view.runtime.version || 0,
        updated_at: view.runtime.updated_at || null,
        growth_log: view.runtime.growth_log || [],
      })
      setGrowthReason('')
      setGrowthEvents([])
      if (view.entry) alert('🎉 已记录一次成长校准，种子设定保持不变。')
      else alert('当前运行态与上次一致，没有产生新的成长记录。')
    } catch (error: any) {
      alert(`❌ 运行态保存失败：${error.message || error}`)
    }
  }

      const handleSave = async () => {
    if (stateLayer === 'runtime' && characterId && characterId !== 'new') {
      await handleRuntimeSave()
      return
    }
    if (!charData.name.trim()) return alert('❌ 请填写人物名称！');
    if (!selectedWorldId) return alert('❌ 请选择人物所属的世界！');

    try {
      // ✅ 1. 先找出那些在 03 里自建、还没同步到 05 的本地事件
      const localEvents = historyData.events.filter((e: any) => !e.source_event_id);
      let updatedEvents = [...historyData.events];

      if (localEvents.length > 0) {
        console.log(`发现 ${localEvents.length} 个未同步的本地事件，准备同步到 05 仓库...`);
        
        for (const le of localEvents) {
          // 构造全局事件数据
          const newGlobalEvent = {
            world_id: selectedWorldId,
            name: le.name,
            description: le.facts || '暂无描述',
            story_time: le.startTime || '',
            domain: le.domain || [],
            polarity: le.polarity || '稳定',
            intensity: le.intensity || '中',
            location_id: le.location || '',
            participants: characterId && characterId !== 'new' ? [characterId] : [],
            storyline: '副线', // 默认归类为副线
            scale: '微观' // 默认归类为微观
          };

          // 发送到 05 的接口创建全局事件
          const evRes = await fetch("http://127.0.0.1:8000/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newGlobalEvent)
          });

          if (evRes.ok) {
            const createdEvent = await evRes.json();
            // 把生成好的全局事件 ID 记下来，回填给 03 的这件事
            updatedEvents = updatedEvents.map((e: any) => 
              e.id === le.id ? { ...e, source_event_id: createdEvent.id } : e
            );
          }
        }
      }

      // ✅ 2. 同步完毕后，把带上了 source_event_id 的最新履历保存进人物档案
      const characterData = {
        world_id: selectedWorldId, 
        name: charData.name,
        basic_profile: charData,
        engines: { ovtde: ovtdeData, dominance: dominance },
        defense_mechanisms: mechanismData,
        reality_conditions: sandboxData,
        thought_imprints: individualData,
        life_history: { ...historyData, events: updatedEvents }, // 使用同步后的数据
        initial_state: { initialData, initialGoals, initialRelations, initialResources },
        persona_type: personaType
      };

      const url = characterId && characterId !== 'new' 
        ? `http://127.0.0.1:8000/api/characters/${characterId}` 
        : "http://127.0.0.1:8000/api/characters";
      const method = characterId && characterId !== 'new' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(characterData)
      });

      if (res.ok) {
        seedLayerRef.current = {
          engines: cloneLayer(characterData.engines),
          defense_mechanisms: cloneLayer(characterData.defense_mechanisms),
          reality_conditions: cloneLayer(characterData.reality_conditions),
          thought_imprints: cloneLayer(characterData.thought_imprints),
        }
        alert('🎉 人物种子已保存，且本地事件已成功同步到 05 仓库！');
        if (onBack) onBack(); 
      } else {
        const errText = await res.text();
        alert(`❌ 保存失败！状态码：${res.status}，原因：${errText}`);
      }
    } catch (error) {
      console.error('保存报错:', error);
      alert('❌ 网络请求失败，请检查后端是否开启');
    }
  };
  

    
 return (
    <div className="character-editor" style={{ backgroundColor: 'transparent', minHeight: '100%', paddingBottom: '2rem' }}>
           <header className="character-editor-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '1.2rem 2rem', backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--card-border)', marginBottom: '1rem', borderRadius: '0 0 16px 16px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
          {onBack && (
            <button onClick={onBack} type="button" style={{ padding: '6px 12px', background: 'rgba(128,128,128,0.1)', border: '1px solid var(--card-border)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer' }}>
              ← 返回
            </button>
          )}
          <div>
            <h1 style={{ margin: '0 0 4px 0', color: 'var(--text-main)', fontSize: '22px', fontWeight: 600 }}>
              {stateLayer === 'seed' ? '人物种子编辑器' : '人物当前运行态'}
            </h1>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {stateLayer === 'seed' ? '稳定底色：设定人物的长期倾向与初始条件' : `第 ${runtimeInfo.version} 次成长校准 · 主色调 ${runtimeInfo.main_color}`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', padding: '3px', borderRadius: '8px', background: 'rgba(128,128,128,0.12)', border: '1px solid var(--card-border)' }}>
            <button
              type="button"
              onClick={() => switchStateLayer('seed')}
              style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: stateLayer === 'seed' ? 'var(--card-bg)' : 'transparent', color: stateLayer === 'seed' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: stateLayer === 'seed' ? 600 : 400 }}
            >
              种子设定
            </button>
            <button
              type="button"
              onClick={() => switchStateLayer('runtime')}
              style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: stateLayer === 'runtime' ? 'var(--card-bg)' : 'transparent', color: stateLayer === 'runtime' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: stateLayer === 'runtime' ? 600 : 400 }}
            >
              当前运行态
            </button>
          </div>
          <button 
            onClick={handleSave}
            style={{ padding: '8px 20px', background: 'var(--primary-color)', color: 'var(--primary-text)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            {stateLayer === 'seed' ? '保存种子' : '保存运行态'}
          </button>
        </div>
      </header>

      {stateLayer === 'runtime' && (
        <div style={{ margin: '0 2rem 1rem', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.1)', color: 'var(--text-main)', fontSize: '12px', lineHeight: 1.7 }}>
          你正在编辑<strong>当前运行态</strong>：02–05 的当前值会随经历、认知与选择变化，但不会覆盖种子底色。保存运行态会同步 06 的生命经历；01 基础档案与 07 初始状态仍属于种子层，请切回“种子设定”保存。事件本身不直接决定变化，先记录人物如何理解、归因和反应，再回到这里确认成长。
        </div>
      )}

      <main className="character-main-full">
             <div className="character-stepper" style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '10px 2rem 1rem 2rem', position: 'sticky', top: '80px', zIndex: 30, background: 'var(--bg-color)' }}>
          {CHARACTER_MODULES.map(module => {
            const isActive = activeModule === module.id
            return (
              <button 
                key={module.id} 
                type="button" 
                onClick={() => setActiveModule(module.id)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                  background: isActive ? 'rgba(128, 128, 128, 0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(128, 128, 128, 0.3)' : '1px solid var(--card-border)',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ display: 'block', color: isActive ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '12px', marginBottom: '4px', fontWeight: 600 }}>
                  {module.number}
                </span>
                <span style={{ display: 'block', color: isActive ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '14px', fontWeight: isActive ? 600 : 400 }}>
                  {module.title}
                </span>
              </button>
            )
          })}
        </div>
                <div style={{ padding: '1.5rem 2rem 0 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
              MODULE {currentModule.number} / 08
            </div>
            <h2 style={{ color: 'var(--text-main)', margin: 0, fontSize: '24px' }}>
              {currentModule.title} <span style={{ color: 'var(--text-muted)', fontSize: '16px', fontWeight: 400 }}>{currentModule.subtitle}</span>
            </h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '14px' }}>
              {currentModule.description}
            </p>
          </div>
          <div style={{ fontSize: '80px', fontWeight: 'bold', color: 'var(--text-main)', opacity: 0.05 }}>
            {currentModule.number}
          </div>
        </div>

                       <section className="module-workspace-light">
          {/* 模块 01 */}
          {currentModule.id === 'basic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>人物类型</span>
                  {([['npc', 'AI 角色'], ['self', '自我人物（我）']] as const).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setPersonaType(value)}
                      style={{
                        padding: '4px 10px', borderRadius: '14px', fontSize: '11px', cursor: 'pointer',
                        border: `1px solid ${personaType === value ? 'var(--primary-color)' : 'var(--card-border)'}`,
                        background: personaType === value ? 'rgba(128,128,128,0.12)' : 'transparent',
                        color: personaType === value ? 'var(--primary-color)' : 'var(--text-muted)',
                      }}>{label}</button>
                  ))}
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>自我人物用于 AI 伴侣中"你"的身份；每个世界一个。</span>
                </div>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', color: 'var(--text-main)' }}>👤 身份识别与社会坐标</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                  <TextField label="人物名称" value={charData.name} onChange={v => updateChar('name', v)} placeholder="例如：张三" />
                  <TextField label="人物编号" value={charData.code} onChange={v => updateChar('code', v)} placeholder="A-001" />
                  <TextField label="人物头像 (URL)" value={charData.avatar} onChange={v => updateChar('avatar', v)} />
                  <TextField label="物种" value={charData.species} onChange={v => updateChar('species', v)} placeholder="人类/精灵/赛博格..." />
                  <TextField label="年龄" value={charData.age} onChange={v => updateChar('age', v)} />
                  <TextField label="性别" value={charData.gender} onChange={v => updateChar('gender', v)} />
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>所属世界</label>
                    <select 
                      value={selectedWorldId} 
                      onChange={e => setSelectedWorldId(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', fontSize: '13px', outline: 'none' }}
                    >
                      <option value="">无（独立存在，不绑定世界）</option>
                      {allWorlds.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  <TextField label="国家/地区" value={charData.nation} onChange={v => updateChar('nation', v)} />
                  <TextField label="所属组织" value={charData.org} onChange={v => updateChar('org', v)} />
                  <TextField label="社会身份" value={charData.socialClass} onChange={v => updateChar('socialClass', v)} placeholder="贵族/平民/奴隶..." />
                  <TextField label="职业" value={charData.profession} onChange={v => updateChar('profession', v)} />
                  <TextField label="人物定位" value={charData.role} onChange={v => updateChar('role', v)} placeholder="主角/反派/关键NPC..." />
                </div>
              </div>
              
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', color: 'var(--text-main)' }}>🎓 外在描述与教育经验</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <TextArea label="外在描述 (外貌、体征、穿着)" value={charData.appearance} onChange={v => updateChar('appearance', v)} placeholder="身高体型、疤痕、义体痕迹、日常穿着风格..." rows={4} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <TextArea label="教育经验 (毕业院校/培训机构)" value={charData.education} onChange={v => updateChar('education', v)} placeholder="皇家魔法学院、街头帮派大学..." rows={2} />
                    <TextField label="学历学位 / 资格证书" value={charData.degree} onChange={v => updateChar('degree', v)} placeholder="学士、博士、高级机械维修认证..." />
                  </div>
                </div>
              </div>
              
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', color: 'var(--text-main)' }}>📝 人物简介与备注</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <TextArea label="人物简介 (一段话概括，非生命经历)" value={charData.intro} onChange={v => updateChar('intro', v)} rows={2} />
                  <TextArea label="背景备注 (其他补充设定)" value={charData.background} onChange={v => updateChar('background', v)} rows={3} />
                </div>
              </div>
            </div>
          )}

          {/* 模块 02 */}
          {currentModule.id === 'engines' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', color: 'var(--text-main)' }}>五引擎动力画像 (手动评估)</h3>
                <p style={{ margin: '0 0 24px 0', fontSize: '12px', color: 'var(--text-muted)' }}>以下数值仅代表界面示意，请根据设定手动拖动赋值。</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {Object.keys(OVTDE_META).map(key => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ width: '180px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-main)' }}>{key} · {OVTDE_META[key as keyof typeof OVTDE_META].label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--primary-color)' }}>{OVTDE_META[key as keyof typeof OVTDE_META].desc}</div>
                      </div>
                      <input type="range" min="0" max="100" value={ovtdeData[key].val} onChange={e => updateOvtde(key, 'val', parseInt(e.target.value))} style={{ flex: 1, accentColor: 'var(--primary-color)' }} />
                      <span style={{ width: '30px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-main)' }}>{ovtdeData[key].val}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.keys(OVTDE_META).map(key => {
                  const isOpen = activeEngine === key
                  const data = ovtdeData[key]
                  return (
                    <div key={key} className="glass-card" style={{ overflow: 'hidden' }}>
                      <button type="button" onClick={() => setActiveEngine(isOpen ? null : key)} style={{ width: '100%', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isOpen ? 'rgba(128, 128, 128, 0.1)' : 'transparent', border: 'none', cursor: 'pointer' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '15px' }}>{key} · {OVTDE_META[key as keyof typeof OVTDE_META].label}</span>
                        <span style={{ color: 'var(--primary-color)', fontSize: '13px' }}>{isOpen ? '收起 ▲' : '展开 ▼'}</span>
                      </button>
                      {isOpen && (
                        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', borderTop: '1px solid var(--card-border)' }}>
                          <TextField label="核心定义" value={data.definition} onChange={v => updateOvtde(key, 'definition', v)} />
                          <TextField label="内在渴求 (要什么)" value={data.desire} onChange={v => updateOvtde(key, 'desire', v)} />
                          <TextField label="核心威胁 (怕什么)" value={data.threat} onChange={v => updateOvtde(key, 'threat', v)} />
                          <TextField label="拥有的资源" value={data.resources} onChange={v => updateOvtde(key, 'resources', v)} />
                          <TextField label="需要的资源" value={data.needs} onChange={v => updateOvtde(key, 'needs', v)} />
                          <TextField label="对其他引擎的影响" value={data.impact} onChange={v => updateOvtde(key, 'impact', v)} />
                          <TextField label="现实行为表现" value={data.behavior} onChange={v => updateOvtde(key, 'behavior', v)} />
                          <TextField label="过强时的表现" value={data.over} onChange={v => updateOvtde(key, 'over', v)} />
                          <TextField label="过弱时的表现" value={data.under} onChange={v => updateOvtde(key, 'under', v)} />
                          <div style={{ gridColumn: '1 / -1' }}><TextField label="自定义补充描述" value={data.custom} onChange={v => updateOvtde(key, 'custom', v)} /></div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              
              <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)' }}>引擎主导关系</h3>
                <TagGroup label="运行模式 (可多选)" options={['单引擎主导', '双引擎交替主导 (振荡)', '多引擎平衡']} selected={dominance.mode} onChange={v => setDominance({...dominance, mode: v})} />
                <TagGroup label="涉及的主导引擎" options={['O', 'V', 'D', 'E', 'T']} selected={dominance.engines} onChange={v => setDominance({...dominance, engines: v})} />
                <TextArea label="具体运行描述" value={dominance.description} onChange={v => setDominance({...dominance, description: v})} placeholder="例如：平时由 O 秩序主导，遇到极端危险时转为 V 锚定主导..." rows={3} />
              </div>
            </div>
          )}

          {/* 模块 03 */}
          {currentModule.id === 'mechanism' && (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
             <div className="glass-card" style={{ padding: '24px', marginBottom: '8px' }}>
               <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: 'var(--text-main)' }}>🧬 L0-L7 人格运行与防御档案</h3>
               <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>下面展示了 ESA 理论中各层的运行机制。请在“人物实际表现”中填写该角色对应层级的真实状态。</p>
             </div>

             {L_LAYERS_META.map(layer => {
               const isOpen = activeLayer === layer.id
               const data = mechanismData[layer.id]

               return (
                 <div key={layer.id} className="glass-card" style={{ overflow: 'hidden' }}>
                   <button type="button" onClick={() => setActiveLayer(isOpen ? null : layer.id)} style={{ width: '100%', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isOpen ? 'rgba(128, 128, 128, 0.1)' : 'transparent', border: 'none', cursor: 'pointer' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <span style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '16px', minWidth: '40px' }}>{layer.id}</span>
                       <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '15px' }}>{layer.name}</span>
                       <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>- {layer.role}</span>
                     </div>
                     <span style={{ color: 'var(--primary-color)', fontSize: '13px' }}>{isOpen ? '收起 ▲' : '展开 ▼'}</span>
                   </button>

                   {isOpen && (
                     <div style={{ padding: '24px', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                       <div style={{ background: 'rgba(128,128,128,0.06)', padding: '16px 20px', borderRadius: '8px', border: '1px dashed var(--card-border)' }}>
                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                           <div><strong style={{ fontSize: '12px', color: 'var(--primary-color)' }}>职责：</strong><span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{layer.duty}</span></div>
                           <div><strong style={{ fontSize: '12px', color: 'var(--primary-color)' }}>内部构成：</strong><span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{layer.structures}</span></div>
                         </div>
                         <div><strong style={{ fontSize: '12px', color: 'var(--danger-color)' }}>核心铁律：</strong><span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{layer.rules}</span></div>
                       </div>

                       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                         {layer.specificFields.map(field => (
                           <TextField 
                             key={field.key} 
                             label={field.label} 
                             value={data.specificData[field.key] || ''} 
                             onChange={v => updateMechanism(layer.id, field.key, v, true)} 
                             placeholder={`记录角色的${field.label}...`}
                           />
                         ))}
                       </div>

                       <div style={{ borderTop: '1px dashed var(--card-border)', margin: '8px 0' }}></div>

                       <TextArea label="人物实际表现" value={data.actualPerformance} onChange={v => updateMechanism(layer.id, 'actualPerformance', v)} placeholder="例如：遭遇霸凌时，L2.5防御层直接启动‘投射’，把愤怒转嫁给旁人..." rows={2} />
                       <TextArea label="自定义补充" value={data.custom} onChange={v => updateMechanism(layer.id, 'custom', v)} rows={2} />
                     </div>
                   )}
                 </div>
               )
             })}
           </div>
          )}

          {/* 模块 04 */}
          {currentModule.id === 'sandbox' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="glass-card" style={{ padding: '24px', marginBottom: '8px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: 'var(--text-main)' }}>🌍 现实承载条件 (六大生存容纳沙盒)</h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>本模块用于记录人物的生存资源、能力积累、关系网络、社会位置、意义支撑和运行机制。请根据 ESA 理论边界进行设定。</p>
              </div>

              {SANDBOX_META.map(box => {
                const isOpen = activeSandbox === box.id
                const data = sandboxData[box.id]
                const status = getSandboxStatus(box.id)

                return (
                  <div key={box.id} className="glass-card" style={{ overflow: 'hidden' }}>
                    <button type="button" onClick={() => setActiveSandbox(isOpen ? null : box.id)} style={{ width: '100%', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isOpen ? 'rgba(128, 128, 128, 0.1)' : 'transparent', border: 'none', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '16px', minWidth: '40px' }}>{box.id}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '15px' }}>{box.name}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>- {box.sub}</span>
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--primary-color)', marginTop: '4px' }}>核心问题：{box.coreQuestion}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '11px', color: status === '未填写' ? 'var(--text-muted)' : 'var(--primary-color)', background: status === '未填写' ? 'rgba(128,128,128,0.12)' : 'rgba(128, 128, 128, 0.16)', padding: '2px 8px', borderRadius: '10px' }}>{status}</span>
                        <span style={{ color: 'var(--primary-color)', fontSize: '13px' }}>{isOpen ? '收起 ▲' : '展开 ▼'}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div style={{ padding: '24px', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        
                        <div style={{ background: 'rgba(128,128,128,0.06)', padding: '16px 20px', borderRadius: '8px', border: '1px dashed var(--card-border)' }}>
                          <div style={{ marginBottom: '12px' }}><strong style={{ fontSize: '12px', color: 'var(--primary-color)' }}>理论定义：</strong><span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{box.theory}</span></div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div><strong style={{ fontSize: '12px', color: '#10b981' }}>基准稳态运行：</strong><span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{box.stable}</span></div>
                            <div><strong style={{ fontSize: '12px', color: 'var(--danger-color)' }}>脆弱过载红线：</strong><span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{box.overload}</span></div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                          {box.fields.map(field => {
                            if (field.type === 'radio') {
                              return <RadioGroup key={field.key} label={field.label} options={field.options || []} value={data.fields[field.key] || ''} onChange={v => updateSandboxField(box.id, field.key, v)} />
                            }
                            return <TextField key={field.key} label={field.label} value={data.fields[field.key] || ''} onChange={v => updateSandboxField(box.id, field.key, v)} placeholder={(field as any).placeholder} />
                          })}
                        </div>

                        {box.id === 'RN' && (
                          <div style={{ border: '1px solid var(--card-border)', borderRadius: '8px', padding: '16px', background: 'rgba(128,128,128,0.06)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                              <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-main)' }}>动态关系对象列表</h4>
                              <button type="button" onClick={() => addRelation('RN')} style={{ padding: '6px 12px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>+ 添加关系</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {data.relations.map((rel: any) => (
                                <div key={rel.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: '12px', alignItems: 'center', background: 'transparent', padding: '12px', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                                  <input type="text" placeholder="对象名称" value={rel.name} onChange={e => updateRelation('RN', rel.id, 'name', e.target.value)} style={{ padding: '8px', fontSize: '12px' }} />
                                  <input type="text" placeholder="关系类型" value={rel.type} onChange={e => updateRelation('RN', rel.id, 'type', e.target.value)} style={{ padding: '8px', fontSize: '12px' }} />
                                  <input type="text" placeholder="描述/羁绊" value={rel.desc} onChange={e => updateRelation('RN', rel.id, 'desc', e.target.value)} style={{ padding: '8px', fontSize: '12px' }} />
                                  <button type="button" onClick={() => removeRelation('RN', rel.id)} style={{ padding: '6px 10px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>删除</button>
                                </div>
                              ))}
                              {data.relations.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>暂无关系对象，点击上方添加</span>}
                            </div>
                          </div>
                        )}

                        <div style={{ borderTop: '1px dashed var(--card-border)', margin: '8px 0' }}></div>

                        <TextArea label="基准稳态下的人物实际表现" value={data.actualPerformance} onChange={v => updateSandboxText(box.id, 'actualPerformance', v)} placeholder="描述当该沙盒处于正常稳定状态时，角色呈现出的现实表现..." rows={2} />
                        <TextArea label="过载时的人物实际表现" value={data.overloadPerformance} onChange={v => updateSandboxText(box.id, 'overloadPerformance', v)} placeholder="描述当该沙盒出现脆弱过载时，角色的变化和失控表现..." rows={2} />
                        <TextArea label="自定义补充" value={data.custom} onChange={v => updateSandboxText(box.id, 'custom', v)} rows={2} />

                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 模块 05 */}
          {currentModule.id === 'individual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--primary-color)' }}>A. 时间分配与生活节奏</h3>
                <TagGroup label="时间分配类型 (多选)" options={TIME_PRESETS} selected={individualData.timePresets} onChange={v => updateInd('timePresets', v)} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                  <TextField label="日常作息" value={individualData.dailyRoutine} onChange={v => updateInd('dailyRoutine', v)} />
                  <TextField label="工作时间" value={individualData.workTime} onChange={v => updateInd('workTime', v)} />
                  <TextField label="休息方式" value={individualData.restStyle} onChange={v => updateInd('restStyle', v)} />
                  <TextField label="时间自主权" value={individualData.timeAutonomy} onChange={v => updateInd('timeAutonomy', v)} />
                  <div style={{ gridColumn: '1 / -1' }}><TextArea label="生活节奏描述" value={individualData.paceDesc} onChange={v => updateInd('paceDesc', v)} rows={2} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><TextField label="主要时间压力来源" value={individualData.timePressure} onChange={v => updateInd('timePressure', v)} /></div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <TextArea label="自定义时间标签与补充说明" value={individualData.timeCustom} onChange={v => updateInd('timeCustom', v)} rows={2} />
                  </div>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--primary-color)' }}>B. 人物思想钢印</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="glass-card" style={{ overflow: 'hidden' }}>
                    <button type="button" onClick={() => setOpenB(openB === 'B1' ? null : 'B1')} style={{ width: '100%', padding: '12px 16px', background: openB === 'B1' ? 'rgba(128, 128, 128, 0.1)' : 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)' }}>B1. 婚恋与亲密范式 {openB === 'B1' ? '▲' : '▼'}</button>
                    {openB === 'B1' && (
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <TagGroup label="婚恋范式 (多选)" options={MARRIAGE_PRESETS} selected={individualData.marriagePresets} onChange={v => updateInd('marriagePresets', v)} />
                        <TextArea label="对婚姻的理解" value={individualData.marriageUnderstand} onChange={v => updateInd('marriageUnderstand', v)} rows={2} />
                        <TextArea label="对爱情的独立理解" value={individualData.loveUnderstand} onChange={v => updateInd('loveUnderstand', v)} rows={2} />
                        <TextArea label="对性与亲密关系的态度" value={individualData.sexAttitude} onChange={v => updateInd('sexAttitude', v)} rows={2} />
                        <TextArea label="择偶标准与关系边界" value={individualData.mateStandard} onChange={v => updateInd('mateStandard', v)} rows={2} />
                        <TextField label="对忠诚、占有、独立与责任的理解" value={individualData.loyaltyDuty} onChange={v => updateInd('loyaltyDuty', v)} />
                        <TextField label="自定义补充" value={individualData.marriageCustom} onChange={v => updateInd('marriageCustom', v)} />
                      </div>
                    )}
                  </div>

                  <div className="glass-card" style={{ overflow: 'hidden' }}>
                    <button type="button" onClick={() => setOpenB(openB === 'B2' ? null : 'B2')} style={{ width: '100%', padding: '12px 16px', background: openB === 'B2' ? 'rgba(128, 128, 128, 0.1)' : 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)' }}>B2. 异种与跨物种逻辑 {openB === 'B2' ? '▲' : '▼'}</button>
                    {openB === 'B2' && (
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <TextField label="物种/种族类型 (人类可跳过)" value={individualData.speciesType} onChange={v => updateInd('speciesType', v)} />
                        <TagGroup label="预设类型 (多选)" options={SPECIES_PRESETS} selected={individualData.speciesPresets} onChange={v => updateInd('speciesPresets', v)} />
                        <TextArea label="个体与群体关系" value={individualData.groupRelation} onChange={v => updateInd('groupRelation', v)} rows={2} />
                        <TextField label="个体意识独立性" value={individualData.isIndependent} onChange={v => updateInd('isIndependent', v)} />
                        <TextArea label="生命与死亡观" value={individualData.lifeDeathView} onChange={v => updateInd('lifeDeathView', v)} rows={2} />
                        <TextArea label="繁衍机制" value={individualData.breedingMechanism} onChange={v => updateInd('breedingMechanism', v)} rows={2} />
                        <TextField label="亲密关系机制" value={individualData.intimacyMechanism} onChange={v => updateInd('intimacyMechanism', v)} />
                        <TextField label="对其他物种态度" value={individualData.attitudeToOthers} onChange={v => updateInd('attitudeToOthers', v)} />
                        <TextField label="自定义补充" value={individualData.speciesCustom} onChange={v => updateInd('speciesCustom', v)} />
                      </div>
                    )}
                  </div>

                  <div className="glass-card" style={{ overflow: 'hidden' }}>
                    <button type="button" onClick={() => setOpenB(openB === 'B3' ? null : 'B3')} style={{ width: '100%', padding: '12px 16px', background: openB === 'B3' ? 'rgba(128, 128, 128, 0.1)' : 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)' }}>B3. 极端宗教与亚文化信仰 {openB === 'B3' ? '▲' : '▼'}</button>
                    {openB === 'B3' && (
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <TagGroup label="信仰类型 (多选)" options={RELIGION_PRESETS} selected={individualData.religionPresets} onChange={v => updateInd('religionPresets', v)} />
                        <TextField label="信仰对象" value={individualData.faithTarget} onChange={v => updateInd('faithTarget', v)} />
                        <TextArea label="核心教义" value={individualData.coreDogma} onChange={v => updateInd('coreDogma', v)} rows={2} />
                        <TextField label="绝对禁忌" value={individualData.absoluteTaboo} onChange={v => updateInd('absoluteTaboo', v)} />
                        <TextArea label="救赎观 / 对异教徒态度" value={individualData.salvationView} onChange={v => updateInd('salvationView', v)} rows={2} />
                        <TextField label="传教倾向" value={individualData.hasMissionary} onChange={v => updateInd('hasMissionary', v)} />
                        <TextField label="是否强制他人信仰" value={individualData.forceBelieve} onChange={v => updateInd('forceBelieve', v)} />
                        <TextField label="自定义补充" value={individualData.religionCustom} onChange={v => updateInd('religionCustom', v)} />
                      </div>
                    )}
                  </div>

                  <div className="glass-card" style={{ overflow: 'hidden' }}>
                    <button type="button" onClick={() => setOpenB(openB === 'B4' ? null : 'B4')} style={{ width: '100%', padding: '12px 16px', background: openB === 'B4' ? 'rgba(128, 128, 128, 0.1)' : 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)' }}>B4. 历史与虚构名人思想烙印 {openB === 'B4' ? '▲' : '▼'}</button>
                    {openB === 'B4' && (
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>可同时受多人思想影响，添加独立卡片记录。</span>
                          <button type="button" onClick={addImprint} style={{ padding: '6px 12px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>+ 添加思想卡片</button>
                        </div>
                        {individualData.imprints.map((imp) => (
                          <div key={imp.id} style={{ padding: '16px', background: 'rgba(128,128,128,0.06)', borderRadius: '6px', border: '1px dashed var(--card-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--primary-color)' }}>思想烙印 #{imp.id.slice(-4)}</span>
                              <button type="button" onClick={() => removeImprint(imp.id)} style={{ color: 'var(--danger-color)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>删除</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <TextField label="思想人物/原型" value={imp.figure} onChange={v => updateImprint(imp.id, 'figure', v)} placeholder="孔子/尼采/大贤者梅林..." />
                              <TextField label="认同程度" value={imp.level} onChange={v => updateImprint(imp.id, 'level', v)} placeholder="狂热/部分认同/批判性吸收..." />
                              <TextField label="认同的具体思想" value={imp.thoughts} onChange={v => updateImprint(imp.id, 'thoughts', v)} />
                              <TextField label="反对的思想" value={imp.opposed} onChange={v => updateImprint(imp.id, 'opposed', v)} />
                              <TextField label="思想来源" value={imp.source} onChange={v => updateImprint(imp.id, 'source', v)} placeholder="家族教育/禁书/经历..." />
                              <TextField label="行为原则" value={imp.principles} onChange={v => updateImprint(imp.id, 'principles', v)} />
                              <div style={{ gridColumn: '1 / -1' }}>
                                <TextField label="由此形成的底线与执念" value={imp.taboos} onChange={v => updateImprint(imp.id, 'taboos', v)} />
                              </div>
                            </div>
                          </div>
                        ))}
                        {individualData.imprints.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>暂无思想烙印</span>}
                      </div>
                    )}
                  </div>

                  <div className="glass-card" style={{ overflow: 'hidden' }}>
                    <button type="button" onClick={() => setOpenB(openB === 'B5' ? null : 'B5')} style={{ width: '100%', padding: '12px 16px', background: openB === 'B5' ? 'rgba(128, 128, 128, 0.1)' : 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)' }}>B5. 个人美学与艺术偏好 {openB === 'B5' ? '▲' : '▼'}</button>
                    {openB === 'B5' && (
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <TagGroup label="美学风格 (多选)" options={AESTHETICS_PRESETS} selected={individualData.aestheticPresets} onChange={v => updateInd('aestheticPresets', v)} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <TextField label="穿衣风格" value={individualData.dressStyle} onChange={v => updateInd('dressStyle', v)} />
                          <TextField label="建筑与空间偏好" value={individualData.archPref} onChange={v => updateInd('archPref', v)} />
                          <TextField label="色彩偏好" value={individualData.colorPref} onChange={v => updateInd('colorPref', v)} />
                          <TextField label="艺术与音乐偏好" value={individualData.artMusicPref} onChange={v => updateInd('artMusicPref', v)} />
                          <TextField label="审美禁忌" value={individualData.aestheticTaboo} onChange={v => updateInd('aestheticTaboo', v)} />
                          <TextField label="语言腔调与表达风格" value={individualData.languageTone} onChange={v => updateInd('languageTone', v)} />
                        </div>
                        <TextField label="自定义补充" value={individualData.aestheticCustom} onChange={v => updateInd('aestheticCustom', v)} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--primary-color)' }}>C. 人物结果评价标准</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>记录人物判断事情好坏时依据的标准，独立于 OVTDE 动力引擎。</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <TagGroup label="基础偏好维度 (多选)" options={PREFERENCE_PRESETS} selected={individualData.prefPresets} onChange={v => updateInd('prefPresets', v)} />
                  <TagGroup label="八种认知功能 (多选)" options={COGNITIVE_PRESETS} selected={individualData.cogPresets} onChange={v => updateInd('cogPresets', v)} />
                  
                  <div style={{ borderTop: '1px dashed var(--card-border)', margin: '8px 0' }}></div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <TextField label="最重视的结果标准" value={individualData.mostImportantStandard} onChange={v => updateInd('mostImportantStandard', v)} />
                    <TextField label="次要结果标准" value={individualData.secondaryStandard} onChange={v => updateInd('secondaryStandard', v)} />
                    <TextField label="不可接受的结果" value={individualData.unacceptableResult} onChange={v => updateInd('unacceptableResult', v)} />
                    <TextField label="标准冲突时的取舍" value={individualData.conflictResolution} onChange={v => updateInd('conflictResolution', v)} />
                  </div>
                  <TextArea label="典型决策案例" value={individualData.typicalCase} onChange={v => updateInd('typicalCase', v)} rows={2} />
                  <TextField label="自定义补充" value={individualData.cognitiveCustom} onChange={v => updateInd('cognitiveCustom', v)} />
                </div>
              </div>
            </div>
          )}

                  {/* ================= 模块 06：生命经历与历史沉积 ================= */}
{currentModule.id === 'history' && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

    <div className="glass-card" style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: 'var(--primary-color)' }}>
        生命经历与历史沉积
      </h3>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        本模块记录人物经历过的事件、人物对事件的理解与反应，以及这些经历长期形成的心理和行为沉积。
        事件本身不直接决定行为；人物的认知、归因与判断共同构成事件对其后续运行的影响。
      </p>
    </div>

    {/* A. 生命时间线 */}
    <div className="glass-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)' }}>A. 生命时间线</h3>
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            按时间轴记录经历，点击卡片可展开查看详细认知与行为。
          </p>
        </div>
                <div style={{ display: 'flex', gap: '12px' }}>
          <button type="button" onClick={loadGlobalEvents}
            style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', borderRadius: '5px', cursor: 'pointer', fontWeight: 600 }}>
            📥 从 05 导入事件
          </button>
          <button type="button" onClick={addHistoryEvent}
            style={{ padding: '8px 14px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600 }}>
            + 自定义事件
          </button>
        </div>
      </div>

      {/* ✅ 全新的垂直时间轴布局 */}
      <div style={{ position: 'relative', paddingLeft: '30px' }}>
        
        {/* 左侧垂直轴线 */}
        <div style={{ position: 'absolute', left: '8px', top: '10px', bottom: '0', width: '2px', background: 'var(--card-border)', borderRadius: '2px' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {historyData.events.map((event, index) => {
            const isExpanded = expandedEvents.includes(event.id);
            
            return (
              <div key={event.id} style={{ position: 'relative' }}>
                
                {/* 时间轴圆点 */}
                <div style={{ position: 'absolute', left: '-29px', top: '20px', width: '14px', height: '14px', borderRadius: '50%', background: 'var(--primary-color)', border: '3px solid var(--bg-color)', zIndex: 1 }} />

                <div style={{ border: '1px solid var(--card-border)', borderRadius: '8px', overflow: 'hidden', background: 'rgba(128,128,128,0.06)' }}>
                  
                  {/* 卡片头部：点击折叠/展开 */}
                  <div 
                    onClick={() => toggleEvent(event.id)}
                    style={{ padding: '16px 20px', background: isExpanded ? 'rgba(128, 128, 128, 0.1)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <strong style={{ color: 'var(--primary-color)', fontSize: '15px' }}>
                        {event.name || `事件 ${index + 1}`}
                      </strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        ⏳ {event.startTime || '未记录时间'} {event.lifeStage && `· ${event.lifeStage}`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeHistoryEvent(event.id); }}
                        style={{ border: 'none', background: 'transparent', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '12px' }}>
                        删除
                      </button>
                      <span style={{ color: 'var(--primary-color)', fontSize: '13px', fontWeight: 600 }}>{isExpanded ? '收起 ▲' : '展开 ▼'}</span>
                    </div>
                  </div>

                  {/* 卡片主体：展开时显示全部表单 */}
                  {isExpanded && (
                    <div style={{ padding: '20px', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <TextField label="事件名称" value={event.name} onChange={v => updateHistoryEvent(event.id, 'name', v)} />
                        <TextField label="发生时间" value={event.startTime} onChange={v => updateHistoryEvent(event.id, 'startTime', v)} placeholder="例如：公元 2020 年 / 某年秋季" />
                        <TextField label="结束时间" value={event.endTime} onChange={v => updateHistoryEvent(event.id, 'endTime', v)} />
                        <TextField label="人物当时年龄" value={event.age} onChange={v => updateHistoryEvent(event.id, 'age', v)} />
                        <TextField label="人生阶段" value={event.lifeStage} onChange={v => updateHistoryEvent(event.id, 'lifeStage', v)} placeholder="童年、青春期、成年早期..." />
                        <TextField label="发生地点" value={event.location} onChange={v => updateHistoryEvent(event.id, 'location', v)} />
                        <div style={{ gridColumn: '1 / -1' }}>
                          <TextField label="相关人物" value={event.relatedPeople} onChange={v => updateHistoryEvent(event.id, 'relatedPeople', v)} />
                        </div>
                      </div>

                      {/* ✅ 防白屏：加了 Array.isArray 检查 */}
                      <TagGroup
                        label="事件领域（可多选）"
                        options={['资源冲击', '关系扰动', '地位评价', '意义扰动', '控制失效', '机会变化', '慢性压力', '存在转变']}
                        selected={Array.isArray(event.domain) ? event.domain : []}
                        onChange={v => updateHistoryEvent(event.id, 'domain', v)}
                      />

                      <RadioGroup label="事件极性" options={['威胁', '奖赏', '扩张', '稳定', '腐化']} value={event.polarity || ''} onChange={v => updateHistoryEvent(event.id, 'polarity', v)} />
                      <RadioGroup label="事件强度" options={['低', '中', '高']} value={event.intensity || ''} onChange={v => updateHistoryEvent(event.id, 'intensity', v)} />

                      <TextArea label="事件经过与客观事实描述" value={event.facts || ''} onChange={v => updateHistoryEvent(event.id, 'facts', v)} rows={4} placeholder="只记录事件发生了什么..." />
                      <TextArea label="事件自定义补充" value={event.custom || ''} onChange={v => updateHistoryEvent(event.id, 'custom', v)} rows={2} />

                      <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '20px' }}>
                        <h4 style={{ margin: '0 0 16px', color: 'var(--primary-color)', fontSize: '14px' }}>B. 事件认知与行为反应</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          
                          <div>
                            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>B1. 事件认知</strong>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                              <TextArea label="人物如何理解这件事" value={event.cognition || ''} onChange={v => updateHistoryEvent(event.id, 'cognition', v)} />
                              <TextArea label="人物赋予事件的意义" value={event.meaning || ''} onChange={v => updateHistoryEvent(event.id, 'meaning', v)} />
                              <TextField label="意义性质" value={event.meaningType || ''} onChange={v => updateHistoryEvent(event.id, 'meaningType', v)} placeholder="例如：损失、背叛、机会、转折..." />
                              <TextField label="判断确定程度" value={event.certainty || ''} onChange={v => updateHistoryEvent(event.id, 'certainty', v)} placeholder="确信、怀疑、矛盾、无法判断..." />
                            </div>
                            <div style={{ marginTop: '12px' }}>
                              <TextArea label="认知补充" value={event.cognitionCustom || ''} onChange={v => updateHistoryEvent(event.id, 'cognitionCustom', v)} />
                            </div>
                          </div>

                          <div>
                            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>B2. 归因对象</strong>
                            <div style={{ marginTop: '12px' }}>
                              <TagGroup label="人物认为事件主要由什么造成（可多选）" options={['自身', '他人', '家庭', '组织或制度', '社会环境', '外部偶然因素', '无法确定']} selected={Array.isArray(event.attribution) ? event.attribution : []} onChange={v => updateHistoryEvent(event.id, 'attribution', v)} />
                            </div>
                            <div style={{ marginTop: '12px' }}>
                              <TextField label="自定义归因" value={event.attributionCustom || ''} onChange={v => updateHistoryEvent(event.id, 'attributionCustom', v)} />
                            </div>
                          </div>

                          <div>
                            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>B3. 情绪与心理反应</strong>
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <TagGroup label="主要情绪（可多选）" options={['恐惧', '愤怒', '悲伤', '羞耻', '内疚', '焦虑', '喜悦', '兴奋', '释然', '麻木', '厌恶', '困惑']} selected={Array.isArray(event.emotions) ? event.emotions : []} onChange={v => updateHistoryEvent(event.id, 'emotions', v)} />
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <TextField label="情绪持续时间" value={event.emotionDuration || ''} onChange={v => updateHistoryEvent(event.id, 'emotionDuration', v)} />
                                <TextField label="心理冲击程度" value={event.psychologicalImpact || ''} onChange={v => updateHistoryEvent(event.id, 'psychologicalImpact', v)} />
                              </div>
                              <TextArea label="长期反复出现的情绪反应" value={event.recurringEmotion || ''} onChange={v => updateHistoryEvent(event.id, 'recurringEmotion', v)} />
                              <TextArea label="情绪反应补充" value={event.emotionCustom || ''} onChange={v => updateHistoryEvent(event.id, 'emotionCustom', v)} />
                            </div>
                          </div>

                          <div>
                            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>B4. 行为反应</strong>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                              <TextArea label="第一反应" value={event.firstReaction || ''} onChange={v => updateHistoryEvent(event.id, 'firstReaction', v)} />
                              <TextArea label="实际采取的行动" value={event.actualAction || ''} onChange={v => updateHistoryEvent(event.id, 'actualAction', v)} />
                              <TextArea label="防御或回避方式" value={event.defenseAvoidance || ''} onChange={v => updateHistoryEvent(event.id, 'defenseAvoidance', v)} />
                              <TextArea label="主动对抗方式" value={event.confrontation || ''} onChange={v => updateHistoryEvent(event.id, 'confrontation', v)} />
                              <TextArea label="是否寻求帮助及其方式" value={event.helpSeeking || ''} onChange={v => updateHistoryEvent(event.id, 'helpSeeking', v)} />
                              <TextArea label="最终应对方式" value={event.finalResponse || ''} onChange={v => updateHistoryEvent(event.id, 'finalResponse', v)} />
                            </div>
                            <div style={{ marginTop: '12px' }}>
                              <TextArea label="行为补充" value={event.behaviorCustom || ''} onChange={v => updateHistoryEvent(event.id, 'behaviorCustom', v)} />
                            </div>
                          </div>

                          <div>
                            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>B5. 事件结果与后续影响</strong>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                              <TextArea label="直接结果" value={event.directResult || ''} onChange={v => updateHistoryEvent(event.id, 'directResult', v)} />
                              <TextArea label="对现实生活的影响" value={event.lifeImpact || ''} onChange={v => updateHistoryEvent(event.id, 'lifeImpact', v)} />
                              <TextArea label="对关系的影响" value={event.relationshipImpact || ''} onChange={v => updateHistoryEvent(event.id, 'relationshipImpact', v)} />
                              <TextArea label="对价值观与信念的影响" value={event.beliefImpact || ''} onChange={v => updateHistoryEvent(event.id, 'beliefImpact', v)} />
                              <TextField label="是否形成长期影响" value={event.longTermImpact || ''} onChange={v => updateHistoryEvent(event.id, 'longTermImpact', v)} />
                              <TextArea label="相关后续事件" value={event.followUpEvents || ''} onChange={v => updateHistoryEvent(event.id, 'followUpEvents', v)} />
                            </div>
                            <div style={{ marginTop: '12px' }}>
                              <TextArea label="结果补充" value={event.resultCustom || ''} onChange={v => updateHistoryEvent(event.id, 'resultCustom', v)} />
                            </div>
                          </div>

                        </div>
                      </div>
             {/* ✅ 新增：完成按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--card-border)' }}>
              <button 
                type="button" 
                onClick={() => toggleEvent(event.id)} 
                style={{ padding: '8px 24px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                ✅ 完成并收起
              </button>
            </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {historyData.events.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
              暂无生命事件记录，点击“添加事件”开始建立人物时间线。
            </p>
          )}
        </div>
      </div>
    </div>

    {/* C. 历史沉积与人格轨迹 */}
    <div className="glass-card" style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 20px', fontSize: '16px', color: 'var(--primary-color)' }}>C. 历史沉积与人格轨迹</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h4 style={{ fontSize: '14px', color: 'var(--text-main)' }}>C1. 反复出现的经历模式</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <TextArea label="反复出现的事件类型" value={historyData.deposits.repeatedPatterns || ''} onChange={v => updateDeposit('repeatedPatterns', v)} />
            <TextArea label="反复出现的关系模式" value={historyData.deposits.relationshipPatterns || ''} onChange={v => updateDeposit('relationshipPatterns', v)} />
            <TextArea label="反复出现的现实困境" value={historyData.deposits.recurringDifficulties || ''} onChange={v => updateDeposit('recurringDifficulties', v)} />
            <TextArea label="反复出现的机会与奖励" value={historyData.deposits.opportunitiesAndRewards || ''} onChange={v => updateDeposit('opportunitiesAndRewards', v)} />
            <TextArea label="长期压力来源" value={historyData.deposits.chronicStress || ''} onChange={v => updateDeposit('chronicStress', v)} />
            <TextArea label="人物对这些模式的认识" value={historyData.deposits.historicalUnderstanding || ''} onChange={v => updateDeposit('historicalUnderstanding', v)} />
          </div>
        </div>

        <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '20px' }}>
          <h4 style={{ fontSize: '14px', color: 'var(--text-main)' }}>C2. 历史形成的心理与行为沉积</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <TextArea label="核心信念" value={historyData.deposits.coreBeliefs || ''} onChange={v => updateDeposit('coreBeliefs', v)} />
            <TextArea label="长期执念" value={historyData.deposits.longTermObsession || ''} onChange={v => updateDeposit('longTermObsession', v)} />
            <TextArea label="心理边界" value={historyData.deposits.psychologicalBoundaries || ''} onChange={v => updateDeposit('psychologicalBoundaries', v)} />
            <TextArea label="防御倾向" value={historyData.deposits.defenseTendencies || ''} onChange={v => updateDeposit('defenseTendencies', v)} />
            <TextArea label="行为习惯" value={historyData.deposits.behavioralHabits || ''} onChange={v => updateDeposit('behavioralHabits', v)} />
            <TextArea label="关系模式" value={historyData.deposits.relationshipModels || ''} onChange={v => updateDeposit('relationshipModels', v)} />
            <div style={{ gridColumn: '1 / -1' }}>
              <TextArea label="风险判断方式" value={historyData.deposits.riskJudgment || ''} onChange={v => updateDeposit('riskJudgment', v)} />
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '14px', color: 'var(--text-main)' }}>C3. 人格轨迹漂移</h4>
            <button type="button" onClick={addTrajectory}
              style={{ padding: '6px 12px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              + 添加变化记录
            </button>
          </div>

          {historyData.deposits.trajectory.map((item, index) => (
            <div key={item.id} style={{ border: '1px solid var(--card-border)', borderRadius: '6px', padding: '16px', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <strong style={{ color: 'var(--primary-color)', fontSize: '13px' }}>轨迹记录 {index + 1}</strong>
                <button type="button" onClick={() => removeTrajectory(item.id)}
                  style={{ border: 'none', background: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}>删除</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <TextField label="发生时间/人生阶段" value={item.period || ''} onChange={v => updateTrajectory(item.id, 'period', v)} />
                <TextField label="相关经历" value={item.relatedExperience || ''} onChange={v => updateTrajectory(item.id, 'relatedExperience', v)} />
                <TextArea label="变化前的状态" value={item.beforeState || ''} onChange={v => updateTrajectory(item.id, 'beforeState', v)} />
                <TextArea label="变化后的状态" value={item.afterState || ''} onChange={v => updateTrajectory(item.id, 'afterState', v)} />
                <TextArea label="行为模式变化" value={item.behaviorChange || ''} onChange={v => updateTrajectory(item.id, 'behaviorChange', v)} />
                <TextArea label="动力倾向变化" value={item.engineChange || ''} onChange={v => updateTrajectory(item.id, 'engineChange', v)} />
                <TextArea label="长期保持稳定的部分" value={item.stableParts || ''} onChange={v => updateTrajectory(item.id, 'stableParts', v)} />
                <TextArea label="人物对自身变化的理解" value={item.selfUnderstanding || ''} onChange={v => updateTrajectory(item.id, 'selfUnderstanding', v)} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '14px', color: 'var(--text-main)' }}>C4. 当前仍然存在的历史影响</h4>
            <button type="button" onClick={addCurrentInfluence}
              style={{ padding: '6px 12px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              + 添加历史影响
            </button>
          </div>

          {historyData.deposits.currentInfluences.map((item, index) => (
            <div key={item.id} style={{ border: '1px solid var(--card-border)', borderRadius: '6px', padding: '16px', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <strong style={{ color: 'var(--primary-color)', fontSize: '13px' }}>历史影响 {index + 1}</strong>
                <button type="button" onClick={() => removeCurrentInfluence(item.id)}
                  style={{ border: 'none', background: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}>删除</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <TextField label="影响领域" value={item.domain || ''} onChange={v => updateCurrentInfluence(item.id, 'domain', v)} />
                <TextField label="来源事件" value={item.sourceEvent || ''} onChange={v => updateCurrentInfluence(item.id, 'sourceEvent', v)} />
                <TextArea label="当前表现" value={item.currentManifestation || ''} onChange={v => updateCurrentInfluence(item.id, 'currentManifestation', v)} />
                <TextField label="是否仍在持续" value={item.isOngoing || ''} onChange={v => updateCurrentInfluence(item.id, 'isOngoing', v)} placeholder="持续 / 间歇出现 / 已结束" />
                <TextField label="是否发生改变" value={item.hasChanged || ''} onChange={v => updateCurrentInfluence(item.id, 'hasChanged', v)} />
                <TextArea label="人物当前对此的看法" value={item.currentView || ''} onChange={v => updateCurrentInfluence(item.id, 'currentView', v)} />
              </div>
                
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)}

{/* ================= 模块 07：人物初始状态 ================= */}
          {currentModule.id === 'growth' && (() => {
            const baselineEngines = (seedLayerRef.current?.engines?.ovtde || {}) as Record<string, any>
            const currentEngines = (ovtdeData || {}) as Record<string, any>
            const baselineValue = (key: string) => Number(baselineEngines?.[key]?.val ?? 0)
            const currentValue = (key: string) => Number(currentEngines?.[key]?.val ?? 0)
            const enterRuntime = (module: string) => {
              if (stateLayer !== 'runtime') {
                switchStateLayer('runtime')
              }
              setActiveModule(module)
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div className="glass-card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '18px', flexWrap: 'wrap' }}>
                    <div style={{ maxWidth: '720px' }}>
                      <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: 'var(--text-main)' }}>种子是底色，运行态才是此刻的人</h3>
                      <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.8, color: 'var(--text-muted)' }}>
                        02–05 不再是一组永不变化的静态答案。种子记录长期倾向与初始条件；运行态记录人物在经历中形成的当前版本。
                        事件不会直接改写人物，真正进入运行态的是人物对事件的认知、归因、情绪与选择。主色调可以保持稳定，也可以缓慢漂移。
                      </p>
                    </div>
                    <div style={{ padding: '8px 12px', borderRadius: '20px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.1)', fontSize: '12px', color: 'var(--text-main)' }}>
                      当前层：{stateLayer === 'seed' ? '种子设定' : `运行态 v${runtimeInfo.version}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '18px' }}>
                    <button type="button" onClick={() => enterRuntime('engines')} style={{ padding: '8px 12px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}>调整五引擎当前值</button>
                    <button type="button" onClick={() => enterRuntime('mechanism')} style={{ padding: '8px 12px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}>调整防御机制</button>
                    <button type="button" onClick={() => enterRuntime('sandbox')} style={{ padding: '8px 12px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}>调整现实条件</button>
                    <button type="button" onClick={() => enterRuntime('individual')} style={{ padding: '8px 12px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}>调整思想钢印</button>
                    <button type="button" onClick={() => setActiveModule('history')} style={{ padding: '8px 12px', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.1)', color: 'var(--text-main)', cursor: 'pointer' }}>先回 06 记录经历 →</button>
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '24px' }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: '15px', color: 'var(--text-main)' }}>主色调</h3>
                  <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-muted)' }}>主色调是长期底色，不是唯一引擎。允许其他引擎随情境升高，但不要轻易失去主色调。</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {Object.keys(ENGINE_LABELS).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setRuntimeInfo((prev) => ({ ...prev, main_color: key }))}
                        style={{
                          padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                          border: runtimeInfo.main_color === key ? '1px solid var(--text-main)' : '1px solid var(--card-border)',
                          background: runtimeInfo.main_color === key ? 'rgba(128,128,128,0.18)' : 'transparent',
                          color: 'var(--text-main)', textAlign: 'left',
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: '13px' }}>{key} · {ENGINE_LABELS[key]}</strong>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>种子 {baselineValue(key)} → 当前 {currentValue(key)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '24px' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '15px', color: 'var(--text-main)' }}>种子 vs 当前运行态</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {Object.keys(ENGINE_LABELS).map((key) => {
                      const before = baselineValue(key)
                      const after = currentValue(key)
                      const delta = after - before
                      return (
                        <div key={key} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 92px', gap: '14px', alignItems: 'center' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-main)' }}>{key} · {ENGINE_LABELS[key]}</div>
                          <div style={{ position: 'relative', height: '10px', borderRadius: '999px', background: 'rgba(128,128,128,0.16)', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', inset: 0, width: `${Math.max(0, Math.min(100, before))}%`, background: 'rgba(128,128,128,0.45)' }} />
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, after))}%`, borderRight: '2px solid var(--text-main)' }} />
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
                            {before} → {after} {delta !== 0 ? `(${delta > 0 ? '+' : ''}${delta})` : ''}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p style={{ margin: '14px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>浅色条 = 种子基线；深色终点 = 当前运行态。</p>
                </div>

                <div className="glass-card" style={{ padding: '24px' }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: '15px', color: 'var(--text-main)' }}>记录一次成长校准</h3>
                  <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--text-muted)' }}>先把 02–05 改成“经历之后的当前值”，再填写这次变化的理由并保存。系统会写一条成长日志和状态历史，种子本身不动。</p>
                  <TextArea label="成长理由 / 人物如何理解与归因" value={growthReason} onChange={setGrowthReason} rows={3} placeholder="例如：韩立第一次真正面对修仙界的生死规则，他把这次经历归因为“资源与信息差决定生存”，因此秩序与扩张上升，但锚定没有消失..." />
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>关联生命经历（可多选）</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxHeight: '180px', overflowY: 'auto' }}>
                      {historyData.events.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>还没有生命经历，先去 06 记录。</span>}
                      {historyData.events.map((event: any) => {
                        const selected = growthEvents.includes(event.id)
                        return (
                          <label key={event.id} style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 10px', borderRadius: '16px', border: selected ? '1px solid var(--text-main)' : '1px solid var(--card-border)', fontSize: '12px', color: 'var(--text-main)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selected} onChange={() => setGrowthEvents((prev) => selected ? prev.filter((id) => id !== event.id) : [...prev, event.id])} />
                            {event.name || '未命名经历'}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => void handleRuntimeSave()} style={{ padding: '9px 18px', borderRadius: '7px', background: 'var(--primary-color)', color: 'var(--primary-text)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      保存运行态并记录成长
                    </button>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>只有发生变化时才会新增日志。</span>
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)' }}>成长日志</h3>
                    {onNavigate && (
                      <button type="button" onClick={() => onNavigate('events')} style={{ padding: '6px 10px', borderRadius: '6px', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--card-border)', cursor: 'pointer', fontSize: '12px' }}>
                        大动作修改 → 去事件管理
                      </button>
                    )}
                  </div>
                  {runtimeInfo.growth_log.length === 0 ? (
                    <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>还没有成长校准。人物会保持种子状态，直到你确认第一次变化。</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
                      {[...runtimeInfo.growth_log].reverse().map((entry) => (
                        <div key={entry.id} style={{ padding: '14px 16px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{entry.reason || '成长校准'}</strong>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(entry.at).toLocaleString()} · 主色调 {entry.main_color}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                            {entry.changed_modules?.map((item: string) => <span key={item} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(128,128,128,0.14)', color: 'var(--text-muted)' }}>{item}</span>)}
                            {Object.entries(entry.engine_deltas || {}).map(([key, delta]: [string, any]) => <span key={key} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--card-border)', color: 'var(--text-main)' }}>{key} {Number(delta) > 0 ? '+' : ''}{delta}</span>)}
                          </div>
                          {entry.source_event_ids?.length > 0 && (
                            <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                              关联经历：{entry.source_event_ids.map((id: string) => historyData.events.find((event: any) => event.id === id)?.name || id).join('、')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

{currentModule.id === 'initial' && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

    <div className="glass-card" style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: 'var(--primary-color)' }}>人物初始状态</h3>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        本模块记录人物进入世界模拟时的当前状态。它是一个状态快照，不是人物的永久人格定义。
        所有信息均为人物当前状态的独立记录，不自动从前六个模块推算。
      </p>
    </div>

    {/* A. 内部状态 */}
    <div className="glass-card" style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 20px', fontSize: '16px', color: 'var(--text-main)' }}>A. 内部状态</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h4 style={{ fontSize: '14px', color: 'var(--primary-color)' }}>1. 当前能量</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <TextField label="当前能量状态" value={initialData.energyState} onChange={v => updateInitial('energyState', v)} placeholder="例如：充足、一般、偏低、枯竭..." />
            <TextField label="状态表现描述" value={initialData.energyDescription} onChange={v => updateInitial('energyDescription', v)} />
            <TextArea label="主要能量消耗来源" value={initialData.energyConsumption} onChange={v => updateInitial('energyConsumption', v)} />
            <TextArea label="能量补充来源" value={initialData.energyRecovery} onChange={v => updateInitial('energyRecovery', v)} />
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '14px', color: 'var(--primary-color)' }}>2. 当前压力</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <TextField label="当前压力状态" value={initialData.pressureState} onChange={v => updateInitial('pressureState', v)} />
            <TextField label="压力持续时间" value={initialData.pressureDuration} onChange={v => updateInitial('pressureDuration', v)} />
            <TextArea label="主要压力来源" value={initialData.pressureSource} onChange={v => updateInitial('pressureSource', v)} />
            <TextArea label="压力对行为的影响" value={initialData.pressureImpact} onChange={v => updateInitial('pressureImpact', v)} />
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '14px', color: 'var(--primary-color)' }}>3. 当前负荷</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <TextField label="当前负荷状态" value={initialData.loadState} onChange={v => updateInitial('loadState', v)} />
            <TextField label="是否超负荷" value={initialData.isOverloaded} onChange={v => updateInitial('isOverloaded', v)} placeholder="未超负荷 / 接近上限 / 已超负荷" />
            <TextArea label="当前承担的责任" value={initialData.responsibilities} onChange={v => updateInitial('responsibilities', v)} />
            <TextArea label="任务数量或复杂程度" value={initialData.taskComplexity} onChange={v => updateInitial('taskComplexity', v)} />
            <div style={{ gridColumn: '1 / -1' }}>
              <TextArea label="负荷来源" value={initialData.loadSource} onChange={v => updateInitial('loadSource', v)} />
            </div>
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '14px', color: 'var(--primary-color)' }}>4. 当前情绪</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TagGroup
              label="主要情绪（可多选）"
              options={['平静', '愉悦', '兴奋', '期待', '焦虑', '恐惧', '愤怒', '悲伤', '失望', '羞耻', '内疚', '厌倦', '麻木', '困惑']}
              selected={initialData.primaryEmotion}
              onChange={v => updateInitial('primaryEmotion', v)}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <TextField label="次要情绪" value={initialData.secondaryEmotion} onChange={v => updateInitial('secondaryEmotion', v)} />
              <TextField label="情绪持续时间" value={initialData.emotionDuration} onChange={v => updateInitial('emotionDuration', v)} />
              <TextArea label="情绪触发来源" value={initialData.emotionTrigger} onChange={v => updateInitial('emotionTrigger', v)} />
              <TextArea label="情绪表现方式" value={initialData.emotionManifestation} onChange={v => updateInitial('emotionManifestation', v)} />
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* B. 行动状态 */}
    <div className="glass-card" style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 20px', fontSize: '16px', color: 'var(--text-main)' }}>B. 行动状态</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h4 style={{ fontSize: '14px', color: 'var(--primary-color)' }}>1. 当前主要困境</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <TextArea label="当前主要困境" value={initialData.mainDilemma} onChange={v => updateInitial('mainDilemma', v)} />
            <TextField label="困境所属领域" value={initialData.dilemmaDomain} onChange={v => updateInitial('dilemmaDomain', v)} />
            <TextArea label="困境形成原因" value={initialData.dilemmaCause} onChange={v => updateInitial('dilemmaCause', v)} />
            <TextField label="困境发展程度" value={initialData.dilemmaProgress} onChange={v => updateInitial('dilemmaProgress', v)} />
            <TextField label="人物是否意识到困境" value={initialData.dilemmaAwareness} onChange={v => updateInitial('dilemmaAwareness', v)} />
            <TextArea label="人物当前应对方式" value={initialData.dilemmaResponse} onChange={v => updateInitial('dilemmaResponse', v)} />
          </div>
        </div>

        <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '14px', color: 'var(--primary-color)' }}>2. 当前主要目标</h4>
            <button type="button" onClick={addInitialGoal}
              style={{ padding: '6px 12px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              + 添加目标
            </button>
          </div>

          {initialGoals.map((goal, index) => (
            <div key={goal.id} style={{ border: '1px solid var(--card-border)', borderRadius: '6px', padding: '16px', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--primary-color)' }}>目标 {index + 1}</strong>
                <button type="button" onClick={() => removeInitialGoal(goal.id)}
                  style={{ border: 'none', background: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}>删除</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <TextField label="目标内容" value={goal.name} onChange={v => updateInitialGoal(goal.id, 'name', v)} />
                <TextField label="优先级" value={goal.priority} onChange={v => updateInitialGoal(goal.id, 'priority', v)} placeholder="主要目标 / 次要目标 / 暂缓目标" />
                <TextArea label="目标形成原因" value={goal.reason} onChange={v => updateInitialGoal(goal.id, 'reason', v)} />
                <TextArea label="希望实现的结果" value={goal.expectedResult} onChange={v => updateInitialGoal(goal.id, 'expectedResult', v)} />
                <TextArea label="当前采取的行动" value={goal.currentAction} onChange={v => updateInitialGoal(goal.id, 'currentAction', v)} />
                <TextArea label="当前阻碍" value={goal.obstacles} onChange={v => updateInitialGoal(goal.id, 'obstacles', v)} />
                <div style={{ gridColumn: '1 / -1' }}>
                  <TextArea label="自定义补充" value={goal.custom} onChange={v => updateInitialGoal(goal.id, 'custom', v)} />
                </div>
              </div>
            </div>
          ))}
          {initialGoals.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>暂无目标记录，点击上方添加。</p>}
        </div>

        <div style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '20px' }}>
          <h4 style={{ fontSize: '14px', color: 'var(--primary-color)' }}>3. 当前主导引擎</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <RadioGroup label="当前主导引擎" options={['O', 'V', 'T', 'D', 'E']} value={initialData.primaryEngine} onChange={v => updateInitial('primaryEngine', v)} />
            <RadioGroup label="次要引擎" options={['无明确次要引擎', 'O', 'V', 'T', 'D', 'E']} value={initialData.secondaryEngine} onChange={v => updateInitial('secondaryEngine', v)} />
            <RadioGroup label="引擎运行关系" options={['单引擎主导', '双引擎交替主导（振荡）', '多引擎平衡', '其他/自定义']} value={initialData.engineRelation} onChange={v => updateInitial('engineRelation', v)} />
            <TextArea label="当前引擎运行表现" value={initialData.engineManifestation} onChange={v => updateInitial('engineManifestation', v)} />
            <TextArea label="当前引擎的触发因素" value={initialData.engineTrigger} onChange={v => updateInitial('engineTrigger', v)} />
            <TextArea label="引擎运行自定义补充" value={initialData.engineCustom} onChange={v => updateInitial('engineCustom', v)} />
          </div>
        </div>
      </div>
    </div>

    {/* C. 外部状态 */}
    <div className="glass-card" style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 20px', fontSize: '16px', color: 'var(--text-main)' }}>C. 外部状态</h3>

      <div style={{ borderBottom: '1px dashed var(--card-border)', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: '14px', color: 'var(--primary-color)' }}>1. 当前关系状态</h4>
          <button type="button" onClick={addInitialRelation}
            style={{ padding: '6px 12px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            + 添加关系
          </button>
        </div>

        {initialRelations.map((rel, index) => (
          <div key={rel.id} style={{ border: '1px solid var(--card-border)', borderRadius: '6px', padding: '16px', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <strong style={{ fontSize: '13px', color: 'var(--primary-color)' }}>关系对象 {index + 1}</strong>
              <button type="button" onClick={() => removeInitialRelation(rel.id)}
                style={{ border: 'none', background: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}>删除</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <TextField label="关系对象" value={rel.person} onChange={v => updateInitialRelation(rel.id, 'person', v)} />
              <TextField label="关系类型" value={rel.type} onChange={v => updateInitialRelation(rel.id, 'type', v)} placeholder="伴侣、亲属、朋友、同事、敌对者..." />
              <TextField label="关系性质" value={rel.nature} onChange={v => updateInitialRelation(rel.id, 'nature', v)} />
              <TextField label="关系稳定性" value={rel.stability} onChange={v => updateInitialRelation(rel.id, 'stability', v)} />
              <TextArea label="主要冲突" value={rel.conflict} onChange={v => updateInitialRelation(rel.id, 'conflict', v)} />
              <TextArea label="关系支持" value={rel.support} onChange={v => updateInitialRelation(rel.id, 'support', v)} />
              <TextArea label="人物主观感受" value={rel.subjectiveFeeling} onChange={v => updateInitialRelation(rel.id, 'subjectiveFeeling', v)} />
              <TextArea label="自定义补充" value={rel.custom} onChange={v => updateInitialRelation(rel.id, 'custom', v)} />
            </div>
          </div>
        ))}
        {initialRelations.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>暂无关系记录。</p>}
      </div>

      <div style={{ paddingTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: '14px', color: 'var(--primary-color)' }}>2. 当前资源状态</h4>
          <button type="button" onClick={addInitialResource}
            style={{ padding: '6px 12px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            + 添加资源
          </button>
        </div>

        {initialResources.map((resource, index) => (
          <div key={resource.id} style={{ border: '1px solid var(--card-border)', borderRadius: '6px', padding: '16px', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <strong style={{ fontSize: '13px', color: 'var(--primary-color)' }}>资源 {index + 1}</strong>
              <button type="button" onClick={() => removeInitialResource(resource.id)}
                style={{ border: 'none', background: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}>删除</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <TextField label="资源名称" value={resource.name} onChange={v => updateInitialResource(resource.id, 'name', v)} />
              <TextArea label="当前拥有的资源" value={resource.owned} onChange={v => updateInitialResource(resource.id, 'owned', v)} />
              <TextArea label="可调用的外部资源" value={resource.external} onChange={v => updateInitialResource(resource.id, 'external', v)} />
              <TextArea label="资源限制" value={resource.limitation} onChange={v => updateInitialResource(resource.id, 'limitation', v)} />
              <TextField label="当前最紧缺的资源" value={resource.scarcity} onChange={v => updateInitialResource(resource.id, 'scarcity', v)} />
              <TextField label="资源稳定性" value={resource.stability} onChange={v => updateInitialResource(resource.id, 'stability', v)} />
              <div style={{ gridColumn: '1 / -1' }}>
                <TextArea label="资源对当前行动的影响" value={resource.impact} onChange={v => updateInitialResource(resource.id, 'impact', v)} />
                <div style={{ marginTop: '12px' }}>
                  <TextArea label="自定义补充" value={resource.custom} onChange={v => updateInitialResource(resource.id, 'custom', v)} />
                </div>
              </div>
            </div>
          </div>
        ))}
        {initialResources.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>暂无资源记录。</p>}
      </div>
    </div>

              {/* D. 初始状态快照元信息 */}
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: '16px', color: 'var(--text-main)' }}>D. 初始状态快照信息</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <TextField label="状态记录名称" value={initialData.snapshotName} onChange={v => updateInitial('snapshotName', v)} placeholder="例如：故事开始时 / 第一章初始状态" />
                  <TextField label="状态记录时间" value={initialData.snapshotTime} onChange={v => updateInitial('snapshotTime', v)} placeholder="填写故事内时间或现实记录时间" />
                  <TextField label="人物所处人生阶段" value={initialData.lifeStage} onChange={v => updateInitial('lifeStage', v)} />
                  <div style={{ gridColumn: '1 / -1' }}>
                    <TextArea label="当前状态总体描述" value={initialData.overallDescription} onChange={v => updateInitial('overallDescription', v)} rows={3} />
                    <div style={{ marginTop: '12px' }}>
                      <TextArea label="自定义备注" value={initialData.snapshotNotes} onChange={v => updateInitial('snapshotNotes', v)} rows={2} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </section>
      </main>
                       {/* ✅ 全局事件导入弹窗 */}
      {isEventImportModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)' }}>从全局事件库导入</h3>
              <button onClick={() => setIsEventImportModalOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {globalEvents.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>该世界暂无 05 事件</div>
              ) : (
                globalEvents.map(ge => (
                  <div key={ge.id} style={{ padding: '16px', border: '1px solid var(--card-border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{ge.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        ⏳ {ge.story_time || '无时间'} | {ge.polarity} · {ge.intensity}
                      </div>
                    </div>
                    <button onClick={() => handleImportGlobalEvent(ge)}
                      style={{ padding: '6px 16px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                      导入
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}