import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { HiOutlineCash, HiOutlinePhone, HiOutlinePlus, HiOutlineTrash, HiOutlineUser } from 'react-icons/hi'
import Swal from 'sweetalert2'
import { SIMULATION_STORAGE_KEY } from '../../data/simulationSnapshot'
import { formatPeso } from '../../utils/mortgageUtils'
import {
  budgetRangeLabel,
  buyingTimelineLabel,
  employmentStatusLabel,
  financingMethodLabel,
} from '../../data/leadQualification'
import type { InquiryRecord, InquiryStatus, LeadPriority } from '../../data/mockAdmin'
import { convertLeadToClient, fetchClients } from '../../services/clientsService'
import {
  fetchInquiries,
  markInquiryAsContacted,
  saveInquiryStore,
  updateInquiryInApi,
  deleteInquiryFromApi,
} from '../../services/inquiriesService'
import { computeNextFollowUpDateFromTimeline, getFollowUpUiKind } from '../../utils/inquiryFollowUp'
import { fetchProperties } from '../../services/propertiesService'
import { logActivity } from '../../data/activityLog'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import FormActions from '../../components/FormActions'
import './admin-common.css'
import './Inquiries.css'

export default function AdminInquiries() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const actor = 'Admin'
  const INQUIRY_STATUSES: InquiryStatus[] = ['new', 'contacted', 'qualified', 'converted', 'lost']
  const PRIORITY_OPTIONS: LeadPriority[] = ['low', 'medium', 'high']
  const SOURCE_OPTIONS = ['facebook', 'website', 'walk-in', 'referral'] as const
  type LeadSource = (typeof SOURCE_OPTIONS)[number]
  const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
    new: 'Pending',
    contacted: 'Contacted',
    qualified: 'Qualified',
    converted: 'Converted',
    lost: 'Lost',
  }

  const [inquiries, setInquiries] = useState<InquiryRecord[]>(() => fetchInquiries())
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddLead, setShowAddLead] = useState(false)
  const [loading, setLoading] = useState(true)
  const [archiveModalInquiry, setArchiveModalInquiry] = useState<InquiryRecord | null>(null)
  const [archiveReason, setArchiveReason] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const properties = fetchProperties().filter((p) => !p.archived)

  useEffect(() => {
    setLoading(false)
  }, [])

  /** Re-load from shared store (same tab after submit, or other tab via localStorage). */
  useEffect(() => {
    const syncFromStore = () => {
      setInquiries(fetchInquiries())
    }
    syncFromStore()
    const onFocus = () => syncFromStore()
    const onStorage = (e: StorageEvent) => {
      if (e.key === SIMULATION_STORAGE_KEY) syncFromStore()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const updateInquiries = (updater: (prev: InquiryRecord[]) => InquiryRecord[]) => {
    setInquiries((prev) => {
      const next = updater(prev)
      saveInquiryStore(() => next)
      return next
    })
  }

  const normalizeSource = (raw: string): LeadSource => {
    const s = String(raw).toLowerCase()
    if (s.includes('facebook')) return 'facebook'
    if (s.includes('walk')) return 'walk-in'
    if (s.includes('referral')) return 'referral'
    if (s.includes('website') || s.includes('property page')) return 'website'
    return 'website'
  }

  const getLeadSource = (i: InquiryRecord): LeadSource | null => {
    const auto = i.source_auto ?? null
    const manual = i.source_manual ?? null
    if (auto) return normalizeSource(auto)
    if (manual) return normalizeSource(manual)
    return null
  }

  const getInquirySourceDisplay = (i: InquiryRecord) => {
    const source = getLeadSource(i)
    if (source) return source
    return '—'
  }

  /** All table-visible (and id) fields for global search */
  const inquirySearchHaystack = (i: InquiryRecord): string => {
    const parts: string[] = [
      i.id,
      i.name,
      i.email,
      i.phone,
      i.propertyId ?? '',
      i.propertyTitle,
      i.message,
      i.notes ?? '',
      INQUIRY_STATUS_LABELS[i.status],
      i.status,
      getInquirySourceDisplay(i),
      i.source_auto ?? '',
      i.source_manual ?? '',
      i.utm_campaign ?? '',
      i.utm_medium ?? '',
      budgetRangeLabel(i.budgetRange),
      buyingTimelineLabel(i.buyingTimeline),
      financingMethodLabel(i.financingMethod),
      employmentStatusLabel(i.employmentStatus),
      i.nextFollowUpAt ?? '',
      i.lastContactedAt ?? '',
      i.lostReason ?? '',
      i.linkedClientId ?? '',
      new Date(i.createdAt).toLocaleDateString(),
      String(i.createdAt),
      i.highBuyingIntent ? 'high buying intent' : '',
    ]
    if (i.estimatedMonthly != null && Number.isFinite(i.estimatedMonthly)) {
      parts.push(String(i.estimatedMonthly), formatPeso(Math.round(i.estimatedMonthly)))
    }
    if (i.downpayment) parts.push(i.downpayment)
    if (i.loanTerm != null) parts.push(String(i.loanTerm), `${i.loanTerm} yr`)
    if (i.interestRate != null) parts.push(String(i.interestRate), `${i.interestRate}%`)
    if (i.downpaymentPercent != null) parts.push(String(i.downpaymentPercent))
    return parts.join(' ').toLowerCase()
  }

  const handleConvertToClient = async (lead: InquiryRecord) => {
    if (lead.status === 'converted') return

    const { clientId, created } = convertLeadToClient(lead)
    const updatedRow: InquiryRecord = {
      ...lead,
      status: 'converted',
      linkedClientId: clientId,
    }
    updateInquiries((prev) =>
      prev.map((row) =>
        row.id === lead.id ? { ...row, status: 'converted', linkedClientId: clientId } : row
      )
    )

    try {
      await updateInquiryInApi(updatedRow)
    } catch {
      /* local store already updated; DB sync failed — user can retry status change */
    }

    logActivity({
      actor,
      action: 'status_changed',
      entityType: 'inquiry',
      entityId: lead.id,
      entityLabel: lead.name,
      details: `Status changed: ${INQUIRY_STATUS_LABELS[lead.status]} -> ${INQUIRY_STATUS_LABELS.converted}`,
    })
    logActivity({
      actor,
      action: 'created',
      entityType: 'client',
      entityId: clientId,
      entityLabel: lead.name,
      details: created
        ? `Converted lead to new client: ${lead.name} (${lead.email})`
        : `Matched existing client by email and updated from lead: ${lead.name} (${lead.email})`,
    })
    Swal.fire({
      icon: 'success',
      title: 'Lead converted to client',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true,
    })

    navigate(`/admin/clients/${clientId}?fromLead=1`)
  }

  const handleCreateDealFromLead = async (lead: InquiryRecord) => {
    let clientId =
      lead.linkedClientId ??
      fetchClients().find((c) => c.email.toLowerCase() === lead.email.trim().toLowerCase())?.id ??
      null
    if (!clientId) {
      const { clientId: cid } = convertLeadToClient(lead)
      clientId = cid
      const synced: InquiryRecord = { ...lead, status: 'converted', linkedClientId: cid }
      updateInquiries((prev) =>
        prev.map((row) =>
          row.id === lead.id ? { ...row, status: 'converted', linkedClientId: clientId! } : row
        )
      )
      try {
        await updateInquiryInApi(synced)
      } catch {
        /* local CRM updated; DB sync optional */
      }
    }
    const client = fetchClients().find((c) => c.id === clientId)
    const params = new URLSearchParams({
      createDeal: '1',
      clientId: clientId!,
      clientName: client?.name ?? lead.name,
      leadOriginId: lead.id,
    })
    if (lead.propertyId) params.set('propertyId', lead.propertyId)
    if (lead.propertyTitle) params.set('propertyTitle', lead.propertyTitle)
    navigate(`/admin/deals?${params.toString()}`)
    Swal.fire({
      icon: 'info',
      title: 'Create deal',
      text: 'Choose property and confirm price on the Deals page.',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2200,
    })
  }

  const handleMarkAsContacted = async (lead: InquiryRecord) => {
    markInquiryAsContacted(lead.id)
    const updated = fetchInquiries().find((x) => x.id === lead.id)
    setInquiries(fetchInquiries())
    if (!updated) return
    try {
      await updateInquiryInApi(updated)
      logActivity({
        actor,
        action: 'updated',
        entityType: 'inquiry',
        entityId: lead.id,
        entityLabel: lead.name,
        details: 'Marked as contacted; next follow-up set to +2 days',
      })
      Swal.fire({
        icon: 'success',
        title: 'Follow-up updated',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      })
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Could not save to server',
        text: 'Follow-up was updated locally. Sign in again or check your connection.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4000,
      })
    }
  }

  const handleArchiveInquiry = (lead: InquiryRecord) => {
    setArchiveModalInquiry(lead)
    setArchiveReason('')
    setArchiveError('')
  }

  const confirmArchiveInquiry = async () => {
    if (!archiveModalInquiry) return
    const reason = archiveReason.trim()
    if (!reason) {
      setArchiveError('Please provide a reason for archiving.')
      return
    }

    try {
      await deleteInquiryFromApi(archiveModalInquiry.id)
      updateInquiries((prev) => prev.filter((row) => row.id !== archiveModalInquiry.id))
      
      logActivity({
        actor,
        action: 'archived',
        entityType: 'inquiry',
        entityId: archiveModalInquiry.id,
        entityLabel: archiveModalInquiry.name,
        details: `Archived inquiry from ${archiveModalInquiry.name} — Reason: ${reason}`,
      })

      Swal.fire({
        icon: 'success',
        title: 'Inquiry archived',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      })
      setArchiveModalInquiry(null)
      setArchiveReason('')
      setArchiveError('')
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Archive failed',
        text: err instanceof Error ? err.message : 'Could not archive inquiry.',
      })
    }
  }

  const handleAddLead = (payload: {
    name: string
    email: string
    phone: string
    propertyId: string | null
    propertyTitle: string
    message: string
    notes: string
    source: LeadSource
    priority: LeadPriority
    lastContactedAt: string | null
    nextFollowUpAt: string | null
  }) => {
    const nowIso = new Date().toISOString()
    const nextLead: InquiryRecord = {
      id: `inq-${Date.now()}`,
      name: payload.name.trim(),
      email: payload.email.trim(),
      phone: payload.phone.trim(),
      propertyId: payload.propertyId,
      propertyTitle: payload.propertyTitle.trim(),
      message: payload.message.trim(),
      notes: payload.notes.trim(),
      source_auto: payload.source,
      source_manual: payload.source,
      status: 'new',
      priority: payload.priority,
      createdAt: nowIso,
      lastContactedAt: payload.lastContactedAt,
      nextFollowUpAt:
        payload.nextFollowUpAt?.trim() ||
        computeNextFollowUpDateFromTimeline(new Date(), null),
      lostReason: null,
      linkedClientId: null,
      estimatedMonthly: null,
      downpayment: null,
      loanTerm: null,
      interestRate: null,
      downpaymentPercent: null,
      highBuyingIntent: false,
      budgetRange: null,
      buyingTimeline: null,
      financingMethod: null,
      employmentStatus: null,
    }

    updateInquiries((prev) => [nextLead, ...prev])
    setShowAddLead(false)
    Swal.fire({
      icon: 'success',
      title: 'Lead added',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2200,
      timerProgressBar: true,
    })
  }

  const filtered = useMemo(() => {
    let list = [...inquiries]

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((i) => inquirySearchHaystack(i).includes(q))
    }

    list.sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (diff !== 0) return diff
      return String(b.id).localeCompare(String(a.id))
    })

    return list
  }, [inquiries, searchQuery])

  const focusInquiryId = searchParams.get('focus')
  useEffect(() => {
    if (!focusInquiryId || loading) return
    const timer = window.setTimeout(() => {
      const safeId = focusInquiryId.replace(/"/g, '')
      const row = document.querySelector(`[data-inquiry-row="${safeId}"]`)
      if (row instanceof HTMLElement) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' })
        row.classList.add('admin-inquiry-row--flash')
        window.setTimeout(() => row.classList.remove('admin-inquiry-row--flash'), 2400)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [focusInquiryId, loading, inquiries])

  return (
    <div className="admin-inquiries">
      <PageHeader
        title="Lead Management"
        subtitle="FB leads, website leads, walk-ins, referrals — track and convert."
        toolbar={
          <>
            <input
              type="search"
              className="admin-input admin-inquiries-search"
              placeholder="Search name, contact, property, message, status, source, budget, …"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search all lead fields"
            />
            <button type="button" className="btn btn-primary" onClick={() => setShowAddLead(true)}>
              <HiOutlinePlus className="btn-icon" /> Add Lead
            </button>
          </>
        }
      />
      <div className="admin-inquiries-legends admin-inquiries-legends--row">
        <div className="admin-inquiries-legend" role="note">
          <span className="admin-inquiry-intent-dot admin-inquiry-intent-dot--legend" aria-hidden />
          <span className="admin-inquiries-legend-text">high buying customer</span>
        </div>
        <div className="admin-inquiries-legend admin-inquiries-legend--followup-rows" role="note">
          <span className="admin-inquiries-legend-text admin-inquiries-legend-text--compact">
            <span className="admin-inquiries-legend-item">
              <span className="admin-inquiries-legend-swatch admin-inquiries-legend-swatch--overdue" aria-hidden />
              Overdue
            </span>
            <span className="admin-inquiries-legend-item">
              <span className="admin-inquiries-legend-swatch admin-inquiries-legend-swatch--today" aria-hidden />
              Due today
            </span>
            <span className="admin-inquiries-legend-item">
              <span className="admin-inquiries-legend-swatch admin-inquiries-legend-swatch--upcoming" aria-hidden />
              Upcoming
            </span>
          </span>
        </div>
      </div>
      <DataTable wrapperClassName="admin-inquiries-table-wrap" tableClassName="inquiries-table">
          <thead>
            <tr>
            <th className="th-plain">
              <span className="th-label">Name</span>
            </th>
            <th className="th-plain">
              <span className="th-label">Contact</span>
            </th>
            <th className="th-plain">
              <span className="th-label">Property</span>
            </th>
            <th className="th-plain">
              <span className="th-label">Message</span>
            </th>
            <th className="th-plain col-qualify">
              <span className="th-label">Budget</span>
            </th>
            <th className="th-plain col-qualify">
              <span className="th-label">Timeline</span>
            </th>
            <th className="th-plain col-qualify">
              <span className="th-label">Financing</span>
            </th>
            <th className="th-plain col-payment-est">
              <span className="th-label">Payment est.</span>
            </th>
            <th className="th-plain col-source">
              <span className="th-label">Source</span>
            </th>
            <th className="th-plain col-status">
              <span className="th-label">Status</span>
            </th>
            <th className="th-plain col-inquiry-date">
              <span className="th-label">Date</span>
            </th>
            <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
          {loading ? (
            <tr>
              <td colSpan={12} className="admin-empty-cell">
                Loading leads...
              </td>
            </tr>
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={12} className="admin-empty-cell">
                No leads found.
                </td>
              </tr>
            ) : (
              filtered.map((i) => {
                const followKind = getFollowUpUiKind(i)
                return (
                <tr
                  key={i.id}
                  data-inquiry-row={i.id}
                  className={followKind ? `admin-inquiry-row--followup-${followKind}` : undefined}
                >
                <td>
                  <div className="admin-inquiry-name-cell">
                    {i.highBuyingIntent ? (
                      <span
                        className="admin-inquiry-intent-dot"
                        title="High buying customer"
                        aria-label="High buying customer"
                      />
                    ) : null}
                    <span>{i.name}</span>
                  </div>
                </td>
                <td>
                  <div className="admin-inquiry-contact">
                    <a href={`mailto:${i.email}`}>{i.email}</a>
                    <small>{i.phone}</small>
                  </div>
                  </td>
                  <td>{i.propertyTitle}</td>
                  <td className="admin-inquiry-message">{i.message}</td>
                <td className="admin-inquiry-qualify">{budgetRangeLabel(i.budgetRange)}</td>
                <td className="admin-inquiry-qualify">{buyingTimelineLabel(i.buyingTimeline)}</td>
                <td className="admin-inquiry-qualify">{financingMethodLabel(i.financingMethod)}</td>
                <td className="admin-inquiry-payment-est">
                  {i.estimatedMonthly != null && Number.isFinite(i.estimatedMonthly) ? (
                    <div className="admin-inquiry-payment-est-inner">
                      <span className="admin-inquiry-payment-est-monthly">
                        {formatPeso(Math.round(i.estimatedMonthly))}/mo
                      </span>
                      {i.downpayment ? (
                        <span className="admin-inquiry-payment-est-line">DP: {i.downpayment}</span>
                      ) : null}
                      {i.loanTerm != null ? (
                        <span className="admin-inquiry-payment-est-line">
                          {i.loanTerm} yr
                          {i.interestRate != null ? ` @ ${i.interestRate}%` : ''}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="admin-inquiry-payment-est-empty">—</span>
                  )}
                </td>
                  <td className="admin-inquiry-source">
                  <StatusBadge className={`admin-badge admin-badge--source-${getInquirySourceDisplay(i).replace(/[^a-z-]/g, '')}`}>
                    {getInquirySourceDisplay(i)}
                  </StatusBadge>
                </td>
                <td className="col-status">
                  <select
                    className={`admin-input admin-inquiry-status-select admin-inquiry-status-select--${i.status}`}
                    value={i.status}
                    onChange={async (e) => {
                      const next = e.target.value as InquiryStatus
                      if (next === i.status) return
                      const prevStatus = i.status
                      const updatedRow: InquiryRecord = { ...i, status: next }
                      updateInquiries((prev) => prev.map((row) => (row.id === i.id ? updatedRow : row)))
                      try {
                        const saved = await updateInquiryInApi(updatedRow)
                        updateInquiries((prev) => prev.map((row) => (row.id === i.id ? saved : row)))
                        logActivity({
                          actor,
                          action: 'status_changed',
                          entityType: 'inquiry',
                          entityId: i.id,
                          entityLabel: i.name,
                          details: `Status changed: ${INQUIRY_STATUS_LABELS[prevStatus]} -> ${INQUIRY_STATUS_LABELS[next]}`,
                        })
                        Swal.fire({
                          icon: 'success',
                          title: 'Status updated',
                          toast: true,
                          position: 'top-end',
                          showConfirmButton: false,
                          timer: 2000,
                          timerProgressBar: true,
                        })
                      } catch (err) {
                        updateInquiries((prev) => prev.map((row) => (row.id === i.id ? i : row)))
                        Swal.fire({
                          icon: 'error',
                          title: 'Could not save status',
                          text: err instanceof Error ? err.message : 'Failed to update inquiry on server.',
                          toast: true,
                          position: 'top-end',
                          showConfirmButton: false,
                          timer: 4000,
                        })
                      }
                    }}
                  >
                    {INQUIRY_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {INQUIRY_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  </td>
                  <td className="admin-inquiry-date-cell">{new Date(i.createdAt).toLocaleDateString()}</td>
                <td className="col-actions col-actions--inquiry">
                  <button
                    type="button"
                    className="btn-icon-btn btn-icon-btn--contacted"
                    onClick={() => handleMarkAsContacted(i)}
                    disabled={i.status === 'converted' || i.status === 'lost'}
                    data-tooltip="Mark as contacted — saves last contacted as now and sets the next follow-up to 2 days from today."
                    title="Mark as contacted — last contact = now; next follow-up in 2 days"
                    aria-label="Mark as contacted: record contact time and schedule next follow-up in two days"
                  >
                    <HiOutlinePhone />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-btn"
                    onClick={() => handleConvertToClient(i)}
                    disabled={i.status === 'converted'}
                    data-tooltip="Convert to client — creates or links a client record and opens their profile."
                    title="Convert to client — create/link client and open profile"
                    aria-label="Convert this lead to a client"
                  >
                    <HiOutlineUser />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-btn"
                    onClick={() => handleCreateDealFromLead(i)}
                    disabled={i.status === 'lost'}
                    data-tooltip="Create deal — opens Deals with this client (and property when set) to start a transaction."
                    title="Create deal — start a deal for this client"
                    aria-label="Create a new deal from this lead"
                  >
                    <HiOutlineCash />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-btn btn-icon-btn--danger"
                    onClick={() => handleArchiveInquiry(i)}
                    data-tooltip="Archive inquiry — moves this inquiry to archives (soft delete)."
                    title="Archive inquiry"
                    aria-label="Archive lead"
                  >
                    <HiOutlineTrash />
                  </button>
                  </td>
                </tr>
                )
              })
            )}
          </tbody>
      </DataTable>
      {showAddLead && (
        <LeadFormSidebar
          sourceOptions={SOURCE_OPTIONS}
          priorityOptions={PRIORITY_OPTIONS}
          properties={properties.map((p) => ({ id: p.id, title: p.title }))}
          onClose={() => setShowAddLead(false)}
          onSaveCreate={handleAddLead}
        />
      )}

      {archiveModalInquiry && (
        <div className="admin-modal-overlay" onClick={() => setArchiveModalInquiry(null)} role="dialog" aria-modal="true" aria-labelledby="archive-modal-title">
          <div className="admin-modal archive-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 id="archive-modal-title">Archive inquiry</h2>
              <button type="button" className="admin-modal-close" onClick={() => setArchiveModalInquiry(null)} aria-label="Close">&times;</button>
            </div>
            <div className="admin-modal-body">
              <div className="archive-warning">
                <p className="archive-warning-title">⚠️ Confirmation</p>
                <p>You are about to archive the inquiry from <strong>{archiveModalInquiry.name}</strong>.</p>
              </div>
              <div className="admin-form-row">
                <label htmlFor="archive-reason">Reason for archiving <span className="required">*</span></label>
                <textarea
                  id="archive-reason"
                  className="admin-input"
                  value={archiveReason}
                  onChange={(e) => { setArchiveReason(e.target.value); setArchiveError(''); }}
                  placeholder="e.g. Lead was duplicate, lost contact, or spam"
                  rows={3}
                  required
                />
              </div>
              {archiveError && <p className="form-error">{archiveError}</p>}
              <div className="archive-actions">
                <button type="button" className="btn btn-primary" onClick={confirmArchiveInquiry}>
                  Archive inquiry
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setArchiveModalInquiry(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LeadFormSidebar({
  sourceOptions,
  priorityOptions,
  properties,
  onClose,
  onSaveCreate,
}: {
  sourceOptions: readonly ('facebook' | 'website' | 'walk-in' | 'referral')[]
  priorityOptions: readonly LeadPriority[]
  properties: { id: string; title: string }[]
  onClose: () => void
  onSaveCreate: (payload: {
    name: string
    email: string
    phone: string
    propertyId: string | null
    propertyTitle: string
    message: string
    notes: string
    source: 'facebook' | 'website' | 'walk-in' | 'referral'
    priority: LeadPriority
    lastContactedAt: string | null
    nextFollowUpAt: string | null
  }) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [propertyTitle, setPropertyTitle] = useState('')
  const [message, setMessage] = useState('')
  const [notes, setNotes] = useState('')
  const [source, setSource] = useState<'facebook' | 'website' | 'walk-in' | 'referral'>('website')
  const [priority, setPriority] = useState<LeadPriority>('medium')
  const [lastContactedAt, setLastContactedAt] = useState('')
  const [nextFollowUpAt, setNextFollowUpAt] = useState('')

  const handleSave = () => {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      Swal.fire({ icon: 'warning', title: 'Required Fields', text: 'Name, email, and phone are required.' })
      return
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(email.trim())) {
      Swal.fire({ icon: 'error', title: 'Invalid Email', text: 'Please enter a valid email address.' })
      return
    }

    const allLeads = fetchInquiries()
    const emailDuplicate = allLeads.find((l) => l.email.toLowerCase() === email.trim().toLowerCase())
    if (emailDuplicate) {
      Swal.fire({ 
        icon: 'error', 
        title: 'Lead Already Exists', 
        html: `The email <strong>${email}</strong> is already used by <strong>${emailDuplicate.name}</strong>.` 
      })
      return
    }

    const phoneDigits = phone.trim().replace(/[\s-]/g, '')
    if (!phoneDigits || phoneDigits.length < 8) {
      Swal.fire({ icon: 'warning', title: 'Invalid Phone', text: 'Please enter a valid phone number.' })
      return
    }

    const phoneDuplicate = allLeads.find((l) => l.phone.replace(/[\s-]/g, '') === phoneDigits)
    if (phoneDuplicate) {
      Swal.fire({ 
        icon: 'error', 
        title: 'Phone Already Used', 
        html: `The phone number <strong>${phone}</strong> is already associated with <strong>${phoneDuplicate.name}</strong>.` 
      })
      return
    }

    const selectedProperty = properties.find((p) => p.id === propertyId)
    const resolvedPropertyTitle = selectedProperty?.title ?? propertyTitle
    onSaveCreate({
      name,
      email: email.trim(),
      phone: phone.trim(),
      propertyId: propertyId || null,
      propertyTitle: resolvedPropertyTitle,
      message,
      notes,
      source,
      priority,
      lastContactedAt: toIsoFromDateTimeLocal(lastContactedAt),
      nextFollowUpAt: nextFollowUpAt || null,
    })
  }

  return (
    <div className="deal-sidebar-overlay" onClick={onClose} role="presentation">
      <div className="deal-sidebar" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add Lead">
        <div className="deal-sidebar-header">
          <h2>Add Lead</h2>
          <button type="button" className="deal-sidebar-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="deal-sidebar-body">
          <div className="admin-form-row">
            <label>Name *</label>
            <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="admin-form-row">
            <label>Email *</label>
            <input type="email" className="admin-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="admin-form-row">
            <label>Phone *</label>
            <input type="tel" className="admin-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="admin-form-row">
            <label>Created At</label>
            <input className="admin-input" value={new Date().toLocaleString()} readOnly />
          </div>
          <div className="admin-form-row">
            <label>Last Contacted At</label>
            <input
              type="datetime-local"
              className="admin-input"
              value={lastContactedAt}
              onChange={(e) => setLastContactedAt(e.target.value)}
            />
          </div>
          <div className="admin-form-row">
            <label>Next Follow-up At</label>
            <input
              type="date"
              className="admin-input"
              value={nextFollowUpAt}
              onChange={(e) => setNextFollowUpAt(e.target.value)}
            />
          </div>
          <div className="admin-form-row">
            <label>Priority</label>
            <select
              className="admin-input"
              value={priority}
              onChange={(e) => setPriority(e.target.value as LeadPriority)}
            >
              {priorityOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="admin-form-row">
            <label>Property</label>
            <select
              className="admin-input"
              value={propertyId}
              onChange={(e) => {
                const selected = properties.find((p) => p.id === e.target.value)
                setPropertyId(e.target.value)
                setPropertyTitle(selected?.title ?? '')
              }}
            >
              <option value="">Select property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div className="admin-form-row">
            <label>Message</label>
            <textarea className="admin-input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="admin-form-row">
            <label>Notes</label>
            <textarea className="admin-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="admin-form-row">
            <label>Source *</label>
            <select className="admin-input" value={source} onChange={(e) => setSource(e.target.value as 'facebook' | 'website' | 'walk-in' | 'referral')}>
              {sourceOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
        <FormActions primaryLabel="Add Lead" onPrimary={handleSave} onCancel={onClose} />
      </div>
    </div>
  )
}

function toIsoFromDateTimeLocal(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}
