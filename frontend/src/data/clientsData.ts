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

export const MOCK_CLIENTS: ClientRecord[] = []

let transactionsStore: Record<string, ClientTransactionRow[]> = {}

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

const savedByClient: Record<string, ClientSavedProperty[]> = {}

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
  const rest = { ...row }
  delete (rest as { assignedTo?: unknown }).assignedTo
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
