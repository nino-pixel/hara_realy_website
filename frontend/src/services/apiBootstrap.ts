/**
 * Hybrid bootstrap: optional one-time localStorage → Laravel sync, then hydrate stores from API.
 * Does not remove localStorage; keeps SPA working when API is down.
 */
import type { Property } from '../data/properties'
import { setPropertyStore } from '../data/properties'
import type { InquiryRecord } from '../data/mockAdmin'
import { setInquiryStore } from '../data/mockAdmin'
import { setClientStore, replaceTransactionsStore } from '../data/clientsData'
import { SIMULATION_STORAGE_KEY, persistSimulationSnapshot } from '../data/simulationSnapshot'
import { normalizeClientFromApi } from './clientsApi'
import { apiGet, apiPost } from './api'
import { getAuthToken } from './authStore'
import { getApiBaseUrl } from './apiConfig'

export const MIGRATION_TO_API_KEY = 'chara_migrated_to_api_v1'

const HEALTH_TIMEOUT_MS = 3500

export async function runApiBootstrap(): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const ctrl = new AbortController()
    const t = window.setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS)
    const healthUrl = getApiBaseUrl() ? `${getApiBaseUrl()}/api/health` : '/api/health'
    const res = await fetch(healthUrl, { signal: ctrl.signal })
    window.clearTimeout(t)
    if (!res.ok) return
  } catch {
    return
  }

  const raw = localStorage.getItem(SIMULATION_STORAGE_KEY)
  const already = localStorage.getItem(MIGRATION_TO_API_KEY) === '1'

  /** Sync pushes local snapshot to the API — requires an authenticated admin session. */
  if (raw && !already && getAuthToken()) {
    try {
      const snap = JSON.parse(raw) as {
        properties?: unknown[]
        inquiries?: unknown[]
        clients?: unknown[]
        transactionsByClient?: Record<string, unknown[]>
      }
      await apiPost('/sync/from-local', {
        properties: snap.properties ?? [],
        inquiries: snap.inquiries ?? [],
        clients: snap.clients ?? [],
        transactionsByClient: snap.transactionsByClient ?? {},
      })
      localStorage.setItem(MIGRATION_TO_API_KEY, '1')
    } catch {
      /* keep local data */
    }
  }

  let touched = false

  try {
    const propsRes = await apiGet<{ success?: boolean; data?: Property[] }>('/properties')
    const list = propsRes?.data
    if (Array.isArray(list)) {
      setPropertyStore(() => list)
      touched = true
    }
  } catch {
    /* keep local */
  }

  try {
    const inqRes = await apiGet<{ data: InquiryRecord[] }>('/inquiries')
    if (Array.isArray(inqRes.data)) {
      setInquiryStore(() => inqRes.data)
      touched = true
    }
  } catch {
    /* keep local */
  }

  try {
    const clientsRes = await apiGet<{ data: Record<string, unknown>[] }>('/clients')
    if (Array.isArray(clientsRes.data)) {
      const normalized = clientsRes.data.map((c: any) => normalizeClientFromApi(c))
      setClientStore(() => normalized)
      touched = true
    }
  } catch {
    /* ignore */
  }

  try {
    /** 
     * Deals/Transactions from DB. 
     * Note: backend uses 'deals' table; sync logic assumes transactionsByClient map.
     */
    const dealsRes = await apiGet<{ data: any[] }>('/deals')
    if (Array.isArray(dealsRes.data)) {
      const map: Record<string, any[]> = {}
      dealsRes.data.forEach((d: any) => {
        const cid = d.clientId
        if (!map[cid]) map[cid] = []
        map[cid].push(d)
      })
      replaceTransactionsStore(map)
      touched = true
    }
  } catch {
    /* ignore */
  }

  if (touched) {
    try {
      persistSimulationSnapshot()
    } catch {
      /* ignore */
    }
  }
}
