import type { ProductConfig, ProductKey } from '../product/types'

export default function ProductHomePage({
  products,
  onSelect,
}: {
  products: ProductConfig[]
  onSelect: (key: ProductKey) => void
}) {
  return (
    <div style={{ minHeight: '100%', padding: 'clamp(24px, 4vw, 64px)', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: 30 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 9 }}>
              WORKBENCHES
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(26px, 3.2vw, 42px)', lineHeight: 1.15, color: 'var(--text-main)', fontWeight: 600 }}>
              选择创作空间
            </h1>
            <p style={{ margin: '11px 0 0', maxWidth: 620, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.85 }}>
              四种独立服务场景，共用底层人物、关系、事件与 AI 能力。选择产品后进入对应工作台，只展示该产品开放的功能。
            </p>
          </div>
          <span style={{ flex: 1 }} />
          <div style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: 'var(--text-muted)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-color)' }} />
            云宝是全局 AI，不属于任何一个产品
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {products.map((product, index) => (
            <button
              key={product.key}
              type="button"
              className="product-home-card"
              onClick={() => onSelect(product.key)}
              style={{
                position: 'relative', minHeight: 218, padding: '25px 24px 22px', borderRadius: 16,
                border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)',
                textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                boxShadow: '0 12px 40px rgba(0,0,0,0.06)', overflow: 'hidden',
              }}
            >
              <span style={{
                position: 'absolute', right: 18, top: 14, fontSize: 52, lineHeight: 1,
                opacity: 0.12, filter: 'grayscale(0.2)',
              }}>{product.icon}</span>
              <span style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)' }}>0{index + 1}</span>
              <span style={{ fontSize: 30, marginTop: 14 }}>{product.icon}</span>
              <strong style={{ fontSize: 19, marginTop: 12, fontWeight: 600 }}>{product.label}</strong>
              <span style={{ marginTop: 9, fontSize: 12.5, lineHeight: 1.75, color: 'var(--text-muted)', maxWidth: 260 }}>
                {product.description}
              </span>
              <span style={{
                marginTop: 'auto', paddingTop: 20, display: 'flex', alignItems: 'center', gap: 7,
                fontSize: 11.5, color: 'var(--primary-color)', fontWeight: 600,
              }}>
                进入工作台 <span style={{ fontSize: 15 }}>→</span>
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 28, display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <span style={{ padding: '6px 10px', borderRadius: 20, border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.06)' }}>
            工作台侧栏只显示当前产品功能
          </span>
          <span style={{ padding: '6px 10px', borderRadius: 20, border: '1px solid var(--card-border)', background: 'rgba(128,128,128,0.06)' }}>
            原有世界、人物、事件数据不迁移、不复制
          </span>
        </div>
      </div>
    </div>
  )
}
