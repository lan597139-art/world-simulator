import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Eye,
  Image as ImageIcon,
  Images,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { API_ORIGIN } from '../api/config'
import { resolveMediaUrl, uploadMedia } from '../api/media'
import {
  createComicAsset,
  createComicChapter,
  createComicPage,
  deleteComicAsset,
  deleteComicChapter,
  deleteComicPage,
  getComicWorkspace,
  reorderComicChapters,
  reorderComicPages,
  updateComicChapter,
  updateComicPage,
  type ComicAssetKind,
  type ComicChapter,
  type ComicPage,
  type ComicPageKind,
  type ComicWorkspace,
} from '../api/comicWorks'
import type { CreativeWork } from '../api/creativeWorks'
import '../styles/comic-workbench.css'

type Lang = 'zh' | 'en'
type Tab = 'pages' | 'assets' | 'preview'

const kindCopy: Record<string, { zh: string; en: string }> = {
  page: { zh: '单页', en: 'Page' },
  strip: { zh: '长条', en: 'Strip' },
  panel: { zh: '画格', en: 'Panel' },
  sketch: { zh: '分镜稿', en: 'Storyboard' },
  illustration: { zh: '插图', en: 'Illustration' },
  manuscript: { zh: '手稿', en: 'Manuscript' },
  character: { zh: '角色立绘', en: 'Character art' },
  cover: { zh: '封面', en: 'Cover' },
  other: { zh: '其他', en: 'Other' },
}

const assetKinds: ComicAssetKind[] = ['illustration', 'manuscript', 'panel', 'character', 'cover', 'other']

function storedUrl(url: string) {
  return url.startsWith(API_ORIGIN) ? url.slice(API_ORIGIN.length) : url
}

export default function ComicWorkbenchPage({
  work,
  lang,
  onBack,
}: {
  work: CreativeWork
  lang: Lang
  onBack: () => void
}) {
  const zh = lang === 'zh'
  const [workspace, setWorkspace] = useState<ComicWorkspace | null>(null)
  const [chapterId, setChapterId] = useState('')
  const [tab, setTab] = useState<Tab>('pages')
  const [previewMode, setPreviewMode] = useState<'page' | 'strip'>('page')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [newChapter, setNewChapter] = useState('')
  const [pageForm, setPageForm] = useState<{ id: string; caption: string; kind: ComicPageKind } | null>(null)
  const [assetKind, setAssetKind] = useState<ComicAssetKind>('illustration')

  const chapter = useMemo(
    () => workspace?.chapters.find((row) => row.id === chapterId) || workspace?.chapters[0] || null,
    [workspace, chapterId],
  )

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getComicWorkspace(work.id)
      setWorkspace(data)
      setChapterId((current) => data.chapters.some((row) => row.id === current) ? current : (data.chapters[0]?.id || ''))
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [work.id])

  const addChapter = async () => {
    const title = newChapter.trim()
    if (!title) return
    setBusy('chapter-add')
    try {
      await createComicChapter(work.id, { title })
      setNewChapter('')
      setFlash(zh ? '章节已创建' : 'Chapter created')
      await load()
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const renameChapter = async (row: ComicChapter, title: string) => {
    if (!title.trim() || title.trim() === row.title) return
    try {
      await updateComicChapter(work.id, row.id, { title: title.trim() })
      await load()
    } catch (err) {
      setError(String((err as Error)?.message || err))
    }
  }

  const moveChapter = async (row: ComicChapter, direction: -1 | 1) => {
    if (!workspace) return
    const rows = [...workspace.chapters]
    const index = rows.findIndex((item) => item.id === row.id)
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    ;[rows[index], rows[target]] = [rows[target], rows[index]]
    setBusy('chapter-order')
    try {
      setWorkspace(await reorderComicChapters(work.id, rows.map((item) => item.id)))
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const removeChapter = async (row: ComicChapter) => {
    if (!window.confirm(zh ? `删除章节「${row.title}」及其中 ${row.page_count} 张页面？` : `Delete “${row.title}” and its ${row.page_count} pages?`)) return
    setBusy(`chapter-delete:${row.id}`)
    try {
      await deleteComicChapter(work.id, row.id)
      setFlash(zh ? '章节已删除' : 'Chapter deleted')
      await load()
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const uploadFiles = async (files: FileList | File[], kind: 'page' | 'asset') => {
    const images = [...files].filter((file) => file.type.startsWith('image/'))
    if (!images.length) { setError(zh ? '请选择图片文件' : 'Choose image files'); return }
    if (kind === 'page' && !chapter) { setError(zh ? '请先创建章节' : 'Create a chapter first'); return }
    setBusy(kind === 'page' ? 'pages-upload' : 'assets-upload')
    setError('')
    try {
      for (const file of images) {
        const uploaded = await uploadMedia(file)
        const relative = storedUrl(uploaded.file_url)
        if (kind === 'page' && chapter) {
          await createComicPage(work.id, chapter.id, {
            image_url: relative,
            caption: file.name.replace(/\.[^.]+$/, ''),
            kind: previewMode === 'strip' ? 'strip' : 'page',
          })
        }
        await createComicAsset(work.id, {
          title: file.name.replace(/\.[^.]+$/, '').slice(0, 160) || (zh ? '作品图片' : 'Work image'),
          file_url: relative,
          kind: kind === 'page' ? 'panel' : assetKind,
          mime_type: uploaded.mime_type,
          file_size: uploaded.file_size,
        })
      }
      setFlash(kind === 'page' ? (zh ? `已加入 ${images.length} 张页面` : `${images.length} page(s) added`) : (zh ? `已入库 ${images.length} 张图片` : `${images.length} image(s) added`))
      await load()
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const movePage = async (page: ComicPage, direction: -1 | 1) => {
    if (!chapter) return
    const rows = [...chapter.pages]
    const index = rows.findIndex((item) => item.id === page.id)
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    ;[rows[index], rows[target]] = [rows[target], rows[index]]
    setBusy(`page-order:${page.id}`)
    try {
      setWorkspace(await reorderComicPages(work.id, chapter.id, rows.map((item) => item.id)))
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const removePage = async (page: ComicPage) => {
    if (!window.confirm(zh ? '删除这张页面？' : 'Delete this page?')) return
    setBusy(`page-delete:${page.id}`)
    try {
      await deleteComicPage(work.id, page.id)
      await load()
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const replacePage = async (page: ComicPage, file?: File) => {
    if (!file) return
    setBusy(`page-replace:${page.id}`)
    try {
      const uploaded = await uploadMedia(file)
      await updateComicPage(work.id, page.id, { image_url: storedUrl(uploaded.file_url) })
      await load()
      setFlash(zh ? '页面已替换' : 'Page replaced')
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const savePage = async () => {
    if (!pageForm) return
    setBusy(`page-save:${pageForm.id}`)
    try {
      await updateComicPage(work.id, pageForm.id, { caption: pageForm.caption, kind: pageForm.kind })
      setPageForm(null)
      await load()
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const addFromAsset = async (assetId: string) => {
    const asset = workspace?.assets.find((row) => row.id === assetId)
    if (!asset || !chapter) return
    setBusy(`asset-add:${assetId}`)
    try {
      await createComicPage(work.id, chapter.id, { image_url: asset.file_url, caption: asset.title, kind: 'page' })
      setFlash(zh ? '已从素材库加入页面' : 'Added from library')
      setTab('pages')
      await load()
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setBusy('')
    }
  }

  const removeAsset = async (assetId: string) => {
    if (!window.confirm(zh ? '从作品图片库移除？已插入页面的图片不会受影响。' : 'Remove from the work library? Pages already inserted are unaffected.')) return
    try {
      await deleteComicAsset(work.id, assetId)
      await load()
    } catch (err) {
      setError(String((err as Error)?.message || err))
    }
  }

  const previewPages = tab === 'preview' ? (chapter?.pages || []) : []

  return (
    <div className="comic-page">
      <header className="comic-head">
        <button type="button" className="comic-back" onClick={onBack}><ArrowLeft size={16} /> {zh ? '返回作品' : 'Back to works'}</button>
        <div className="comic-title">
          {work.cover_url ? <img src={resolveMediaUrl(work.cover_url)} alt="" /> : <span><Images size={20} /></span>}
          <div><small>{zh ? '漫画工作台' : 'Comic workbench'}</small><h1>{workspace?.work.title || work.title}</h1><p>{workspace?.work.summary || work.summary}</p></div>
        </div>
        <div className="comic-head-actions">
          <span className="comic-stat"><BookOpen size={13} /> {workspace?.chapters.length || 0} {zh ? '章' : 'ch.'}</span>
          <span className="comic-stat"><ImageIcon size={13} /> {workspace?.page_count || 0} {zh ? '页' : 'p.'}</span>
          <button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? 'is-spinning' : ''} /></button>
        </div>
      </header>

      {error && <div className="comic-alert is-error"><span>{error}</span><button type="button" onClick={() => setError('')}><X size={14} /></button></div>}
      {flash && <div className="comic-alert is-ok"><CheckCircle2 size={14} /> {flash}<button type="button" onClick={() => setFlash('')}><X size={14} /></button></div>}

      <div className="comic-layout">
        <aside className="comic-chapters">
          <div className="comic-side-title"><strong>{zh ? '章节' : 'Chapters'}</strong><span>{workspace?.chapters.length || 0}</span></div>
          <div className="comic-chapter-list">
            {workspace?.chapters.map((row, index) => (
              <div key={row.id} className={`comic-chapter${row.id === chapter?.id ? ' is-active' : ''}`} onClick={() => { setChapterId(row.id); setTab('pages') }}>
                <span className="comic-chapter-index">{String(index + 1).padStart(2, '0')}</span>
                <div className="comic-chapter-main">
                  <input defaultValue={row.title} key={`${row.id}:${row.title}`} onBlur={(event) => void renameChapter(row, event.target.value)} onClick={(event) => event.stopPropagation()} aria-label={zh ? '章节标题' : 'Chapter title'} />
                  <small>{row.page_count} {zh ? '页' : 'pages'} · {row.status === 'completed' ? (zh ? '已完成' : 'Done') : row.status === 'in_progress' ? (zh ? '进行中' : 'In progress') : (zh ? '草稿' : 'Draft')}</small>
                </div>
                <ChevronRight size={13} />
                <div className="comic-chapter-tools" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => void moveChapter(row, -1)} disabled={index === 0 || busy === 'chapter-order'}><ArrowUp size={11} /></button>
                  <button type="button" onClick={() => void moveChapter(row, 1)} disabled={index === (workspace?.chapters.length || 0) - 1 || busy === 'chapter-order'}><ArrowDown size={11} /></button>
                  <button type="button" className="is-danger" onClick={() => void removeChapter(row)} disabled={busy === `chapter-delete:${row.id}`}><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="comic-add-chapter">
            <input value={newChapter} onChange={(event) => setNewChapter(event.target.value)} placeholder={zh ? '新章节标题' : 'New chapter title'} onKeyDown={(event) => { if (event.key === 'Enter') void addChapter() }} />
            <button type="button" onClick={() => void addChapter()} disabled={!newChapter.trim() || busy === 'chapter-add'}><Plus size={13} /></button>
          </div>
        </aside>

        <main className="comic-main">
          <div className="comic-tabs">
            <button type="button" className={tab === 'pages' ? 'active' : ''} onClick={() => setTab('pages')}><ImageIcon size={14} /> {zh ? '页面编排' : 'Pages'}</button>
            <button type="button" className={tab === 'assets' ? 'active' : ''} onClick={() => setTab('assets')}><Images size={14} /> {zh ? '作品图片库' : 'Image library'} <span>{workspace?.assets.length || 0}</span></button>
            <button type="button" className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}><Eye size={14} /> {zh ? '预览' : 'Preview'}</button>
          </div>

          {tab === 'pages' && (
            chapter ? (
              <>
                <div className="comic-toolbar">
                  <div><h2>{chapter.title}</h2><p>{zh ? '上传画稿图片，按顺序组成单页或长条漫画。' : 'Upload artwork and order it into pages or a long-strip comic.'}</p></div>
                  <label className="comic-upload">
                    <UploadCloud size={14} /> {busy === 'pages-upload' ? (zh ? '上传中…' : 'Uploading…') : (zh ? '上传页面' : 'Upload pages')}
                    <input type="file" accept="image/*" multiple hidden onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files, 'page'); event.target.value = '' }} />
                  </label>
                </div>
                {!chapter.pages.length ? (
                  <div className="comic-empty"><ImageIcon size={26} /><strong>{zh ? '这一章还没有页面' : 'No pages in this chapter'}</strong><span>{zh ? '上传漫画手稿、插画或成品画格。' : 'Upload manuscript, illustrations, or finished panels.'}</span></div>
                ) : (
                  <div className="comic-pages">
                    {chapter.pages.map((page, index) => (
                      <article className="comic-page-card" key={page.id}>
                        <div className="comic-page-img"><img src={resolveMediaUrl(page.image_url)} alt={page.caption || `page ${index + 1}`} loading="lazy" /><span>{index + 1}</span></div>
                        <div className="comic-page-meta">
                          <div><strong>{page.caption || `${zh ? '第' : 'Page '}${index + 1}${zh ? '页' : ''}`}</strong><span>{kindCopy[page.kind]?.[lang] || page.kind}</span></div>
                          <div className="comic-page-tools">
                            <button type="button" title={zh ? '上移' : 'Move up'} onClick={() => void movePage(page, -1)} disabled={index === 0 || busy === `page-order:${page.id}`}><ArrowUp size={12} /></button>
                            <button type="button" title={zh ? '下移' : 'Move down'} onClick={() => void movePage(page, 1)} disabled={index === chapter.pages.length - 1 || busy === `page-order:${page.id}`}><ArrowDown size={12} /></button>
                            <button type="button" title={zh ? '编辑说明' : 'Edit caption'} onClick={() => setPageForm({ id: page.id, caption: page.caption, kind: page.kind })}><BookOpen size={12} /></button>
                            <label title={zh ? '替换图片' : 'Replace image'} className="comic-page-tool-label"><UploadCloud size={12} /><input type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void replacePage(page, file); event.target.value = '' }} /></label>
                            <button type="button" className="is-danger" title={zh ? '删除' : 'Delete'} onClick={() => void removePage(page)}><Trash2 size={12} /></button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="comic-empty"><BookOpen size={26} /><strong>{zh ? '先创建一个章节' : 'Create a chapter first'}</strong><span>{zh ? '在左侧输入章节标题，然后上传页面。' : 'Add a chapter title on the left, then upload pages.'}</span></div>
            )
          )}

          {tab === 'assets' && (
            <>
              <div className="comic-toolbar">
                <div><h2>{zh ? '作品图片库' : 'Work image library'}</h2><p>{zh ? '插图、手稿、画格、角色立绘与封面可重复插入不同章节。' : 'Reuse illustrations, manuscripts, panels, character art, and covers across chapters.'}</p></div>
                <div className="comic-asset-actions">
                  <select value={assetKind} onChange={(event) => setAssetKind(event.target.value as ComicAssetKind)}>
                    {assetKinds.map((kind) => <option key={kind} value={kind}>{kindCopy[kind]?.[lang] || kind}</option>)}
                  </select>
                  <label className="comic-upload"><UploadCloud size={14} /> {zh ? '上传图片' : 'Upload'}<input type="file" accept="image/*" multiple hidden onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files, 'asset'); event.target.value = '' }} /></label>
                </div>
              </div>
              {!workspace?.assets.length ? <div className="comic-empty"><Images size={26} /><strong>{zh ? '图片库为空' : 'Library is empty'}</strong></div> : (
                <div className="comic-assets">
                  {workspace.assets.map((asset) => (
                    <article key={asset.id} className="comic-asset-card">
                      <img src={resolveMediaUrl(asset.file_url)} alt={asset.title} loading="lazy" />
                      <div><strong>{asset.title}</strong><span>{kindCopy[asset.kind]?.[lang] || asset.kind}</span></div>
                      <div className="comic-asset-tools">
                        <button type="button" onClick={() => void addFromAsset(asset.id)} disabled={!chapter || busy === `asset-add:${asset.id}`}><Plus size={12} /> {zh ? '插入本章' : 'Add'}</button>
                        <button type="button" className="is-danger" onClick={() => void removeAsset(asset.id)}><Trash2 size={12} /></button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'preview' && (
            <>
              <div className="comic-toolbar">
                <div><h2>{chapter?.title || (zh ? '预览' : 'Preview')}</h2><p>{zh ? '按当前顺序预览单页或长条漫画。' : 'Preview pages or the long strip in current order.'}</p></div>
                <div className="comic-preview-switch">
                  <button type="button" className={previewMode === 'page' ? 'active' : ''} onClick={() => setPreviewMode('page')}>{zh ? '单页' : 'Pages'}</button>
                  <button type="button" className={previewMode === 'strip' ? 'active' : ''} onClick={() => setPreviewMode('strip')}>{zh ? '长条' : 'Strip'}</button>
                </div>
              </div>
              {!previewPages.length ? <div className="comic-empty"><Eye size={26} /><strong>{zh ? '暂无可预览页面' : 'No pages to preview'}</strong></div> : previewMode === 'strip' ? (
                <div className="comic-strip-preview">{previewPages.map((page) => <img key={page.id} src={resolveMediaUrl(page.image_url)} alt={page.caption || ''} loading="lazy" />)}</div>
              ) : (
                <div className="comic-preview-pages">{previewPages.map((page, index) => <figure key={page.id}><img src={resolveMediaUrl(page.image_url)} alt={page.caption || ''} loading="lazy" /><figcaption>{page.caption || `${zh ? '第' : 'Page '}${index + 1}`}</figcaption></figure>)}</div>
              )}
            </>
          )}
        </main>
      </div>

      {pageForm && (
        <div className="comic-modal-backdrop" onClick={() => setPageForm(null)}>
          <form className="comic-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void savePage() }}>
            <div className="comic-modal-head"><h3>{zh ? '页面信息' : 'Page details'}</h3><button type="button" onClick={() => setPageForm(null)}><X size={15} /></button></div>
            <label><span>{zh ? '图片说明' : 'Caption'}</span><textarea rows={3} value={pageForm.caption} onChange={(event) => setPageForm((prev) => prev ? { ...prev, caption: event.target.value } : prev)} /></label>
            <label><span>{zh ? '页面类型' : 'Page type'}</span><select value={pageForm.kind} onChange={(event) => setPageForm((prev) => prev ? { ...prev, kind: event.target.value as ComicPageKind } : prev)}>{(['page', 'strip', 'panel', 'sketch'] as ComicPageKind[]).map((kind) => <option key={kind} value={kind}>{kindCopy[kind]?.[lang] || kind}</option>)}</select></label>
            <div className="comic-modal-actions"><button type="button" onClick={() => setPageForm(null)}>{zh ? '取消' : 'Cancel'}</button><button type="submit" className="is-primary" disabled={busy === `page-save:${pageForm.id}`}>{zh ? '保存' : 'Save'}</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
