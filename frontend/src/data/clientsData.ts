/**
 * Clients management — mock data and types.
 * BACKEND NOTES: See BACKEND_NOTES.md for clients table schema and related tables (inquiries.client_id, transactions.client_id, favorites.client_id).
 */

export type ClientSource = 'Facebook' | 'Website' | 'Referral' | 'Walk-in'
export type ClientStatus =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'negotiating'
  | 'reserved'
  | 'closed'
  | 'lost'
  | 'inactive'

export type LastActivityType = 'Inquiry' | 'Call' | 'Email' | 'Meeting' | 'Reservation' | 'Note'

export interface ClientRecord {
  id: string
  name: string
  email: string
  phone: string
  /** Single-line display (Bulacan formatted); legacy rows may only have this. */
  address: string
  /** Always Bulacan for new clients */
  province?: string
  municipality?: string
  barangay?: string
  /** Optional sitio / purok / street */
  purokOrStreet?: string
  source: ClientSource
  status: ClientStatus
  notes: string
  createdAt: string
  updatedAt: string
  dealsCount: number
  lastActivity: string
  lastActivityType?: LastActivityType
  adminNotes: string
  isPriority?: boolean
  lastContact?: string
  nextFollowUp?: string
  archived?: boolean
  archivedAt?: string
  archiveReason?: string
  leadOriginId?: string | null
  leadPropertyId?: string | null
  leadPropertyTitle?: string | null
}

export interface ClientInquiryRow {
  id: string
  propertyTitle: string
  message: string
  date: string
  status: string
}

/**
 * Single payment entry. UI currently uses reservation | downpayment | full_payment.
 * Backend should allow flexible types (e.g. reservation, dp1, dp2, bank_release, balance)
 * so multiple partial payments sum to sale price. Payments array = progress toward sale price.
 */
export interface DealPaymentEntry {
  type: 'reservation' | 'downpayment' | 'full_payment'
  amount: string
  date: string
  proof?: string
  notes?: string
}

/** Document tracking: status + when uploaded + file ref */
export interface DealDocumentTrack {
  status: 'pending' | 'uploaded'
  uploadedAt?: string
  fileRef?: string
}

/** One entry in deal status timeline (pipeline history) */
export interface DealStatusHistoryEntry {
  status: string
  at: string
  note?: string
}

export interface ClientTransactionRow {
  id: string
  /** Display id for Deals module (e.g. DL-001). Optional for backward compat. */
  dealId?: string
  propertyTitle: string
  propertyId?: string
  amount: string
  date: string
  status: string
  payment?: string
  agent?: string
  /** Property listing price (e.g. ₱4,200,000) */
  propertyPrice?: string
  /** Final agreed sale price if different from listing */
  finalSalePrice?: string
  /** Payment method (Cash, Bank Transfer, etc.) */
  paymentMethod?: string
  /** When deal record was created (ISO date) */
  createdAt?: string
  /** When deal closed (ISO date) */
  closingDate?: string
  /** Expected closing date (ISO) — track delays vs actual closing. */
  expectedClosingDate?: string
  /** When deal is Cancelled: reason (e.g. Client backed out, Loan rejected, Price disagreement, Property sold to another). Optional — for analyzing why deals fail. */
  cancelledReason?: string
  /** Admin-only notes for this deal */
  adminNotes?: string
  /** Last time deal record was updated (ISO date) */
  updatedAt?: string
  /** Payments: Reservation, Downpayment(s), Full payment. Single source of truth — no separate reservationFee. */
  payments?: DealPaymentEntry[]
  /** Document tracking: status (pending/uploaded), uploadedAt, fileRef */
  documents?: {
    reservationForm?: DealDocumentTrack
    contract?: DealDocumentTrack
    receipt?: DealDocumentTrack
  }
  /** Deal pipeline status history (timeline). Each status change with at + optional note. */
  statusHistory?: DealStatusHistoryEntry[]
  /** Activity log for this deal (created, status_changed, document_uploaded) */
  activity?: Array<{
    type: 'created' | 'status_changed' | 'document_uploaded'
    date: string
    label: string
    details?: string
  }>
  leadOriginId?: string | null
}

export interface ClientSavedProperty {
  id: string
  propertyTitle: string
  propertyId: string
}

export const MOCK_CLIENTS: ClientRecord[] = [
  {
    id: 'c1',
    name: 'Roberto Garcia',
    email: 'roberto.g@email.com',
    phone: '09171234567',
    address: '123 Rizal St, Malolos, Bulacan',
    source: 'Website',
    status: 'interested',
    notes: '',
    createdAt: '2026-02-01',
    updatedAt: '2026-02-10',
    dealsCount: 0,
    lastActivity: '2026-02-10',
    lastActivityType: 'Inquiry',
    adminNotes: 'Interested in 3BR. Budget 5M.',
    lastContact: '2026-02-12',
    nextFollowUp: '2026-02-20',
    isPriority: true,
  },
  {
    id: 'c2',
    name: 'Sandra Lim',
    email: 'sandra.lim@email.com',
    phone: '09187654321',
    address: '45 Mabini, Guiguinto, Bulacan',
    source: 'Facebook',
    status: 'new',
    notes: '',
    createdAt: '2026-02-11',
    updatedAt: '2026-02-11',
    dealsCount: 0,
    lastActivity: '2026-02-11',
    lastActivityType: 'Inquiry',
    adminNotes: '',
  },
  {
    id: 'c3',
    name: 'Carlos Mendoza',
    email: 'carlos.m@email.com',
    phone: '09199887766',
    address: '78 Poblacion, Bocaue, Bulacan',
    source: 'Referral',
    status: 'closed',
    notes: '',
    createdAt: '2026-01-15',
    updatedAt: '2026-02-01',
    dealsCount: 1,
    lastActivity: '2026-02-01',
    lastActivityType: 'Reservation',
    adminNotes: 'Client prefers condo near mall. Budget: 3M max.',
  },
  {
    id: 'c4',
    name: 'Pedro Cruz',
    email: 'pedro.c@email.com',
    phone: '09171223344',
    address: '22 MacArthur Hwy, Marilao',
    source: 'Facebook',
    status: 'contacted',
    notes: '',
    createdAt: '2026-02-10',
    updatedAt: '2026-02-10',
    dealsCount: 0,
    lastActivity: '2026-02-10',
    lastActivityType: 'Call',
    adminNotes: '',
  },
  {
    id: 'c5',
    name: 'Maria Lopez',
    email: 'maria.lopez@email.com',
    phone: '09165554433',
    address: '',
    source: 'Website',
    status: 'inactive',
    notes: '',
    createdAt: '2026-01-20',
    updatedAt: '2026-01-28',
    dealsCount: 0,
    lastActivity: '2026-01-28',
    lastActivityType: 'Email',
    adminNotes: '',
  },
  {
    id: 'c6',
    name: 'Jose Santos',
    email: 'jose.s@email.com',
    phone: '09178889900',
    address: 'Angeles City, Pampanga',
    source: 'Walk-in',
    status: 'closed',
    notes: '',
    createdAt: '2026-01-28',
    updatedAt: '2026-01-28',
    dealsCount: 1,
    lastActivity: '2026-01-28',
    lastActivityType: 'Reservation',
    adminNotes: '',
  },
  {
    id: 'c7',
    name: 'Elena Reyes',
    email: 'elena.r@email.com',
    phone: '09181234567',
    address: 'Mabalacat City',
    source: 'Facebook',
    status: 'negotiating',
    notes: '',
    createdAt: '2026-02-08',
    updatedAt: '2026-02-08',
    dealsCount: 0,
    lastActivity: '2026-02-08',
    lastActivityType: 'Inquiry',
    adminNotes: '',
  },
]

let transactionsStore: Record<string, ClientTransactionRow[]> = JSON.parse(JSON.stringify({
  c1: [],
  c2: [],
  c3: [
    {
      id: 't1',
      dealId: 'DL-001',
      propertyTitle: 'Casa Verde — Unit B',
      propertyId: '6',
      amount: '₱4,100,000',
      date: '2026-02-01',
      status: 'Closed',
      propertyPrice: '₱4,200,000',
      finalSalePrice: '₱4,100,000',
      createdAt: '2026-01-20',
      closingDate: '2026-02-01',
      expectedClosingDate: '2026-01-28',
      updatedAt: '2026-02-01',
      paymentMethod: 'Bank Transfer',
      payments: [
        { type: 'reservation', amount: '₱50,000', date: '2026-01-21', notes: 'Reservation fee received' },
        { type: 'downpayment', amount: '₱1,200,000', date: '2026-01-28', proof: 'receipt-dp-dl001.pdf' },
        { type: 'full_payment', amount: '₱4,100,000', date: '2026-02-01', proof: 'receipt-dl001.pdf' },
      ],
      documents: {
        reservationForm: { status: 'uploaded', uploadedAt: '2026-01-21', fileRef: 'reservation-dl001.pdf' },
        contract: { status: 'uploaded', uploadedAt: '2026-01-28', fileRef: 'contract-dl001.pdf' },
        receipt: { status: 'uploaded', uploadedAt: '2026-02-01', fileRef: 'receipt-dl001.pdf' },
      },
      statusHistory: [
        { status: 'Inquiry', at: '2026-01-20', note: 'Deal created' },
        { status: 'Negotiation', at: '2026-01-21' },
        { status: 'Reserved', at: '2026-01-21', note: 'Reservation fee received' },
        { status: 'Processing Documents', at: '2026-01-28' },
        { status: 'Closed', at: '2026-02-01' },
      ],
      activity: [
        { type: 'created', date: '2026-01-20', label: 'Deal created' },
        { type: 'status_changed', date: '2026-01-25', label: 'Status changed to Reserved', details: 'Reservation fee received' },
        { type: 'document_uploaded', date: '2026-01-28', label: 'Contract to Sell uploaded' },
        { type: 'status_changed', date: '2026-02-01', label: 'Status changed to Closed' },
      ],
    },
  ],
  c4: [],
  c5: [],
  c6: [
    {
      id: 't2',
      dealId: 'DL-002',
      propertyTitle: 'Talanai Homes — Apitong',
      propertyId: '3',
      amount: '₱2,788,000',
      date: '2026-01-28',
      status: 'Closed',
      propertyPrice: '₱2,788,000',
      finalSalePrice: '₱2,788,000',
      createdAt: '2026-01-25',
      closingDate: '2026-01-28',
      expectedClosingDate: '2026-01-27',
      updatedAt: '2026-01-28',
      paymentMethod: 'Cash',
      payments: [
        { type: 'reservation', amount: '₱30,000', date: '2026-01-25' },
        { type: 'full_payment', amount: '₱2,788,000', date: '2026-01-28', proof: 'receipt-dl002.pdf' },
      ],
      documents: {
        reservationForm: { status: 'uploaded', uploadedAt: '2026-01-27', fileRef: 'reservation-dl002.pdf' },
        contract: { status: 'pending' },
        receipt: { status: 'uploaded', uploadedAt: '2026-01-28', fileRef: 'receipt-dl002.pdf' },
      },
      statusHistory: [
        { status: 'Inquiry', at: '2026-01-25', note: 'Deal created' },
        { status: 'Reserved', at: '2026-01-25' },
        { status: 'Closed', at: '2026-01-28' },
      ],
      activity: [
        { type: 'created', date: '2026-01-25', label: 'Deal created' },
        { type: 'document_uploaded', date: '2026-01-27', label: 'Reservation Form uploaded' },
        { type: 'status_changed', date: '2026-01-28', label: 'Status changed to Closed' },
      ],
    },
  ],
  c7: [],
}))

export function getTransactionsByClientId(clientId: string): ClientTransactionRow[] {
  return transactionsStore[clientId] ?? []
}

export function getTransactionsStoreSnapshot(): Record<string, ClientTransactionRow[]> {
  return JSON.parse(JSON.stringify(transactionsStore)) as Record<string, ClientTransactionRow[]>
}

export function replaceTransactionsStore(next: Record<string, ClientTransactionRow[]>): void {
  transactionsStore = JSON.parse(JSON.stringify(next)) as Record<string, ClientTransactionRow[]>
}

function syncClientDealsCountFromTransactions(clientId: string) {
  const count = (transactionsStore[clientId] ?? []).length
  const today = new Date().toISOString().slice(0, 10)
  clientStore = clientStore.map((c) =>
    c.id === clientId ? { ...c, dealsCount: count, updatedAt: today } : c
  )
}

export function addTransaction(clientId: string, row: ClientTransactionRow): void {
  transactionsStore = {
    ...transactionsStore,
    [clientId]: [...(transactionsStore[clientId] ?? []), row],
  }
  syncClientDealsCountFromTransactions(clientId)
  import('../services/propertyDealSync').then(({ syncPropertyWhenDealStatusChanges }) => {
    syncPropertyWhenDealStatusChanges(row.propertyId, undefined, row.status)
  })
  import('./simulationSnapshot').then(({ persistSimulationSnapshot }) => persistSimulationSnapshot())
}

export function updateTransaction(clientId: string, transactionId: string, updates: Partial<ClientTransactionRow>): void {
  const list = transactionsStore[clientId] ?? []
  const before = list.find((t) => t.id === transactionId)
  const prevStatus = before?.status
  const merged = before ? { ...before, ...updates } : null
  const nextStatus = merged?.status
  const propertyId = merged?.propertyId ?? before?.propertyId
  transactionsStore = {
    ...transactionsStore,
    [clientId]: list.map((t) => (t.id === transactionId ? { ...t, ...updates } : t)),
  }
  syncClientDealsCountFromTransactions(clientId)
  import('../services/propertyDealSync').then(({ syncPropertyWhenDealStatusChanges }) => {
    syncPropertyWhenDealStatusChanges(propertyId, prevStatus, nextStatus)
  })
  import('./simulationSnapshot').then(({ persistSimulationSnapshot }) => persistSimulationSnapshot())
}

export function deleteTransaction(clientId: string, transactionId: string): void {
  const list = transactionsStore[clientId] ?? []
  transactionsStore = {
    ...transactionsStore,
    [clientId]: list.filter((t) => t.id !== transactionId),
  }
  syncClientDealsCountFromTransactions(clientId)
  import('./simulationSnapshot').then(({ persistSimulationSnapshot }) => persistSimulationSnapshot())
}

const savedByClient: Record<string, ClientSavedProperty[]> = {
  c1: [
    { id: 'f1', propertyId: '4', propertyTitle: 'Greenfield Residence' },
    { id: 'f2', propertyId: '1', propertyTitle: 'Solana Heights — Unit 4A' },
  ],
  c2: [{ id: 'f3', propertyId: '1', propertyTitle: 'Solana Heights — Unit 4A' }],
  c3: [],
  c4: [],
  c5: [],
  c6: [],
  c7: [],
}

export function getSavedByClientId(clientId: string): ClientSavedProperty[] {
  return savedByClient[clientId] ?? []
}

let clientStore: ClientRecord[] = [...MOCK_CLIENTS]

export function getClientById(id: string): ClientRecord | undefined {
  return clientStore.find((c) => c.id === id)
}

export const STATUS_LABELS: Record<ClientStatus, string> = {
  new: 'New Lead',
  contacted: 'Contacted',
  interested: 'Interested',
  negotiating: 'Negotiating',
  reserved: 'Reserved',
  closed: 'Closed / Sold',
  lost: 'Lost',
  inactive: 'Inactive',
}
export const STATUS_DESCRIPTIONS: Record<ClientStatus, string> = {
  new: 'Kakapasok lang (FB / Website / Walk-in). Wala pang contact.',
  contacted: 'Nakausap na (call/chat/email).',
  interested: 'May budget, nagtatanong, nagvi-view. Serious na.',
  negotiating: 'Nakita na property / tumatawad. High chance.',
  reserved: 'May reservation fee. Almost sold.',
  closed: 'Tapos na deal. Success.',
  lost: 'Hindi tumuloy. Reason: no budget / ghosted / competitor.',
  inactive: 'Walang response 60+ days. Pwede pang i-revive.',
}
export function getStatusLabel(s: ClientStatus): string {
  return STATUS_LABELS[s] ?? s
}
export function getStatusDescription(s: ClientStatus): string {
  return STATUS_DESCRIPTIONS[s] ?? ''
}

export function getClientStore(): ClientRecord[] {
  return clientStore
}

/** Strip legacy `assignedTo` from persisted snapshots. */
function omitLegacyClientFields(row: ClientRecord & { assignedTo?: unknown }): ClientRecord {
  const { assignedTo: _omit, ...rest } = row
  return rest as ClientRecord
}

export function setClientStore(updater: (prev: ClientRecord[]) => ClientRecord[]) {
  clientStore = updater(clientStore).map((c) => omitLegacyClientFields(c as ClientRecord & { assignedTo?: unknown }))
  import('./simulationSnapshot').then(({ persistSimulationSnapshot }) => persistSimulationSnapshot())
}

/** After hydrating transactions from localStorage, realign dealsCount on every client. */
export function rebalanceAllClientDealsCounts() {
  clientStore = clientStore.map((c) => ({
    ...c,
    dealsCount: (transactionsStore[c.id] ?? []).length,
  }))
}
