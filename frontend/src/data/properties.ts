import { resolveStorageUrl } from '../utils/mediaUrl'

export const PROPERTY_TYPES = ['Condo', 'House', 'House & Lot', 'Lot', 'Commercial'] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]
/** Sales pipeline: Draft → Available → Reserved → Under Negotiation → Processing Docs → Sold | Cancelled | Archived */
export type PropertyStatus =
  | 'draft'
  | 'available'
  | 'reserved'
  | 'under_negotiation'
  | 'processing_docs'
  | 'sold'
  | 'cancelled'
  | 'archived'

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: 'Draft',
  available: 'Available',
  reserved: 'Reserved',
  under_negotiation: 'Under Negotiation',
  processing_docs: 'Processing Docs',
  sold: 'Sold',
  cancelled: 'Cancelled',
  archived: 'Archived',
}

export const PROPERTY_STATUS_DESCRIPTIONS: Record<PropertyStatus, string> = {
  draft: 'Listing not yet ready. Hidden from public.',
  available: 'Live on market. Accepting inquiries.',
  reserved: 'Reservation fee received. Hold period.',
  under_negotiation: 'In discussion. Price / terms / docs.',
  processing_docs: 'Deal in progress. Paperwork / bank / turnover.',
  sold: 'Deal closed. Success.',
  cancelled: 'Deal fell through or listing withdrawn.',
  archived: 'Soft-deleted. Kept for records.',
}

export function getPropertyStatusLabel(s: PropertyStatus): string {
  return PROPERTY_STATUS_LABELS[s] ?? s
}

export function getPropertyStatusDescription(s: PropertyStatus): string {
  return PROPERTY_STATUS_DESCRIPTIONS[s] ?? ''
}

/**
 * Customer website: not draft/archived.
 * `showOnWebsite` defaults to true (matches DB); only an explicit `false` hides a listing.
 * (Using `=== true` before hid every row missing the field after API/local merge.)
 */
export function isPropertyPublicListing(p: Property): boolean {
  if (p.archived || p.status === 'archived') return false
  if (p.status === 'draft') return false
  if (p.showOnWebsite === false) return false
  return true
}

/** Main image first, then gallery; deduped. For public pages only. */
export function getPublicGalleryUrls(p: Property): string[] {
  const urls = [p.image, ...(p.gallery ?? [])].filter(Boolean) as string[]
  const normalized = urls.map((u) => resolveStorageUrl(u)).filter(Boolean)
  const seen = new Set<string>()
  return normalized.filter((u) => {
    if (seen.has(u)) return false
    seen.add(u)
    return true
  })
}

// ─── Payment Schemes (flexible, multi-developer) ─────────────────────────────

/** How a line item computes its peso value. */
export type PaymentLineItemType = 'fixed' | 'percent' | 'subtotal' | 'installment'

/**
 * One row in a payment computation sheet.
 * - fixed      : admin enters a fixed ₱ amount (negative = deduction)
 * - percent    : admin enters %, applied to the most-recent subtotal above it
 * - subtotal   : auto-sum of all items since the previous subtotal (or start)
 * - installment: admin enters total ₱ + months → monthly = total / months
 */
export interface PaymentLineItem {
  id: string
  label: string
  type: PaymentLineItemType
  /** ₱ for 'fixed' / 'installment'; decimal fraction for 'percent' (0.10 = 10%). */
  value: number
  /** Only for 'installment' — number of months. */
  termMonths?: number
  /** Small note displayed to the right (e.g. "** Special Discount"). */
  note?: string
}

/** One row in the financing terms table (bank, Pag-IBIG, in-house, etc.). */
export interface FinancingTerm {
  id: string
  institution: string
  termYears: number
  ratePercent: number
  /**
   * If set, overrides the PMT auto-calculation.
   * Useful when the developer's sheet has rounding differences.
   */
  monthlyAmort?: number
  /** Required buyer net income / month (optional guideline). */
  requiredIncome?: number
  /** e.g. "BPI MayBahay only", "with PDC" etc. */
  note?: string
}

/**
 * One named payment option (e.g. "10% DP – Pag-IBIG (18 mos.)").
 * A property can have multiple schemes, one per financing strategy.
 */
export interface PaymentScheme {
  id: string
  label: string
  promoNotes?: string
  lineItems: PaymentLineItem[]
  financingTerms: FinancingTerm[]
}

// ─── Legacy payment option tags ──────────────────────────────────────────────
export type PaymentOption = 'cash' | 'bank_loan' | 'in_house' | 'installment'

export const PAYMENT_OPTION_LABELS: Record<PaymentOption, string> = {
  cash: 'Cash',
  bank_loan: 'Bank Loan',
  in_house: 'In-House',
  installment: 'Installment',
}

export interface PriceHistoryEntry {
  price: string
  at: string
}

/** Full property record (admin form + profile). Base fields required; rest optional. */
export interface Property {
  id: string
  title: string
  location: string
  price: string
  image: string
  status: PropertyStatus
  type: PropertyType
  beds: number
  baths: number
  area: string
  leads: number
  updatedAt: string
  // Basic
  propertyCode?: string
  isPropertyGroup?: boolean
  parentPropertyId?: string | null
  unitLabel?: string
  phase?: string
  block?: string
  lot?: string
  developer?: string
  yearBuilt?: string
  // Location
  address?: string
  city?: string
  province?: string
  // Pricing
  downpayment?: string
  monthlyEst?: string
  negotiable?: boolean
  paymentOptions?: PaymentOption[]
  promoPrice?: string
  promoUntil?: string
  priceHistory?: PriceHistoryEntry[]
  /** Annual % for public mortgage calculator (admin-only; visitors cannot change it). */
  mortgageInterestRate?: number | null
  // Status & Sales
  availabilityDate?: string
  // Media
  gallery?: string[]
  floorPlan?: string
  virtualTourUrl?: string
  // Details
  /** Public-safe marketing copy for the website. Do not put internal notes, owner info, or legal IDs here. */
  publicDescription?: string
  floorArea?: string
  lotArea?: string
  parking?: number
  furnished?: boolean
  // Visibility (backend: show_on_website, facebook_post_url, is_featured)
  showOnWebsite?: boolean
  showOnFacebook?: boolean | string  // FB post URL when string (manual link)
  featuredListing?: boolean
  // Notes (admin only)
  internalNotes?: string
  ownerInstructions?: string
  // Legal & Ownership (structured; future-proof)
  titleType?: 'TCT' | 'CCT'
  titleNumber?: string
  registeredOwner?: string
  taxDeclarationNo?: string
  lastTransferDate?: string
  withEncumbrance?: boolean
  legalStatus?: string
  // Performance (read-only display)
  views?: number
  saves?: number
  // Documents (future-proof; URLs or data URLs)
  documentContract?: string
  documentReservationForm?: string
  documentTitleCopy?: string
  // Soft delete (archive)
  archived?: boolean
  archivedAt?: string
  archiveReason?: string
  // Payment schemes (multi-developer, flexible line items)
  paymentSchemes?: PaymentScheme[]
}

const TITLE_TYPE_PUBLIC_LABELS: Record<'TCT' | 'CCT', string> = {
  TCT: 'Transfer Certificate of Title (TCT)',
  CCT: 'Condominium Certificate of Title (CCT)',
}

/** Safe one-liner for public site (no title numbers or owner names). */
export function getPublicTitleTypeLabel(titleType?: 'TCT' | 'CCT'): string | null {
  if (!titleType) return null
  return TITLE_TYPE_PUBLIC_LABELS[titleType] ?? null
}

export const PROPERTIES: Property[] = []

// Admin: mutable store so profile/edit see same data
let adminPropertyStore: Property[] = [...PROPERTIES]
export function getPropertyStore(): Property[] {
  return adminPropertyStore
}
export function setPropertyStore(updater: (prev: Property[]) => Property[]) {
  adminPropertyStore = updater(adminPropertyStore)
  import('./simulationSnapshot').then(({ persistSimulationSnapshot }) => persistSimulationSnapshot())
}
export function getPropertyById(id: string): Property | undefined {
  return adminPropertyStore.find((p) => p.id === id)
}

/** Generates next property code: PREFIX-YEAR-SEQUENCE (e.g. CHR-2026-000123). Frontend-only; no backend. */
export function getNextPropertyCode(): string {
  const year = new Date().getFullYear()
  const prefix = `CHR-${year}-`
  const all = adminPropertyStore
  const sameYearCodes = all
    .map((p) => p.propertyCode || '')
    .filter((c) => c.startsWith(prefix))
  const nums = sameYearCodes
    .map((c) => parseInt(c.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n))
  const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `${prefix}${String(nextNum).padStart(6, '0')}`
}
