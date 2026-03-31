import { useState } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { HiOutlineArrowLeft, HiOutlineCash, HiOutlinePencil } from 'react-icons/hi'
import {
  getClientById,
  setClientStore,
  getSavedByClientId,
  getStatusLabel,
  getStatusDescription,
  type ClientRecord,
} from '../../data/clientsData'
import { getInquiriesForClientProfile } from '../../services/clientsService'
import { getClientAddressDisplay } from '../../data/bulacanAddress'
import { fetchDeals, DEAL_STATUS_LABELS, type Deal } from '../../services/dealsService'
import { getActivityStore, logActivity } from '../../data/activityLog'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import './admin-common.css'
import './ClientProfile.css'

export default function ClientProfile() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [client, setClient] = useState<ClientRecord | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Sync: ensure client state matches id in URL
  const [prevProfileId, setPrevProfileId] = useState(id)
  if (id !== prevProfileId) {
    setPrevProfileId(id)
    const c = id ? getClientById(id) : undefined
    setClient(c ?? null)
    setAdminNotes(c?.adminNotes ?? '')
  }

  const handleSaveNotes = () => {
    if (!client) return
    setSavingNotes(true)
    setClientStore((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, adminNotes } : c))
    )
    logActivity({
      actor: 'Admin',
      action: 'updated',
      entityType: 'client',
      entityId: client.id,
      entityLabel: client.name,
      details: 'Added a note',
    })
    setClient((prev) => (prev ? { ...prev, adminNotes } : null))
    setSavingNotes(false)
  }

  if (!client) {
    return (
      <div className="client-profile">
        <p className="admin-empty">Client not found.</p>
        <Link to="/admin/clients" className="btn btn-outline">Back to Clients</Link>
      </div>
    )
  }

  const inquiries = getInquiriesForClientProfile(client)
  const deals: Deal[] = fetchDeals().filter((d) => d.clientId === client.id)
  const saved = getSavedByClientId(client.id)
  const activity = getActivityStore()
    .filter((entry) => entry.entityId === client.id)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const isFromLead = searchParams.get('fromLead') === '1'
  const createDealHref = (() => {
    const params = new URLSearchParams({
      clientId: client.id,
      clientName: client.name,
      createDeal: '1',
    })
    if (client.leadOriginId) params.set('leadOriginId', client.leadOriginId)
    if (client.leadPropertyId) params.set('propertyId', client.leadPropertyId)
    if (client.leadPropertyTitle) params.set('propertyTitle', client.leadPropertyTitle)
    return `/admin/deals?${params.toString()}`
  })()

  const formatShortDate = (iso: string) => {
    const d = new Date(iso)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[d.getMonth()]} ${d.getDate()}`
  }

  return (
    <div className="client-profile">
      <header className="client-profile-header">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/admin/clients')}>
          <HiOutlineArrowLeft className="btn-icon" /> Back
        </button>
        <div className="client-profile-header-right">
          <h1 className="admin-page-title">Client Profile</h1>
          <p className="client-profile-subtitle">{client.name}</p>
        </div>
      </header>

      <div className="client-profile-context">
        <div className="client-profile-context-main">
          <h2 className="client-profile-name">{client.name}</h2>
          {client.isPriority && <span className="client-profile-priority-badge">High Priority</span>}
          {isFromLead && <StatusBadge className="admin-badge admin-badge--new">From Lead</StatusBadge>}
        </div>
        <div className="client-profile-context-meta">
          {client.lastContact && (
            <span className="client-profile-meta-item">
              <strong>Last Contact:</strong> {formatShortDate(client.lastContact)}
            </span>
          )}
          {client.nextFollowUp && (
            <span className="client-profile-meta-item">
              <strong>Next Follow-up:</strong> {formatShortDate(client.nextFollowUp)}
            </span>
          )}
          {!client.lastContact && !client.nextFollowUp && (
            <span className="client-profile-meta-item client-profile-meta-empty">No contact dates set</span>
          )}
        </div>
      </div>

      <section className="profile-section profile-card">
        <div className="profile-section-head">
          <h2 className="profile-section-title">Basic Info</h2>
          <div className="profile-section-actions">
            <Link to={createDealHref} className="btn btn-outline btn-sm">
              <HiOutlineCash className="btn-icon" /> Create Deal
            </Link>
            <Link to="/admin/clients" state={{ editId: client.id }} className="btn btn-primary btn-sm">
              <HiOutlinePencil className="btn-icon" /> Edit
            </Link>
          </div>
        </div>
        <dl className="profile-dl">
          <div><dt>Full Name</dt><dd>{client.name}</dd></div>
          <div><dt>Email</dt><dd><a href={`mailto:${client.email}`}>{client.email}</a></dd></div>
          <div><dt>Phone</dt><dd><a href={`tel:${client.phone}`}>{client.phone}</a></dd></div>
          <div><dt>Address</dt><dd>{getClientAddressDisplay(client)}</dd></div>
          <div><dt>Source</dt><dd>{client.source}</dd></div>
          <div><dt>Date Joined</dt><dd>{client.createdAt}</dd></div>
          <div>
            <dt>Status</dt>
            <dd>
              <StatusBadge className={`admin-badge admin-badge--${client.status}`} title={getStatusDescription(client.status)}>
                {getStatusLabel(client.status)}
              </StatusBadge>
            </dd>
          </div>
        </dl>
      </section>

      <section className="profile-section profile-card">
        <h2 className="profile-section-title">Inquiry History</h2>
        <DataTable wrapperClassName="profile-table-wrap">
          <thead>
            <tr>
              <th>Property</th>
              <th>Message</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {inquiries.length === 0 ? (
              <tr><td colSpan={4} className="admin-empty-cell">No inquiries</td></tr>
            ) : (
              inquiries.map((row) => (
                <tr key={row.id}>
                  <td>{row.propertyTitle}</td>
                  <td>{row.message}</td>
                  <td>{row.date}</td>
                  <td>{row.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </section>

      <section className="profile-section profile-card">
        <h2 className="profile-section-title">Deals</h2>
        <DataTable wrapperClassName="profile-table-wrap">
          <thead>
            <tr>
              <th>Deal ID</th>
              <th>Property</th>
              <th>Status</th>
              <th>Price</th>
              <th>Closing Date</th>
            </tr>
          </thead>
          <tbody>
            {deals.length === 0 ? (
              <tr><td colSpan={5} className="admin-empty-cell">No deals</td></tr>
            ) : (
              deals.map((deal) => (
                <tr key={deal.id}>
                  <td><Link to={`/admin/deals/${deal.dealId}`}>{deal.dealId}</Link></td>
                  <td>
                    {deal.propertyId ? (
                      <Link to={`/admin/properties/${deal.propertyId}`}>{deal.propertyTitle}</Link>
                    ) : (
                      deal.propertyTitle
                    )}
                  </td>
                  <td>
                    <StatusBadge className={`admin-badge admin-badge--deal-${deal.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {DEAL_STATUS_LABELS[deal.status]}
                    </StatusBadge>
                  </td>
                  <td>{deal.price}</td>
                  <td>{deal.closingDate || deal.date}</td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </section>

      <section className="profile-section profile-card">
        <h2 className="profile-section-title">Activity Timeline</h2>
        <DataTable wrapperClassName="profile-table-wrap">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {activity.length === 0 ? (
              <tr><td colSpan={3} className="admin-empty-cell">No activity yet</td></tr>
            ) : (
              activity.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.at).toLocaleString()}</td>
                  <td>{entry.action.replace(/_/g, ' ')}</td>
                  <td>
                    <strong>{entry.actor}</strong>
                    {': '}
                    {entry.details || entry.entityLabel || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </section>

      {saved.length > 0 && (
        <section className="profile-section profile-card">
          <h2 className="profile-section-title">Saved Properties</h2>
          <ul className="saved-list">
            {saved.map((s) => (
              <li key={s.id}><Link to={`/admin/properties/${s.propertyId}`}>{s.propertyTitle}</Link></li>
            ))}
          </ul>
        </section>
      )}

      <section className="profile-section profile-card">
        <h2 className="profile-section-title">Admin Notes</h2>
        <textarea
          className="admin-input profile-notes-textarea"
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder="Add notes about this client..."
          rows={4}
        />
        <div className="profile-notes-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveNotes}
            disabled={savingNotes}
          >
            {savingNotes ? 'Saving...' : 'Save'}
          </button>
        </div>
      </section>
    </div>
  )
}
