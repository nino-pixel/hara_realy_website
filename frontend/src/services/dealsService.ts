import {
  getAllDeals,
  getNextDealId,
  DEAL_STATUS_LABELS,
  getDealPaymentsSummary,
  type Deal,
  type DealStatus,
} from '../data/deals'
import {
  getClientStore,
  getTransactionsByClientId,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  type DealPaymentEntry,
  type DealStatusHistoryEntry,
  type ClientTransactionRow,
} from '../data/clientsData'
import { getPropertyStore } from '../data/properties'
import { logActivity } from '../data/activityLog'
import { apiDelete } from './api'

export function deleteDealFromApi(id: string): Promise<void> {
  // Mock IDs (c177..., t177...) are local only. Skip API call to avoid 404.
  if (id.startsWith('t') || id.startsWith('temp-')) {
    return Promise.resolve()
  }
  return apiDelete(`/deals/${encodeURIComponent(id)}`)
}

export function deleteDealFromLocal(clientId: string, transactionId: string): void {
  deleteTransaction(clientId, transactionId)
}

/**
 * Deals service — wraps the in-memory deals + related client/property data.
 * When a real backend exists, this is where fetch/axios calls should go.
 */

export type { Deal, DealStatus, DealPaymentEntry, DealStatusHistoryEntry }
export { DEAL_STATUS_LABELS, getDealPaymentsSummary, getNextDealId }

export function fetchDeals(): Deal[] {
  return getAllDeals()
}

export function fetchActiveClientsForDeals() {
  return getClientStore().filter((c) => !c.archived)
}

export function fetchActivePropertiesForDeals() {
  return getPropertyStore().filter((p) => !p.archived)
}

export function createDealTransaction(clientId: string, row: ClientTransactionRow) {
  if (!clientId) {
    throw new Error('clientId is required when creating a deal')
  }
  const client = getClientStore().find((c) => c.id === clientId)
  const rowWithLeadOrigin = {
    ...row,
    leadOriginId: row?.leadOriginId ?? client?.leadOriginId ?? null,
  }
  addTransaction(clientId, rowWithLeadOrigin)

  const dealLabel = rowWithLeadOrigin.dealId ?? rowWithLeadOrigin.id ?? 'deal'
  logActivity({
    actor: 'Admin',
    action: 'created',
    entityType: 'deal',
    entityId: String(dealLabel),
    entityLabel: rowWithLeadOrigin.propertyTitle ?? 'Deal',
    details: `Deal ${dealLabel} created for ${client?.name ?? 'client'} — ${rowWithLeadOrigin.propertyTitle ?? ''}`,
  })
}

export function updateDealTransaction(
  dealIdOrClientId: string,
  updatesOrTransactionId: string | Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>),
  maybeUpdates?: Record<string, unknown>
) {
  // New API: updateDealTransaction(dealId, updates | updater)
  if (maybeUpdates === undefined) {
    const dealId = dealIdOrClientId
    const updaterOrUpdates = updatesOrTransactionId

    // Find owning client + current transaction row
    const clients = getClientStore()
    let ownerClientId: string | null = null
    let currentRow: Record<string, unknown> | null = null

    for (const c of clients) {
      const txns = getTransactionsByClientId(c.id)
      const found = txns.find((t) => t.id === dealId)
      if (found) {
        ownerClientId = c.id
        currentRow = found as unknown as Record<string, unknown>
        break
      }
    }

    if (!ownerClientId || !currentRow) {
      // Nothing to update
      return
    }

    const prevStatus: string | undefined = currentRow.status as string | undefined
    const updates =
      typeof updaterOrUpdates === 'function'
        ? (updaterOrUpdates as (prev: Record<string, unknown>) => Record<string, unknown>)(currentRow)
        : (updaterOrUpdates as Record<string, unknown>)

    const nextStatus: string | undefined = (updates && (updates.status as string)) || prevStatus

    updateTransaction(ownerClientId, dealId, updates)

    if (prevStatus && nextStatus && prevStatus !== nextStatus) {
      logActivity({
        actor: 'Admin',
        action: 'status_changed',
        entityType: 'deal',
        entityId: String(currentRow.dealId ?? dealId),
        entityLabel: (currentRow.propertyTitle as string) ?? 'Deal',
        details: `Deal ${currentRow.dealId ?? dealId}: ${prevStatus} → ${nextStatus}`,
      })
    }

    return
  }

  // Backwards-compatible API: updateDealTransaction(clientId, transactionId, updates)
  const clientId = dealIdOrClientId
  const transactionId = updatesOrTransactionId as string
  const updates = maybeUpdates

  const currentRow = getTransactionsByClientId(clientId).find((t) => t.id === transactionId)
  if (!currentRow) {
    return
  }

  const prevStatus: string | undefined = currentRow.status
  const nextStatus: string | undefined = (updates && (updates.status as string)) || prevStatus

  updateTransaction(clientId, transactionId, updates)

  if (prevStatus && nextStatus && prevStatus !== nextStatus) {
    logActivity({
      actor: 'Admin',
      action: 'status_changed',
      entityType: 'deal',
      entityId: String(currentRow.dealId ?? transactionId),
      entityLabel: currentRow.propertyTitle ?? 'Deal',
      details: `Deal ${currentRow.dealId ?? transactionId}: ${prevStatus} → ${nextStatus}`,
    })
  }

  return
}

