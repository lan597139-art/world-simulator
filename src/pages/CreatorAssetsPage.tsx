import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Globe2,
  Layers,
  Link2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { API_ORIGIN } from '../api/config'
import '../styles/creator-assets.css'

type ViewKey = 'active' | 'archive' | 'trash'
type AssetType = 'world' | 'character' | 'location' | 'organization' | 'event' | 'story' | 'note' | 'image'
type Status = 'draft' | 'published' | 'archived' | 'deleted'
type Visibility = 'private' | 'scoped' | 'public'

type FolderRow = {
  id: string
  owner_id: string
  world_id: string | null
  world_name: string
  parent_id: string | null
  name: string
  sort_order: number
  is_system: boolean
  system_key: string | null
  asset_count: number
  created_at: string | null
  updated_at: string | null
}

type Asset = {
  id: string
  owner_id: string
  world_id: string | null
  world_name: string
  folder_id: string | null
  asset_type: AssetType
  asset_type_label: string
  entity_id: string | null
  is_linked: boolean
  title: string
  description: string
  content: string
  file_url: string
  mime_type: string
  file_size: number
  status: Status
  visibility: Visibility
  scope: string[]
  published_at: string | null
  archived_at: string | null
  deleted_at: string | null
  original_folder_id: string | null
  created_at: string | null
  updated_at: string | null
}

type Reference = { kind: string; name?: string; detail?: string }
type Publication = {
  id: string
  version_no: number
  visibility: Visibility
  scope: string[]
  published_at: string | null
  unpublished_at: string | null
}
type AssetDetail = Asset & { references: Reference[]; publications: Publication[] }

type TreeResponse = {
  folders: FolderRow[]
  worlds: Array<{ id: string; name: string }>
  unfiled_id: string | null
}

type ApiFailureDetail = {
  code?: string
  message?: string
  references?: Reference[]
  child_folders?: number
  assets?: number
}

class ApiError extends Error {
  detail: unknown
  status: number

  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : detail && typeof detail === 'object' && 'message' in detail ? String((detail as ApiFailureDetail).message) : `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

const API = `${API_ORIGIN}/api/creator-assets`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API}${path}`, { ...init, headers })
  const text = await response.text()
  let data: unknown = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }
  if (!response.ok) throw new ApiError(response.status, data)
  return data as T
}

function errorInfo(error: unknown): { message: string; references?: Reference[] } {
  if (error instanceof ApiError) {
    if (typeof error.detail === 'string') return { message: error.detail }
    if (error.detail && typeof error.detail === 'object') {
      const detail = error.detail as ApiFailureDetail
      return {
        message: detail.message || detail.code || `请求失败（HTTP ${error.status}）`,
        references: detail.references,
      }
    }
    return { message: error.message }
  }
  return { message: error instanceof Error ? error.message : String(error) }
}

const TYPE_ICONS: Record<AssetType, LucideIcon> = {
  world: Globe2,
  character: UserRound,
  location: MapPin,
  organization: Building2,
  event: Sparkles,
  story: BookOpen,
  note: FileText,
  image: FileImage,
}

const STATUS_LABELS: Record<Status, string> = {
  draft: '草稿', published: '已发布', archived: '已归档', deleted: '已删除',
}
const VISIBILITY_LABELS: Record<Visibility, string> = {
  private: '私密', scoped: '指定范围', public: '公开',
}
const TYPE_LABELS: Record<AssetType, string> = {
  world: '世界', character: '人物', location: '地点', organization: '组织',
  event: '事件', story: '故事', note: '笔记', image: '图片',
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function excerpt(value: string, length = 70) {
  const text = (value || '').replace(/\s+/g, ' ').trim()
  return text.length > length ? `${text.slice(0, length)}…` : text
}

function fileNameFromUrl(url: string) {
  try { return decodeURIComponent(url.split('/').pop() || '') } catch { return url }
}

function TypeIcon({ type, size = 16 }: { type: AssetType; size?: number }) {
  const Icon = TYPE_ICONS[type] || FileText
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />
}

type FolderDialogState = { mode: 'create' | 'edit'; parentId: string | null; folder?: FolderRow }
type AssetDialogState = { mode: 'create' | 'edit'; assetType: AssetType; fileUrl?: string; mimeType?: string; fileSize?: number; asset?: Asset | AssetDetail }
type PublishDialogState = { mode: 'publish' | 'unpublish'; asset: AssetDetail }

export default function CreatorAssetsPage({ worldId = '' }: { worldId?: string }) {
  const [folders, setFolders] = useState<FolderRow[]>([])
  const [worlds, setWorlds] = useState<Array<{ id: string; name: string }>>([])
  const [unfiledId, setUnfiledId] = useState<string>('')
  const [assets, setAssets] = useState<Asset[]>([])
  const [view, setView] = useState<ViewKey>('active')
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string>('')
  const [detail, setDetail] = useState<AssetDetail | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [ready, setReady] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<{ message: string; references?: Reference[] } | null>(null)
  const [toast, setToast] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [folderDialog, setFolderDialog] = useState<FolderDialogState | null>(null)
  const [folderName, setFolderName] = useState('')
  const [folderParent, setFolderParent] = useState<string>('')
  const [assetDialog, setAssetDialog] = useState<AssetDialogState | null>(null)
  const [assetTitle, setAssetTitle] = useState('')
  const [assetDescription, setAssetDescription] = useState('')
  const [assetContent, setAssetContent] = useState('')
  const [assetFolder, setAssetFolder] = useState('')
  const [publishDialog, setPublishDialog] = useState<PublishDialogState | null>(null)
  const [publishVisibility, setPublishVisibility] = useState<Visibility>('public')
  const [publishScope, setPublishScope] = useState('')
  const uploadRef = useRef<HTMLInputElement>(null)

  const applyTree = useCallback((tree: TreeResponse, expandRoots = false) => {
    setFolders(tree.folders)
    setWorlds(tree.worlds)
    setUnfiledId(tree.unfiled_id || '')
    if (expandRoots) {
      setExpanded((previous) => {
        const next = new Set(previous)
        tree.folders.filter((folder) => !folder.parent_id).forEach((folder) => next.add(folder.id))
        return next
      })
    }
  }, [])

  const loadTree = useCallback(async (expandRoots = false) => {
    const tree = await request<TreeResponse>('/tree')
    applyTree(tree, expandRoots)
    return tree
  }, [applyTree])

  const loadDetail = useCallback(async (id: string) => {
    try {
      const data = await request<AssetDetail>(`/${id}`)
      setDetail(data)
    } catch {
      setDetail(null)
      setSelectedId('')
    }
  }, [])

  const refreshAll = useCallback(async (message?: string) => {
    if (message) setToast(message)
    await loadTree(false)
    setRefreshKey((key) => key + 1)
    if (selectedId) await loadDetail(selectedId)
  }, [loadDetail, loadTree, selectedId])

  useEffect(() => {
    let alive = true
    const boot = async () => {
      try {
        if (worldId) {
          const key = `ws.creatorAssets.imported.${worldId}`
          if (!sessionStorage.getItem(key)) {
            try {
              const imported = await request<{ created: number }>('/import', {
                method: 'POST',
                body: JSON.stringify({ world_id: worldId }),
              })
              sessionStorage.setItem(key, '1')
              if (imported.created > 0 && alive) setToast(`已将当前世界的 ${imported.created} 项内容整理进资产库`)
            } catch {
              // 当前世界没有可导入内容时仍允许使用空白资产库。
            }
          }
        }
        const tree = await request<TreeResponse>('/tree')
        if (!alive) return
        applyTree(tree, true)
        setReady(true)
      } catch (err) {
        if (alive) setError(errorInfo(err))
      }
    }
    void boot()
    return () => { alive = false }
  }, [applyTree, worldId])

  useEffect(() => {
    if (!ready) return
    let ignore = false
    setListLoading(true)
    const params = new URLSearchParams({ view })
    if (selectedFolderId !== 'all' && !query.trim() && view === 'active') params.set('folder_id', selectedFolderId)
    if (query.trim()) params.set('q', query.trim())
    if (typeFilter) params.set('asset_type', typeFilter)
    request<{ items: Asset[]; total: number }>(`?${params.toString()}`)
      .then((data) => {
        if (ignore) return
        setAssets(data.items)
        setError(null)
      })
      .catch((err) => { if (!ignore) setError(errorInfo(err)) })
      .finally(() => { if (!ignore) setListLoading(false) })
    return () => { ignore = true }
  }, [ready, view, selectedFolderId, query, typeFilter, refreshKey])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3400)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const folderMap = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders])

  const childrenOf = useCallback((parentId: string | null) => (
    folders
      .filter((folder) => folder.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh-CN'))
  ), [folders])

  const aggregateCount = useMemo(() => {
    const counts = new Map<string, number>()
    const walking = new Set<string>()
    const count = (id: string): number => {
      if (counts.has(id)) return counts.get(id) || 0
      if (walking.has(id)) return 0
      walking.add(id)
      const folder = folderMap.get(id)
      let total = folder?.asset_count || 0
      folders.filter((item) => item.parent_id === id).forEach((child) => { total += count(child.id) })
      walking.delete(id)
      counts.set(id, total)
      return total
    }
    folders.forEach((folder) => count(folder.id))
    return counts
  }, [folderMap, folders])

  const totalActiveCount = useMemo(() => folders.filter((folder) => !folder.parent_id).reduce((sum, folder) => sum + (aggregateCount.get(folder.id) || 0), 0), [aggregateCount, folders])

  const selectedFolder = selectedFolderId === 'all' ? null : folderMap.get(selectedFolderId) || null

  const folderPath = useCallback((folder: FolderRow | null | undefined): string => {
    if (!folder) return '全部内容'
    const parts: string[] = []
    let current: FolderRow | undefined = folder
    let guard = 0
    while (current && guard < 30) {
      parts.unshift(current.name)
      current = current.parent_id ? folderMap.get(current.parent_id) : undefined
      guard += 1
    }
    return parts.join(' / ')
  }, [folderMap])

  const descendantIds = useCallback((id: string) => {
    const result = new Set<string>()
    const stack = [id]
    while (stack.length) {
      const current = stack.pop() as string
      folders.filter((folder) => folder.parent_id === current).forEach((folder) => {
        if (!result.has(folder.id)) {
          result.add(folder.id)
          stack.push(folder.id)
        }
      })
    }
    return result
  }, [folders])

  const listTitle = query.trim()
    ? '搜索结果'
    : view === 'archive' ? '已归档内容' : view === 'trash' ? '回收站' : selectedFolder?.name || '全部内容'

  const selectAsset = (asset: Asset) => {
    setSelectedId(asset.id)
    setDetail({ ...asset, references: [], publications: [] })
  }

  const openCreateFolder = (parentId: string | null = null) => {
    setFolderName('')
    setFolderParent(parentId || '')
    setFolderDialog({ mode: 'create', parentId })
  }

  const openEditFolder = (folder: FolderRow, event: React.MouseEvent) => {
    event.stopPropagation()
    setFolderName(folder.name)
    setFolderParent(folder.parent_id || '')
    setFolderDialog({ mode: 'edit', parentId: folder.parent_id, folder })
  }

  const submitFolder = async () => {
    if (!folderDialog) return
    const name = folderName.trim()
    if (!name) return
    setBusy('folder-dialog')
    try {
      if (folderDialog.mode === 'create') {
        await request('/folders', {
          method: 'POST',
          body: JSON.stringify({ name, parent_id: folderParent || null }),
        })
        if (folderParent) setExpanded((previous) => new Set(previous).add(folderParent))
        setToast('文件夹已创建')
      } else if (folderDialog.folder) {
        await request(`/folders/${folderDialog.folder.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, parent_id: folderParent || null }),
        })
        setToast('文件夹已更新')
      }
      setFolderDialog(null)
      await loadTree(false)
    } catch (err) {
      setError(errorInfo(err))
    } finally {
      setBusy('')
    }
  }

  const deleteFolder = async (folder: FolderRow, event: React.MouseEvent) => {
    event.stopPropagation()
    if (folder.is_system) return
    if (!window.confirm(`删除文件夹「${folder.name}」？`)) return
    setBusy(`folder-delete-${folder.id}`)
    try {
      await request(`/folders/${folder.id}`, { method: 'DELETE' })
      setToast('文件夹已删除')
    } catch (err) {
      const failure = err instanceof ApiError ? err.detail as ApiFailureDetail : null
      if (failure?.code === 'FOLDER_NOT_EMPTY') {
        const recursive = window.confirm(`文件夹内还有 ${failure.child_folders || 0} 个子文件夹、${failure.assets || 0} 项内容。\n是否连同内容一起移入回收站？`)
        if (recursive) {
          try {
            await request(`/folders/${folder.id}?recursive=true`, { method: 'DELETE' })
            setToast('文件夹与其中的内容已移入回收站')
          } catch (nestedError) {
            setError(errorInfo(nestedError))
          }
        }
      } else {
        setError(errorInfo(err))
      }
    } finally {
      setBusy('')
      if (selectedFolderId === folder.id) setSelectedFolderId('all')
      await loadTree(false)
      setRefreshKey((key) => key + 1)
    }
  }

  const openCreateNote = () => {
    setAssetTitle('')
    setAssetDescription('')
    setAssetContent('')
    setAssetFolder(selectedFolderId !== 'all' ? selectedFolderId : unfiledId)
    setAssetDialog({ mode: 'create', assetType: 'note' })
  }

  const openEditAsset = () => {
    if (!detail) return
    setAssetTitle(detail.title)
    setAssetDescription(detail.description)
    setAssetContent(detail.content)
    setAssetFolder(detail.folder_id || unfiledId)
    setAssetDialog({ mode: 'edit', assetType: detail.asset_type, asset: detail })
  }

  const openUploadedImage = (file: File, uploaded: { file_url: string; mime_type: string; file_size: number }) => {
    setAssetTitle(file.name.replace(/\.[^.]+$/, ''))
    setAssetDescription('')
    setAssetContent('')
    setAssetFolder(selectedFolderId !== 'all' ? selectedFolderId : unfiledId)
    setAssetDialog({
      mode: 'create', assetType: 'image', fileUrl: uploaded.file_url,
      mimeType: uploaded.mime_type, fileSize: uploaded.file_size,
    })
  }

  const uploadImage = async (file: File) => {
    if (!file) return
    setBusy('upload')
    try {
      const response = await fetch(`${API}/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new ApiError(response.status, data?.detail || '上传失败')
      openUploadedImage(file, data)
    } catch (err) {
      setError(errorInfo(err))
    } finally {
      setBusy('')
      if (uploadRef.current) uploadRef.current.value = ''
    }
  }

  const submitAsset = async () => {
    if (!assetDialog) return
    const title = assetTitle.trim()
    if (!title) return
    setBusy('asset-dialog')
    try {
      if (assetDialog.mode === 'create') {
        await request('', {
          method: 'POST',
          body: JSON.stringify({
            asset_type: assetDialog.assetType,
            title,
            description: assetDescription,
            content: assetContent,
            folder_id: assetFolder || unfiledId,
            file_url: assetDialog.fileUrl || '',
            mime_type: assetDialog.mimeType || '',
            file_size: assetDialog.fileSize || 0,
          }),
        })
        setToast('内容已加入资产库')
      } else if (assetDialog.asset) {
        await request(`/${assetDialog.asset.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title, description: assetDescription, content: assetContent, folder_id: assetFolder || unfiledId }),
        })
        setToast('内容已保存')
      }
      setAssetDialog(null)
      await refreshAll()
    } catch (err) {
      setError(errorInfo(err))
    } finally {
      setBusy('')
    }
  }

  const moveAsset = async (folderId: string) => {
    if (!detail) return
    setBusy('move')
    try {
      await request(`/${detail.id}`, { method: 'PATCH', body: JSON.stringify({ folder_id: folderId }) })
      setToast('已移动到新文件夹')
      await refreshAll()
    } catch (err) {
      setError(errorInfo(err))
    } finally {
      setBusy('')
    }
  }

  const archiveAsset = async (asset: Asset | AssetDetail) => {
    setBusy(`archive-${asset.id}`)
    try {
      await request(`/${asset.id}/archive`, { method: 'POST' })
      await refreshAll('已归档；原发布记录仍然保留')
    } catch (err) { setError(errorInfo(err)) } finally { setBusy('') }
  }

  const restoreArchive = async (asset: Asset | AssetDetail) => {
    setBusy(`restore-archive-${asset.id}`)
    try {
      await request(`/${asset.id}/restore-archive`, { method: 'POST' })
      await refreshAll('已恢复到归档前状态')
    } catch (err) { setError(errorInfo(err)) } finally { setBusy('') }
  }

  const deleteAsset = async (asset: Asset | AssetDetail) => {
    if (!window.confirm(`将「${asset.title}」移入回收站？仍被其他内容引用的对象会被保护。`)) return
    setBusy(`delete-${asset.id}`)
    try {
      await request(`/${asset.id}`, { method: 'DELETE' })
      setSelectedId('')
      setDetail(null)
      await refreshAll('已移入回收站，可随时恢复')
    } catch (err) {
      setError(errorInfo(err))
    } finally { setBusy('') }
  }

  const restoreAsset = async (asset: Asset | AssetDetail) => {
    setBusy(`restore-${asset.id}`)
    try {
      await request(`/${asset.id}/restore`, { method: 'POST' })
      await refreshAll('内容已恢复')
    } catch (err) { setError(errorInfo(err)) } finally { setBusy('') }
  }

  const purgeAsset = async (asset: Asset | AssetDetail) => {
    if (!window.confirm(`永久移除「${asset.title}」？此操作不可恢复。关联型内容的源数据会保留在原模块，避免误删关联。`)) return
    setBusy(`purge-${asset.id}`)
    try {
      const result = await request<{ source_preserved: boolean }>(`/${asset.id}/purge`, { method: 'DELETE' })
      setSelectedId('')
      setDetail(null)
      await refreshAll(result.source_preserved ? '资产记录已永久移除；源内容仍保留在原模块' : '内容已永久移除')
    } catch (err) { setError(errorInfo(err)) } finally { setBusy('') }
  }

  const duplicateAsset = async (asset: AssetDetail) => {
    setBusy(`duplicate-${asset.id}`)
    try {
      await request(`/${asset.id}/duplicate`, { method: 'POST' })
      await refreshAll('已创建副本')
    } catch (err) { setError(errorInfo(err)) } finally { setBusy('') }
  }

  const openPublish = (asset: Asset | AssetDetail) => {
    setPublishVisibility(asset.visibility === 'scoped' ? 'scoped' : asset.visibility === 'public' ? 'public' : 'public')
    setPublishScope((asset.scope || []).join(', '))
    setPublishDialog({ mode: 'publish', asset })
  }

  const openUnpublish = (asset: AssetDetail) => {
    setPublishVisibility('private')
    setPublishScope('')
    setPublishDialog({ mode: 'unpublish', asset })
  }

  const submitPublish = async () => {
    if (!publishDialog) return
    const scope = publishScope.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
    if (publishVisibility === 'scoped' && !scope.length) {
      setError({ message: '指定范围可见至少需要填写一个用户或成员标识。' })
      return
    }
    setBusy('publish')
    try {
      if (publishDialog.mode === 'publish') {
        await request(`/${publishDialog.asset.id}/publish`, {
          method: 'POST',
          body: JSON.stringify({ visibility: publishVisibility, scope }),
        })
        setToast(publishVisibility === 'public' ? '已发布，其他用户可在公开页浏览' : '已发布，并按范围授权')
      } else {
        await request(`/${publishDialog.asset.id}/unpublish`, {
          method: 'POST',
          body: JSON.stringify({ visibility: publishVisibility, scope }),
        })
        setToast('已下架公开展示；内容与发布记录均保留')
      }
      setPublishDialog(null)
      await refreshAll()
    } catch (err) { setError(errorInfo(err)) } finally { setBusy('') }
  }

  const openAssetByView = (asset: Asset | AssetDetail) => {
    setSelectedId(asset.id)
    void loadDetail(asset.id)
  }

  const renderFolder = (folder: FolderRow, depth = 0): React.ReactNode => {
    const children = childrenOf(folder.id)
    const isOpen = expanded.has(folder.id)
    const active = selectedFolderId === folder.id && view === 'active'
    const count = aggregateCount.get(folder.id) || 0
    return (
      <div key={folder.id} className="ca-folder-branch">
        <div
          className={`ca-folder-row${active ? ' is-active' : ''}`}
          style={{ paddingLeft: `${10 + depth * 16}px` }}
          onClick={() => { setSelectedFolderId(folder.id); setView('active') }}
        >
          <button
            type="button"
            className={`ca-folder-chevron${children.length ? '' : ' is-empty'}`}
            onClick={(event) => {
              event.stopPropagation()
              if (!children.length) return
              setExpanded((previous) => {
                const next = new Set(previous)
                if (next.has(folder.id)) next.delete(folder.id)
                else next.add(folder.id)
                return next
              })
            }}
            aria-label={isOpen ? '收起文件夹' : '展开文件夹'}
          >
            {children.length ? (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : null}
          </button>
          {isOpen && children.length ? <FolderOpen size={15} /> : <Folder size={15} />}
          <span className="ca-folder-name">{folder.name}</span>
          <span className="ca-folder-count">{count}</span>
          <span className="ca-folder-actions">
            <button type="button" title="新建子文件夹" onClick={(event) => { event.stopPropagation(); openCreateFolder(folder.id) }}><Plus size={13} /></button>
            <button type="button" title="重命名 / 调整层级" onClick={(event) => openEditFolder(folder, event)}><Pencil size={12} /></button>
            {!folder.is_system && (
              <button type="button" title="删除文件夹" onClick={(event) => void deleteFolder(folder, event)}><Trash2 size={12} /></button>
            )}
          </span>
        </div>
        {isOpen && children.map((child) => renderFolder(child, depth + 1))}
      </div>
    )
  }

  const rootFolders = childrenOf(null).filter((folder) => folder.system_key !== 'unfiled')
  const unfiledFolder = folders.find((folder) => folder.system_key === 'unfiled') || null

  const parentOptions = folderDialog
    ? folders.filter((folder) => {
        if (folder.is_system && folder.system_key !== 'unfiled') return false
        if (folderDialog.mode === 'edit' && folderDialog.folder) {
          if (folder.id === folderDialog.folder.id) return false
          if (descendantIds(folderDialog.folder.id).has(folder.id)) return false
        }
        return true
      })
    : []

  return (
    <div className="ca-page">
      <div className="ca-page-head">
        <div className="ca-page-title">
          <span className="ca-eyebrow">CREATOR LIBRARY</span>
          <h1>创作者资产库</h1>
          <p>文件夹只负责组织。移动内容不会改变它和世界、人物、事件、故事之间的关联。</p>
        </div>
        <div className="ca-head-actions">
          <button type="button" className="ca-btn" onClick={() => openCreateFolder(null)}>
            <FolderPlus size={15} /> 新建文件夹
          </button>
          <button type="button" className="ca-btn ca-btn-primary" onClick={openCreateNote}>
            <Plus size={15} /> 新建笔记
          </button>
          <button type="button" className="ca-btn" onClick={() => uploadRef.current?.click()} disabled={busy === 'upload'}>
            <Upload size={15} /> {busy === 'upload' ? '上传中…' : '上传图片'}
          </button>
          <input ref={uploadRef} type="file" accept="image/*,.pdf" hidden onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void uploadImage(file)
          }} />
        </div>
      </div>

      {error && (
        <div className="ca-alert" role="alert">
          <div>
            <strong>操作未完成</strong>
            <p>{error.message}</p>
            {error.references && error.references.length > 0 && (
              <ul>
                {error.references.slice(0, 8).map((reference, index) => (
                  <li key={`${reference.kind}-${index}`}>
                    <span>{reference.kind}</span>{reference.name ? ` · ${reference.name}` : ''}{reference.detail ? ` — ${reference.detail}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" onClick={() => setError(null)} aria-label="关闭提示"><X size={15} /></button>
        </div>
      )}

      <div className={`ca-shell${detail ? ' has-detail' : ''}`}>
        <aside className="ca-panel ca-tree">
          <div className="ca-tree-head">
            <div>
              <span className="ca-panel-kicker">MY SPACE</span>
              <strong>我的创作空间</strong>
            </div>
            <button type="button" className="ca-icon-btn" title="新建根文件夹" onClick={() => openCreateFolder(null)}><FolderPlus size={15} /></button>
          </div>

          <button
            type="button"
            className={`ca-tree-special${selectedFolderId === 'all' && view === 'active' ? ' is-active' : ''}`}
            onClick={() => { setSelectedFolderId('all'); setView('active') }}
          >
            <Layers size={15} />
            <span>全部内容</span>
            <em>{totalActiveCount}</em>
          </button>

          <div className="ca-tree-scroll">
            {unfiledFolder && (
              <button
                type="button"
                className={`ca-tree-special ca-tree-unfiled${selectedFolderId === unfiledFolder.id && view === 'active' ? ' is-active' : ''}`}
                onClick={() => { setSelectedFolderId(unfiledFolder.id); setView('active') }}
              >
                <Folder size={15} />
                <span>{unfiledFolder.name}</span>
                <em>{aggregateCount.get(unfiledFolder.id) || 0}</em>
              </button>
            )}
            {rootFolders.map((folder) => renderFolder(folder))}
            {!rootFolders.length && (
              <p className="ca-tree-empty">还没有世界文件夹。进入一个世界后，点击「导入当前世界」即可自动整理。</p>
            )}
          </div>

          <div className="ca-tree-footer">
            <button
              type="button"
              className={`ca-tree-special${view === 'archive' ? ' is-active' : ''}`}
              onClick={() => setView('archive')}
            >
              <Archive size={15} /><span>已归档</span>
            </button>
            <button
              type="button"
              className={`ca-tree-special${view === 'trash' ? ' is-active' : ''}`}
              onClick={() => setView('trash')}
            >
              <Trash2 size={15} /><span>回收站</span>
            </button>
          </div>
        </aside>

        <section className="ca-panel ca-list">
          <div className="ca-list-head">
            <div className="ca-list-title">
              <span className="ca-panel-kicker">{view === 'active' ? 'FILES & CONTENT' : view === 'archive' ? 'ARCHIVED' : 'TRASH'}</span>
              <h2>{listTitle}</h2>
              <p>{query.trim() ? `在全部文件夹中搜索「${query.trim()}」` : view === 'active' ? (selectedFolder ? folderPath(selectedFolder) : '跨世界浏览全部内容') : view === 'archive' ? '归档是非破坏性操作，可恢复到归档前状态' : '删除的内容会保留快照，可恢复或永久移除'}</p>
            </div>
            <div className="ca-view-tabs">
              <button type="button" className={view === 'active' ? 'is-active' : ''} onClick={() => setView('active')}>内容</button>
              <button type="button" className={view === 'archive' ? 'is-active' : ''} onClick={() => setView('archive')}>归档</button>
              <button type="button" className={view === 'trash' ? 'is-active' : ''} onClick={() => setView('trash')}>回收站</button>
            </div>
          </div>

          <div className="ca-toolbar">
            <label className="ca-search">
              <Search size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、简介或笔记正文…" />
              {query && <button type="button" onClick={() => setQuery('')} aria-label="清除搜索"><X size={13} /></button>}
            </label>
            <select className="ca-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">全部类型</option>
              <option value="world">世界</option>
              <option value="character">人物</option>
              <option value="location">地点</option>
              <option value="organization">组织</option>
              <option value="event">事件</option>
              <option value="story">故事</option>
              <option value="note">笔记</option>
              <option value="image">图片</option>
            </select>
            <button type="button" className="ca-icon-btn" title="刷新" onClick={() => void refreshAll()} disabled={listLoading}>
              <RefreshCw size={15} className={listLoading ? 'ca-spin' : ''} />
            </button>
            {worldId && (
              <button type="button" className="ca-btn ca-btn-sm" onClick={async () => {
                setBusy('import')
                try {
                  const imported = await request<{ created: number }>('/import', { method: 'POST', body: JSON.stringify({ world_id: worldId }) })
                  await refreshAll(imported.created ? `新导入 ${imported.created} 项内容` : '当前世界内容已在资产库中')
                } catch (err) { setError(errorInfo(err)) } finally { setBusy('') }
              }} disabled={busy === 'import'}>
                <Globe2 size={14} /> {busy === 'import' ? '整理中…' : '导入当前世界'}
              </button>
            )}
          </div>

          <div className="ca-table-head">
            <span>内容</span><span>状态</span><span>可见性</span><span>更新时间</span><span />
          </div>

          <div className="ca-table">
            {listLoading && !assets.length ? (
              <div className="ca-loading"><RefreshCw size={18} className="ca-spin" /> 正在整理资产…</div>
            ) : !assets.length ? (
              <div className="ca-empty">
                <FileText size={30} />
                <strong>{view === 'trash' ? '回收站是空的' : view === 'archive' ? '还没有归档内容' : '还没有内容'}</strong>
                <p>{view === 'active' ? '新建一条笔记，或进入一个世界把人物、地点、事件和故事整理进来。' : '在内容列表里执行归档或删除后，会出现在这里。'}</p>
                {view === 'active' && <button type="button" className="ca-btn ca-btn-primary" onClick={openCreateNote}><Plus size={14} /> 新建第一条笔记</button>}
              </div>
            ) : assets.map((asset) => {
              const Icon = TYPE_ICONS[asset.asset_type] || FileText
              const isBusy = busy.endsWith(asset.id)
              return (
                <div
                  key={asset.id}
                  className={`ca-row${selectedId === asset.id ? ' is-active' : ''}`}
                  onClick={() => selectAsset(asset)}
                >
                  <div className="ca-row-main">
                    <span className={`ca-type-icon ca-type-${asset.asset_type}`}><Icon size={17} /></span>
                    <div className="ca-row-text">
                      <strong>{asset.title}</strong>
                      <span>{excerpt(asset.description || asset.content || (asset.is_linked ? `关联${asset.asset_type_label} · 文件夹移动不影响源关联` : ''), 82)}</span>
                    </div>
                  </div>
                  <div className={`ca-status ca-status-${asset.status}`}>{STATUS_LABELS[asset.status] || asset.status}</div>
                  <div className={`ca-vis ca-vis-${asset.visibility}`}>{VISIBILITY_LABELS[asset.visibility] || asset.visibility}</div>
                  <div className="ca-row-date">{formatDate(asset.updated_at)}</div>
                  <div className="ca-row-actions">
                    {view === 'active' && asset.status !== 'archived' && (
                      <>
                        <button type="button" title="发布" disabled={isBusy} onClick={(event) => { event.stopPropagation(); openPublish(asset) }}><Send size={14} /></button>
                        <button type="button" title="归档" disabled={isBusy} onClick={(event) => { event.stopPropagation(); void archiveAsset(asset) }}><Archive size={14} /></button>
                        <button type="button" title="移入回收站" disabled={isBusy} onClick={(event) => { event.stopPropagation(); void deleteAsset(asset) }}><Trash2 size={14} /></button>
                      </>
                    )}
                    {view === 'archive' && (
                      <>
                        <button type="button" title="恢复" disabled={isBusy} onClick={(event) => { event.stopPropagation(); void restoreArchive(asset) }}><ArchiveRestore size={14} /></button>
                        <button type="button" title="移入回收站" disabled={isBusy} onClick={(event) => { event.stopPropagation(); void deleteAsset(asset) }}><Trash2 size={14} /></button>
                      </>
                    )}
                    {view === 'trash' && (
                      <>
                        <button type="button" title="恢复" disabled={isBusy} onClick={(event) => { event.stopPropagation(); void restoreAsset(asset) }}><RotateCcw size={14} /></button>
                        <button type="button" title="永久移除" disabled={isBusy} onClick={(event) => { event.stopPropagation(); void purgeAsset(asset) }}><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="ca-list-footer">
            <span>{assets.length} 项{view === 'active' ? ' · 文件夹计数不含归档与回收站' : ''}</span>
            <span>拖动文件夹不改内容身份 · 发布与归档分离</span>
          </div>
        </section>

        {detail && (
          <aside className="ca-panel ca-detail">
            <div className="ca-detail-head">
              <span className={`ca-type-icon ca-type-${detail.asset_type}`}><TypeIcon type={detail.asset_type} size={18} /></span>
              <div>
                <span className="ca-panel-kicker">{TYPE_LABELS[detail.asset_type] || detail.asset_type_label}</span>
                <h3>{detail.title}</h3>
              </div>
              <button type="button" className="ca-icon-btn ca-detail-close" onClick={() => { setSelectedId(''); setDetail(null) }} aria-label="关闭详情"><X size={15} /></button>
            </div>

            <div className="ca-detail-chips">
              <span className={`ca-status ca-status-${detail.status}`}>{STATUS_LABELS[detail.status]}</span>
              <span className={`ca-vis ca-vis-${detail.visibility}`}>{VISIBILITY_LABELS[detail.visibility]}</span>
              {detail.world_name && <span className="ca-chip-muted"><Globe2 size={12} /> {detail.world_name}</span>}
            </div>

            <div className="ca-detail-preview">
              {detail.asset_type === 'image' && detail.file_url ? (
                <img src={`${API_ORIGIN}${detail.file_url}`} alt={detail.title} />
              ) : detail.asset_type === 'note' && detail.content ? (
                <div className="ca-note-preview">{detail.content}</div>
              ) : detail.is_linked ? (
                <div className="ca-linked-preview">
                  <Link2 size={22} />
                  <strong>关联型内容</strong>
                  <p>{detail.description || `这是资产库中的${detail.asset_type_label}入口。源内容由对应模块管理，移动文件夹不会改变关联。`}</p>
                  <code>{detail.asset_type}:{detail.entity_id?.slice(0, 12)}</code>
                </div>
              ) : (
                <p className="ca-detail-empty">{detail.description || '暂无预览内容。'}</p>
              )}
            </div>

            {detail.references && detail.references.length > 0 && (
              <div className="ca-ref-warning">
                <div><Link2 size={14} /><strong>删除保护 · 仍被引用</strong></div>
                <p>以下内容还在使用它。删除会被阻止；建议改为归档。</p>
                <ul>
                  {detail.references.slice(0, 6).map((reference, index) => (
                    <li key={`${reference.kind}-${index}`}>{reference.kind}{reference.name ? ` · ${reference.name}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="ca-meta">
              <label>
                <span>所属文件夹</span>
                <select value={detail.folder_id || unfiledId} onChange={(event) => void moveAsset(event.target.value)} disabled={detail.status === 'deleted' || busy === 'move'}>
                  <option value={unfiledId || ''}>未分类内容</option>
                  {folders.map((folder) => <option key={folder.id} value={folder.id}>{folderPath(folder)}</option>)}
                </select>
              </label>
              <div><span>更新时间</span><b>{formatDate(detail.updated_at)}</b></div>
              {detail.published_at && <div><span>发布时间</span><b>{formatDate(detail.published_at)}</b></div>}
              {detail.status === 'deleted' && <div><span>删除时间</span><b>{formatDate(detail.deleted_at)}</b></div>}
              {detail.scope.length > 0 && <div><span>授权范围</span><b>{detail.scope.join(', ')}</b></div>}
            </div>

            <div className="ca-detail-actions">
              {detail.status !== 'deleted' && <button type="button" className="ca-btn" onClick={openEditAsset}><Pencil size={14} /> 编辑</button>}
              {(detail.asset_type === 'note' || detail.asset_type === 'image') && detail.status !== 'deleted' && (
                <button type="button" className="ca-btn" onClick={() => void duplicateAsset(detail)}><Copy size={14} /> 复制</button>
              )}
              {detail.status === 'published' && (
                <button type="button" className="ca-btn" onClick={() => openUnpublish(detail)}><Eye size={14} /> 下架公开展示</button>
              )}
              {detail.status !== 'deleted' && detail.status !== 'archived' && (
                <button type="button" className="ca-btn ca-btn-primary" onClick={() => openPublish(detail)}><Send size={14} /> {detail.status === 'published' ? '发布新版本' : '发布'}</button>
              )}
              {(detail.status === 'draft' || detail.status === 'published') && (
                <button type="button" className="ca-btn" onClick={() => void archiveAsset(detail)}><Archive size={14} /> 归档</button>
              )}
              {detail.status === 'archived' && <button type="button" className="ca-btn" onClick={() => void restoreArchive(detail)}><ArchiveRestore size={14} /> 恢复</button>}
              {detail.status === 'deleted' && <button type="button" className="ca-btn" onClick={() => void restoreAsset(detail)}><RotateCcw size={14} /> 恢复</button>}
              {detail.status === 'deleted' ? (
                <button type="button" className="ca-btn ca-btn-danger" onClick={() => void purgeAsset(detail)}><Trash2 size={14} /> 永久移除</button>
              ) : detail.status !== 'archived' ? (
                <button type="button" className="ca-btn ca-btn-danger" onClick={() => void deleteAsset(detail)}><Trash2 size={14} /> 移入回收站</button>
              ) : null}
            </div>

            {detail.publications && detail.publications.length > 0 && (
              <details className="ca-publications">
                <summary><CheckCircle2 size={14} /> 发布记录 · {detail.publications.length}</summary>
                {detail.publications.map((publication) => (
                  <div className="ca-publication" key={publication.id}>
                    <span>v{publication.version_no}</span>
                    <b>{VISIBILITY_LABELS[publication.visibility]}</b>
                    <em>{formatDate(publication.published_at)}</em>
                    {publication.unpublished_at && <small>已下架 · {formatDate(publication.unpublished_at)}</small>}
                  </div>
                ))}
              </details>
            )}
          </aside>
        )}
      </div>

      {folderDialog && (
        <div className="ca-modal-mask" onMouseDown={() => setFolderDialog(null)}>
          <div className="ca-modal ca-modal-sm" onMouseDown={(event) => event.stopPropagation()}>
            <div className="ca-modal-head">
              <div><span className="ca-panel-kicker">FOLDER</span><h3>{folderDialog.mode === 'create' ? '新建文件夹' : '编辑文件夹'}</h3></div>
              <button type="button" className="ca-icon-btn" onClick={() => setFolderDialog(null)}><X size={15} /></button>
            </div>
            <label className="ca-field"><span>文件夹名称</span><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="例如：角色设定 / 第一章素材" onKeyDown={(event) => { if (event.key === 'Enter') void submitFolder() }} /></label>
            <label className="ca-field"><span>上级文件夹</span>
              <select value={folderParent} onChange={(event) => setFolderParent(event.target.value)}>
                <option value="">根目录（我的创作空间）</option>
                {parentOptions.map((folder) => <option key={folder.id} value={folder.id}>{folderPath(folder)}</option>)}
              </select>
            </label>
            <div className="ca-modal-actions">
              <button type="button" className="ca-btn" onClick={() => setFolderDialog(null)}>取消</button>
              <button type="button" className="ca-btn ca-btn-primary" onClick={() => void submitFolder()} disabled={!folderName.trim() || busy === 'folder-dialog'}>{folderDialog.mode === 'create' ? '创建' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {assetDialog && (
        <div className="ca-modal-mask" onMouseDown={() => setAssetDialog(null)}>
          <div className="ca-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="ca-modal-head">
              <div><span className="ca-panel-kicker">{assetDialog.mode === 'create' ? 'NEW CONTENT' : 'EDIT CONTENT'}</span><h3>{assetDialog.mode === 'create' ? (assetDialog.assetType === 'image' ? '保存图片资产' : '新建笔记') : '编辑内容'}</h3></div>
              <button type="button" className="ca-icon-btn" onClick={() => setAssetDialog(null)}><X size={15} /></button>
            </div>
            {assetDialog.assetType === 'image' && assetDialog.fileUrl && (
              <div className="ca-upload-preview"><img src={`${API_ORIGIN}${assetDialog.fileUrl}`} alt="待保存图片" /></div>
            )}
            <label className="ca-field"><span>标题</span><input autoFocus value={assetTitle} onChange={(event) => setAssetTitle(event.target.value)} placeholder="给这份内容起一个名字" /></label>
            <label className="ca-field"><span>简介</span><input value={assetDescription} onChange={(event) => setAssetDescription(event.target.value)} placeholder="可选：一句话说明用途" /></label>
            {assetDialog.assetType === 'note' && (
              <label className="ca-field"><span>正文</span><textarea rows={9} value={assetContent} onChange={(event) => setAssetContent(event.target.value)} placeholder="记录设定、灵感、素材说明…" /></label>
            )}
            <label className="ca-field"><span>放入文件夹</span>
              <select value={assetFolder} onChange={(event) => setAssetFolder(event.target.value)}>
                <option value={unfiledId || ''}>未分类内容</option>
                {folders.map((folder) => <option key={folder.id} value={folder.id}>{folderPath(folder)}</option>)}
              </select>
            </label>
            <div className="ca-modal-actions">
              <button type="button" className="ca-btn" onClick={() => setAssetDialog(null)}>取消</button>
              <button type="button" className="ca-btn ca-btn-primary" onClick={() => void submitAsset()} disabled={!assetTitle.trim() || busy === 'asset-dialog'}>{assetDialog.mode === 'create' ? '保存内容' : '保存修改'}</button>
            </div>
          </div>
        </div>
      )}

      {publishDialog && (
        <div className="ca-modal-mask" onMouseDown={() => setPublishDialog(null)}>
          <div className="ca-modal ca-modal-sm" onMouseDown={(event) => event.stopPropagation()}>
            <div className="ca-modal-head">
              <div><span className="ca-panel-kicker">{publishDialog.mode === 'publish' ? 'PUBLISH' : 'UNPUBLISH'}</span><h3>{publishDialog.mode === 'publish' ? '发布内容' : '下架公开展示'}</h3></div>
              <button type="button" className="ca-icon-btn" onClick={() => setPublishDialog(null)}><X size={15} /></button>
            </div>
            <p className="ca-modal-hint">{publishDialog.mode === 'publish' ? '发布后仍保留完整编辑权；再次发布会产生新的版本记录。' : '下架只撤销公开展示，内容本身和发布记录都会保留。'}</p>
            <div className="ca-visibility-options">
              {publishDialog.mode === 'publish' && (
                <label className={publishVisibility === 'public' ? 'is-selected' : ''}>
                  <input type="radio" name="visibility" checked={publishVisibility === 'public'} onChange={() => setPublishVisibility('public')} />
                  <span><Globe2 size={15} /><b>公开</b><small>其他用户可在公开页浏览</small></span>
                </label>
              )}
              <label className={publishVisibility === 'scoped' ? 'is-selected' : ''}>
                <input type="radio" name="visibility" checked={publishVisibility === 'scoped'} onChange={() => setPublishVisibility('scoped')} />
                <span><Users size={15} /><b>指定范围</b><small>仅授权用户或成员可见</small></span>
              </label>
              <label className={publishVisibility === 'private' ? 'is-selected' : ''}>
                <input type="radio" name="visibility" checked={publishVisibility === 'private'} onChange={() => setPublishVisibility('private')} />
                <span><Eye size={15} /><b>私密</b><small>仅自己可见，保留发布状态</small></span>
              </label>
            </div>
            {publishVisibility === 'scoped' && (
              <label className="ca-field"><span>授权用户 / 成员标识</span><textarea rows={3} value={publishScope} onChange={(event) => setPublishScope(event.target.value)} placeholder="用逗号或换行分隔，例如：user_1024, editor_lin" /></label>
            )}
            <div className="ca-modal-actions">
              <button type="button" className="ca-btn" onClick={() => setPublishDialog(null)}>取消</button>
              <button type="button" className="ca-btn ca-btn-primary" onClick={() => void submitPublish()} disabled={busy === 'publish'}>{publishDialog.mode === 'publish' ? '确认发布' : '确认下架'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="ca-toast"><CheckCircle2 size={15} /> {toast}</div>}
    </div>
  )
}
