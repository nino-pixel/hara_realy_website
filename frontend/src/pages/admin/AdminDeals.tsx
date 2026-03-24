import { useState, useMemo, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { HiOutlineEye, HiOutlinePencil, HiOutlineArchive } from 'react-icons/hi'
import Swal from 'sweetalert2'
import FormActions from '../../components/FormActions'
import StatusBadge from '../../components/StatusBadge'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import {
  fetchDeals,
  fetchActiveClientsForDeals,
  fetchActivePropertiesForDeals,
  getNextDealId,
  DEAL_STATUS_LABELS,
  getDealPaymentsSummary,
  type Deal,
  type DealStatus,
  type DealPaymentEntry,
  type DealStatusHistoryEntry,
  updateDealTransaction,
  createDealTransaction,
  deleteDealFromApi,
  deleteDealFromLocal,
} from '../../services/dealsService'
import './admin-common.css'
import './Deals.css'

const DEAL_STATUSES: DealStatus[] = [
  'Inquiry',
  'Negotiation',
  'Reserved',
  'Processing Documents',
  'Closed',
  'Cancelled',
]

function formatDisplayDate(iso: string): string {
  const d = new Date(iso)
  const mon = d.toLocaleString('en-US', { month: 'short' })
  const day = d.getDate()
  return `${mon} ${day}`
}

function buildDealSearchHaystack(d: Deal): string {
  const parts: string[] = [
    d.id,
    d.dealId,
    d.clientId,
    d.clientName,
    d.propertyId ?? '',
    d.propertyTitle,
    d.status,
    DEAL_STATUS_LABELS[d.status],
    d.price,
    d.date,
    d.closingDate ?? '',
    d.expectedClosingDate ?? '',
    d.createdAt ?? '',
    d.updatedAt ?? '',
    d.cancelledReason ?? '',
    d.adminNotes ?? '',
    d.paymentMethod ?? '',
    d.propertyPrice ?? '',
    d.finalSalePrice ?? '',
    d.discount ?? '',
    getDealPaymentsSummary(d),
  ]
  const closeOrDate = d.closingDate || d.date
  if (closeOrDate) {
    try {
      parts.push(formatDisplayDate(closeOrDate), new Date(closeOrDate).toLocaleDateString())
    } catch {
      /* ignore */
    }
  }
  if (d.payments?.length) {
    for (const p of d.payments) {
      parts.push(p.amount, p.type, p.date, p.notes ?? '', p.proof ?? '')
    }
  }
  if (d.statusHistory?.length) {
    for (const h of d.statusHistory) {
      parts.push(h.status, h.at, h.note ?? '')
    }
  }
  if (d.activity?.length) {
    for (const a of d.activity) {
      parts.push(a.type, a.date, a.label, a.details ?? '')
    }
  }
  const row = d._row
  if (row?.leadOriginId) parts.push(row.leadOriginId)
  if (row?.payment) parts.push(row.payment)
  if (row?.agent) parts.push(row.agent)
  return parts.filter(Boolean).join(' ').toLowerCase()
}

export default function AdminDeals() {
  const [searchParams, setSearchParams] = useSearchParams()
  const clientIdFromUrl = searchParams.get('clientId') ?? ''
  const [deals, setDeals] = useState<Deal[]>(() => fetchDeals())
  const [showAdd, setShowAdd] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelReasonError, setCancelReasonError] = useState('')
  const [archiveModalDeal, setArchiveModalDeal] = useState<Deal | null>(null)
  const [archiveReason, setArchiveReason] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [form, setForm] = useState({
    clientId: '',
    clientName: '',
    propertyId: '',
    propertyTitle: '',
    leadOriginId: '' as string | null,
    propertyPrice: '',
    finalSalePrice: '',
    paymentMethod: '',
    status: 'Inquiry' as DealStatus,
    createdAt: new Date().toISOString().slice(0, 10),
    closingDate: '',
    expectedClosingDate: '',
    adminNotes: '',
    firstPaymentType: '' as '' | 'reservation' | 'downpayment' | 'full_payment',
    firstPaymentAmount: '',
    firstPaymentDate: '',
  })

  useEffect(() => {
    setLoading(false)
  }, [])

  const clients = fetchActiveClientsForDeals()
  const properties = fetchActivePropertiesForDeals()

  useEffect(() => {
    const shouldOpenCreate = searchParams.get('createDeal') === '1'
    if (!shouldOpenCreate || !clientIdFromUrl) return

    const propertyIdFromUrl = searchParams.get('propertyId') ?? ''
    const propertyTitleFromUrl = searchParams.get('propertyTitle') ?? ''
    const clientNameFromUrl = searchParams.get('clientName') ?? ''
    const leadOriginIdFromUrl = searchParams.get('leadOriginId')
    const propsList = fetchActivePropertiesForDeals()
    const prop = propertyIdFromUrl ? propsList.find((p) => p.id === propertyIdFromUrl) : undefined
    const listPrice = prop?.price ?? ''
    setShowAdd(true)
    setEditingDeal(null)
    setForm((prev) => ({
      ...prev,
      clientId: clientIdFromUrl,
      clientName: clientNameFromUrl,
      propertyId: propertyIdFromUrl,
      propertyTitle: propertyTitleFromUrl || prop?.title || '',
      leadOriginId: leadOriginIdFromUrl,
      propertyPrice: listPrice || prev.propertyPrice,
      finalSalePrice: listPrice || prev.finalSalePrice,
    }))
  }, [searchParams, clientIdFromUrl])
  const clientFromUrl = clientIdFromUrl ? clients.find((c) => c.id === clientIdFromUrl) : null

  const filtered = useMemo(() => {
    let list = [...deals]

    if (clientIdFromUrl) {
      list = list.filter((d) => d.clientId === clientIdFromUrl)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((d) => buildDealSearchHaystack(d).includes(q))
    }

    const dealTime = (d: (typeof list)[number]) =>
      new Date(d.createdAt || d.closingDate || d.date || 0).getTime()
    return [...list].sort((a, b) => dealTime(b) - dealTime(a))
  }, [deals, clientIdFromUrl, searchQuery])

  const refreshDeals = () => setDeals(fetchDeals())

  const openEdit = (d: Deal) => {
    setForm({
      clientId: d.clientId,
      clientName: d.clientName,
      propertyId: d.propertyId ?? '',
      propertyTitle: d.propertyTitle,
      leadOriginId: d._row.leadOriginId ?? null,
      propertyPrice: d.propertyPrice ?? '',
      finalSalePrice: d.finalSalePrice ?? d.price ?? '',
      paymentMethod: d.paymentMethod ?? '',
      status: d.status,
      createdAt: d.createdAt?.slice(0, 10) ?? d.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      closingDate: d.closingDate ?? '',
      expectedClosingDate: d.expectedClosingDate ?? '',
      adminNotes: d.adminNotes ?? '',
      firstPaymentType: '' as '' | 'reservation' | 'downpayment' | 'full_payment',
      firstPaymentAmount: '',
      firstPaymentDate: '',
    })
    setEditingDeal(d)
  }

  const closeSidebar = () => {
    setShowAdd(false)
    setEditingDeal(null)
  }

  const extractNumericAmount = (value: string): string => {
    const numeric = String(value ?? '').replace(/[^\d.]/g, '')
    return numeric
  }

  const handleAddDeal = () => {
    if (!form.clientId) {
      window.alert('Client is required before creating a deal.')
      return
    }
    if (!form.propertyTitle.trim()) return
    if (form.status === 'Closed' && !form.closingDate.trim()) {
      window.alert('Closing date is required when closing a deal.')
      return
    }
    const prop = properties.find((p) => p.id === form.propertyId)
    const propertyTitle = (form.propertyTitle.trim() || prop?.title) ?? ''
    if (!propertyTitle) return
    const amount = form.finalSalePrice.trim() || form.propertyPrice.trim() || '₱0'
    const createdAt = form.createdAt || new Date().toISOString().slice(0, 10)
    const payments: DealPaymentEntry[] = []
    if (form.firstPaymentType && form.firstPaymentAmount.trim()) {
      payments.push({
        type: form.firstPaymentType,
        amount: form.firstPaymentAmount.trim(),
        date: form.firstPaymentDate || createdAt,
      })
    }
    const statusHistory: DealStatusHistoryEntry[] = [
      { status: form.status, at: createdAt, note: 'Deal created' },
    ]
    const dealId = getNextDealId()
    const clientLeadOriginId =
      form.leadOriginId ?? clients.find((c) => c.id === form.clientId)?.leadOriginId ?? null
    createDealTransaction(form.clientId, {
      id: 't' + Date.now(),
      dealId,
      propertyTitle,
      propertyId: form.propertyId || undefined,
      amount,
      date: form.closingDate || createdAt,
      status: form.status,
      propertyPrice: form.propertyPrice.trim() || undefined,
      finalSalePrice: form.finalSalePrice.trim() || undefined,
      paymentMethod: form.paymentMethod.trim() || undefined,
      createdAt,
      closingDate: form.closingDate.trim() || undefined,
      expectedClosingDate: form.expectedClosingDate.trim() || undefined,
      updatedAt: createdAt,
      adminNotes: form.adminNotes.trim() || undefined,
      payments: payments.length ? payments : undefined,
      statusHistory,
      documents: {
        reservationForm: { status: 'pending' },
        contract: { status: 'pending' },
        receipt: { status: 'pending' },
      },
      leadOriginId: clientLeadOriginId,
    } as any)
    setForm({
      clientId: '',
      clientName: '',
      propertyId: '',
      propertyTitle: '',
      leadOriginId: null,
      propertyPrice: '',
      finalSalePrice: '',
      paymentMethod: '',
      status: 'Inquiry',
      createdAt: new Date().toISOString().slice(0, 10),
      closingDate: '',
      expectedClosingDate: '',
      adminNotes: '',
      firstPaymentType: '',
      firstPaymentAmount: '',
      firstPaymentDate: '',
    })
    setShowAdd(false)
    refreshDeals()
  }

  const handleUpdateDeal = () => {
    if (!editingDeal) return
    if (form.status === 'Closed' && !form.closingDate.trim()) {
      window.alert('Closing date is required when closing a deal.')
      return
    }
    if (form.status === 'Cancelled') {
      setShowCancelConfirmModal(true)
      setCancelReason('')
      setCancelReasonError('')
      return
    }
    applyDealUpdate()
  }

  const handleArchiveDeal = (d: Deal) => {
    setArchiveModalDeal(d)
    setArchiveReason('')
    setArchiveError('')
  }

  const confirmArchiveDeal = async () => {
    if (!archiveModalDeal) return
    const reason = archiveReason.trim()
    if (!reason) {
      setArchiveError('Please provide a reason for archiving.')
      return
    }

    try {
      await deleteDealFromApi(archiveModalDeal.id)
      deleteDealFromLocal(archiveModalDeal._clientId, archiveModalDeal.id)
      setDeals(prev => prev.filter(x => x.id !== archiveModalDeal.id))
      
      Swal.fire({
        icon: 'success',
        title: 'Deal archived',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      })
      setArchiveModalDeal(null)
      setArchiveReason('')
      setArchiveError('')
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Archive failed',
        text: err instanceof Error ? err.message : 'Could not archive deal.',
      })
    }
  }

  const confirmCancelDeal = () => {
    if (!editingDeal) return
    const reason = cancelReason.trim() || null
    applyDealUpdate(reason)
    setShowCancelConfirmModal(false)
    setCancelReason('')
    setCancelReasonError('')
    closeSidebar()
    refreshDeals()
    setTimeout(() => {
      Swal.fire({
        icon: 'success',
        title: 'Deal cancelled',
        ...(reason && { text: `Reason: ${reason}` }),
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      })
    }, 100)
  }

  const applyDealUpdate = (cancelledReason: string | null = null) => {
    if (!editingDeal) return
    const amount = form.finalSalePrice.trim() || form.propertyPrice.trim() || editingDeal._row.amount
    const updatedAt = new Date().toISOString().slice(0, 10)
    const payload: Record<string, unknown> = {
      propertyTitle: form.propertyTitle.trim() || editingDeal.propertyTitle,
      propertyId: form.propertyId || undefined,
      amount,
      propertyPrice: form.propertyPrice.trim() || undefined,
      finalSalePrice: form.finalSalePrice.trim() || undefined,
      paymentMethod: form.paymentMethod.trim() || undefined,
      status: form.status,
      createdAt: form.createdAt || undefined,
      closingDate: form.closingDate.trim() || undefined,
      expectedClosingDate: form.expectedClosingDate.trim() || undefined,
      adminNotes: form.adminNotes.trim() || undefined,
      updatedAt,
    }
    if (form.status === 'Cancelled' && cancelledReason !== undefined) {
      payload.cancelledReason = cancelledReason
    }
    updateDealTransaction(editingDeal._clientId, editingDeal.id, payload)
    if (form.status !== 'Cancelled') {
      closeSidebar()
      refreshDeals()
      setTimeout(() => {
        Swal.fire({
          icon: 'success',
          title: 'Deal updated',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        })
      }, 100)
    }
  }

  const displayDate = (d: Deal) => formatDisplayDate(d.closingDate || d.date)

  return (
    <div className="admin-deals">
      <PageHeader
        title="Deals"
        subtitle="Transaction engine. Who bought what, when, and at what stage in the pipeline."
        toolbar={
          <>
            {clientFromUrl && (
              <span className="admin-deals-client-filter">
                Showing deals for <strong>{clientFromUrl.name}</strong>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setSearchParams({})}
                  style={{ marginLeft: 8 }}
                >
                  Show all
                </button>
              </span>
            )}
            <input
              type="search"
              className="admin-input admin-deals-search"
              placeholder="Search deal ID, client, property, status, price, dates, payments, notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search all deal fields"
            />
            <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
              Add Deal
            </button>
          </>
        }
      />
      <DataTable wrapperClassName="admin-deals-table-wrap" tableClassName="deals-table">
        <thead>
          <tr>
            <th className="th-plain">
              <span className="th-label">Deal ID</span>
            </th>
            <th className="th-plain">
              <span className="th-label">Client</span>
            </th>
            <th className="th-plain">
              <span className="th-label">Property</span>
            </th>
            <th className="th-plain col-status">
              <span className="th-label">Status</span>
            </th>
            <th className="th-plain">
              <span className="th-label">Price</span>
            </th>
            <th className="th-plain">
              <span className="th-label">Discount</span>
            </th>
            <th className="th-plain">
              <span className="th-label">Payments</span>
            </th>
            <th className="th-plain">
              <span className="th-label">Closing Date</span>
            </th>
            <th className="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={9} className="admin-empty-cell">
                Loading deals...
              </td>
            </tr>
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={9} className="admin-empty-cell">
                No deals found.
              </td>
            </tr>
          ) : (
            filtered.map((d) => (
              <tr key={d.clientId + d.id}>
                <td className="deals-deal-id">{d.dealId}</td>
                <td>
                  <Link to={`/admin/clients/${d.clientId}`}>{d.clientName}</Link>
                </td>
                <td>
                  {d.propertyId ? (
                    <Link to={`/admin/properties/${d.propertyId}`}>{d.propertyTitle}</Link>
                  ) : (
                    d.propertyTitle
                  )}
                </td>
                <td>
                  <StatusBadge className={`admin-badge admin-badge--deal-${d.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {DEAL_STATUS_LABELS[d.status]}
                  </StatusBadge>
                </td>
                <td className="deals-amount">{d.price}</td>
                <td className="deals-discount">{d.discount ?? '—'}</td>
                <td className="deals-payments">{getDealPaymentsSummary(d)}</td>
                <td>{displayDate(d)}</td>
                <td className="col-actions">
                  <Link
                    to={`/admin/deals/${d.dealId}`}
                    className="btn-icon-btn"
                    data-tooltip="View deal — open the full deal page (timeline, payments, documents)."
                    title="View deal — full page with timeline and documents"
                    aria-label="View deal details"
                  >
                    <HiOutlineEye />
                  </Link>
                  <button
                    type="button"
                    className="btn-icon-btn"
                    data-tooltip="Edit deal — change stage, price, dates, payments, and notes in the side panel."
                    title="Edit deal — pipeline, pricing, and payments"
                    aria-label="Edit this deal"
                    onClick={() => openEdit(d)}
                  >
                    <HiOutlinePencil />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-btn btn-icon-btn--danger"
                    data-tooltip="Archive deal — hides this deal and moves it to the Archives hub (soft delete)."
                    title="Archive deal"
                    aria-label="Archive this deal"
                    onClick={() => handleArchiveDeal(d)}
                  >
                    <HiOutlineArchive />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>

      {/* Add / Edit Deal sidebar */}
      {(showAdd || editingDeal) && (
        <div className="deal-sidebar-overlay" onClick={closeSidebar} role="presentation">
          <div className="deal-sidebar" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={editingDeal ? 'Edit Deal' : 'Add Deal'}>
            <div className="deal-sidebar-header">
              <h2>{editingDeal ? 'Edit Deal' : 'Add Deal'}</h2>
              <button type="button" className="deal-sidebar-close" onClick={closeSidebar} aria-label="Close">×</button>
            </div>
            <div className="deal-sidebar-body">
              <div className="admin-form-row">
                <label>Client *</label>
                <select
                  value={form.clientId}
                  onChange={(e) => {
                    const nextClientId = e.target.value
                    const selectedClient = clients.find((c) => c.id === nextClientId)
                    setForm((f) => ({
                      ...f,
                      clientId: nextClientId,
                      clientName: selectedClient?.name ?? '',
                      leadOriginId: selectedClient?.leadOriginId ?? null,
                    }))
                  }}
                  className="admin-input"
                  disabled={!!editingDeal}
                >
                  <option value="">Select client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="admin-form-row">
                <label>Property *</label>
                <select
                  value={form.propertyId}
                  onChange={(e) => {
                    const p = properties.find((x) => x.id === e.target.value)
                    setForm((f) => {
                      const nextPropertyPrice = p?.price ?? ''
                      const shouldAutofillFullPayment = f.firstPaymentType === 'full_payment'
                      return {
                        ...f,
                        propertyId: e.target.value,
                        propertyTitle: p?.title ?? '',
                        propertyPrice: nextPropertyPrice,
                        firstPaymentAmount: shouldAutofillFullPayment
                          ? extractNumericAmount(nextPropertyPrice)
                          : f.firstPaymentAmount,
                      }
                    })
                  }}
                  className="admin-input"
                >
                  <option value="">Select property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.title} — {p.price}</option>
                  ))}
                </select>
              </div>
              <div className="admin-form-row">
                <label>Deal Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DealStatus }))}
                  className="admin-input"
                >
                  {DEAL_STATUSES.map((s) => (
                    <option key={s} value={s}>{DEAL_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className="admin-form-row">
                <label>Property Price</label>
                <input
                  value={form.propertyPrice}
                  onChange={(e) => setForm((f) => ({ ...f, propertyPrice: e.target.value }))}
                  placeholder="₱0"
                  className="admin-input"
                />
              </div>
              <div className="admin-form-row">
                <label>Final Sale Price (optional)</label>
                <input
                  value={form.finalSalePrice}
                  onChange={(e) => setForm((f) => ({ ...f, finalSalePrice: e.target.value }))}
                  placeholder="₱0"
                  className="admin-input"
                />
              </div>
              {!editingDeal && (
                <div className="admin-form-row">
                  <label>First payment (optional)</label>
                  <div className="deal-sidebar-payment-row">
                    <select
                      value={form.firstPaymentType}
                      onChange={(e) =>
                        setForm((f) => {
                          const nextType = e.target.value as typeof form.firstPaymentType
                          const shouldAutofill = nextType === 'full_payment'
                          return {
                            ...f,
                            firstPaymentType: nextType,
                            firstPaymentAmount: shouldAutofill
                              ? extractNumericAmount(f.propertyPrice)
                              : f.firstPaymentAmount,
                          }
                        })
                      }
                      className="admin-input"
                    >
                      <option value="">—</option>
                      <option value="reservation">Reservation</option>
                      <option value="downpayment">Downpayment</option>
                      <option value="full_payment">Full payment</option>
                    </select>
                    <input
                      value={form.firstPaymentAmount}
                      onChange={(e) => setForm((f) => ({ ...f, firstPaymentAmount: e.target.value }))}
                      placeholder="Amount"
                      className="admin-input"
                    />
                    <input
                      type="date"
                      value={form.firstPaymentDate}
                      onChange={(e) => setForm((f) => ({ ...f, firstPaymentDate: e.target.value }))}
                      className="admin-input"
                    />
                  </div>
                </div>
              )}
              <div className="admin-form-row">
                <label>Payment Method</label>
                <input
                  value={form.paymentMethod}
                  onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                  placeholder="e.g. Cash, Bank Transfer"
                  className="admin-input"
                />
              </div>
              <div className="admin-form-row">
                <label>Deal Created Date</label>
                <input
                  type="date"
                  value={form.createdAt}
                  onChange={(e) => setForm((f) => ({ ...f, createdAt: e.target.value }))}
                  className="admin-input"
                />
              </div>
              <div className="admin-form-row">
                <label>Expected closing date</label>
                <input
                  type="date"
                  value={form.expectedClosingDate}
                  onChange={(e) => setForm((f) => ({ ...f, expectedClosingDate: e.target.value }))}
                  className="admin-input"
                />
                <span className="deal-form-hint">Optional</span>
              </div>
              <div className="admin-form-row">
                <label>Closing date (actual)</label>
                <input
                  type="date"
                  value={form.closingDate}
                  onChange={(e) => setForm((f) => ({ ...f, closingDate: e.target.value }))}
                  className="admin-input"
                />
              </div>
              <div className="admin-form-row">
                <label>Admin Notes</label>
                <textarea
                  value={form.adminNotes}
                  onChange={(e) => setForm((f) => ({ ...f, adminNotes: e.target.value }))}
                  placeholder="Optional"
                  className="admin-input"
                  rows={3}
                />
              </div>
            </div>
            <FormActions
              primaryLabel={editingDeal ? 'Update Deal' : 'Add Deal'}
              onPrimary={editingDeal ? handleUpdateDeal : handleAddDeal}
              onCancel={closeSidebar}
            />
          </div>
        </div>
      )}

      {/* Confirm cancel deal modal — same pattern as property archive */}
      {showCancelConfirmModal && editingDeal && (
        <div
          className="admin-modal-overlay"
          onClick={() => setShowCancelConfirmModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-deal-modal-title"
        >
          <div className="admin-modal archive-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 id="cancel-deal-modal-title">Cancel this deal?</h2>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setShowCancelConfirmModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="archive-warning">
                <p className="archive-warning-title">⚠️ Confirmation</p>
                <p>
                  You are about to set deal <strong>{editingDeal.dealId}</strong> to <strong>Cancelled</strong>.
                  This will remove it from the active pipeline.
                </p>
              </div>
              <div className="admin-form-row">
                <label htmlFor="cancel-deal-reason">Reason for cancelling (optional)</label>
                <textarea
                  id="cancel-deal-reason"
                  className="admin-input"
                  value={cancelReason}
                  onChange={(e) => {
                    setCancelReason(e.target.value)
                    setCancelReasonError('')
                  }}
                  placeholder="e.g. Client backed out, Financing rejected, Price too high"
                  rows={3}
                />
              </div>
              {cancelReasonError && <p className="form-error">{cancelReasonError}</p>}
              <div className="archive-actions">
                <button type="button" className="btn btn-primary" onClick={confirmCancelDeal}>
                  Cancel deal
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCancelConfirmModal(false)}
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Archive deal modal — same pattern as client archive */}
      {archiveModalDeal && (
        <div
          className="admin-modal-overlay"
          onClick={() => setArchiveModalDeal(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-deal-modal-title"
        >
          <div className="admin-modal archive-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 id="archive-deal-modal-title">Archive deal</h2>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setArchiveModalDeal(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="archive-warning">
                <p className="archive-warning-title">⚠️ Confirmation</p>
                <p>
                  You are about to archive deal <strong>{archiveModalDeal.dealId}</strong>.
                </p>
              </div>
              <div className="admin-form-row">
                <label htmlFor="archive-reason">Reason for archiving <span className="required">*</span></label>
                <textarea
                  id="archive-reason"
                  className="admin-input"
                  value={archiveReason}
                  onChange={(e) => { setArchiveReason(e.target.value); setArchiveError(''); }}
                  placeholder="e.g. Transaction completed, client withdrew, listing expired"
                  rows={3}
                  required
                />
              </div>
              {archiveError && <p className="form-error">{archiveError}</p>}
              <div className="archive-actions">
                <button type="button" className="btn btn-primary" onClick={confirmArchiveDeal}>
                  Archive deal
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setArchiveModalDeal(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
