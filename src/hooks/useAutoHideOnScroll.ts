import { useEffect, useState } from 'react'

/** 二级导航随页面滚动自动收起；回到顶部或向上滚动时恢复。 */
export function useAutoHideOnScroll() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.cc-page-scroll')
    if (!el) return
    let lastTop = el.scrollTop
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const top = el.scrollTop
        const delta = top - lastTop
        lastTop = top
        if (top <= 24) {
          setHidden(false)
          return
        }
        if (delta > 10 && top > 72) setHidden(true)
        else if (delta < -8) setHidden(false)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return hidden
}
