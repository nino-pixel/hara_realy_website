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

export const PROPERTIES: Property[] = [
  {
    id: '1',
    title: 'Solana Heights — Unit 4A',
    location: 'Angeles City, Pampanga',
    price: '₱7,867,263',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80',
    status: 'available' as PropertyStatus,
    type: 'Condo' as PropertyType,
    beds: 4,
    baths: 3,
    area: '189 sqm',
    leads: 12,
    updatedAt: '2026-02-10',
    publicDescription:
      'Bright corner unit with floor-to-ceiling windows, four bedrooms, and a layout suited for families. The building offers shared amenities; parking included. Ideal if you want space and a established address in Angeles.',
    developer: 'Solana Development Corp.',
    yearBuilt: '2019',
    city: 'Angeles City',
    province: 'Pampanga',
    floorArea: '189 sqm',
    parking: 1,
    furnished: true,
    paymentOptions: ['bank_loan', 'in_house', 'installment'],
    downpayment: 'Approx. 20% (subject to approval)',
    monthlyEst: 'From ₱48,000/mo (estimate; depends on terms)',
    negotiable: true,
    gallery: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80',
    ],
    virtualTourUrl: 'https://example.com/virtual-tours/sample-unit',
    titleType: 'TCT',
    titleNumber: '12345',
    registeredOwner: 'Juan Dela Cruz',
    taxDeclarationNo: '2024-001234',
    lastTransferDate: '2023-06-15',
    withEncumbrance: false,
    legalStatus: 'Clean title',
    showOnWebsite: true,
  },
  {
    id: '2',
    title: 'The Arcadia — Aberdeen',
    location: 'Porac, Pampanga',
    price: '₱7,258,125',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80',
    status: 'available' as PropertyStatus,
    type: 'House' as PropertyType,
    beds: 4,
    baths: 2,
    area: '124 sqm',
    leads: 8,
    updatedAt: '2026-02-11',
    publicDescription:
      'Single-attached home in a quiet Porac subdivision. Four bedrooms, two baths, and room to grow. Good for buyers who want a house-and-lot feel with access toward Clark and major roads.',
    developer: 'Arcadia Homes',
    yearBuilt: '2021',
    city: 'Porac',
    province: 'Pampanga',
    floorArea: '124 sqm',
    lotArea: '165 sqm',
    parking: 2,
    furnished: false,
    paymentOptions: ['cash', 'bank_loan'],
    downpayment: 'Flexible; bank financing available',
    gallery: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
      'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80',
    ],
    showOnWebsite: true,
  },
  {
    id: '3',
    title: 'Talanai Homes — Apitong',
    location: 'Mabalacat City, Pampanga',
    price: '₱2,788,000',
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=600&q=80',
    status: 'sold' as PropertyStatus,
    type: 'House' as PropertyType,
    beds: 2,
    baths: 1,
    area: '50 sqm',
    leads: 5,
    updatedAt: '2026-02-01',
    showOnWebsite: true,
  },
  {
    id: '4',
    title: 'Greenfield Residence',
    location: 'Bulacan',
    price: '₱5,500,000',
    image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80',
    status: 'reserved' as PropertyStatus,
    type: 'House' as PropertyType,
    beds: 3,
    baths: 2,
    area: '95 sqm',
    leads: 3,
    updatedAt: '2026-02-09',
    showOnWebsite: true,
  },
  {
    id: '5',
    title: 'Sunrise Village Lot',
    location: 'Bataan',
    price: '₱1,200,000',
    image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600&q=80',
    status: 'available' as PropertyStatus,
    type: 'Lot' as PropertyType,
    beds: 0,
    baths: 0,
    area: '120 sqm',
    leads: 7,
    updatedAt: '2026-02-12',
    publicDescription:
      'Inner lot in a developing village—level terrain, ready for your house design. Competitive entry price for Bataan; utilities and subdivision rules confirmed with our team after inquiry.',
    developer: 'Sunrise Land Inc.',
    city: 'Mariveles',
    province: 'Bataan',
    lotArea: '120 sqm',
    paymentOptions: ['cash', 'in_house', 'installment'],
    monthlyEst: 'In-house terms available on request',
    gallery: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80'],
    showOnWebsite: true,
  },
  {
    id: '6',
    title: 'Casa Verde — Unit B',
    location: 'Pampanga',
    price: '₱4,100,000',
    image: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=600&q=80',
    status: 'sold' as PropertyStatus,
    type: 'Condo' as PropertyType,
    beds: 3,
    baths: 2,
    area: '88 sqm',
    leads: 4,
    updatedAt: '2026-01-28',
    showOnWebsite: true,
  },
  {
    id: '7',
    title: 'Pinecrest Condo — 12B',
    location: 'Angeles City, Pampanga',
    price: '₱3,850,000',
    image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80',
    status: 'under_negotiation' as PropertyStatus,
    type: 'Condo' as PropertyType,
    beds: 2,
    baths: 1,
    area: '62 sqm',
    leads: 15,
    updatedAt: '2026-02-11',
    showOnWebsite: true,
  },
  {
    id: '8',
    title: 'Mountain View Lot — Block 3',
    location: 'Tarlac',
    price: '₱980,000',
    image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600&q=80',
    status: 'available' as PropertyStatus,
    type: 'Lot' as PropertyType,
    beds: 0,
    baths: 0,
    area: '200 sqm',
    leads: 22,
    updatedAt: '2026-02-12',
    publicDescription:
      'Larger lot with elevation and views toward the east. Suited for a rest house or future build. Corner of the village map—ask us for the latest subdivision plan and restrictions.',
    city: 'Tarlac City',
    province: 'Tarlac',
    lotArea: '200 sqm',
    paymentOptions: ['cash', 'bank_loan'],
    negotiable: true,
    gallery: [
      'https://images.unsplash.com/photo-1500076656116-558359c3d73c?w=800&q=80',
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80',
    ],
    showOnWebsite: true,
  },
  {
    id: '9',
    title: 'Legacy Heights — Unit 5C',
    location: 'Angeles City, Pampanga',
    price: '₱4,500,000',
    image: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=600&q=80',
    status: 'draft' as PropertyStatus,
    type: 'Condo' as PropertyType,
    beds: 3,
    baths: 2,
    area: '78 sqm',
    leads: 0,
    updatedAt: '2026-02-08',
    showOnWebsite: false,
  },
  {
    id: '10',
    title: 'Old Pampanga Lot — Withdrawn',
    location: 'Pampanga',
    price: '₱850,000',
    image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600&q=80',
    status: 'archived' as PropertyStatus,
    type: 'Lot' as PropertyType,
    beds: 0,
    baths: 0,
    area: '100 sqm',
    leads: 2,
    updatedAt: '2024-11-15',
    archived: true,
    showOnWebsite: false,
  },
]

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
