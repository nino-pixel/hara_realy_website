import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Swal from 'sweetalert2'
import { HiOutlineArrowLeft, HiOutlineRefresh, HiOutlineCash, HiOutlineDocument, HiOutlinePencil } from 'react-icons/hi'
import StatusBadge from '../../components/StatusBadge'
import SectionCard from '../../components/SectionCard'
import {
  getDealByDealId,
  DEAL_STATUS_LABELS,
  DEAL_STATUSES,
  DEAL_CANCELLED_REASON_EXAMPLES,
  type Deal,
  type DealStatus,
} from '../../data/deals'
import { updateTransaction } from '../../data/clientsData'
import type { DealPaymentEntry } from '../../data/clientsData'
import './admin-common.css'
import './AdminDealProfile.css'

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const PAYMENT_TYPE_LABELS: Record<'reservation' | 'downpayment' | 'full_payment', string> = {
  reservation: 'Reservation',
  downpayment: 'Downpayment',
  full_payment: 'Full payment',
}

const DOC_TYPE_LABELS: Record<'reservationForm' | 'contract' | 'receipt', string> = {
  reservationForm: 'Reservation Form',
  contract: 'Contract',
  receipt: 'Receipt',
}

type ActionPanel = null | 'status' | 'payment' | 'document' | 'note'

export default function AdminDealProfile() {
  const { dealId } = useParams<{ dealId: string }>()
  const [deal, setDeal] = useState<Deal | null>(() => (dealId ? getDealByDealId(dealId) : null))
  const [actionPanel, setActionPanel] = useState<ActionPanel>(null)
  const [statusForm, setStatusForm] = useState<DealStatus>('Inquiry')
  const [cancelReasonForm, setCancelReasonForm] = useState('')
  const [cancelReasonOther, setCancelReasonOther] = useState('')
  const [paymentForm, setPaymentForm] = useState({ type: 'downpayment' as DealPaymentEntry['type'], amount: '', date: todayISO(), proof: '', notes: '' })
  const [documentForm, setDocumentForm] = useState<{ doc: 'reservationForm' | 'contract' | 'receipt'; fileRef: string }>({ doc: 'contract', fileRef: '' })
  const [noteForm, setNoteForm] = useState('')

  // Sync: ensure deal state matches dealId in URL
  const [prevDealIdSync, setPrevDealIdSync] = useState(dealId)
  if (dealId !== prevDealIdSync) {
    setPrevDealIdSync(dealId)
    setDeal(dealId ? getDealByDealId(dealId) : null)
  }

  const refreshDeal = () => {
    if (dealId) setDeal(getDealByDealId(dealId))
  }

  const handleUpdateStatus = () => {
    if (!deal) return
    if (statusForm === 'Cancelled') {
      const confirmed = window.confirm(
        'Cancel this deal? Setting this deal to Cancelled will remove it from the active pipeline.'
      )
      if (!confirmed) return
    }
    const now = todayISO()
    const cancelledReason =
      statusForm === 'Cancelled'
        ? (cancelReasonForm === 'Other' ? cancelReasonOther.trim() : cancelReasonForm) || null
        : null
    updateTransaction(deal._clientId, deal._row.id, {
      status: statusForm,
      cancelledReason: cancelledReason ?? undefined,
      updatedAt: now,
      statusHistory: [...(deal._row.statusHistory ?? []), { status: statusForm, at: now, note: cancelledReason ?? '' }],
      activity: [...(deal._row.activity ?? []), { type: 'status_changed', date: now, label: `Status changed to ${statusForm}` }],
    })
    refreshDeal()
    setActionPanel(null)
    setCancelReasonForm('')
    setCancelReasonOther('')
    if (statusForm === 'Cancelled') {
      const reasonText = cancelledReason ? `Reason: ${cancelledReason}` : ''
      setTimeout(() => {
        Swal.fire({
          icon: 'success',
          title: 'Deal cancelled',
          ...(reasonText && { text: reasonText }),
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        })
      }, 100)
    }
  }

  const handleAddPayment = () => {
    if (!deal || !paymentForm.amount.trim()) return
    const now = todayISO()
    const entry: DealPaymentEntry = {
      type: paymentForm.type,
      amount: paymentForm.amount.trim(),
      date: paymentForm.date || now,
      proof: paymentForm.proof.trim() || undefined,
      notes: paymentForm.notes.trim() || undefined,
    }
    updateTransaction(deal._clientId, deal._row.id, {
      payments: [...(deal._row.payments ?? []), entry],
      updatedAt: now,
    })
    refreshDeal()
    setActionPanel(null)
    setPaymentForm({ type: 'downpayment', amount: '', date: todayISO(), proof: '', notes: '' })
  }

  const handleUploadDocument = () => {
    if (!deal) return
    const now = todayISO()
    const key = documentForm.doc
    const value = { status: 'uploaded' as const, uploadedAt: now, fileRef: documentForm.fileRef.trim() || undefined }
    updateTransaction(deal._clientId, deal._row.id, {
      documents: { ...deal._row.documents, [key]: value },
      updatedAt: now,
      activity: [...(deal._row.activity ?? []), { type: 'document_uploaded', date: now, label: `${DOC_TYPE_LABELS[key]} uploaded` }],
    })
    refreshDeal()
    setActionPanel(null)
    setDocumentForm({ doc: 'contract', fileRef: '' })
  }

  const handleAddNote = () => {
    if (!deal || !noteForm.trim()) return
    const prev = deal._row.adminNotes ?? ''
    const next = prev ? `${prev}\n\n${noteForm.trim()}` : noteForm.trim()
    updateTransaction(deal._clientId, deal._row.id, { adminNotes: next, updatedAt: todayISO() })
    refreshDeal()
    setActionPanel(null)
    setNoteForm('')
  }

  if (!deal) {
    return (
      <div className="admin-deal-profile">
        <p className="admin-empty">Deal not found.</p>
        <Link to="/admin/deals" className="btn btn-outline">Back to Deals</Link>
      </div>
    )
  }

  const statusClass = deal.status.toLowerCase().replace(/\s+/g, '-')
  const docs = deal.documents
  const payments = deal.payments ?? []
  const statusHistory = (deal.statusHistory ?? []).slice().sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  const activityList = deal.activity && deal.activity.length > 0
    ? deal.activity
    : [
        ...(deal.createdAt ? [{ type: 'created' as const, date: deal.createdAt, label: 'Deal created' }] : []),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="admin-deal-profile">
      <header className="deal-profile-header">
        <Link to="/admin/deals" className="deal-profile-back">
          <HiOutlineArrowLeft aria-hidden /> Back to Deals
        </Link>
        <div className="deal-profile-title-row">
          <h1 className="deal-profile-title">Deal {deal.dealId}</h1>
          <StatusBadge className={`admin-badge admin-badge--deal-${statusClass}`}>
            {DEAL_STATUS_LABELS[deal.status]}
          </StatusBadge>
        </div>
        <p className="deal-profile-who-what">
          <Link to={`/admin/clients/${deal.clientId}`}>{deal.clientName}</Link>
          <span className="deal-profile-who-what-sep"> · </span>
          {deal.propertyId ? (
            <Link to={`/admin/properties/${deal.propertyId}`}>{deal.propertyTitle}</Link>
          ) : (
            deal.propertyTitle
          )}
        </p>
        <div className="deal-profile-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setActionPanel('status'); setStatusForm(deal.status); setCancelReasonForm(''); setCancelReasonOther(''); }}>
            <HiOutlineRefresh aria-hidden /> Update Status
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setActionPanel('payment')}>
            <HiOutlineCash aria-hidden /> Add Payment
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setActionPanel('document')}>
            <HiOutlineDocument aria-hidden /> Upload Document
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setActionPanel('note')}>
            <HiOutlinePencil aria-hidden /> Add Note
          </button>
        </div>
      </header>

      {/* Update Status modal */}
      {actionPanel === 'status' && (
        <div className="admin-modal-overlay" onClick={() => setActionPanel(null)}>
          <div className="admin-modal deal-action-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Update Status</h2>
              <button type="button" className="admin-modal-close" onClick={() => setActionPanel(null)} aria-label="Close">×</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-row">
                <label>New status</label>
                <select value={statusForm} onChange={(e) => setStatusForm(e.target.value as DealStatus)} className="admin-input">
                  {DEAL_STATUSES.map((s) => (
                    <option key={s} value={s}>{DEAL_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              {statusForm === 'Cancelled' && (
                <>
                  <div className="admin-form-row">
                    <label htmlFor="deal-cancel-reason">Cancelled reason (optional)</label>
                    <select
                      id="deal-cancel-reason"
                      value={cancelReasonForm}
                      onChange={(e) => setCancelReasonForm(e.target.value)}
                      className="admin-input"
                    >
                      <option value="">— Optional —</option>
                      {DEAL_CANCELLED_REASON_EXAMPLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {cancelReasonForm === 'Other' && (
                    <div className="admin-form-row">
                      <label htmlFor="deal-cancel-reason-other">Other reason</label>
                      <input
                        id="deal-cancel-reason-other"
                        type="text"
                        value={cancelReasonOther}
                        onChange={(e) => setCancelReasonOther(e.target.value)}
                        placeholder="e.g. Price too high, Financing rejected"
                        className="admin-input"
                      />
                    </div>
                  )}
                </>
              )}
              <div className="admin-form-actions">
                <button type="button" className="btn btn-primary" onClick={handleUpdateStatus}>Update</button>
                <button type="button" className="btn btn-outline" onClick={() => setActionPanel(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment modal */}
      {actionPanel === 'payment' && (
        <div className="admin-modal-overlay" onClick={() => setActionPanel(null)}>
          <div className="admin-modal deal-action-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Add Payment</h2>
              <button type="button" className="admin-modal-close" onClick={() => setActionPanel(null)} aria-label="Close">×</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-row">
                <label>Type</label>
                <select value={paymentForm.type} onChange={(e) => setPaymentForm((f) => ({ ...f, type: e.target.value as DealPaymentEntry['type'] }))} className="admin-input">
                  <option value="reservation">Reservation</option>
                  <option value="downpayment">Downpayment</option>
                  <option value="full_payment">Full payment</option>
                </select>
              </div>
              <div className="admin-form-row">
                <label>Amount *</label>
                <input value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} placeholder="₱0" className="admin-input" />
              </div>
              <div className="admin-form-row">
                <label>Date</label>
                <input type="date" value={paymentForm.date} onChange={(e) => setPaymentForm((f) => ({ ...f, date: e.target.value }))} className="admin-input" />
              </div>
              <div className="admin-form-row">
                <label>Proof (e.g. receipt filename)</label>
                <input value={paymentForm.proof} onChange={(e) => setPaymentForm((f) => ({ ...f, proof: e.target.value }))} placeholder="Optional" className="admin-input" />
              </div>
              <div className="admin-form-row">
                <label>Notes</label>
                <input value={paymentForm.notes} onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" className="admin-input" />
              </div>
              <div className="admin-form-actions">
                <button type="button" className="btn btn-primary" onClick={handleAddPayment}>Add Payment</button>
                <button type="button" className="btn btn-outline" onClick={() => setActionPanel(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document modal */}
      {actionPanel === 'document' && (
        <div className="admin-modal-overlay" onClick={() => setActionPanel(null)}>
          <div className="admin-modal deal-action-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Upload Document</h2>
              <button type="button" className="admin-modal-close" onClick={() => setActionPanel(null)} aria-label="Close">×</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-row">
                <label>Document</label>
                <select value={documentForm.doc} onChange={(e) => setDocumentForm((f) => ({ ...f, doc: e.target.value as typeof f.doc }))} className="admin-input">
                  <option value="reservationForm">Reservation Form</option>
                  <option value="contract">Contract</option>
                  <option value="receipt">Receipt</option>
                </select>
              </div>
              <div className="admin-form-row">
                <label>File / reference</label>
                <input value={documentForm.fileRef} onChange={(e) => setDocumentForm((f) => ({ ...f, fileRef: e.target.value }))} placeholder="e.g. contract-dl001.pdf" className="admin-input" />
              </div>
              <p className="deal-action-hint">Mark as uploaded. Backend can replace with real file upload.</p>
              <div className="admin-form-actions">
                <button type="button" className="btn btn-primary" onClick={handleUploadDocument}>Mark Uploaded</button>
                <button type="button" className="btn btn-outline" onClick={() => setActionPanel(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Note modal */}
      {actionPanel === 'note' && (
        <div className="admin-modal-overlay" onClick={() => setActionPanel(null)}>
          <div className="admin-modal deal-action-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Add Note</h2>
              <button type="button" className="admin-modal-close" onClick={() => setActionPanel(null)} aria-label="Close">×</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-row">
                <label>Admin note</label>
                <textarea value={noteForm} onChange={(e) => setNoteForm(e.target.value)} placeholder="Add a note…" className="admin-input" rows={4} />
              </div>
              <div className="admin-form-actions">
                <button type="button" className="btn btn-primary" onClick={handleAddNote}>Add Note</button>
                <button type="button" className="btn btn-outline" onClick={() => setActionPanel(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="deal-profile-two-col">
        <div className="deal-profile-left">
          <SectionCard title="Financial Summary">
            <dl className="deal-profile-dl deal-profile-financial-dl">
              <dt>Property Price</dt>
              <dd>{deal.propertyPrice ?? '—'}</dd>
              <dt>Final Sale Price</dt>
              <dd>{deal.finalSalePrice ?? deal.price ?? '—'}</dd>
              <dt>Discount</dt>
              <dd>{deal.discount ?? '—'}</dd>
              <dt>Reservation</dt>
              <dd>{payments.find((p) => p.type === 'reservation')?.amount ?? '—'}</dd>
            </dl>
          </SectionCard>
          <SectionCard title="Payments">
            {payments.length === 0 ? (
              <p className="admin-empty">No payments yet. Use <strong>Add Payment</strong> above.</p>
            ) : (
              <ul className="deal-profile-payments">
                {payments.map((p, i) => (
                  <li key={i} className="deal-profile-payment-item">
                    <span className="deal-profile-payment-type">{PAYMENT_TYPE_LABELS[p.type]}</span>
                    <span className="deal-profile-payment-amount">{p.amount}</span>
                    <span className="deal-profile-payment-date">{formatDate(p.date)}</span>
                    {p.proof && <span className="deal-profile-payment-proof">{p.proof}</span>}
                    {p.notes && <span className="deal-profile-payment-notes">{p.notes}</span>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard title="Documents">
            <ul className="deal-profile-docs">
              <li>
                <span className="deal-profile-doc-label">Reservation Form</span>
                <span className="deal-profile-doc-value">
                  {docs?.reservationForm ? (
                    <>
                      <span className={`deal-profile-doc-status deal-profile-doc-status--${docs.reservationForm.status}`}>
                        {docs.reservationForm.status === 'uploaded' ? 'Uploaded' : 'Pending'}
                      </span>
                      {docs.reservationForm.uploadedAt && ` ${formatDate(docs.reservationForm.uploadedAt)}`}
                      {docs.reservationForm.fileRef && ` · ${docs.reservationForm.fileRef}`}
                    </>
                  ) : '—'}
                </span>
              </li>
              <li>
                <span className="deal-profile-doc-label">Contract</span>
                <span className="deal-profile-doc-value">
                  {docs?.contract ? (
                    <>
                      <span className={`deal-profile-doc-status deal-profile-doc-status--${docs.contract.status}`}>
                        {docs.contract.status === 'uploaded' ? 'Uploaded' : 'Pending'}
                      </span>
                      {docs.contract.uploadedAt && ` ${formatDate(docs.contract.uploadedAt)}`}
                      {docs.contract.fileRef && ` · ${docs.contract.fileRef}`}
                    </>
                  ) : '—'}
                </span>
              </li>
              <li>
                <span className="deal-profile-doc-label">Receipt</span>
                <span className="deal-profile-doc-value">
                  {docs?.receipt ? (
                    <>
                      <span className={`deal-profile-doc-status deal-profile-doc-status--${docs.receipt.status}`}>
                        {docs.receipt.status === 'uploaded' ? 'Uploaded' : 'Pending'}
                      </span>
                      {docs.receipt.uploadedAt && ` ${formatDate(docs.receipt.uploadedAt)}`}
                      {docs.receipt.fileRef && ` · ${docs.receipt.fileRef}`}
                    </>
                  ) : '—'}
                </span>
              </li>
            </ul>
          </SectionCard>
        </div>
        <div className="deal-profile-right">
          <SectionCard title="Deal Info">
            <dl className="deal-profile-dl">
              <dt>Client</dt>
              <dd><Link to={`/admin/clients/${deal.clientId}`}>{deal.clientName}</Link></dd>
              <dt>Property</dt>
              <dd>
                {deal.propertyId ? (
                  <Link to={`/admin/properties/${deal.propertyId}`}>{deal.propertyTitle}</Link>
                ) : (
                  deal.propertyTitle
                )}
              </dd>
              <dt>Status</dt>
              <dd>
                <StatusBadge className={`admin-badge admin-badge--deal-${statusClass}`}>
                  {DEAL_STATUS_LABELS[deal.status]}
                </StatusBadge>
              </dd>
              {deal.status === 'Cancelled' && deal.cancelledReason && (
                <>
                  <dt>Cancelled reason</dt>
                  <dd>{deal.cancelledReason}</dd>
                </>
              )}
            </dl>
          </SectionCard>
          <SectionCard title="Timeline">
            <dl className="deal-profile-dl">
              <dt>Created</dt>
              <dd>{formatDate(deal.createdAt ?? deal.date)}</dd>
              <dt>Last updated</dt>
              <dd>{formatDate(deal.updatedAt)}</dd>
              <dt>Expected closing</dt>
              <dd>{formatDate(deal.expectedClosingDate)}</dd>
              <dt>Closing date</dt>
              <dd>{formatDate(deal.closingDate)}</dd>
            </dl>
          </SectionCard>
          <SectionCard title="Status history">
            {statusHistory.length === 0 ? (
              <p className="admin-empty">No status history yet.</p>
            ) : (
              <ul className="deal-profile-status-history">
                {statusHistory.map((entry, i) => (
                  <li key={i} className="deal-profile-status-entry">
                    <span className="deal-profile-status-date">{formatDate(entry.at)}</span>
                    <span className="deal-profile-status-name">{entry.status}</span>
                    {entry.note && <span className="deal-profile-status-note">{entry.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard title="Activity & notes">
            {activityList.length === 0 && !deal.adminNotes ? (
              <p className="admin-empty">No activity or notes yet.</p>
            ) : (
              <>
                {activityList.length > 0 && (
                  <ul className="deal-profile-activity">
                    {activityList.map((item, i) => (
                      <li key={i} className="deal-profile-activity-item">
                        <span className="deal-profile-activity-date">{formatDate(item.date)}</span>
                        <span className="deal-profile-activity-label">{item.label}</span>
                        {'details' in item && item.details ? (
                          <span className="deal-profile-activity-details">{item.details}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {deal.adminNotes && (
                  <div className="deal-profile-notes">
                    <strong>Admin notes</strong>
                    <p className="deal-profile-notes-text">{deal.adminNotes}</p>
                  </div>
                )}
              </>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
