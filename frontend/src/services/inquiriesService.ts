import type { LeadPriority } from '../data/mockAdmin'
import { getInquiryStore, setInquiryStore, type InquiryRecord } from '../data/mockAdmin'
import { logActivity } from '../data/activityLog'
import { getPropertyById, setPropertyStore } from '../data/properties'
import { computeNextFollowUpDateFromTimeline, formatLocalDateOnly } from '../utils/inquiryFollowUp'
import { trackEvent } from './analyticsService'
import { apiPost, apiPut, apiDelete } from './api'

export type { InquiryRecord }

export function fetchInquiries(): InquiryRecord[] {
  return getInquiryStore()
}

export function saveInquiryStore(updater: (prev: InquiryRecord[]) => InquiryRecord[]): InquiryRecord[] {
  const next = updater(getInquiryStore())
  setInquiryStore(() => next)
  return next
}

function bumpPropertyLeads(propertyId: string | null) {
  if (!propertyId) return
  const prop = getPropertyById(propertyId)
  if (!prop) return
  setPropertyStore((prev) =>
    prev.map((p) => (p.id === propertyId ? { ...p, leads: (p.leads ?? 0) + 1, updatedAt: new Date().toISOString().slice(0, 10) } : p))
  )
}

export type CreatePublicInquiryPayload = {
  name: string
  email: string
  phone: string
  message: string
  propertyId: string | null
  propertyTitle: string
  /** 'property_page' | 'general' */
  origin: 'property_page' | 'general'
  source_manual?: string | null
  utm_campaign?: string | null
  utm_medium?: string | null
  utm_source?: string | null
  /** Property page mortgage calculator (optional) */
  estimatedMonthly?: number | null
  downpayment?: string | null
  loanTerm?: number | null
  interestRate?: number | null
  downpaymentPercent?: number | null
  /** Property page: calculator DP ≥ 20% */
  highBuyingIntent?: boolean
  budgetRange: string
  buyingTimeline: string
  financingMethod: string
  employmentStatus?: string | null
}

function buildLeadRecord(payload: CreatePublicInquiryPayload, id: string): InquiryRecord {
  const now = new Date()
  const nowIso = now.toISOString()
  const msg = payload.message.trim()
  const priority: LeadPriority = msg.length > 20 ? 'high' : 'medium'
  const nextFollowUpAt = computeNextFollowUpDateFromTimeline(now, payload.buyingTimeline)

  const utmSrc = payload.utm_source?.trim()
  const source_auto =
    payload.origin === 'property_page'
      ? utmSrc
        ? `Website Property Page (utm: ${utmSrc})`
        : 'Website Property Page'
      : utmSrc
        ? `Website General Inquiry (utm: ${utmSrc})`
        : 'Website General Inquiry'

  const manual = payload.source_manual?.trim() || null

  return {
    id,
    name: payload.name.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
    propertyId: payload.propertyId,
    propertyTitle: payload.propertyTitle.trim() || 'General inquiry',
    message: msg,
    notes: '',
    status: 'new',
    priority,
    createdAt: nowIso,
    lastContactedAt: null,
    nextFollowUpAt,
    lostReason: null,
    source_auto,
    source_manual: manual,
    utm_campaign: payload.utm_campaign?.trim() || null,
    utm_medium: payload.utm_medium?.trim() || null,
    linkedClientId: null,
    estimatedMonthly:
      payload.estimatedMonthly != null && Number.isFinite(payload.estimatedMonthly)
        ? payload.estimatedMonthly
        : null,
    downpayment: payload.downpayment?.trim() || null,
    loanTerm:
      payload.loanTerm != null && Number.isFinite(payload.loanTerm) ? payload.loanTerm : null,
    interestRate:
      payload.interestRate != null && Number.isFinite(payload.interestRate)
        ? payload.interestRate
        : null,
    downpaymentPercent:
      payload.downpaymentPercent != null && Number.isFinite(payload.downpaymentPercent)
        ? payload.downpaymentPercent
        : null,
    highBuyingIntent: !!payload.highBuyingIntent,
    budgetRange: payload.budgetRange?.trim() || null,
    buyingTimeline: payload.buyingTimeline?.trim() || null,
    financingMethod: payload.financingMethod?.trim() || null,
    employmentStatus: payload.employmentStatus?.trim() || null,
  }
}

function finalizeNewInquiry(lead: InquiryRecord, payload: CreatePublicInquiryPayload) {
  saveInquiryStore((prev) => [lead, ...prev])
  bumpPropertyLeads(payload.propertyId)

  logActivity({
    actor: 'Website User',
    action: 'created',
    entityType: 'inquiry',
    entityId: lead.id,
    entityLabel: lead.name,
    details: 'New inquiry created',
  })

  trackEvent('inquiry_submit', {
    propertyId: payload.propertyId ?? null,
    origin: payload.origin,
  })
}

/**
 * Website inquiry → shared lead store (admin sees immediately).
 * Hybrid: try `POST /api/inquiries` first (same-origin `/api` or `VITE_API_BASE_URL`); on failure use localStorage-backed store only.
 */
export async function createPublicInquiry(payload: CreatePublicInquiryPayload): Promise<InquiryRecord> {
  const id = `i${Date.now()}`
  const lead = buildLeadRecord(payload, id)

  if (typeof window !== 'undefined') {
    try {
      const res = await apiPost<{ data: InquiryRecord }>('/inquiries', lead)
      const saved = res.data
      saveInquiryStore((prev) => [saved, ...prev.filter((x) => x.id !== saved.id)])
      bumpPropertyLeads(payload.propertyId)
      logActivity({
        actor: 'Website User',
        action: 'created',
        entityType: 'inquiry',
        entityId: saved.id,
        entityLabel: saved.name,
        details: 'New inquiry created',
      })
      trackEvent('inquiry_submit', {
        propertyId: payload.propertyId ?? null,
        origin: payload.origin,
      })
      return saved
    } catch {
      /* local fallback */
    }
  }

  finalizeNewInquiry(lead, payload)
  return lead
}

/** @deprecated use createPublicInquiry */
export async function createWebsiteInquiry(payload: {
  name: string
  email: string
  phone: string
  message: string
  propertyId: string | null
  propertyTitle: string
  budgetRange: string
  buyingTimeline: string
  financingMethod: string
  employmentStatus?: string | null
  estimatedMonthly?: number | null
  downpayment?: string | null
  loanTerm?: number | null
  interestRate?: number | null
  downpaymentPercent?: number | null
  highBuyingIntent?: boolean
  utm_campaign?: string | null
  utm_medium?: string | null
  utm_source?: string | null
}) {
  return createPublicInquiry({
    ...payload,
    origin: 'property_page',
  })
}

type ApiInquiryEnvelope = { success?: boolean; data: InquiryRecord }

/** Full payload for Laravel InquiryController (camelCase keys → toDbColumns). */
export function inquiryRecordToApiBody(row: InquiryRecord): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    propertyId: row.propertyId,
    propertyTitle: row.propertyTitle,
    message: row.message,
    notes: row.notes ?? '',
    status: row.status,
    priority: row.priority ?? null,
    lastContactedAt: row.lastContactedAt ?? null,
    nextFollowUpAt: row.nextFollowUpAt ?? null,
    lostReason: row.lostReason ?? null,
    source_auto: row.source_auto ?? null,
    source_manual: row.source_manual ?? null,
    utm_campaign: row.utm_campaign ?? null,
    utm_medium: row.utm_medium ?? null,
    linkedClientId: row.linkedClientId ?? null,
    budgetRange: row.budgetRange ?? null,
    buyingTimeline: row.buyingTimeline ?? null,
    financingMethod: row.financingMethod ?? null,
    employmentStatus: row.employmentStatus ?? null,
    estimatedMonthly: row.estimatedMonthly ?? null,
    downpayment: row.downpayment ?? null,
    loanTerm: row.loanTerm ?? null,
    interestRate: row.interestRate ?? null,
    downpaymentPercent: row.downpaymentPercent ?? null,
    highBuyingIntent: row.highBuyingIntent ?? false,
  }
}

/**
 * Persist inquiry to Laravel (PUT /api/inquiries/{id}) — requires admin auth.
 * Call after local store updates so the DB matches the CRM.
 */
export async function updateInquiryInApi(row: InquiryRecord): Promise<InquiryRecord> {
  const res = await apiPut<ApiInquiryEnvelope>(
    `/inquiries/${encodeURIComponent(row.id)}`,
    inquiryRecordToApiBody(row)
  )
  return res.data
}

/** Quick action: record contact, update status to 'contacted', and push next follow-up +2 days (local date). */
export function markInquiryAsContacted(inquiryId: string) {
  const now = new Date()
  const next = new Date(now)
  next.setDate(next.getDate() + 2)
  saveInquiryStore((prev) =>
    prev.map((row) =>
      row.id === inquiryId
        ? {
            ...row,
            status: 'contacted' as const,
            lastContactedAt: now.toISOString(),
            nextFollowUpAt: formatLocalDateOnly(next),
          }
        : row
    )
  )
}

export async function deleteInquiryFromApi(id: string): Promise<void> {
  // Mock IDs (L177..., i177...) are local only. Skip API call to avoid 404.
  if (id.startsWith('L') || id.startsWith('i')) {
    return
  }
  await apiDelete(`/inquiries/${encodeURIComponent(id)}`)
}
