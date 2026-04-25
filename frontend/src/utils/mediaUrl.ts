import { getApiBaseUrl } from '../services/apiConfig'

/**
 * Normalize Laravel storage URLs for the SPA origin.
 *
 * In development, Vite proxies `/storage/*` to Laravel so relative paths work.
 * In production the frontend (chrealty.online) and the API (api.chrealty.online)
 * live on different origins, so we must prepend the API base URL to any
 * `/storage/…` path so the browser fetches the image from the correct host.
 */
export function resolveStorageUrl(src: string | undefined | null): string {
  if (src == null || typeof src !== 'string') return ''
  const s = src.trim()
  if (!s) return ''
  if (s.startsWith('data:') || s.startsWith('blob:')) return s

  // Extract the /storage/… portion from a full URL if present
  let storagePath = s
  const m = s.match(/^https?:\/\/[^/]+(\/storage\/.+)$/i)
  if (m) {
    storagePath = m[1]
  }

  // If it's a /storage/ path, prepend the API base URL in production
  if (storagePath.startsWith('/storage/') || storagePath.startsWith('/storage?')) {
    const base = getApiBaseUrl()
    // In dev base is empty → keep relative path (Vite proxy handles it)
    // In prod base is e.g. "https://api.chrealty.online" → full URL
    return base ? `${base}${storagePath}` : storagePath
  }

  return s
}
