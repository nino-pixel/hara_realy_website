/**
 * Persist client to Laravel (POST /api/clients) — requires admin auth.
 */
import { BULACAN_PROVINCE, formatBulacanAddressLine } from '../data/bulacanAddress'
import type { ClientRecord, ClientSource, ClientStatus, LastActivityType } from '../data/clientsData'
import { apiPost, apiDelete } from './api'

type ApiClientResponse = { success: boolean; data: Record<string, unknown> }

export function clientToApiPayload(c: ClientRecord): Record<string, unknown> {
  return {
    id: c.id,
    name: c.name.trim(),
    email: c.email.trim().toLowerCase(),
    phone: c.phone.replace(/\s/g, ''),
    source: c.source,
    status: c.status,
    province: c.province ?? BULACAN_PROVINCE,
    municipality: c.municipality ?? '',
    barangay: (c.barangay ?? '').trim(),
    purok_or_street: c.purokOrStreet?.trim() || null,
    notes: c.notes,
    adminNotes: c.adminNotes,
  }
}

export function normalizeClientFromApi(
  raw: Record<string, unknown>,
  preserve?: Pick<ClientRecord, 'dealsCount' | 'lastActivity' | 'lastActivityType' | 'leadOriginId' | 'leadPropertyId' | 'leadPropertyTitle' | 'isPriority' | 'lastContact' | 'nextFollowUp' | 'archived' | 'archivedAt' | 'archiveReason'>
): ClientRecord {
  const id = String(raw.id ?? '')
  const createdAt = String(raw.createdAt ?? new Date().toISOString())
  const updatedAt = String(raw.updatedAt ?? createdAt)
  const prov = raw.province != null ? String(raw.province) : undefined
  const mun = raw.municipality != null ? String(raw.municipality) : undefined
  const brgy = raw.barangay != null ? String(raw.barangay) : undefined
  const purok =
    raw.purokOrStreet != null
      ? String(raw.purokOrStreet)
      : raw.purok_or_street != null
        ? String(raw.purok_or_street)
        : undefined
  let address = String(raw.address ?? '')
  if (!address && mun && brgy) {
    address = formatBulacanAddressLine({
      purokOrStreet: purok,
      barangay: brgy,
      municipality: mun,
      province: prov ?? BULACAN_PROVINCE,
    })
  }

  return {
    id,
    name: String(raw.name ?? ''),
    email: String(raw.email ?? ''),
    phone: String(raw.phone ?? ''),
    address,
    province: prov,
    municipality: mun,
    barangay: brgy,
    purokOrStreet: purok,
    source: (raw.source as ClientSource) ?? 'Website',
    status: (raw.status as ClientStatus) ?? 'new',
    notes: String(raw.notes ?? ''),
    createdAt: createdAt.slice(0, 10),
    updatedAt: updatedAt.slice(0, 10),
    dealsCount: Number(raw.dealsCount ?? preserve?.dealsCount ?? 0),
    lastActivity: String(raw.lastActivity ?? preserve?.lastActivity ?? updatedAt.slice(0, 10)),
    lastActivityType: (raw.lastActivityType as LastActivityType | undefined) ?? preserve?.lastActivityType,
    adminNotes: String(raw.adminNotes ?? ''),
    isPriority: (raw.isPriority as boolean | undefined) ?? preserve?.isPriority,
    lastContact: (raw.lastContact as string | undefined) ?? preserve?.lastContact,
    nextFollowUp: (raw.nextFollowUp as string | undefined) ?? preserve?.nextFollowUp,
    archived: (raw.archived as boolean | undefined) ?? preserve?.archived,
    archivedAt: (raw.archivedAt as string | undefined) ?? preserve?.archivedAt,
    archiveReason: (raw.archiveReason as string | undefined) ?? preserve?.archiveReason,
    leadOriginId: (raw.leadOriginId as string | null | undefined) ?? preserve?.leadOriginId ?? null,
    leadPropertyId: (raw.leadPropertyId as string | null | undefined) ?? preserve?.leadPropertyId ?? null,
    leadPropertyTitle: (raw.leadPropertyTitle as string | null | undefined) ?? preserve?.leadPropertyTitle ?? null,
  }
}

export async function persistClientToApi(client: ClientRecord): Promise<ClientRecord> {
  const res = await apiPost<ApiClientResponse>('/clients', clientToApiPayload(client))
  const raw = res.data as Record<string, unknown>
  return normalizeClientFromApi(raw, {
    dealsCount: client.dealsCount,
    lastActivity: client.lastActivity,
    lastActivityType: client.lastActivityType,
    leadOriginId: client.leadOriginId,
    leadPropertyId: client.leadPropertyId,
    leadPropertyTitle: client.leadPropertyTitle,
    isPriority: client.isPriority,
    lastContact: client.lastContact,
    nextFollowUp: client.nextFollowUp,
    archived: client.archived,
    archivedAt: client.archivedAt,
    archiveReason: client.archiveReason,
  })
}

export async function deleteClientFromApi(id: string): Promise<void> {
  // Mock IDs (c177...) are local only. Skip API call to avoid 404.
  if (id.startsWith('c')) {
    return
  }
  await apiDelete(`/clients/${id}`)
}
