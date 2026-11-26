import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  FolderKanban,
  Gamepad2,
  Globe2,
  NotebookPen,
  PanelsTopLeft,
  Plus,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { API_ORIGIN } from '../api/config'
import { listWorks, type CreativeWork } from '../api/creativeWorks'
import { resolveMediaUrl } from '../api/media'
import { getAllWorlds } from '../services/worldService'
import type { ProductKey } from '../product/types'
import { LiquidGlass } from '../components/LiquidGlass'
import './../styles/creation-center.css'

type Lang = 'zh' | 'en'

export type CreationToolKey =
  | 'world-management'
  | 'character-management'
  | 'relationships'
  | 'events'
  | 'timeline'
  | 'simulation'
  | 'storyline'
  | 'writing'

export type CreationAssetKey = 'worlds' | 'characters' | 'works'

export type CreationScene = ProductKey | 'comic'

type Scene = {
  product: CreationScene
  number: string
  title: string
  description: string
  action: string
  icon: LucideIcon
}

type Asset = {
  key: CreationAssetKey
  label: string
  unit: string
}

type WorldLite = { id: string; name: string; product_scene?: string | null; updated_at?: string }

function sceneCopy(lang: Lang): Scene[] {
  return lang === 'zh'
    ? [
        { product: 'game', number: '01', title: '游戏创作', description: '构建世界、角色、规则与多结局游戏。', action: '进入创作', icon: Gamepad2 },
        { product: 'literature', number: '02', title: '文学创作', description: '人物塑造、关系和故事构思中心，保留模拟作为辅助推演，不改变完整写作能力。', action: '进入创作', icon: BookOpen },
        { product: 'comic', number: '03', title: '漫画创作', description: '漫画作品、章节、页面与连续画格，支持长条漫画与分镜管理。', action: '进入创作', icon: PanelsTopLeft },
        { product: 'companion', number: '04', title: '虚拟角色制作与体验', description: '创建角色、设定关系与长期互动。', action: '进入空间', icon: Sparkles },
        { product: 'diary', number: '05', title: '日记与传记', description: '记录本人及他人的人生、关系、经历与来源证据，生成时间线与传记。', action: '进入空间', icon: NotebookPen },
      ]
    : [
        { product: 'game', number: '01', title: 'Game Creation', description: 'Build worlds, characters, rules, and multi-ending games.', action: 'Start creating', icon: Gamepad2 },
        { product: 'literature', number: '02', title: 'Literature Creation', description: 'Character building, relationships, and story ideation; simulation remains an optional aid without limiting full writing.', action: 'Start creating', icon: BookOpen },
        { product: 'comic', number: '03', title: 'Comic Creation', description: 'Comic works, chapters, pages, and sequential panels; long-strip comics and storyboard management.', action: 'Start creating', icon: PanelsTopLeft },
        { product: 'companion', number: '04', title: 'AI Companion Creation & Experience', description: 'Create personas, define characters, and build long-term interaction.', action: 'Enter space', icon: Sparkles },
        { product: 'diary', number: '05', title: 'Diary & Biography', description: "Record your own life and others' relationships, experiences, and source evidence; generate timelines and biographies.", action: 'Enter space', icon: NotebookPen },
      ]
}

function assetCopy(lang: Lang): Asset[] {
  return lang === 'zh'
    ? [
        { key: 'worlds', label: '世界', unit: '个' },
        { key: 'characters', label: '人物', unit: '位' },
        { key: 'works', label: '作品', unit: '部' },
      ]
    : [
        { key: 'worlds', label: 'Worlds', unit: '' },
        { key: 'characters', label: 'Characters', unit: '' },
        { key: 'works', label: 'Works', unit: '' },
      ]
}

type AssetCounts = Record<CreationAssetKey, number | null>

const SCENE_LABEL: Record<string, string> = {
  game: '游戏创作',
  literature: '文学创作',
  companion: '虚拟角色',
  diary: '日记与传记',
  comic: '漫画创作',
}

export default function CreationCenterPage({
  lang,
  onOpenScene,
  onOpenTool,
  onOpenAsset,
  onOpenWorld,
  onOpenLibrary,
}: {
  lang: Lang
  onOpenScene: (product: CreationScene) => void
  onOpenTool: (page: CreationToolKey) => void
  onOpenAsset: (asset: CreationAssetKey) => void
  /** 继续创作：直接进入某个世界（缺省时退回世界列表）。 */
  onOpenWorld?: (id: string) => void
  /** 打开创作者资产库（收纳入口）。 */
  onOpenLibrary?: () => void
}) {
  const [counts, setCounts] = useState<AssetCounts>({ worlds: null, characters: null, works: null })
  const [recentWorks, setRecentWorks] = useState<CreativeWork[]>([])
  const [worlds, setWorlds] = useState<WorldLite[]>([])

  useEffect(() => {
    let cancelled = false
    void getAllWorlds(false)
      .then((list) => {
        if (cancelled) return
        setCounts((current) => ({ ...current, worlds: list.length }))
        setWorlds((list as WorldLite[]).slice(0, 3))
      })
      .catch(() => undefined)
    void fetch(`${API_ORIGIN}/api/characters`)
      .then((response) => (response.ok ? response.json() : []))
      .then((characters) => {
        if (!cancelled && Array.isArray(characters)) {
          setCounts((current) => ({ ...current, characters: characters.length }))
        }
      })
      .catch(() => undefined)
    void listWorks()
      .then((works) => {
        if (!cancelled && Array.isArray(works)) {
          setCounts((current) => ({ ...current, works: works.length }))
          setRecentWorks(works.slice(0, 3))
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const scenes = useMemo(() => sceneCopy(lang), [lang])
  const assets = useMemo(() => assetCopy(lang), [lang])
  const number = (value: number | null) => (value === null ? '—' : String(value))
  const hasRecent = worlds.length > 0 || recentWorks.length > 0

  const quickActions = lang === 'zh'
    ? [
        { key: 'world', label: '新建世界', icon: Globe2, run: () => onOpenTool('world-management') },
        { key: 'character', label: '新建人物', icon: UserRound, run: () => onOpenTool('character-management') },
        { key: 'work', label: '新建作品', icon: Plus, run: () => onOpenAsset('works') },
        { key: 'library', label: '创作资产库', icon: FolderKanban, run: () => (onOpenLibrary ? onOpenLibrary() : onOpenAsset('worlds')) },
      ]
    : [
        { key: 'world', label: 'New world', icon: Globe2, run: () => onOpenTool('world-management') },
        { key: 'character', label: 'New character', icon: UserRound, run: () => onOpenTool('character-management') },
        { key: 'work', label: 'New work', icon: Plus, run: () => onOpenAsset('works') },
        { key: 'library', label: 'Creator library', icon: FolderKanban, run: () => (onOpenLibrary ? onOpenLibrary() : onOpenAsset('worlds')) },
      ]

  return (
    <div className="cc-content">
      <section className="cc-hero">
        <div className="cc-hero-copy">
          <div className="cc-eyebrow">Creation Center</div>
          <h1>{lang === 'zh' ? '创作中心' : 'Creation Center'}</h1>
          <p className="cc-hero-subtitle">
            {lang === 'zh'
              ? '先选创作场景开始；专业模块在各自工作台里，不在这里平铺。'
              : 'Pick a scene to start; professional modules live inside each workspace.'}
          </p>
        </div>
        <div className="cc-hero-meta" aria-hidden="true">
          <strong>{String(scenes.length).padStart(2, '0')}</strong>
          <span>{lang === 'zh' ? '创作场景 · 独立工作台' : 'Creative scenes · Separate workspaces'}</span>
        </div>
      </section>

      <section className="cc-scenes-grid" aria-label={lang === 'zh' ? '创作场景' : 'Creation scenes'}>
        {scenes.map((scene) => {
          const Icon = scene.icon
          return (
            <LiquidGlass
              key={scene.product}
              className="cc-scene-card"
              onClick={() => onOpenScene(scene.product)}
              aria-label={`${scene.number} ${scene.title} · ${scene.action}`}
            >
              <span className="cc-scene-top">
                <span className="cc-scene-number">{scene.number}</span>
                <span className="cc-scene-icon"><Icon aria-hidden="true" strokeWidth={1.6} /></span>
              </span>
              <span className="cc-scene-title">{scene.title}</span>
              <span className="cc-scene-desc">{scene.description}</span>
              <span className="cc-scene-action">
                <span>{scene.action}</span>
                <ArrowUpRight aria-hidden="true" strokeWidth={1.8} />
              </span>
            </LiquidGlass>
          )
        })}
      </section>

      {hasRecent && (
        <section className="cc-section">
          <div className="cc-section-head">
            <h2>{lang === 'zh' ? '最近创作' : 'Continue creating'}</h2>
            <p>{lang === 'zh' ? '直接回到上次的世界或作品' : 'Jump back into your latest world or work'}</p>
          </div>
          <div className="cc-recent-row">
            {worlds.map((world) => (
              <button
                key={`w-${world.id}`}
                type="button"
                className="cc-recent-item"
                onClick={() => (onOpenWorld ? onOpenWorld(world.id) : onOpenTool('world-management'))}
              >
                <span className="cc-recent-badge">{lang === 'zh' ? '世界' : 'World'}</span>
                <span className="cc-recent-copy">
                  <strong>{world.name}</strong>
                  <small>{SCENE_LABEL[world.product_scene || ''] || (lang === 'zh' ? '创作世界' : 'Creative world')}</small>
                </span>
                <ArrowUpRight size={12} aria-hidden="true" />
              </button>
            ))}
            {recentWorks.map((work) => (
              <button key={`k-${work.id}`} type="button" className="cc-recent-item" onClick={() => onOpenAsset('works')}>
                <span className="cc-recent-cover">
                  {work.cover_url ? <img src={resolveMediaUrl(work.cover_url)} alt="" loading="lazy" /> : <BookOpen size={15} strokeWidth={1.3} aria-hidden="true" />}
                </span>
                <span className="cc-recent-copy">
                  <strong>{work.title}</strong>
                  <small>{SCENE_LABEL[work.scene] || work.category}</small>
                </span>
                <ArrowUpRight size={12} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="cc-section">
        <div className="cc-section-head">
          <h2>{lang === 'zh' ? '快捷操作' : 'Quick actions'}</h2>
          <p>{lang === 'zh' ? '常用起点 · 具体管理在各工作台内' : 'Common starting points · manage inside workspaces'}</p>
        </div>
        <div className="cc-quick-row">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button key={action.key} type="button" className="cc-quick" onClick={action.run}>
                <Icon aria-hidden="true" strokeWidth={1.6} />
                <span>{action.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="cc-asset-line" aria-label={lang === 'zh' ? '创作资产摘要' : 'Creative asset summary'}>
        <span className="cc-asset-line-label">{lang === 'zh' ? '创作资产' : 'Assets'}</span>
        {assets.map((asset) => (
          <button key={asset.key} type="button" className="cc-asset-chip" onClick={() => onOpenAsset(asset.key)}>
            {asset.label}
            <strong aria-live="polite">{number(counts[asset.key])}<small>{asset.unit}</small></strong>
          </button>
        ))}
        <span className="cc-asset-line-hint">
          {lang === 'zh' ? '计数来自服务端 · 作品与原子资产分开统计' : 'Counts from server · works and assets counted separately'}
        </span>
      </section>
    </div>
  )
}
