import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Heart, Image as ImageIcon, Search, X } from 'lucide-react'
import { OFFICIAL_BACKGROUNDS, type OfficialBackground } from '../../data/officialBackgrounds'
import { tr } from '../../i18n'
import '../../styles/official-assets.css'

type Lang = 'zh' | 'en'
type Props = {
  open: boolean
  lang: Lang
  onClose: () => void
  onSelect: (url: string) => void
  selectedUrl?: string
  title?: string
}

const FAVORITES_KEY = 'ws.ui.officialFavorites'

function loadFavorites(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

export default function OfficialAssetPicker({ open, lang, onClose, onSelect, selectedUrl = '', title }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [favorites, setFavorites] = useState<string[]>(loadFavorites)
  const [onlyFavorites, setOnlyFavorites] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const categories = useMemo(() => {
    const map = new Map<string, string>()
    OFFICIAL_BACKGROUNDS.forEach((item) => map.set(item.categoryEn, lang === 'zh' ? item.categoryZh : item.categoryEn))
    return Array.from(map.entries())
  }, [lang])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return OFFICIAL_BACKGROUNDS.filter((item) => {
      if (category !== 'all' && item.categoryEn !== category) return false
      if (onlyFavorites && !favorites.includes(item.key)) return false
      if (!keyword) return true
      return [item.nameZh, item.nameEn, item.categoryZh, item.categoryEn, ...(item.tagsZh || []), ...(item.tagsEn || [])]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    })
  }, [category, favorites, onlyFavorites, query])

  if (!open) return null

  const toggleFavorite = (item: OfficialBackground) => {
    setFavorites((current) => {
      const next = current.includes(item.key) ? current.filter((key) => key !== item.key) : [...current, item.key]
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)) } catch { /* private mode */ }
      return next
    })
  }

  const copy = async (item: OfficialBackground) => {
    const url = new URL(item.url, window.location.origin).href
    try { await navigator.clipboard.writeText(url) } catch { /* clipboard may be blocked */ }
  }

  return createPortal(
    <div className="official-assets-overlay" role="dialog" aria-modal="true" aria-label={title || tr(lang, '官方素材库', 'Official library')} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="official-assets-modal">
        <header className="official-assets-head">
          <div>
            <strong><ImageIcon size={17} /> {title || tr(lang, '官方素材库', 'Official library')}</strong>
            <p>{tr(lang, '本地化照片与原创插画，可用于界面背景、世界地图、人物头像与作品封面。', 'Localized photos and original illustrations for backgrounds, world maps, avatars and covers.')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={tr(lang, '关闭', 'Close')}><X size={17} /></button>
        </header>

        <div className="official-assets-toolbar">
          <label>
            <Search size={14} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr(lang, '搜索名称、分类或标签', 'Search names, categories or tags')} />
          </label>
          <button type="button" className={onlyFavorites ? 'is-active' : ''} onClick={() => setOnlyFavorites((value) => !value)}><Heart size={14} fill={onlyFavorites ? 'currentColor' : 'none'} /> {tr(lang, '只看收藏', 'Favorites')}</button>
        </div>

        <div className="official-assets-categories">
          <button type="button" className={category === 'all' ? 'is-active' : ''} onClick={() => setCategory('all')}>{tr(lang, '全部', 'All')}</button>
          {categories.map(([key, label]) => (
            <button key={key} type="button" className={category === key ? 'is-active' : ''} onClick={() => setCategory(key)}>{label}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="official-assets-empty">{tr(lang, '没有匹配的素材。', 'No matching assets.')}</div>
        ) : (
          <div className="official-assets-grid">
            {filtered.map((item) => {
              const selected = selectedUrl === item.url
              const favorite = favorites.includes(item.key)
              return (
                <article key={item.key} className={`official-asset-card${selected ? ' is-selected' : ''}`}>
                  <button type="button" className="official-asset-preview" style={{ backgroundImage: `url(${JSON.stringify(item.url)})` }} onClick={() => { onSelect(item.url); onClose() }} aria-label={lang === 'zh' ? item.nameZh : item.nameEn}>
                    <span className="official-asset-kind">{item.kind === 'photo' ? tr(lang, '照片', 'Photo') : tr(lang, '插画', 'Illustration')}</span>
                    {selected && <span className="official-asset-check"><Check size={14} /></span>}
                  </button>
                  <div className="official-asset-meta">
                    <div>
                      <strong>{lang === 'zh' ? item.nameZh : item.nameEn}</strong>
                      <small>{lang === 'zh' ? item.categoryZh : item.categoryEn}{item.credit ? ` · ${item.credit}` : ''}</small>
                    </div>
                    <div className="official-asset-actions">
                      <button type="button" className={favorite ? 'is-favorite' : ''} onClick={() => toggleFavorite(item)} aria-label={tr(lang, '收藏', 'Favorite')}><Heart size={13} fill={favorite ? 'currentColor' : 'none'} /></button>
                      <button type="button" onClick={() => void copy(item)} aria-label={tr(lang, '复制地址', 'Copy URL')}><Copy size={13} /></button>
                      {item.licenseUrl && <a href={item.licenseUrl} target="_blank" rel="noreferrer" title={tr(lang, '查看授权', 'License')}>i</a>}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <footer className="official-assets-foot">
          <span>{tr(lang, '照片来自 Unsplash，遵循 Unsplash License；插画为站内原创素材。', 'Photos are localized from Unsplash under the Unsplash License; illustrations are original.')}</span>
          <button type="button" onClick={onClose}>{tr(lang, '关闭', 'Close')}</button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
