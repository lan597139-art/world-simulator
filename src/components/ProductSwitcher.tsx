import { useState } from 'react'
import type { ProductConfig, ProductKey } from '../product/types'

export default function ProductSwitcher({
  product,
  configs,
  onSelect,
  compact = false,
}: {
  product: ProductConfig
  configs: ProductConfig[]
  onSelect: (key: ProductKey) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const moduleLabels = new Map<string, string>([
    ['world-building', '世界建设配置'],
    ['multipath', '多路径沙盒'],
  ])
  for (const item of configs) {
    for (const entry of item.nav_groups.flatMap((group) => group.items)) {
      if (!moduleLabels.has(entry.module)) moduleLabels.set(entry.module, entry.label)
    }
  }
  const preferred = [
    'overview', 'world-management', 'world-building', 'world-structure', 'world-data', 'character-management', 'personas',
    'chat', 'relationships', 'events', 'timeline', 'simulation', 'companion-runtime',
    'memories', 'storyline', 'writing', 'information-sources', 'diary', 'multipath',
    'time-machine', 'archive', 'trash',
  ]
  const allModules = Array.from(new Set(configs.flatMap((item) => item.allowed_modules)))
    .sort((a, b) => preferred.indexOf(a) - preferred.indexOf(b))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="切换产品类型；导航、权限、业务模式与数据空间会一起切换"
        style={{
          width: compact ? 'auto' : '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: compact ? '6px 9px' : '9px 11px', borderRadius: 9, cursor: 'pointer',
          border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.08)',
          color: 'var(--sidebar-text)', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16 }}>{product.icon}</span>
        <span style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', fontSize: 12 }}>{product.label}</strong>
          {!compact && <span style={{ display: 'block', fontSize: 9.5, opacity: 0.68 }}>产品配置 · 点击切换</span>}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1600, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(1080px, 100%)', maxHeight: '88vh', overflow: 'auto', background: 'var(--bg-color)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 18, boxShadow: '0 24px 90px rgba(0,0,0,.35)' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 19, color: 'var(--text-main)' }}>选择产品功能配置</h2>
                <p style={{ margin: '5px 0 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  四套产品共用人物、关系、事件、记忆与 AI 能力；导航、页面权限、业务模式和数据空间按产品隔离。
                </p>
              </div>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={() => setOpen(false)} style={btn}>关闭</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10, marginTop: 14 }}>
              {configs.map((item) => {
                const active = item.key === product.key
                const navModules = item.nav_groups.flatMap((group) => group.items.map((entry) => entry.module))
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => { onSelect(item.key); setOpen(false) }}
                    style={{
                      textAlign: 'left', padding: 14, borderRadius: 11, cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--primary-color)' : 'var(--card-border)'}`,
                      background: active ? 'color-mix(in srgb, var(--primary-color) 9%, var(--card-bg))' : 'var(--card-bg)',
                      color: 'var(--text-main)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 24 }}>{item.icon}</span>
                      <strong style={{ fontSize: 15 }}>{item.label}</strong>
                      {active && <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--primary-color)', border: '1px solid var(--primary-color)', borderRadius: 10, padding: '2px 6px' }}>当前</span>}
                    </div>
                    <p style={{ margin: '9px 0 0', fontSize: 11, lineHeight: 1.65, color: 'var(--text-muted)' }}>{item.description}</p>
                    <div style={{ marginTop: 9, fontSize: 9.5, color: 'var(--text-muted)' }}>
                      {item.auto_workspace ? `自动工作空间：${item.workspace_name}` : '使用你自己的普通世界'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {navModules.slice(0, 8).map((module) => (
                        <span key={module} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 5, border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                          {item.nav_groups.flatMap((g) => g.items).find((entry) => entry.module === module)?.label || module}
                        </span>
                      ))}
                      {navModules.length > 8 && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{navModules.length - 8}</span>}
                    </div>
                  </button>
                )
              })}
            </div>

            <div style={{ marginTop: 14, border: '1px solid var(--card-border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, background: 'rgba(128,128,128,.08)' }}>功能配置矩阵 · 当前产品「{product.label}」</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(4, 1fr)', fontSize: 10 }}>
                <div style={cellHead}>模块 / 业务模式</div>
                {configs.map((item) => <div key={item.key} style={cellHead}>{item.icon} {item.short}</div>)}
                {allModules.map((module) => (
                  <div key={module} style={{ display: 'contents' }}>
                    <div style={cell}>{moduleLabels.get(module) || module}</div>
                    {configs.map((item) => (
                      <div key={`${item.key}-${module}`} style={{ ...cell, color: item.allowed_modules.includes(module) ? 'var(--text-main)' : 'var(--text-muted)', opacity: item.allowed_modules.includes(module) ? 1 : 0.38 }}>
                        {item.allowed_modules.includes(module) ? (item.modes[module] || '开启') : '—'}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const btn: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 7, border: '1px solid var(--card-border)',
  background: 'transparent', color: 'var(--text-main)', fontSize: 11, cursor: 'pointer',
}
const cellHead: React.CSSProperties = {
  padding: '7px 8px', fontWeight: 700, borderBottom: '1px solid var(--card-border)',
  color: 'var(--text-main)', background: 'rgba(128,128,128,.04)',
}
const cell: React.CSSProperties = {
  padding: '6px 8px', borderBottom: '1px solid var(--card-border)',
  color: 'var(--text-main)', lineHeight: 1.4,
}
