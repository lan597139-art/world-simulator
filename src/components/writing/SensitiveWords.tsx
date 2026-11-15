import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, FileUp, ShieldCheck, Trash2, X } from 'lucide-react'
import * as complianceApi from '../../api/writingCompliance'
import type { SensitiveHit, SensitiveWord } from '../../api/writingCompliance'

type Props = {
  text: string
  onClose: () => void
  onToast: (message: string) => void
}

export default function SensitiveWords({ text, onClose, onToast }: Props) {
  const [words, setWords] = useState<SensitiveWord[]>([])
  const [input, setInput] = useState('')
  const [replace, setReplace] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scan, setScan] = useState<{ hits: SensitiveHit[]; total: number } | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const rows = await complianceApi.listSensitiveWords()
      setWords(Array.isArray(rows) ? rows : [])
    } catch (error: any) {
      onToast(String(error?.message || error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const parsed = useMemo(
    () => Array.from(new Set(input.split(/[\n,，、;；]+/).map((word) => word.trim()).filter(Boolean))),
    [input],
  )

  const save = async () => {
    if (parsed.length === 0) {
      onToast('先粘贴或导入词条')
      return
    }
    setSaving(true)
    try {
      await complianceApi.saveSensitiveWords(parsed, replace)
      setInput('')
      await load()
      onToast(`已保存 ${parsed.length} 个词条`)
    } catch (error: any) {
      onToast(String(error?.message || error))
    } finally {
      setSaving(false)
    }
  }

  const importFile = async (file: File) => {
    const content = await file.text()
    setInput((prev) => `${prev}${prev ? '\n' : ''}${content}`)
    onToast('文件已读入，确认后点“保存词表”')
  }

  const scanNow = async () => {
    try {
      const result = await complianceApi.scanSensitiveText(text || '')
      setScan(result)
      onToast(result.total > 0 ? `发现 ${result.total} 处风险词` : '正文中没有命中当前词表')
    } catch (error: any) {
      onToast(String(error?.message || error))
    }
  }

  const remove = async (row: SensitiveWord) => {
    try {
      await complianceApi.deleteSensitiveWord(row.id)
      setWords((prev) => prev.filter((item) => item.id !== row.id))
    } catch (error: any) {
      onToast(String(error?.message || error))
    }
  }

  return (
    <div className="swl-overlay" role="dialog" aria-modal="true" aria-label="敏感词库">
      <div className="swl-modal">
        <header className="swl-head">
          <div>
            <div className="swl-kicker">PUBLISHING RISK / LOCAL LEXICON</div>
            <h2>敏感词库</h2>
            <p>默认空表。词表由你导入和维护，只在本账号生效；系统不会凭空替你判定违规。</p>
          </div>
          <button type="button" className="swl-close" onClick={onClose} aria-label="关闭"><X size={15} /></button>
        </header>

        <div className="swl-body">
          <section className="swl-import">
            <div className="swl-section-head">
              <strong>导入词条</strong>
              <label className="swl-check"><input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} /> 覆盖旧词表</label>
            </div>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={4}
              placeholder="每行一个词，或用逗号/顿号分隔。也可以从 txt/csv 导入。"
            />
            <div className="swl-import-foot">
              <span>{parsed.length} 个待保存词条</span>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.csv,text/plain,text/csv"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void importFile(file)
                    event.target.value = ''
                  }}
                />
                <button type="button" onClick={() => fileRef.current?.click()}><FileUp size={11} /> 导入文件</button>
                <button type="button" className="is-primary" disabled={saving || parsed.length === 0} onClick={() => void save()}>
                  {saving ? '保存中…' : '保存词表'}
                </button>
              </div>
            </div>
          </section>

          <section className="swl-scan">
            <div className="swl-section-head">
              <strong>扫描当前章节</strong>
              <span>{text.length.toLocaleString()} 字 · {words.length} 个词条</span>
            </div>
            <button type="button" className="swl-scan-btn" onClick={() => void scanNow()}>
              <ShieldCheck size={13} /> 开始扫描
            </button>
            {scan && (
              <div className={`swl-result${scan.total > 0 ? ' has-hit' : ''}`}>
                <div className="swl-result-head">
                  <strong>{scan.total > 0 ? `命中 ${scan.total} 处` : '没有命中'}</strong>
                  <span>{scan.hits.length} 个词条</span>
                </div>
                {scan.hits.length > 0 && (
                  <div className="swl-hits">
                    {scan.hits.map((hit) => (
                      <span key={hit.word} className={`swl-hit is-${hit.severity}`}>
                        {hit.word}<b>{hit.count}</b>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="swl-list">
            <div className="swl-section-head">
              <strong>当前词表</strong>
              <span>{words.length} 条</span>
            </div>
            {loading ? (
              <div className="swl-empty">读取词表…</div>
            ) : words.length === 0 ? (
              <div className="swl-empty">
                <AlertTriangle size={14} />
                <span>还没有词条。可以先导入平台发布规范里的风险词，或只维护你真正会误用的词。</span>
              </div>
            ) : (
              <div className="swl-words">
                {words.map((row) => (
                  <div key={row.id} className="swl-word">
                    <span>{row.word}</span>
                    <small>{row.category} · {row.severity === 'block' ? '阻断' : '提醒'}</small>
                    <button type="button" onClick={() => void remove(row)} title="删除"><Trash2 size={10} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="swl-foot">
          <span>扫描结果只作发布前提醒，不自动改正文。</span>
          <button type="button" className="is-primary" onClick={onClose}>完成</button>
        </footer>
      </div>
    </div>
  )
}
