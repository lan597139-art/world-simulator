import { useEffect, useState } from 'react'

/**
 * 统一响应式断点判定。
 * 全站只使用这一套断点，避免各页面各写一套媒体查询。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return matches
}

/** 窄屏（平板竖屏与手机）：侧边栏转抽屉。 */
export function useIsNarrow(): boolean {
  return useMediaQuery('(max-width: 1024px)')
}
