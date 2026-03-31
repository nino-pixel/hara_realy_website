/**
 * Persist property to Laravel (POST /api/properties) — requires admin auth (Sanctum).
 * Uses multipart FormData when uploading images (no base64 in JSON).
 */
import type { Property } from '../data/properties'
import { apiPost, apiPostFormData, apiDelete } from './api'

type ApiPropertyResponse = { success: boolean; data: Property }

export type PropertyImageUpload = {
  coverFile: File | null
  galleryFiles: File[]
  /** Sent as multipart field `floorPlan` — never base64 in JSON */
  floorPlanFile: File | null
  /** Sent as multipart fields — never base64 in JSON */
  documentContractFile: File | null
  documentReservationFormFile: File | null
  documentTitleCopyFile: File | null
}

/**
 * Remove data URLs from JSON payload (files are sent separately as multipart).
 */
export function stripPropertyForMultipartJson(
  p: Property,
  options?: {
    omitFloorPlanPath?: boolean
    omitDocumentContractPath?: boolean
    omitDocumentReservationFormPath?: boolean
    omitDocumentTitleCopyPath?: boolean
  }
): Property {
  const raw = { ...p } as Record<string, unknown>

  if (typeof raw.image === 'string' && raw.image.startsWith('data:')) {
    raw.image = ''
  }

  if (Array.isArray(raw.gallery)) {
    raw.gallery = raw.gallery.filter((x) => typeof x === 'string' && !String(x).startsWith('data:'))
  }

  if (typeof raw.floorPlan === 'string' && raw.floorPlan.startsWith('data:')) {
    delete raw.floorPlan
  }
  if (typeof raw.documentContract === 'string' && raw.documentContract.startsWith('data:')) {
    delete raw.documentContract
  }
  if (typeof raw.documentReservationForm === 'string' && raw.documentReservationForm.startsWith('data:')) {
    delete raw.documentReservationForm
  }
  if (typeof raw.documentTitleCopy === 'string' && raw.documentTitleCopy.startsWith('data:')) {
    delete raw.documentTitleCopy
  }

  if (options?.omitFloorPlanPath) {
    delete raw.floorPlan
  }
  if (options?.omitDocumentContractPath) {
    delete raw.documentContract
  }
  if (options?.omitDocumentReservationFormPath) {
    delete raw.documentReservationForm
  }
  if (options?.omitDocumentTitleCopyPath) {
    delete raw.documentTitleCopy
  }

  return raw as unknown as Property
}

/**
 * Flat payload: core columns validated by API; everything else is stored in `extra` JSON.
 */
export function propertyToApiPayload(p: Property): Record<string, unknown> {
  return {
    ...p,
    id: String(p.id),
    title: String(p.title ?? '').trim() || 'Untitled',
    location: String(p.location ?? '').trim() || '—',
    price: String(p.price ?? '').trim() || '₱0',
    type: p.type ?? 'House',
    status: p.status ?? 'draft',
    beds: typeof p.beds === 'number' ? p.beds : Number(p.beds) || 0,
    baths: typeof p.baths === 'number' ? p.baths : Number(p.baths) || 0,
    area: p.area ?? '',
    image: p.image ?? '',
    showOnWebsite: p.showOnWebsite !== false,
    archived: Boolean(p.archived),
  }
}

export async function persistPropertyToApi(
  p: Property,
  upload?: PropertyImageUpload,
  onUploadProgress?: (ratio: number) => void
): Promise<Property> {
  const hasFiles = !!(
    upload?.coverFile ||
    (upload?.galleryFiles?.length ?? 0) > 0 ||
    upload?.floorPlanFile ||
    upload?.documentContractFile ||
    upload?.documentReservationFormFile ||
    upload?.documentTitleCopyFile
  )

  if (hasFiles) {
    const body = stripPropertyForMultipartJson(p, {
      omitFloorPlanPath: Boolean(upload?.floorPlanFile),
      omitDocumentContractPath: Boolean(upload?.documentContractFile),
      omitDocumentReservationFormPath: Boolean(upload?.documentReservationFormFile),
      omitDocumentTitleCopyPath: Boolean(upload?.documentTitleCopyFile),
    })
    const fd = new FormData()
    fd.append('property', JSON.stringify(body))
    if (upload?.coverFile) {
      fd.append('cover', upload.coverFile)
    }
    for (const f of upload?.galleryFiles ?? []) {
      fd.append('gallery[]', f)
    }
    if (upload?.floorPlanFile) {
      fd.append('floorPlan', upload.floorPlanFile)
    }
    if (upload?.documentContractFile) {
      fd.append('documentContract', upload.documentContractFile)
    }
    if (upload?.documentReservationFormFile) {
      fd.append('documentReservationForm', upload.documentReservationFormFile)
    }
    if (upload?.documentTitleCopyFile) {
      fd.append('documentTitleCopy', upload.documentTitleCopyFile)
    }

    const res = await apiPostFormData<ApiPropertyResponse>('/properties', fd, {
      onUploadProgress: (loaded, total) => {
        if (total > 0) onUploadProgress?.(loaded / total)
      },
    })

    const data = res.data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid property response from server.')
    }
    return data as Property
  }

  const res = await apiPost<ApiPropertyResponse>(
    '/properties',
    propertyToApiPayload(stripPropertyForMultipartJson(p))
  )
  const data = res.data
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid property response from server.')
  }
  return data as Property
}

export async function deletePropertyFromApi(id: string | number): Promise<void> {
  const sid = String(id)
  // Mock IDs (p177...) are local only. Skip API call to avoid 404.
  if (sid.startsWith('p')) {
    return
  }
  await apiDelete(`/properties/${encodeURIComponent(sid)}`)
}
