/** Admin panel: single operator role only (no staff tier in this app). */
export type AdminRole = 'admin'

export interface AdminUser {
  id?: number
  role: AdminRole
  name: string
  email: string
}

export type ClientStatus = 'new' | 'active' | 'closed'

export interface Client {
  id: string
  name: string
  email: string
  phone: string
  status: ClientStatus
  createdAt: string
  history: { date: string; note: string }[]
}

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'Roberto Garcia',
    email: 'roberto.g@email.com',
    phone: '09171234567',
    status: 'active',
    createdAt: '2026-02-01',
    history: [
      { date: '2026-02-10', note: 'Viewed Greenfield Residence' },
      { date: '2026-02-05', note: 'Inquiry received, replied' },
    ],
  },
  {
    id: 'c2',
    name: 'Sandra Lim',
    email: 'sandra.lim@email.com',
    phone: '09187654321',
    status: 'new',
    createdAt: '2026-02-11',
    history: [{ date: '2026-02-11', note: 'Submitted inquiry for Solana Heights' }],
  },
  {
    id: 'c3',
    name: 'Carlos Mendoza',
    email: 'carlos.m@email.com',
    phone: '09199887766',
    status: 'closed',
    createdAt: '2026-01-15',
    history: [
      { date: '2026-02-01', note: 'Deal closed - Casa Verde' },
      { date: '2026-01-20', note: 'Site visit scheduled' },
    ],
  },
]

export type InquiryStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
export type LeadPriority = 'low' | 'medium' | 'high'

/**
 * Inquiry / lead record.
 * Backend note (DB): store source_auto (from UTM), source_manual (user dropdown), utm_campaign, utm_medium.
 * final_source logic when saving: if source_auto present use it, else source_manual, else 'unknown'.
 */
export interface InquiryRecord {
  id: string
  name: string
  email: string
  phone: string
  propertyId: string | null
  propertyTitle: string
  message: string
  notes?: string
  status: InquiryStatus
  priority?: LeadPriority
  createdAt: string
  lastContactedAt?: string | null
  nextFollowUpAt?: string | null
  lostReason?: string | null
  source_auto?: string | null
  source_manual?: string | null
  utm_campaign?: string | null
  utm_medium?: string | null
  /** Set when lead is converted to a client */
  linkedClientId?: string | null
  /** From property page payment calculator (optional) */
  estimatedMonthly?: number | null
  /** e.g. "20% (₱840,000)" or "₱500,000" */
  downpayment?: string | null
  loanTerm?: number | null
  interestRate?: number | null
  /** Effective DP % at time of inquiry (calculator) */
  downpaymentPercent?: number | null
  /** True when calculator estimate exists and DP ≥ 20% (property page) */
  highBuyingIntent?: boolean
  /** Lead qualification (website forms) */
  budgetRange?: string | null
  buyingTimeline?: string | null
  financingMethod?: string | null
  employmentStatus?: string | null
}

export const MOCK_INQUIRIES: InquiryRecord[] = [
  {
    id: 'i1',
    name: 'Sandra Lim',
    email: 'sandra.lim@email.com',
    phone: '09187654321',
    propertyId: '1',
    propertyTitle: 'Solana Heights — Unit 4A',
    message: 'Interested in this property. What are the payment terms?',
    notes: '',
    status: 'new',
    priority: 'medium',
    createdAt: '2026-02-11T14:30:00',
    lastContactedAt: null,
    nextFollowUpAt: null,
    lostReason: null,
    source_auto: 'facebook',
    source_manual: null,
    utm_campaign: 'promo_march',
    utm_medium: 'social',
  },
  {
    id: 'i2',
    name: 'Pedro Cruz',
    email: 'pedro.c@email.com',
    phone: '09171223344',
    propertyId: '4',
    propertyTitle: 'Greenfield Residence',
    message: 'Is this still available? Can we schedule a viewing?',
    notes: '',
    status: 'contacted',
    priority: 'high',
    createdAt: '2026-02-10T09:15:00',
    lastContactedAt: '2026-02-10T10:00:00Z',
    nextFollowUpAt: '2026-02-15',
    lostReason: null,
    source_auto: null,
    source_manual: 'referral',
    utm_campaign: null,
    utm_medium: null,
  },
  {
    id: 'i3',
    name: 'Carlos Mendoza',
    email: 'carlos.m@email.com',
    phone: '09199887766',
    propertyId: '6',
    propertyTitle: 'Talanai Homes — Apitong',
    message: 'Can you confirm the availability and total contract price?',
    notes: '',
    status: 'qualified',
    priority: 'medium',
    createdAt: '2026-02-09T11:10:00',
    lastContactedAt: '2026-02-09T12:30:00Z',
    nextFollowUpAt: '2026-02-14',
    lostReason: null,
    source_auto: null,
    source_manual: 'website',
    utm_campaign: 'lead_qualification',
    utm_medium: 'web',
  },
  {
    id: 'i4',
    name: 'Elena Reyes',
    email: 'elena.r@email.com',
    phone: '09181234567',
    propertyId: '2',
    propertyTitle: 'The Arcadia — Aberdeen',
    message: 'Ready to proceed with reservation and payment instructions.',
    notes: '',
    status: 'converted',
    priority: 'high',
    linkedClientId: 'c7',
    createdAt: '2026-02-08T16:45:00',
    lastContactedAt: '2026-02-08T17:05:00Z',
    nextFollowUpAt: null,
    lostReason: null,
    source_auto: 'facebook',
    source_manual: null,
    utm_campaign: null,
    utm_medium: null,
  },
  {
    id: 'i5',
    name: 'Roberto Garcia',
    email: 'roberto.g@email.com',
    phone: '09171234567',
    propertyId: '3',
    propertyTitle: 'Solana Heights — Unit 4A',
    message: 'Client went with another developer. Please close as lost.',
    notes: 'Lost after final comparison with competitor pricing.',
    status: 'lost',
    priority: 'low',
    createdAt: '2026-02-06T10:05:00',
    lastContactedAt: '2026-02-06T11:20:00Z',
    nextFollowUpAt: null,
    lostReason: 'Chose another developer',
    source_auto: null,
    source_manual: 'referral',
    utm_campaign: null,
    utm_medium: null,
  },
]

function isValidIsoDate(value: string | null | undefined): boolean {
  if (!value) return false
  const t = Date.parse(value)
  return !Number.isNaN(t)
}

function fallbackIsoFromId(id: string, index: number): string {
  const numericPart = Number(id.replace(/\D/g, ''))
  const offsetDays = Number.isNaN(numericPart) ? index : numericPart + index
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - offsetDays)
  return d.toISOString()
}

function normalizeOptionalDate(value: string | null | undefined): string | null {
  if (!value) return null
  return isValidIsoDate(value) ? new Date(value).toISOString() : null
}

/** YYYY-MM-DD only for nextFollowUpAt (safe for string compare). */
function normalizeFollowUpDateOnly(value: string | null | undefined): string | null {
  if (value == null || String(value).trim() === '') return null
  const s = String(value).trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

function normalizeInquiryDates(list: InquiryRecord[]): InquiryRecord[] {
  return list.map((lead, index) => {
    const rest = { ...lead } as InquiryRecord & { assignedTo?: string | null }
    delete (rest as { assignedTo?: string | null }).assignedTo
    return {
      ...rest,
      createdAt: isValidIsoDate(rest.createdAt) ? new Date(rest.createdAt).toISOString() : fallbackIsoFromId(rest.id, index),
      notes: rest.notes ?? '',
      priority: rest.priority ?? 'medium',
      lastContactedAt: normalizeOptionalDate(rest.lastContactedAt),
      nextFollowUpAt: normalizeFollowUpDateOnly(rest.nextFollowUpAt),
      lostReason: rest.lostReason ?? null,
      linkedClientId: rest.linkedClientId ?? null,
      estimatedMonthly: rest.estimatedMonthly ?? null,
      downpayment: rest.downpayment ?? null,
      loanTerm: rest.loanTerm ?? null,
      interestRate: rest.interestRate ?? null,
      downpaymentPercent: rest.downpaymentPercent ?? null,
      highBuyingIntent: rest.highBuyingIntent ?? false,
      budgetRange: rest.budgetRange ?? null,
      buyingTimeline: rest.buyingTimeline ?? null,
      financingMethod: rest.financingMethod ?? null,
      employmentStatus: rest.employmentStatus ?? null,
    }
  })
}

let inquiryStore: InquiryRecord[] = normalizeInquiryDates([...MOCK_INQUIRIES])

export function getInquiryStore(): InquiryRecord[] {
  return inquiryStore
}

export function setInquiryStore(updater: (prev: InquiryRecord[]) => InquiryRecord[]) {
  inquiryStore = normalizeInquiryDates(updater(inquiryStore))
  import('./simulationSnapshot').then(({ persistSimulationSnapshot }) => persistSimulationSnapshot())
}
