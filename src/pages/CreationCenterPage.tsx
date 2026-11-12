import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Gamepad2,
  Globe2,
  History,
  Link2,
  NotebookPen,
  PenLine,
  PlayCircle,
  Route,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { API_ORIGIN } from '../api/config'
import { listStories } from '../api/writing'
import { getAllWorlds } from '../services/worldService'
import type { ProductKey } from '../product/types'

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

type Scene = {
  product: ProductKey
  number: string
  title: string
  description: string
  action: string
  icon: LucideIcon
}

type Tool = {
  page: CreationToolKey
  number: string
  label: string
  icon: LucideIcon
}

type Asset = {
  key: CreationAssetKey
  label: string
  unit: string
}

function sceneCopy(lang: Lang): Scene[] {
  return lang === 'zh'
    ? [
        { product: 'game', number: '01', title: '游戏创作', description: '构建世界、角色、规则与多结局游戏。', action: '进入创作', icon: Gamepad2 },
        { product: 'literature', number: '02', title: '文学创作', description: '人物塑造、关系和故事构思中心，保留模拟作为辅助推演，不改变完整写作能力。', action: '进入创作', icon: BookOpen },
        { product: 'companion', number: '03', title: 'AI 伴侣制作与体验', description: '创建角色、设定关系与长期互动。', action: '进入空间', icon: Sparkles },
        { product: 'diary', number: '04', title: '日记与传记', description: '记录本人及他人的人生、关系、经历与来源证据，生成时间线与传记。', action: '进入空间', icon: NotebookPen },
      ]
    : [
        { product: 'game', number: '01', title: 'Game Creation', description: 'Build worlds, characters, rules, and multi-ending games.', action: 'Start creating', icon: Gamepad2 },
        { product: 'literature', number: '02', title: 'Literature Creation', description: 'Character building, relationships, and story ideation; simulation remains an optional aid without limiting full writing.', action: 'Start creating', icon: BookOpen },
        { product: 'companion', number: '03', title: 'AI Companion Creation & Experience', description: 'Create personas, define characters, and build long-term interaction.', action: 'Enter space', icon: Sparkles },
        { product: 'diary', number: '04', title: 'Diary & Biography', description: "Record your own life and others' relationships, experiences, and source evidence; generate timelines and biographies.", action: 'Enter space', icon: NotebookPen },
      ]
}

function toolCopy(lang: Lang): Tool[] {
  return lang === 'zh'
    ? [
        { page: 'world-management', number: '02', label: '世界管理', icon: Globe2 },
        { page: 'character-management', number: '03', label: '人物管理', icon: UserRound },
        { page: 'relationships', number: '04', label: '关系与组织', icon: Link2 },
        { page: 'events', number: '05', label: '事件管理', icon: CalendarDays },
        { page: 'timeline', number: '06', label: '时间线', icon: History },
        { page: 'simulation', number: '07', label: '模拟运行', icon: PlayCircle },
        { page: 'storyline', number: '', label: '故事线管理', icon: Route },
        { page: 'writing', number: '08', label: '写作辅助', icon: PenLine },
      ]
    : [
        { page: 'world-management', number: '02', label: 'World Management', icon: Globe2 },
        { page: 'character-management', number: '03', label: 'Character Management', icon: UserRound },
        { page: 'relationships', number: '04', label: 'Relationships & Organizations', icon: Link2 },
        { page: 'events', number: '05', label: 'Event Management', icon: CalendarDays },
        { page: 'timeline', number: '06', label: 'Timeline', icon: History },
        { page: 'simulation', number: '07', label: 'Simulation', icon: PlayCircle },
        { page: 'storyline', number: '', label: 'Storyline Management', icon: Route },
        { page: 'writing', number: '08', label: 'Writing Assistant', icon: PenLine },
      ]
}

function assetCopy(lang: Lang): Asset[] {
  return lang === 'zh'
    ? [
        { key: 'worlds', label: '我的世界', unit: '个世界' },
        { key: 'characters', label: '我的 OC', unit: '位人物' },
        { key: 'works', label: '我的作品', unit: '篇作品' },
      ]
    : [
        { key: 'worlds', label: 'My worlds', unit: 'worlds' },
        { key: 'characters', label: 'My OCs', unit: 'characters' },
        { key: 'works', label: 'My works', unit: 'works' },
      ]
}

type AssetCounts = Record<CreationAssetKey, number | null>

export default function CreationCenterPage({
  lang,
  onOpenScene,
  onOpenTool,
  onOpenAsset,
}: {
  lang: Lang
  onOpenScene: (product: ProductKey) => void
  onOpenTool: (page: CreationToolKey) => void
  onOpenAsset: (asset: CreationAssetKey) => void
}) {
  const [counts, setCounts] = useState<AssetCounts>({ worlds: null, characters: null, works: null })

  useEffect(() => {
    let cancelled = false
    void getAllWorlds(false)
      .then((worlds) => {
        if (!cancelled) setCounts((current) => ({ ...current, worlds: worlds.length }))
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
    void listStories()
      .then((stories) => {
        if (!cancelled && Array.isArray(stories)) {
          setCounts((current) => ({ ...current, works: stories.length }))
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const scenes = sceneCopy(lang)
  const tools = toolCopy(lang)
  const assets = assetCopy(lang)
  const number = (value: number | null) => (value === null ? '—' : String(value))

  return (
    <div className="cc-content">
      <section className="cc-hero">
        <div className="cc-hero-copy">
          <div className="cc-eyebrow">Creation Center</div>
          <h1>{lang === 'zh' ? '创作中心' : 'Creation Center'}</h1>
          <p className="cc-hero-subtitle">
            {lang === 'zh' ? '选择创作场景，开始你的创作。' : 'Choose a creation scene and begin.'}
          </p>
        </div>
        <div className="cc-hero-meta" aria-hidden="true">
          <strong>04</strong>
          <span>{lang === 'zh' ? '创作场景 · 独立工作台' : 'Creative scenes · Separate workspaces'}</span>
        </div>
      </section>

      <section className="cc-scenes-grid" aria-label={lang === 'zh' ? '创作场景' : 'Creation scenes'}>
        {scenes.map((scene) => {
          const Icon = scene.icon
          return (
            <button
              key={scene.product}
              type="button"
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
            </button>
          )
        })}
      </section>

      <section className="cc-section">
        <div className="cc-section-head">
          <h2>{lang === 'zh' ? '专业创作工具' : 'Professional tools'}</h2>
          <p>{lang === 'zh' ? '统一模块 · 按场景权限开放' : 'Unified modules · Access follows scene permissions'}</p>
        </div>
        <div className="cc-tools-grid">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <button
                key={tool.page}
                type="button"
                className="cc-tool"
                onClick={() => onOpenTool(tool.page)}
                aria-label={tool.label}
              >
                {tool.number && <span className="cc-tool-number">{tool.number}</span>}
                <span className="cc-tool-icon"><Icon aria-hidden="true" strokeWidth={1.6} /></span>
                <span className="cc-tool-name">{tool.label}</span>
                <ArrowUpRight className="cc-tool-arrow" aria-hidden="true" strokeWidth={1.8} />
              </button>
            )
          })}
        </div>
      </section>

      <section className="cc-section">
        <div className="cc-section-head">
          <h2>{lang === 'zh' ? '我的创作资产' : 'My creative assets'}</h2>
          <p>{lang === 'zh' ? '当前系统数据' : 'Live system data'}</p>
        </div>
        <div className="cc-assets-grid">
          {assets.map((asset) => (
            <button
              key={asset.key}
              type="button"
              className="cc-asset"
              onClick={() => onOpenAsset(asset.key)}
              aria-label={`${asset.label}: ${number(counts[asset.key])} ${asset.unit}`}
            >
              <span className="cc-asset-copy">
                <span className="cc-asset-label">{asset.label}</span>
                <span className="cc-asset-value" aria-live="polite">
                  {number(counts[asset.key])} <small>{asset.unit}</small>
                </span>
              </span>
              <ArrowUpRight className="cc-asset-arrow" aria-hidden="true" strokeWidth={1.8} />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
