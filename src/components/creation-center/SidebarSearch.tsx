import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { searchGlobal, type SearchGroup } from '../../api/platform'

type Lang = 'zh' | 'en'

const GROUP_LABELS: Record<string, { zh: string; en: string }> = {
  worlds: { zh: '世界', en: 'Worlds' },
  characters: { zh: '人物', en: 'Characters' },
  events: { zh: '事件', en: 'Events' },
  works: { zh: '作品', en: 'Works' },
  posts: { zh: '动态', en: 'Posts' },
  users: { zh: '用户', en: 'Users' },
  topics: { zh: '讨论', en: 'Discussions' },
}

/**
 * 全局搜索：从顶部导航下沉到侧边栏，不再占用每个页面的顶栏。
 * 结果下拉向内容区展开，回车或点击结果跳转到对应页面。
 */
export default function SidebarSearch({
  lang,
  onNavigate,
}: {
  lang: Lang
  onNavigate: (page: string) => void
}) {
  const [query, setQuery] = useState('')
  const [searchGroups, setSearchGroups] = useState<SearchGroup[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const value = query.trim()
    if (value.length < 1) {
      setSearchGroups([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = window.setTimeout(() => {
      void searchGlobal(value)
        .then((data) => setSearchGroups(data.groups))
        .catch(() => setSearchGroups([]))
        .finally(() => setSearching(false))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!searchOpen) return
    const close = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [searchOpen])

  const go = (page?: string) => {
    if (!page) return
    setSearchOpen(false)
    setQuery('')
    onNavigate(page)
  }

  return (
    <form
      ref={searchRef}
      className="cc-side-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        go(searchGroups[0]?.items[0]?.page)
      }}
    >
      <Search className="cc-search-icon" aria-hidden="true" strokeWidth={1.7} />
      <input
        type="search"
        aria-label={lang === 'zh' ? '搜索' : 'Search'}
        placeholder={lang === 'zh' ? '搜索世界、人物、作品…' : 'Search worlds, characters, works…'}
        value={query}
        onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }}
        onFocus={() => setSearchOpen(true)}
      />
      {searchOpen && query.trim() && (
        <div className="cc-search-results cc-search-results--side" role="listbox">
          {searching && <div className="cc-search-state">{lang === 'zh' ? '搜索中…' : 'Searching…'}</div>}
          {!searching && searchGroups.length === 0 && <div className="cc-search-state">{lang === 'zh' ? '没有找到匹配内容' : 'No matches'}</div>}
          {!searching && searchGroups.map((group) => (
            <section key={group.key} className="cc-search-group">
              <div className="cc-search-group-label">
                {GROUP_LABELS[group.key] ? GROUP_LABELS[group.key][lang] : group.label}
              </div>
              {group.items.map((item) => (
                <button
                  key={`${group.key}:${item.id}`}
                  type="button"
                  className="cc-search-hit"
                  onClick={() => go(item.page)}
                >
                  <strong>{item.title}</strong>
                  {item.subtitle && <span>{item.subtitle}</span>}
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
    </form>
  )
}
