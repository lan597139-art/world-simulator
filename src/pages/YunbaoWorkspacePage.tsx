import { useEffect, useState } from 'react'
import { Bot, BookOpen, Compass, FileText, Globe2, HeartHandshake, Landmark, LibraryBig, Map, PenLine, Sparkles, UsersRound, Workflow } from 'lucide-react'
import { getYunbao, type YunbaoProfile } from '../api/yunbao'
import { YunbaoProfilePanel } from '../components/YunbaoProfile'

const modules = [
  { page: 'world-management', title: '世界管理', desc: '云宝自己的世界、设定与工作空间', icon: Globe2 },
  { page: 'character-management', title: '人物管理', desc: '人物档案、成长与关系网络', icon: UsersRound },
  { page: 'relationships', title: '关系与组织', desc: '人物关系、组织与阵营', icon: HeartHandshake },
  { page: 'events', title: '事件管理', desc: '世界事件、互动与因果链', icon: Landmark },
  { page: 'writing', title: '写作工作台', desc: '章节、叙事与长篇创作', icon: PenLine },
  { page: 'diary', title: '日记与传记', desc: '私人日记、人生经历与用户传记', icon: BookOpen },
  { page: 'storyline', title: '故事线', desc: '树状故事结构与分支', icon: LibraryBig },
  { page: 'simulation', title: '模拟运行', desc: '世界推演与多路径沙盒', icon: Compass },
  { page: 'world-structure', title: '世界结构', desc: '地点、组织、资源与规则', icon: Map },
  { page: 'world-data', title: '世界设定', desc: '背景、规则与资料库', icon: FileText },
  { page: 'memories', title: '记忆管理', desc: '云宝的长期记忆与来源', icon: Sparkles },
  { page: 'personas', title: '人格编辑器', desc: '云宝身份、表达与成长经历', icon: Bot },
  { page: 'yunbao-seed', title: '人物种子编辑器', desc: '动力结构、防御、思想钢印与生命经历', icon: Workflow },
]

export default function YunbaoWorkspacePage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [profile, setProfile] = useState<YunbaoProfile | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void getYunbao().then(setProfile).catch((err) => setError(String(err?.message || err)))
  }, [])

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 48, height: 48, borderRadius: 13, display: 'grid', placeItems: 'center', fontSize: 23, background: 'color-mix(in srgb, var(--primary-color) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--primary-color) 26%, transparent)' }}>☁</div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>云宝工作台</h1>
          <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            云宝拥有游戏创作、文学创作、日记与传记的全部专业能力。人格与工作台独立于 AI 伴侣产品。
          </p>
        </div>
        <span style={{ padding: '5px 9px', borderRadius: 10, border: `1px solid ${profile?.can_edit ? 'var(--primary-color)' : 'var(--card-border)'}`, color: profile?.can_edit ? 'var(--primary-color)' : 'var(--text-muted)', fontSize: 10 }}>
          {profile ? (profile.can_edit ? '开发者 · 可编辑' : '访客 · 只读') : '读取权限…'}
        </span>
      </header>

      {error && <div style={{ padding: 10, border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: 8, fontSize: 12 }}>{error}</div>}
      {profile && !profile.can_edit && (
        <div style={{ padding: 10, border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)', background: 'rgba(128,128,128,.06)' }}>
          当前账号只能查看云宝工作台。所有写入、编辑与状态切换仅限开发者「兰哆哆」。
        </div>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 9 }}>
        {modules.map((item) => {
          const Icon = item.icon
          return (
            <button key={item.page} type="button" onClick={() => onNavigate(item.page)} style={{
              display: 'flex', alignItems: 'flex-start', gap: 9, padding: 12, textAlign: 'left',
              border: '1px solid var(--card-border)', borderRadius: 10, background: 'var(--card-bg)',
              color: 'var(--text-main)', cursor: 'pointer',
            }}>
              <Icon size={17} strokeWidth={1.6} style={{ marginTop: 1, color: 'var(--primary-color)' }} />
              <span>
                <strong style={{ display: 'block', fontSize: 12.5 }}>{item.title}</strong>
                <span style={{ display: 'block', marginTop: 3, fontSize: 10, lineHeight: 1.55, color: 'var(--text-muted)' }}>{item.desc}</span>
              </span>
            </button>
          )
        })}
      </section>

      <YunbaoProfilePanel embedded onOpenSeedEditor={() => onNavigate('yunbao-seed')} />
    </div>
  )
}
