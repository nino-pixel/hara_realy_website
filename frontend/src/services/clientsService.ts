import {
  getClientStore,
  setClientStore,
  getStatusLabel,
  getStatusDescription,
  type ClientRecord,
  type ClientStatus,
  type ClientSource,
  type LastActivityType,
  type ClientInquiryRow,
} from '../data/clientsData'
import { BULACAN_PROVINCE } from '../data/bulacanAddress'
import type { InquiryRecord } from '../data/mockAdmin'
import { logActivity, type ActivityLogEntry } from '../data/activityLog'
import { fetchInquiries } from './inquiriesService'
import { persistClientToApi } from './clientsApi'

/**
 * Clients service — wraps the in-memory clients data store.
 * This is where real HTTP calls (fetch/axios) would live once
 * you connect a backend API.
 */

export type { ClientRecord, ClientStatus, ClientSource, LastActivityType, ActivityLogEntry }
export { getStatusLabel, getStatusDescription }

export { getClientStore }

export function fetchClients(): ClientRecord[] {
  return getClientStore()
}

export function saveClientStore(updater: (prev: ClientRecord[]) => ClientRecord[]): ClientRecord[] {
  const next = updater(getClientStore())
  setClientStore(() => next)
  return next
}

export function logClientActivity(entry: Omit<ActivityLogEntry, 'id' | 'at'>) {
  return logActivity(entry)
}

function inquiryRowStatusLabel(i: InquiryRecord): string {
  switch (i.status) {
    case 'new':
      return 'Pending'
    case 'contacted':
      return 'Contacted'
    case 'qualified':
      return 'Qualified'
    case 'converted':
      return 'Converted'
    case 'lost':
      return 'Lost'
    default:
      return i.status
  }
}

/** Inquiry history for profile: linked client id, originating lead id, or same email. */
export function getInquiriesForClientProfile(client: ClientRecord): ClientInquiryRow[] {
  const all = fetchInquiries()
  const email = client.email.trim().toLowerCase()
  return all
    .filter(
      (i) =>
        i.linkedClientId === client.id ||
        client.leadOriginId === i.id ||
        i.email.trim().toLowerCase() === email
    )
    .map((i) => ({
      id: i.id,
      propertyTitle: i.propertyTitle,
      message: i.message,
      date: i.createdAt.slice(0, 10),
      status: inquiryRowStatusLabel(i),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

function mapLeadSourceToClientSource(lead: InquiryRecord): ClientSource {
  const raw = String(lead.source_manual ?? lead.source_auto ?? '').toLowerCase()
  if (raw.includes('facebook')) return 'Facebook'
  if (raw.includes('walk')) return 'Walk-in'
  if (raw.includes('referral')) return 'Referral'
  return 'Website'
}

function getNextClientId(clients: ClientRecord[]): string {
  const ids = clients
    .map((c) => {
      const m = c.id.match(/^c(\d+)$/)
      return m ? parseInt(m[1], 10) : null
    })
    .filter((n): n is number => n != null)
  const max = ids.length ? Math.max(...ids) : 0
  return `c${max + 1}`
}

export function convertLeadToClient(lead: InquiryRecord): { clientId: string; created: boolean } {
  const todayISO = new Date().toISOString().slice(0, 10)
  const source = mapLeadSourceToClientSource(lead)
  const existing = getClientStore().find((c) => c.email.toLowerCase() === lead.email.toLowerCase())

  if (existing) {
    saveClientStore((prev) =>
      prev.map((c) =>
        c.id === existing.id
          ? {
              ...c,
              name: lead.name,
              phone: lead.phone,
              source,
              status: c.status === 'closed' ? c.status : 'interested',
              updatedAt: todayISO,
              lastActivity: todayISO,
              lastActivityType: 'Inquiry',
              leadOriginId: c.leadOriginId ?? lead.id,
              leadPropertyId: c.leadPropertyId ?? lead.propertyId ?? null,
              leadPropertyTitle: c.leadPropertyTitle ?? lead.propertyTitle ?? null,
            }
          : c
      )
    )
    return { clientId: existing.id, created: false }
  }

  let createdId = ''
  saveClientStore((prev) => {
    createdId = getNextClientId(prev)
    return [
      ...prev,
      {
        id: createdId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        province: BULACAN_PROVINCE,
        municipality: '',
        barangay: '',
        address: '',
        source,
        status: 'new',
        notes: '',
        createdAt: todayISO,
        updatedAt: todayISO,
        dealsCount: 0,
        lastActivity: todayISO,
        lastActivityType: 'Inquiry',
        adminNotes: '',
        leadOriginId: lead.id,
        leadPropertyId: lead.propertyId ?? null,
        leadPropertyTitle: lead.propertyTitle ?? null,
      },
    ]
  })
  return { clientId: createdId, created: true }
}

export async function convertLeadToClientAndPersist(
  lead: InquiryRecord
): Promise<{ clientId: string; created: boolean; client: ClientRecord }> {
  const result = convertLeadToClient(lead)
  const localClient = getClientStore().find((client) => client.id === result.clientId)

  if (!localClient) {
    throw new Error('Client conversion failed.')
  }

  const saved = await persistClientToApi(localClient)

  saveClientStore((prev) =>
    prev.map((client) =>
      client.id === saved.id
        ? {
            ...client,
            ...saved,
          }
        : client
    )
  )

  const nextClient = getClientStore().find((client) => client.id === saved.id) ?? {
    ...localClient,
    ...saved,
  }

  return {
    ...result,
    client: nextClient,
  }
}
