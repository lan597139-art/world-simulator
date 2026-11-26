import { API_ORIGIN, LEGACY_API_ORIGIN } from './config'

export function resolveMediaUrl(url: string | undefined | null): string {
  if (!url) return ''
  // 平台内置背景随前端发布，不能错误地拼到后端域名。
  if (url.startsWith('/backgrounds/') || url.startsWith('/official-photos/')) return url
  // 兼容历史数据：早期上传把绝对地址写进了库，去掉本地开发域名后再按相对路径解析。
  if (url.startsWith(LEGACY_API_ORIGIN)) {
    const rest = url.slice(LEGACY_API_ORIGIN.length)
    return rest.startsWith('/') ? `${API_ORIGIN}${rest}` : rest
  }
  return url.startsWith('/') ? `${API_ORIGIN}${url}` : url
}

export type UploadedMedia = {
  file_url: string
  storage: 'local' | 's3'
  mime_type: string
  file_size: number
  original_name: string
}

export async function uploadMedia(file: File): Promise<UploadedMedia> {
  const response = await fetch(
    `${API_ORIGIN}/api/creator-assets/upload?filename=${encodeURIComponent(file.name)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    },
  )
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try { const body = await response.json(); if (body?.detail) message = body.detail } catch { /* status */ }
    throw new Error(message)
  }
  const data = await response.json() as UploadedMedia
  // 统一返回相对路径，落库后换域名/端口依然可用；需要立即展示时用 resolveMediaUrl 解析。
  if (data.file_url.startsWith(API_ORIGIN)) data.file_url = data.file_url.slice(API_ORIGIN.length)
  return data
}


/** 将已上传文件登记进创作者媒体资产库；失败不阻断主流程。 */
export async function recordMediaAsset(input: {
  title: string
  fileUrl: string
  mimeType?: string
  fileSize?: number
  description?: string
}): Promise<void> {
  const relative = input.fileUrl.startsWith(API_ORIGIN) ? input.fileUrl.slice(API_ORIGIN.length) : input.fileUrl
  await fetch(`${API_ORIGIN}/api/creator-assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset_type: 'image',
      title: input.title,
      file_url: relative,
      mime_type: input.mimeType || '',
      file_size: input.fileSize || 0,
      description: input.description || '',
    }),
  })
}
