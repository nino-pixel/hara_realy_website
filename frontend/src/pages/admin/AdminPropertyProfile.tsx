import { useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineTag, HiOutlineScale } from 'react-icons/hi'
import { resolveStorageUrl } from '../../utils/mediaUrl'
import { getPropertyById, setPropertyStore } from '../../data/properties'
import { getActivityStore, getActivityActionLabel } from '../../data/activityLog'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import {
  getClientStore,
  getTransactionsByClientId,
  getSavedByClientId,
} from '../../data/clientsData'
import { PROPERTY_STATUS_LABELS, getPropertyStatusDescription, PAYMENT_OPTION_LABELS } from '../../data/properties'
import type { PaymentOption } from '../../data/properties'
import type { ClientTransactionRow, ClientInquiryRow } from '../../data/clientsData'
import { getInquiriesForClientProfile } from '../../services/clientsService'
import './admin-common.css'
import './AdminPropertyProfile.css'

/**
 * ARCHITECTURE NOTE — Internal / Operations details (View vs Edit):
 * - Internal notes, Owner instructions, Property Code = pure backend/operations.
 * - These stay in EDIT / Admin Panel ONLY. Never show them on the View (summary) page.
 * - View = decision info for daily ops (location, type, price, status, performance, clients, deals, legal).
 */

export default function AdminPropertyProfile() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAdminAuth()
  const property = id ? getPropertyById(id) : undefined
  const [galleryLightboxIndex, setGalleryLightboxIndex] = useState<number | null>(null)
  const [heroImageLightboxOpen, setHeroImageLightboxOpen] = useState(false)
  const [, setGalleryUpdateCounter] = useState(0)
  const [salesInfoExpanded, setSalesInfoExpanded] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const handleGalleryFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!property || !id || !files?.length) return
    const prev = property.gallery ?? []
    const newUrls: string[] = new Array(files.length)
    let done = 0
    Array.from(files).forEach((file, i) => {
      const reader = new FileReader()
      reader.onload = () => {
        newUrls[i] = reader.result as string
        done++
        if (done === files.length) {
          setPropertyStore((store) =>
            store.map((p) =>
              p.id === id ? { ...p, gallery: [...prev, ...newUrls] } : p
            )
          )
          setGalleryUpdateCounter((c) => c + 1)
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  if (!property) {
    return (
      <div className="admin-property-profile">
        <p className="admin-empty">Property not found.</p>
        <Link to="/admin/properties" className="btn btn-outline">Back to Properties</Link>
      </div>
    )
  }

  const title = property.title
  const allClients = getClientStore().filter((c) => !c.archived)
  const deals: { clientId: string; clientName: string; row: ClientTransactionRow }[] = []
  const inquiries: { clientId: string; clientName: string; row: ClientInquiryRow }[] = []
  const savedBy: { clientId: string; clientName: string }[] = []

  allClients.forEach((c) => {
    getTransactionsByClientId(c.id).forEach((t) => {
      if (t.propertyTitle === title) deals.push({ clientId: c.id, clientName: c.name, row: t })
    })
    getInquiriesForClientProfile(c).forEach((i) => {
      if (i.propertyTitle === title) inquiries.push({ clientId: c.id, clientName: c.name, row: i })
    })
    getSavedByClientId(c.id).forEach((s) => {
      if (s.propertyTitle === title || s.propertyId === property.id) savedBy.push({ clientId: c.id, clientName: c.name })
    })
  })

  const interestedClientIds = new Set([
    ...deals.map((d) => d.clientId),
    ...inquiries.map((i) => i.clientId),
    ...savedBy.map((s) => s.clientId),
  ])
  const interestedClients = Array.from(interestedClientIds).map((clientId) => {
    const client = allClients.find((c) => c.id === clientId)
    return client ? { id: client.id, name: client.name } : null
  }).filter(Boolean) as { id: string; name: string }[]

  const formatTimelineDate = (iso: string) => {
    const d = new Date(iso)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const day = d.getDate()
    return `${months[d.getMonth()]} ${day < 10 ? '0' + day : day}`
  }

  const formatDisplayDate = (iso: string) => {
    if (!iso) return '—'
    const [y, m, d] = iso.split('-')
    if (!m || !d) return iso
    const month = parseInt(m, 10)
    const day = parseInt(d, 10)
    return `${month}/${day}/${y}`
  }

  const propertyActivityLog = getActivityStore().filter(
    (e) => e.entityType === 'property' && e.entityId === id
  )
  const timelineFromLog = propertyActivityLog.map((e) => ({
    at: e.at,
    label:
      e.details && e.details.trim()
        ? e.details.trim()
        : e.action === 'created'
          ? 'Created'
          : e.action === 'archived'
            ? 'Archived'
            : e.action === 'updated'
              ? 'Updated'
              : getActivityActionLabel(e.action),
  }))
  const timelineFromPriceHistory = (property.priceHistory ?? []).map((entry) => ({
    at: entry.at,
    label: `Price changed to ${entry.price}`,
  }))
  const timeline = [...timelineFromLog, ...timelineFromPriceHistory]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 50)

  // Conversion: Deals ÷ Inquiries × 100 (single source of truth — backend should use same formula)
  const conversionPercent =
    inquiries.length > 0 ? (deals.length / inquiries.length) * 100 : null

  return (
    <div className="admin-property-profile">
      <div className="property-profile-header">
        <div className="property-profile-hero-image">
          <button
            type="button"
            className="property-profile-hero-image-btn"
            onClick={() => setHeroImageLightboxOpen(true)}
            aria-label="View cover photo"
          >
            <img src={resolveStorageUrl(property.image)} alt={property.title} />
          </button>
          <span className={`admin-badge admin-badge--${property.status} property-profile-badge`} title={getPropertyStatusDescription(property.status)}>
            {PROPERTY_STATUS_LABELS[property.status]}
          </span>
        </div>
        <div className="property-profile-hero-meta">
          <h1 className="property-profile-title">{property.title}</h1>
          <p className="property-profile-price">{property.price}</p>
          <div className="property-profile-actions">
            <Link to="/admin/properties" state={{ editId: property.id }} className="btn btn-primary btn-sm">
              Edit
            </Link>
            <Link to="/admin/properties" className="btn btn-outline btn-sm">Back to List</Link>
          </div>
        </div>
      </div>

      {heroImageLightboxOpen && (
        <div
          className="property-profile-lightbox-overlay"
          onClick={() => setHeroImageLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="View cover photo"
        >
          <button
            type="button"
            className="property-profile-lightbox-close"
            onClick={() => setHeroImageLightboxOpen(false)}
            aria-label="Close"
          >
            ×
          </button>
          <div className="property-profile-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={resolveStorageUrl(property.image)} alt={property.title} />
          </div>
        </div>
      )}

      <div className="property-profile-grid">
        <h2 className="property-profile-section-title">Overview</h2>
        <section className="property-profile-card property-profile-info">
          <h3 className="property-profile-card-title">Info</h3>
          <dl className="property-profile-dl">
            <dt>Address</dt>
            <dd>{property.address || property.location || '—'}</dd>
            <dt>Type</dt>
            <dd>{property.type}</dd>
            <dt>Floor Area</dt>
            <dd>{property.floorArea || property.area || '—'}</dd>
            <dt>Lot Area</dt>
            <dd>{property.lotArea || '—'}</dd>
            <dt>Rooms</dt>
            <dd>{property.beds} beds, {property.baths} baths{property.parking != null && property.parking > 0 ? `, ${property.parking} parking` : ''}</dd>
            {property.developer && (
              <>
                <dt>Developer</dt>
                <dd>{property.developer}</dd>
              </>
            )}
          </dl>
        </section>

        <section className="property-profile-card property-profile-performance">
          <h3 className="property-profile-card-title">Performance</h3>
          <div className="property-profile-stats">
            <div className="property-profile-stat">
              <span className="property-profile-stat-value">{property.views ?? 0}</span>
              <span className="property-profile-stat-label">Views</span>
            </div>
            <div className="property-profile-stat">
              <span className="property-profile-stat-value">{property.leads ?? 0}</span>
              <span className="property-profile-stat-label">Inquiries</span>
            </div>
            <div className="property-profile-stat">
              <span className="property-profile-stat-value">{property.saves ?? savedBy.length}</span>
              <span className="property-profile-stat-label">Saves</span>
            </div>
            <div className="property-profile-stat">
              <span className="property-profile-stat-value">{deals.length}</span>
              <span className="property-profile-stat-label">Deals</span>
            </div>
          </div>
          <div className="property-profile-conversion">
            <h3 className="property-profile-conversion-title">Conversion</h3>
            <p className="property-profile-conversion-rate">
              {conversionPercent !== null ? `${conversionPercent.toFixed(1)}%` : '—'}
            </p>
            <p className="property-profile-conversion-detail">
              {inquiries.length > 0
                ? `Deals ÷ Inquiries × 100 (${deals.length} ÷ ${inquiries.length} = ${conversionPercent!.toFixed(1)}%)`
                : 'Deals ÷ Inquiries × 100 — no inquiries yet'}
            </p>
          </div>
        </section>

        <h2 className="property-profile-section-title">Sales</h2>
        <section className="property-profile-card property-profile-sales-info">
          <button
            type="button"
            className="property-profile-collapse-trigger"
            onClick={() => setSalesInfoExpanded((e) => !e)}
            aria-expanded={salesInfoExpanded}
            aria-controls="property-profile-sales-info-body"
          >
            <span className="property-profile-collapse-title">
              <HiOutlineTag className="property-profile-collapse-title-icon" aria-hidden />
              Sales
            </span>
            <span className="property-profile-collapse-icon" aria-hidden>{salesInfoExpanded ? '▼' : '▶'}</span>
          </button>
          <div
            id="property-profile-sales-info-body"
            className={`property-profile-collapse-body ${salesInfoExpanded ? 'property-profile-collapse-body--open' : ''}`}
            role="region"
            aria-label="Sales info details"
          >
            <dl className="property-profile-dl">
              <dt>Payment</dt>
              <dd>
                {(property.paymentOptions && property.paymentOptions.length > 0)
                  ? property.paymentOptions.map((opt) => PAYMENT_OPTION_LABELS[opt as PaymentOption]).join(', ')
                  : '—'}
              </dd>
              {(property.promoPrice?.trim() || property.promoUntil) && (
                <>
                  <dt>Promo</dt>
                  <dd>
                    {property.promoPrice?.trim()
                      ? `${property.promoPrice}${property.promoUntil ? ` until ${formatDisplayDate(property.promoUntil)}` : ''}`
                      : property.promoUntil ? `Until ${formatDisplayDate(property.promoUntil)}` : '—'}
                  </dd>
                </>
              )}
              <dt>Negotiable</dt>
              <dd>{property.negotiable === true ? 'Yes' : property.negotiable === false ? 'No' : '—'}</dd>
              <dt>Furnished</dt>
              <dd>{property.furnished === true ? 'Yes' : property.furnished === false ? 'No' : '—'}</dd>
              <dt>Featured</dt>
              <dd>{property.featuredListing === true ? 'Yes' : 'No'}</dd>
              {property.virtualTourUrl?.trim() && (
                <>
                  <dt>Virtual Tour</dt>
                  <dd>
                    <a href={property.virtualTourUrl} target="_blank" rel="noopener noreferrer" className="property-profile-doc-link">
                      View virtual tour
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </div>
        </section>

        <section className="property-profile-card property-profile-gallery">
          <h3 className="property-profile-card-title">Gallery</h3>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleGalleryFiles}
            className="property-profile-gallery-input-hidden"
            aria-label="Choose gallery images"
          />
          {(!property.gallery || property.gallery.length === 0) ? (
            <div className="property-profile-gallery-empty">
              <p className="property-profile-gallery-empty-label">Upload shortcut</p>
              <p className="admin-empty">No gallery images.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => galleryInputRef.current?.click()}
              >
                Upload Now
              </button>
            </div>
          ) : (
            <>
            <div className="property-profile-gallery-grid">
              {property.gallery.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  className="property-profile-gallery-item property-profile-gallery-item--clickable"
                  onClick={() => setGalleryLightboxIndex(i)}
                  title="View image"
                >
                  <img src={resolveStorageUrl(src)} alt={`${property.title} — ${i + 1}`} />
                </button>
              ))}
            </div>
            <div className="property-profile-gallery-add-more">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => galleryInputRef.current?.click()}
              >
                Add more images
              </button>
            </div>
            </>
          )}
          {property.gallery && property.gallery.length > 0 && galleryLightboxIndex !== null && (
            <div
              className="property-profile-lightbox-overlay"
              onClick={() => setGalleryLightboxIndex(null)}
              role="dialog"
              aria-modal="true"
              aria-label="View gallery image"
            >
              <button
                type="button"
                className="property-profile-lightbox-close"
                onClick={() => setGalleryLightboxIndex(null)}
                aria-label="Close"
              >
                ×
              </button>
              {property.gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    className="property-profile-lightbox-nav property-profile-lightbox-prev"
                    onClick={(e) => {
                      e.stopPropagation()
                      setGalleryLightboxIndex((galleryLightboxIndex - 1 + property.gallery!.length) % property.gallery!.length)
                    }}
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="property-profile-lightbox-nav property-profile-lightbox-next"
                    onClick={(e) => {
                      e.stopPropagation()
                      setGalleryLightboxIndex((galleryLightboxIndex + 1) % property.gallery!.length)
                    }}
                    aria-label="Next image"
                  >
                    ›
                  </button>
                </>
              )}
              <div
                className="property-profile-lightbox-content"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={resolveStorageUrl(property.gallery[galleryLightboxIndex])}
                  alt={`${property.title} — ${galleryLightboxIndex + 1}`}
                />
                <span className="property-profile-lightbox-counter">
                  {galleryLightboxIndex + 1} / {property.gallery.length}
                </span>
              </div>
            </div>
          )}
          {property.floorPlan && (
            <div className="property-profile-floorplan">
              <h3 className="property-profile-floorplan-title">Floor Plan</h3>
              {(() => {
                const fp = resolveStorageUrl(property.floorPlan)
                const isPdf =
                  fp.toLowerCase().includes('.pdf') || fp.startsWith('data:application/pdf')
                return isPdf ? (
                  <a href={fp} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">
                    View floor plan (PDF)
                  </a>
                ) : (
                  <img src={fp} alt="Floor plan" className="property-profile-floorplan-img" />
                )
              })()}
            </div>
          )}
        </section>

        <section className="property-profile-card property-profile-clients">
          <h3 className="property-profile-card-title">Interested Clients</h3>
          {interestedClients.length === 0 ? (
            <p className="admin-empty">No linked clients yet.</p>
          ) : (
            <ul className="property-profile-client-list">
              {interestedClients.map((c) => (
                <li key={c.id}>
                  <Link to={`/admin/clients/${c.id}`}>{c.name}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <h2 className="property-profile-section-title">History</h2>
        <section className="property-profile-card property-profile-deals">
          <h3 className="property-profile-card-title">Deal History</h3>
          {deals.length === 0 ? (
            <p className="admin-empty">No transactions yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d) => (
                    <tr key={d.clientId + d.row.id}>
                      <td><Link to={`/admin/clients/${d.clientId}`}>{d.clientName}</Link></td>
                      <td>{d.row.amount}</td>
                      <td>{d.row.date}</td>
                      <td>{d.row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="property-profile-card property-profile-activity">
          <h3 className="property-profile-card-title">Property Activity</h3>
          {timeline.length === 0 ? (
            <p className="admin-empty">No activity yet.</p>
          ) : (
            <ul className="property-profile-timeline">
              {timeline.map((item, i) => (
                <li key={i} className="property-profile-timeline-item">
                  <span className="property-profile-timeline-date">{formatTimelineDate(item.at)}</span>
                  <span className="property-profile-timeline-sep"> – </span>
                  <span className="property-profile-timeline-label">{item.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {user?.role === 'admin' && (
          <>
        <h2 className="property-profile-section-title">Legal</h2>
        <section className="property-profile-card property-profile-legal-section">
          <h3 className="property-profile-card-title">
            <HiOutlineScale className="property-profile-card-title-icon" aria-hidden />
            Titles &amp; Encumbrance
          </h3>
          {(
            property.titleType ||
            property.titleNumber ||
            property.registeredOwner ||
            property.taxDeclarationNo ||
            property.lastTransferDate ||
            property.withEncumbrance !== undefined ||
            property.legalStatus
          ) ? (
            <dl className="property-profile-dl property-profile-legal-dl">
              <dt>Title</dt>
              <dd>
                {[property.titleType, property.titleNumber].filter(Boolean).join(' ') || '—'}
              </dd>
              <dt>Owner</dt>
              <dd>{property.registeredOwner || '—'}</dd>
              <dt>Encumbrance</dt>
              <dd>
                {property.withEncumbrance === true
                  ? 'Yes'
                  : property.withEncumbrance === false
                    ? 'None'
                    : '—'}
              </dd>
              <dt>Tax declaration no.</dt>
              <dd>{property.taxDeclarationNo || '—'}</dd>
              {property.lastTransferDate && (
                <>
                  <dt>Last transfer date</dt>
                  <dd>{property.lastTransferDate}</dd>
                </>
              )}
              <dt>Remarks</dt>
              <dd>{property.legalStatus || '—'}</dd>
            </dl>
          ) : (
            <p className="admin-empty">No legal details recorded.</p>
          )}
          <h3 className="property-profile-card-subtitle">Documents</h3>
          <dl className="property-profile-documents-list">
            <dt>Contract</dt>
            <dd className="property-profile-doc-row">
              {property.documentContract ? (
                <>
                  <span className="property-profile-doc-status property-profile-doc-status--uploaded">
                    <HiOutlineCheckCircle aria-hidden /> Uploaded
                  </span>
                  <a href={resolveStorageUrl(property.documentContract)} target="_blank" rel="noopener noreferrer" className="property-profile-doc-link">View</a>
                </>
              ) : (
                <span className="property-profile-doc-status property-profile-doc-status--missing">
                  <HiOutlineXCircle aria-hidden /> Missing
                </span>
              )}
            </dd>
            <dt>Reservation Form</dt>
            <dd className="property-profile-doc-row">
              {property.documentReservationForm ? (
                <>
                  <span className="property-profile-doc-status property-profile-doc-status--uploaded">
                    <HiOutlineCheckCircle aria-hidden /> Uploaded
                  </span>
                  <a href={resolveStorageUrl(property.documentReservationForm)} target="_blank" rel="noopener noreferrer" className="property-profile-doc-link">View</a>
                </>
              ) : (
                <span className="property-profile-doc-status property-profile-doc-status--missing">
                  <HiOutlineXCircle aria-hidden /> Missing
                </span>
              )}
            </dd>
            <dt>Title Copy</dt>
            <dd className="property-profile-doc-row">
              {property.documentTitleCopy ? (
                <>
                  <span className="property-profile-doc-status property-profile-doc-status--uploaded">
                    <HiOutlineCheckCircle aria-hidden /> Uploaded
                  </span>
                  <a href={resolveStorageUrl(property.documentTitleCopy)} target="_blank" rel="noopener noreferrer" className="property-profile-doc-link">View</a>
                </>
              ) : (
                <span className="property-profile-doc-status property-profile-doc-status--missing">
                  <HiOutlineXCircle aria-hidden /> Missing
                </span>
              )}
            </dd>
          </dl>
        </section>

        <h2 className="property-profile-section-title">Admin</h2>
        <section className="property-profile-card property-profile-notes">
          <h3 className="property-profile-card-title">Notes</h3>
          {property.internalNotes && (
            <div className="property-profile-note-block">
              <strong>Internal notes</strong>
              <p>{property.internalNotes}</p>
            </div>
          )}
          {property.ownerInstructions && (
            <div className="property-profile-note-block">
              <strong>Owner instructions</strong>
              <p>{property.ownerInstructions}</p>
            </div>
          )}
          {!property.internalNotes && !property.ownerInstructions && (
            <p className="admin-empty">No admin notes.</p>
          )}
        </section>
          </>
        )}

      </div>
    </div>
  )
}
