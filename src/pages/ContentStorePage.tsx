import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  FileStack,
  Globe2,
  Layers3,
  PackageOpen,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UserRound,
  X,
} from 'lucide-react'
import { listStories as listStoryProjects, type StoryProject } from '../api/storyline'
import { listStories as listWriting, type StoryItem } from '../api/writing'
import type { Lang } from './centerShared'
import { apiGet, excerpt, fetchWorlds, STORY_STATUS_LABELS, toCharacter, type BasicCharacter } from './centerShared'
import type { World } from '../types/world'
import './../styles/centers.css'

type AssetFilter = 'all' | 'world' | 'oc' | 'story' | 'template' | 'license'

type StoreAsset = {
  id: string
  kind: 'world' | 'oc' | 'story'
  title: string
  subtitle: string
  description: string
  meta: string
  worldId?: string
}

function copyFor(lang: Lang) {
  return lang === 'zh'
    ? {
        eyebrow: 'CONTENT STORE',
        title: '内容商城',
        subtitle: '把世界、角色与故事变成可被授权和体验的数字资产。',
        products: '商品',
        assets: '可上架资产',
        orders: '订单',
        licenses: '授权',
        statusTitle: '交易系统筹备中',
        statusHint: '商品、支付、数字交付、订单与创作者结算尚未接入。当前页面只展示真实创作资产预览，不提供价格或购买操作。',
        currentAssets: '当前可预览资产',
        browseAssets: '查看可上架资产',
        search: '搜索可上架资产…',
        all: '全部',
        world: '世界',
        oc: 'OC',
        story: '剧情',
        template: '模板',
        license: '授权',
        previewAssets: '可上架资产预览',
        previewKicker: 'ASSETS READY TO LIST',
        previewHint: '真实存在，尚未上架。点击可进入现有管理页面查看。',
        notListed: '未上架',
        noAssets: '没有匹配的资产',
        noAssetsHint: '换一个关键词或分类继续查看。',
        templateEmpty: '模板商城尚未接入',
        templateHint: '当前数据库没有模板资产，也没有模板上架接口。',
        licenseEmpty: '授权专区尚未接入',
        licenseHint: '没有授权记录或许可范围数据，页面不生成虚拟授权。',
        openAsset: '预览资产',
        market: '商城首页',
        marketKicker: 'STORE OVERVIEW',
        marketEmpty: '0 个在售商品',
        marketHint: '商品库尚未建立；可上架资产只做预览，不产生交易。',
        directory: '商城目录',
        worldStore: '世界商城',
        ocStore: 'OC 商城',
        storyStore: '剧情商城',
        templateStore: '模板商城',
        licenseZone: '授权专区',
        itemUnit: '项',
        assetsUnit: '项资产',
        creators: '热门创作者',
        creatorsKicker: 'TOP CREATORS',
        creatorsEmpty: '暂无公开创作者榜单',
        creatorsHint: '当前为单用户空间，无法生成热门创作者或销售排名。',
        localCreator: '本地创作者',
        ordersTitle: '我的订单',
        ordersKicker: 'MY ORDERS',
        ordersEmpty: '暂无订单记录',
        ordersHint: '购买与订单流程接入后会出现在这里。',
        licenseTitle: '我的授权',
        licenseKicker: 'MY LICENSES',
        licensesEmpty: '暂无授权资产',
        licensesHint: '购买、授权范围与到期时间尚未接入。',
        seller: '创作者销售中心',
        sellerKicker: 'CREATOR SALES',
        sellerAssets: '可上架资产',
        sellerProducts: '在售商品',
        sellerOrders: '成交订单',
        sellerRevenue: '累计结算',
        sellerHint: '商品管理、上架下架、订单、交易记录、销售数据与结算尚未接入；这里只汇总真实资产数量。',
        currentCreator: '当前创作者',
        works: '作品',
        note: '内容商城没有商品、订单或授权后端；页面不伪造价格、销量、评价或结算金额。真实世界、OC 与剧情仅作为可上架资产预览。',
      }
    : {
        eyebrow: 'CONTENT STORE',
        title: 'Content Store',
        subtitle: 'Turn worlds, characters, and stories into digital assets that can be licensed and experienced.',
        products: 'Products',
        assets: 'Listable assets',
        orders: 'Orders',
        licenses: 'Licenses',
        statusTitle: 'Commerce is being prepared',
        statusHint: 'Products, payment, digital delivery, orders, and creator settlement are not connected. This page previews real creative assets only; no prices or purchases.',
        currentAssets: 'Previewable assets',
        browseAssets: 'View listable assets',
        search: 'Search listable assets…',
        all: 'All',
        world: 'Worlds',
        oc: 'OCs',
        story: 'Stories',
        template: 'Templates',
        license: 'Licenses',
        previewAssets: 'Listable asset preview',
        previewKicker: 'ASSETS READY TO LIST',
        previewHint: 'Real assets, not listed for sale. Open an existing management page to inspect them.',
        notListed: 'Not listed',
        noAssets: 'No matching assets',
        noAssetsHint: 'Try another keyword or category.',
        templateEmpty: 'Template store is not connected',
        templateHint: 'There are no template assets or template listing APIs in the current database.',
        licenseEmpty: 'Licensing is not connected',
        licenseHint: 'No license records or usage scopes exist, so no virtual licenses are generated.',
        openAsset: 'Preview asset',
        market: 'Store home',
        marketKicker: 'STORE OVERVIEW',
        marketEmpty: '0 products on sale',
        marketHint: 'No product catalog exists yet. Listable assets are previews and do not create transactions.',
        directory: 'Store directory',
        worldStore: 'World store',
        ocStore: 'OC store',
        storyStore: 'Story store',
        templateStore: 'Template store',
        licenseZone: 'Licensing',
        itemUnit: 'items',
        assetsUnit: 'assets',
        creators: 'Top creators',
        creatorsKicker: 'TOP CREATORS',
        creatorsEmpty: 'No public creator ranking',
        creatorsHint: 'This is a single-user space, so popular creators and sales rankings cannot be generated.',
        localCreator: 'Local creator',
        ordersTitle: 'My orders',
        ordersKicker: 'MY ORDERS',
        ordersEmpty: 'No orders',
        ordersHint: 'Purchases and orders will appear here once connected.',
        licenseTitle: 'My licenses',
        licenseKicker: 'MY LICENSES',
        licensesEmpty: 'No licensed assets',
        licensesHint: 'Purchases, usage scopes, and expiry dates are not connected.',
        seller: 'Creator sales center',
        sellerKicker: 'CREATOR SALES',
        sellerAssets: 'Listable assets',
        sellerProducts: 'Products on sale',
        sellerOrders: 'Orders',
        sellerRevenue: 'Settlement',
        sellerHint: 'Product management, listing, orders, transactions, sales data, and settlement are not connected. Only real asset counts are summarized.',
        currentCreator: 'Current creator',
        works: 'Works',
        note: 'Content Store has no product, order, or licensing backend. Prices, sales, reviews, and settlement are not fabricated. Real worlds, OCs, and stories appear as listable asset previews only.',
      }
}

export default function ContentStorePage({
  lang,
  user,
  onOpenWorld,
  onOpenCharacters,
  onOpenStorylines,
  onOpenWorks,
}: {
  lang: Lang
  user: { display_name?: string } | null
  onOpenWorld: () => void
  onOpenCharacters: () => void
  onOpenStorylines: () => void
  onOpenWorks: () => void
}) {
  const copy = copyFor(lang)
  const [worlds, setWorlds] = useState<World[]>([])
  const [characters, setCharacters] = useState<BasicCharacter[]>([])
  const [stories, setStories] = useState<StoryProject[]>([])
  const [works, setWorks] = useState<StoryItem[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AssetFilter>('all')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const worldRows = await fetchWorlds(false)
        const visibleWorlds = worldRows.filter((world) => !world.is_product_workspace)
        const [characterRows, workRows, storyGroups] = await Promise.all([
          apiGet<any[]>('/characters').catch(() => []),
          listWriting().catch(() => [] as StoryItem[]),
          Promise.all(visibleWorlds.map((world) => listStoryProjects(world.id).catch(() => [] as StoryProject[]))),
        ])
        if (cancelled) return
        setWorlds(visibleWorlds)
        const visibleIds = new Set(visibleWorlds.map((world) => world.id))
        setCharacters(characterRows.map((row) => toCharacter(row, visibleWorlds)).filter((character) => visibleIds.has(character.worldId)))
        setWorks(workRows)
        setStories(storyGroups.flat())
      } catch {
        /* honest empty states */
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const worldNames = useMemo(() => new Map(worlds.map((world) => [world.id, world.name])), [worlds])
  const assets = useMemo<StoreAsset[]>(() => {
    const rows: StoreAsset[] = []
    worlds.forEach((world) => {
      const worldChars = characters.filter((character) => character.worldId === world.id).length
      const worldStories = stories.filter((story) => story.world_id === world.id).length
      rows.push({
        id: `world-${world.id}`,
        kind: 'world',
        title: world.name,
        subtitle: copy.world,
        description: excerpt(world.description || world.background, 130),
        meta: `${worldChars} ${lang === 'zh' ? '位角色' : 'characters'} · ${worldStories} ${lang === 'zh' ? '个剧情' : 'stories'}`,
        worldId: world.id,
      })
    })
    characters.forEach((character) => {
      rows.push({
        id: `oc-${character.id}`,
        kind: 'oc',
        title: character.name,
        subtitle: copy.oc,
        description: excerpt(character.intro, 120) || character.identity || '—',
        meta: `${character.role}${character.worldName ? ` · ${character.worldName}` : ''}`,
        worldId: character.worldId,
      })
    })
    stories.forEach((story) => {
      rows.push({
        id: `story-${story.id}`,
        kind: 'story',
        title: story.title,
        subtitle: copy.story,
        description: excerpt(story.premise, 130) || '—',
        meta: `${STORY_STATUS_LABELS[story.status]?.[lang] || story.status}${worldNames.get(story.world_id) ? ` · ${worldNames.get(story.world_id)}` : ''}`,
        worldId: story.world_id,
      })
    })
    return rows
  }, [characters, copy.oc, copy.story, copy.world, lang, stories, worldNames, worlds])

  const filters: Array<{ key: AssetFilter; label: string; count: number }> = [
    { key: 'all', label: copy.all, count: assets.length },
    { key: 'world', label: copy.world, count: worlds.length },
    { key: 'oc', label: copy.oc, count: characters.length },
    { key: 'story', label: copy.story, count: stories.length },
    { key: 'template', label: copy.template, count: 0 },
    { key: 'license', label: copy.license, count: 0 },
  ]

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return assets.filter((asset) => {
      const inFilter = filter === 'all' || filter === asset.kind
      const inSearch = !needle || `${asset.title} ${asset.description} ${asset.meta}`.toLowerCase().includes(needle)
      return inFilter && inSearch
    })
  }, [assets, filter, query])

  const isSpecialEmpty = filter === 'template' || filter === 'license'
  const creatorName = user?.display_name || copy.localCreator
  const assetCount = assets.length
  const specialEmptyTitle = filter === 'license' ? copy.licenseEmpty : copy.templateEmpty
  const specialEmptyHint = filter === 'license' ? copy.licenseHint : copy.templateHint

  const openAsset = (asset: StoreAsset) => {
    if (asset.kind === 'world') onOpenWorld()
    else if (asset.kind === 'oc') onOpenCharacters()
    else onOpenStorylines()
  }

  const scrollToAssets = () => {
    document.getElementById('store-assets')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="ct-content st-content">
      <section className="ct-hero">
        <div className="ct-hero-copy">
          <div className="ct-eyebrow">{copy.eyebrow}</div>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="ct-hero-actions">
          <div className="ct-stats">
            <div><strong>0</strong><span>{copy.products}</span></div>
            <div><strong>{loaded ? assetCount : '—'}</strong><span>{copy.assets}</span></div>
            <div><strong>0</strong><span>{copy.orders}</span></div>
            <div><strong>0</strong><span>{copy.licenses}</span></div>
          </div>
          <button type="button" className="ct-primary" onClick={scrollToAssets}>
            <ShoppingBag aria-hidden="true" strokeWidth={1.7} />
            {copy.browseAssets}
          </button>
        </div>
      </section>

      <section className="st-status">
        <div className="st-status-mark"><PackageOpen aria-hidden="true" strokeWidth={1.4} /></div>
        <div className="st-status-copy">
          <strong>{copy.statusTitle}</strong>
          <p>{copy.statusHint}</p>
        </div>
        <div className="st-status-numbers">
          <div><strong>0</strong><span>{copy.products}</span></div>
          <div><strong>{loaded ? assetCount : '—'}</strong><span>{copy.currentAssets}</span></div>
        </div>
      </section>

      <div className="ct-toolbar st-toolbar" id="store-assets">
        <div className="ct-search">
          <Search aria-hidden="true" strokeWidth={1.7} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} aria-label={copy.search} />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="clear"><X aria-hidden="true" strokeWidth={1.8} /></button>}
        </div>
        <div className="ct-filters">
          {filters.map((item) => (
            <button type="button" key={item.key} className={`ct-filter${filter === item.key ? ' active' : ''}`} onClick={() => setFilter(item.key)}>
              {item.label}<span>{item.count}</span>
            </button>
          ))}
        </div>
        <div className="ct-toolbar-meta">{filtered.length} {copy.assetsUnit}</div>
      </div>

      <div className="ct-top-grid st-top-grid">
        <section className="ct-section st-assets">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.previewKicker}</span>
              <h2>{copy.previewAssets}</h2>
            </div>
            <Layers3 aria-hidden="true" strokeWidth={1.5} />
          </div>
          <p className="st-preview-hint">{copy.previewHint}</p>
          {!loaded ? (
            <div className="ct-loading">{lang === 'zh' ? '正在读取资产…' : 'Loading assets…'}</div>
          ) : isSpecialEmpty ? (
            <div className="ct-empty large">
              {filter === 'license' ? <ShieldCheck aria-hidden="true" strokeWidth={1.4} /> : <FileStack aria-hidden="true" strokeWidth={1.4} />}
              <strong>{specialEmptyTitle}</strong>
              <p>{specialEmptyHint}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="ct-empty large"><Boxes aria-hidden="true" strokeWidth={1.4} /><strong>{copy.noAssets}</strong><p>{copy.noAssetsHint}</p></div>
          ) : (
            <div className="st-asset-grid">
              {filtered.map((asset) => (
                <article className="st-asset-card" key={asset.id}>
                  <div className="st-asset-top">
                    <span className={`st-kind ${asset.kind}`}>{asset.subtitle}</span>
                    <span className="st-unlisted">{copy.notListed}</span>
                  </div>
                  <span className="st-asset-icon">
                    {asset.kind === 'world' ? <Globe2 aria-hidden="true" strokeWidth={1.4} /> : asset.kind === 'oc' ? <UserRound aria-hidden="true" strokeWidth={1.4} /> : <FileStack aria-hidden="true" strokeWidth={1.4} />}
                  </span>
                  <h3>{asset.title}</h3>
                  <span className="st-asset-meta">{asset.meta}</span>
                  <p>{asset.description}</p>
                  <button type="button" onClick={() => openAsset(asset)}>{copy.openAsset} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="ct-section st-side">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.marketKicker}</span>
              <h2>{copy.market}</h2>
            </div>
            <Store aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="st-market-empty">
            <span><ShoppingBag aria-hidden="true" strokeWidth={1.4} /></span>
            <strong>{copy.marketEmpty}</strong>
            <p>{copy.marketHint}</p>
          </div>
          <div className="st-directory">
            <span className="st-directory-title">{copy.directory}</span>
            {[
              { key: 'world' as const, label: copy.worldStore, count: worlds.length, icon: Globe2 },
              { key: 'oc' as const, label: copy.ocStore, count: characters.length, icon: UserRound },
              { key: 'story' as const, label: copy.storyStore, count: stories.length, icon: FileStack },
              { key: 'template' as const, label: copy.templateStore, count: 0, icon: Boxes },
              { key: 'license' as const, label: copy.licenseZone, count: 0, icon: ShieldCheck },
            ].map(({ key, label, count, icon: Icon }) => (
              <button type="button" key={key} onClick={() => setFilter(key)} className={filter === key ? 'active' : ''}>
                <Icon aria-hidden="true" strokeWidth={1.4} />
                <span>{label}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <div className="ct-three-grid st-account-grid">
        <section className="ct-section">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.creatorsKicker}</span>
              <h2>{copy.creators}</h2>
            </div>
            <Sparkles aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="st-number">0</div>
          <strong className="st-empty-title">{copy.creatorsEmpty}</strong>
          <p className="st-empty-hint">{copy.creatorsHint}</p>
          <div className="st-local-creator"><span className="ct-avatar small">{creatorName.charAt(0)}</span><div><strong>{creatorName}</strong><span>{copy.localCreator}</span></div></div>
        </section>

        <section className="ct-section">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.ordersKicker}</span>
              <h2>{copy.ordersTitle}</h2>
            </div>
            <ReceiptText aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="st-number">0</div>
          <strong className="st-empty-title">{copy.ordersEmpty}</strong>
          <p className="st-empty-hint">{copy.ordersHint}</p>
        </section>

        <section className="ct-section">
          <div className="ct-section-head">
            <div>
              <span className="ct-kicker">{copy.licenseKicker}</span>
              <h2>{copy.licenseTitle}</h2>
            </div>
            <ShieldCheck aria-hidden="true" strokeWidth={1.5} />
          </div>
          <div className="st-number">0</div>
          <strong className="st-empty-title">{copy.licensesEmpty}</strong>
          <p className="st-empty-hint">{copy.licensesHint}</p>
        </section>
      </div>

      <section className="ct-section st-seller">
        <div className="st-seller-head">
          <div>
            <span className="ct-kicker">{copy.sellerKicker}</span>
            <h2>{copy.seller}</h2>
            <p>{copy.currentCreator} · {creatorName}</p>
          </div>
          <span className="st-seller-mark"><CircleDollarSign aria-hidden="true" strokeWidth={1.4} /></span>
        </div>
        <div className="st-seller-stats">
          <div><strong>{assetCount}</strong><span>{copy.sellerAssets}</span></div>
          <div><strong>0</strong><span>{copy.sellerProducts}</span></div>
          <div><strong>0</strong><span>{copy.sellerOrders}</span></div>
          <div><strong>¥0</strong><span>{copy.sellerRevenue}</span></div>
        </div>
        <div className="st-seller-breakdown">
          <span>{copy.world} {worlds.length}</span>
          <span>{copy.oc} {characters.length}</span>
          <span>{copy.story} {stories.length}</span>
          <button type="button" onClick={onOpenWorks}>{copy.works} {works.length} <ArrowUpRight aria-hidden="true" strokeWidth={1.8} /></button>
        </div>
        <p className="st-seller-hint">{copy.sellerHint}</p>
      </section>

      <div className="ct-note">{copy.note}</div>
    </div>
  )
}
