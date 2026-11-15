import { API_ORIGIN } from './config'

export function resolveMediaUrl(url: string | undefined | null): string {
  if (!url) return ''
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
  if (data.file_url.startsWith('/')) data.file_url = `${API_ORIGIN}${data.file_url}`
  return data
}
