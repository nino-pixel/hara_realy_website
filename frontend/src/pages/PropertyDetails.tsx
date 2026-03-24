import { useMemo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { 
  HiOutlineChevronLeft, 
  HiOutlineChevronRight, 
  HiOutlineX, 
  HiOutlineZoomIn,
  HiOutlineLocationMarker,
  HiOutlineCalendar,
  HiOutlineOfficeBuilding
} from 'react-icons/hi'
import { 
  MdOutlineBed, 
  MdOutlineBathtub, 
  MdOutlineSquareFoot,
  MdOutlineDirectionsCar 
} from 'react-icons/md'
import Swal from 'sweetalert2'
import {
  fetchProperties,
  isPropertyPublicListing,
  getPublicGalleryUrls,
  getPublicTitleTypeLabel,
  PAYMENT_OPTION_LABELS,
} from '../services/propertiesService'
import { trackEvent } from '../services/analyticsService'
import { createWebsiteInquiry } from '../services/inquiriesService'
import { estimatedMonthlyToBudgetRange } from '../data/leadQualification'
import type { MortgageCalculatorSnapshot } from '../utils/mortgageUtils'
import MonthlyPaymentCalculator from '../components/MonthlyPaymentCalculator'
import LeadQualificationFields from '../components/LeadQualificationFields'
import SavePropertyButton from '../components/SavePropertyButton'
import { PROPERTY_STATUS_LABELS } from '../data/properties'
import { resolveStorageUrl } from '../utils/mediaUrl'
import { getMarketingAttribution } from '../utils/marketingAttribution'
import { useMarketingLinkTo } from '../hooks/useMarketingLinkTo'
import '../components/PropertyCard.css'
import './PropertyDetails.css'

const RECENT_UPDATE_MS = 7 * 24 * 60 * 60 * 1000

function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="property-details-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function PropertySpecCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="property-spec-card">
      <div className="property-spec-content">
        <div className="property-spec-icon">{icon}</div>
        <div className="property-spec-value">{value}</div>
        <div className="property-spec-label">{label}</div>
      </div>
    </div>
  )
}

export default function PropertyDetails() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const propertiesListTo = useMarketingLinkTo('/properties')
  const inquiryRef = useRef<HTMLElement>(null)
  const inquiryNameInputRef = useRef<HTMLInputElement>(null)
  const budgetManualRef = useRef(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false)
  const [floorPlanLightboxOpen, setFloorPlanLightboxOpen] = useState(false)
  const lightboxCloseRef = useRef<HTMLButtonElement>(null)
  const floorPlanLightboxCloseRef = useRef<HTMLButtonElement>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    budgetRange: '',
    buyingTimeline: '',
    financingMethod: '',
    employmentStatus: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [mortgageSnapshot, setMortgageSnapshot] = useState<MortgageCalculatorSnapshot | null>(null)

  const property = useMemo(
    () => fetchProperties().find((p) => p.id === id && isPropertyPublicListing(p)),
    [id]
  )

  const galleryUrls = useMemo(() => (property ? getPublicGalleryUrls(property) : []), [property])

  useEffect(() => {
    setActiveImageIndex(0)
    setImageLightboxOpen(false)
    setFloorPlanLightboxOpen(false)
    budgetManualRef.current = false
    setForm({
      name: '',
      email: '',
      phone: '',
      message: '',
      budgetRange: '',
      buyingTimeline: '',
      financingMethod: '',
      employmentStatus: '',
    })
  }, [id])

  useEffect(() => {
    if (budgetManualRef.current) return
    if (mortgageSnapshot?.isValid && mortgageSnapshot.estimatedMonthly != null) {
      const br = estimatedMonthlyToBudgetRange(mortgageSnapshot.estimatedMonthly)
      setForm((f) => ({ ...f, budgetRange: br }))
    }
  }, [mortgageSnapshot?.isValid, mortgageSnapshot?.estimatedMonthly])

  useEffect(() => {
    if (!property) return
    trackEvent('property_view', { propertyId: property.id })
  }, [property])

  useEffect(() => {
    if (!imageLightboxOpen && !floorPlanLightboxOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => {
      if (imageLightboxOpen) lightboxCloseRef.current?.focus()
      else if (floorPlanLightboxOpen) floorPlanLightboxCloseRef.current?.focus()
    }, 0)
    return () => {
      window.clearTimeout(t)
      document.body.style.overflow = prevOverflow
    }
  }, [imageLightboxOpen, floorPlanLightboxOpen])

  useEffect(() => {
    if (!imageLightboxOpen && !floorPlanLightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setImageLightboxOpen(false)
        setFloorPlanLightboxOpen(false)
        return
      }
      if (!imageLightboxOpen) return
      const n = galleryUrls.length
      if (n <= 1) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setActiveImageIndex((i) => (i - 1 + n) % n)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setActiveImageIndex((i) => (i + 1) % n)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [imageLightboxOpen, floorPlanLightboxOpen, galleryUrls.length])

  const scrollToInquiry = () => {
    if (property) trackEvent('inquire_click', { propertyId: property.id })
    inquiryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToInquiryAndFocus = () => {
    if (property) trackEvent('inquire_click', { propertyId: property.id })
    inquiryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => inquiryNameInputRef.current?.focus(), 450)
  }

  if (!property) {
    return (
      <div className="property-details-page section">
        <div className="container">
          <p className="property-details-not-found">
            This listing is not available, may be unpublished, or the link is incorrect.
          </p>
          <Link to={propertiesListTo} className="btn btn-outline">Back to Properties</Link>
        </div>
      </div>
    )
  }

  const statusLabel = PROPERTY_STATUS_LABELS[property.status]
  const updatedAt = new Date(property.updatedAt).getTime()
  const isRecentlyUpdated = Date.now() - updatedAt < RECENT_UPDATE_MS && Number.isFinite(updatedAt)

  const mainImage = galleryUrls[activeImageIndex] ?? property.image
  const virtualTour = property.virtualTourUrl?.trim() && isSafeHttpUrl(property.virtualTourUrl)
    ? property.virtualTourUrl.trim()
    : null
  const floorPlanRaw = property.floorPlan?.trim()
  const floorPlanResolved = floorPlanRaw ? resolveStorageUrl(floorPlanRaw) : ''
  const floorPlan =
    floorPlanResolved &&
    (floorPlanResolved.startsWith('/storage/') ||
      isSafeHttpUrl(floorPlanResolved))
      ? floorPlanResolved
      : null
  const floorPlanIsPdf = Boolean(floorPlan && floorPlan.toLowerCase().includes('.pdf'))
  const titleTypeLine = getPublicTitleTypeLabel(property.titleType)

  const paymentLabels =
    property.paymentOptions?.length ?
      property.paymentOptions.map((k) => PAYMENT_OPTION_LABELS[k] ?? k).join(' · ')
    : null

  const hasKeyFacts =
    Boolean(
      property.developer ||
        property.yearBuilt ||
        property.city ||
        property.province ||
        property.floorArea ||
        property.lotArea ||
        (property.parking != null && property.parking > 0) ||
        property.furnished != null ||
        paymentLabels ||
        property.downpayment ||
        property.monthlyEst ||
        property.negotiable ||
        property.promoPrice ||
        property.promoUntil ||
        property.availabilityDate
    )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const name = form.name.trim()
    const email = form.email.trim()
    const phone = form.phone.trim()
    const message = form.message.trim()

    if (name.length < 2) {
      setFormError('Name must be at least 2 characters.')
      return
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(email)) {
      setFormError('Please enter a valid email address.')
      return
    }
    const phoneDigits = phone.replace(/\D/g, '')
    if (phoneDigits.length !== 11) {
      setFormError('Phone must be 11 digits (PH format).')
      return
    }
    if (!message) {
      setFormError('Message is required.')
      return
    }
    if (!form.budgetRange || !form.buyingTimeline || !form.financingMethod) {
      setFormError('Please select budget range, buying timeline, and financing method.')
      return
    }

    setFormError('')
    setSubmitting(true)

    try {
      const stored = getMarketingAttribution()
      const utm_source =
        searchParams.get('utm_source')?.trim() || stored.utm_source || null
      const utm_medium =
        searchParams.get('utm_medium')?.trim() || stored.utm_medium || null
      const utm_campaign =
        searchParams.get('utm_campaign')?.trim() || stored.utm_campaign || null

      await createWebsiteInquiry({
        name,
        email,
        phone: phoneDigits,
        message,
        propertyId: property.id,
        propertyTitle: property.title,
        budgetRange: form.budgetRange,
        buyingTimeline: form.buyingTimeline,
        financingMethod: form.financingMethod,
        employmentStatus: form.employmentStatus.trim() || null,
        utm_source,
        utm_medium,
        utm_campaign,
        ...(mortgageSnapshot?.isValid
          ? {
              estimatedMonthly: mortgageSnapshot.estimatedMonthly,
              downpayment: mortgageSnapshot.downpayment,
              loanTerm: mortgageSnapshot.loanTerm,
              interestRate: mortgageSnapshot.interestRate,
              downpaymentPercent: mortgageSnapshot.downpaymentPercent,
              highBuyingIntent: mortgageSnapshot.highBuyingIntent,
            }
          : {}),
      })
      setForm({
        name: '',
        email: '',
        phone: '',
        message: '',
        budgetRange: '',
        buyingTimeline: '',
        financingMethod: '',
        employmentStatus: '',
      })
      budgetManualRef.current = false
      /* Defer toast so it paints above route/lightbox layers; z-index in index.css */
      queueMicrotask(() => {
        void Swal.fire({
          icon: 'success',
          title: 'Inquiry sent successfully',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2200,
          timerProgressBar: true,
        })
      })
    } catch {
      setFormError('Failed to send inquiry. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const showSavedListToast = (nowSaved: boolean) => {
    if (nowSaved) {
      Swal.fire({
        icon: 'success',
        title: 'Saved to your list',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2200,
        timerProgressBar: true,
      })
    } else {
      Swal.fire({
        icon: 'info',
        title: 'Removed from saved',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      })
    }
  }

  return (
    <div className="property-details-page">
      <section className="page-hero">
        <div className="container">
          <div className="property-details-hero-badges">
            <span className="property-type-tag">{property.type}</span>
            <span className={`property-status-tag property-status-tag--${property.status}`}>
              {statusLabel}
            </span>
            {isRecentlyUpdated && (
              <span className="property-details-recent">Recently updated</span>
            )}
          </div>
          
          <div className="property-details-title-row">
            <h1 className="page-title">{property.title}</h1>
            <div className="property-details-hero-actions">
              <SavePropertyButton
                propertyId={property.id}
                variant="detail"
                onToggle={showSavedListToast}
              />
            </div>
          </div>
          
          <p className="property-details-location">
            <HiOutlineLocationMarker className="loc-icon" /> {property.location}
          </p>
          
          <div className="property-details-hero-lower">
            <p className="property-details-price">{property.price}</p>
            <button type="button" className="btn btn-primary" onClick={scrollToInquiry}>
              Inquire Now
            </button>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container property-details-grid">
          <article className="property-details-card property-details-main">
            <div className="property-details-gallery">
              <div className="property-details-gallery-main">
                <button
                  type="button"
                  className="property-details-gallery-zoom"
                  onClick={() => setImageLightboxOpen(true)}
                  aria-label="View full size image"
                >
                  <img src={mainImage} alt={property.title} className="property-details-image" />
                  <span className="property-details-gallery-zoom-hint" aria-hidden>
                    <HiOutlineZoomIn />
                    <span className="property-details-gallery-zoom-text">View larger</span>
                  </span>
                </button>
              </div>
              {galleryUrls.length > 1 && (
                <div className="property-details-gallery-thumbs" role="list">
                  {galleryUrls.map((url, i) => (
                    <button
                      key={url + i}
                      type="button"
                      className={`property-details-thumb ${i === activeImageIndex ? 'is-active' : ''}`}
                      onClick={() => setActiveImageIndex(i)}
                      aria-label={`Show photo ${i + 1}`}
                      aria-pressed={i === activeImageIndex}
                    >
                      <img src={url} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="property-details-specs-grid">
              {property.beds > 0 && (
                <PropertySpecCard 
                  icon={<MdOutlineBed />} 
                  value={property.beds} 
                  label="Bedrooms" 
                />
              )}
              {property.baths > 0 && (
                <PropertySpecCard 
                  icon={<MdOutlineBathtub />} 
                  value={property.baths} 
                  label="Bathrooms" 
                />
              )}
              {property.area && (
                <PropertySpecCard 
                  icon={<MdOutlineSquareFoot />} 
                  value={property.area} 
                  label="Area" 
                />
              )}
              {property.yearBuilt && (
                <PropertySpecCard 
                  icon={<HiOutlineCalendar />} 
                  value={property.yearBuilt} 
                  label="Year Built" 
                />
              )}
              {property.parking != null && property.parking > 0 && (
                <PropertySpecCard 
                  icon={<MdOutlineDirectionsCar />} 
                  value={property.parking} 
                  label="Parking" 
                />
              )}
            </div>

            {property.publicDescription && (
              <section className="property-details-block property-details-block--description" aria-labelledby="pd-about">
                <h2 id="pd-about" className="property-details-block-title">Description</h2>
                <p className="property-details-description">{property.publicDescription}</p>
                {property.developer && (
                  <div className="property-details-developer">
                    <HiOutlineOfficeBuilding className="dev-icon" />
                    <span>Developer: <strong>{property.developer}</strong></span>
                  </div>
                )}
              </section>
            )}

            {hasKeyFacts && (
              <section className="property-details-block" aria-labelledby="pd-facts">
                <h2 id="pd-facts" className="property-details-block-title">
                  Key details
                </h2>
                <dl className="property-details-facts">
                  <Fact label="City" value={property.city} />
                  <Fact label="Province" value={property.province} />
                  <Fact
                    label="Furnished"
                    value={
                      property.furnished === true ? 'Yes' : property.furnished === false ? 'No' : null
                    }
                  />
                  <Fact label="Payment options" value={paymentLabels} />
                  <Fact label="Down payment" value={property.downpayment} />
                  <Fact label="Estimated monthly" value={property.monthlyEst} />
                  {property.negotiable ? (
                    <Fact label="Price" value="Open to negotiation (confirm with us)" />
                  ) : null}
                  <Fact label="Promo / special price" value={property.promoPrice} />
                  <Fact label="Promo until" value={property.promoUntil} />
                  <Fact label="Availability" value={property.availabilityDate} />
                </dl>
              </section>
            )}

            {(titleTypeLine || property.legalStatus) && (
              <section className="property-details-block" aria-labelledby="pd-tenure">
                <h2 id="pd-tenure" className="property-details-block-title">
                  Title & tenure (summary)
                </h2>
                <p className="property-details-tenure-note">
                  We only publish general tenure information here. Title numbers, registered owner names, tax
                  declaration IDs, and document copies are <strong>not</strong> shown on the website and are
                  discussed after you inquire.
                </p>
                <ul className="property-details-tenure-list">
                  {titleTypeLine ? <li>{titleTypeLine}</li> : null}
                  {property.legalStatus ? <li>{property.legalStatus}</li> : null}
                </ul>
              </section>
            )}

            {(virtualTour || floorPlan) && (
              <section className="property-details-block" aria-labelledby="pd-media">
                <h2 id="pd-media" className="property-details-block-title">
                  Explore further
                </h2>
                {virtualTour && (
                  <p className="property-details-external-link">
                    <a href={virtualTour} target="_blank" rel="noopener noreferrer">
                      Open virtual tour (new tab)
                    </a>
                  </p>
                )}
                {floorPlan && (
                  <div className="property-details-floorplan">
                    <p className="property-details-floorplan-label">Floor plan</p>
                    <div className="property-details-gallery-main property-details-floorplan-main">
                      {floorPlanIsPdf ? (
                        <button
                          type="button"
                          className="property-details-gallery-zoom property-details-floorplan-zoom property-details-floorplan-zoom--pdf"
                          onClick={() => setFloorPlanLightboxOpen(true)}
                          aria-label="View floor plan full screen"
                        >
                          <span className="property-details-floorplan-pdf-badge" aria-hidden>
                            PDF
                          </span>
                          <span className="property-details-gallery-zoom-hint" aria-hidden>
                            <HiOutlineZoomIn />
                            <span className="property-details-gallery-zoom-text">View full screen</span>
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="property-details-gallery-zoom"
                          onClick={() => setFloorPlanLightboxOpen(true)}
                          aria-label="View full size floor plan"
                        >
                          <img
                            src={floorPlan}
                            alt={`Floor plan for ${property.title}`}
                            className="property-details-image"
                          />
                          <span className="property-details-gallery-zoom-hint" aria-hidden>
                            <HiOutlineZoomIn />
                            <span className="property-details-gallery-zoom-text">View larger</span>
                          </span>
                        </button>
                      )}
                    </div>
                    <p className="property-details-external-link property-details-floorplan-open-tab">
                      <a href={floorPlan} target="_blank" rel="noopener noreferrer">
                        Open in new tab
                      </a>
                    </p>
                  </div>
                )}
              </section>
            )}

            <aside className="property-details-privacy" aria-label="Privacy note">
              <strong>Your privacy matters.</strong> You won&apos;t see full street addresses, seller names, or
              private paperwork here—that stays with us until you&apos;re ready to talk. Browse what we publish
              online, then send an inquiry and we&apos;ll share the right details with you directly.
            </aside>
          </article>

          <aside ref={inquiryRef} id="property-inquiry" className="property-details-inquiry-column property-inquiry-scroll-target">
            <MonthlyPaymentCalculator
              key={property.id}
              propertyId={property.id}
              propertyPriceDisplay={property.price}
              lockedAnnualInterestRate={
                typeof property.mortgageInterestRate === 'number' &&
                Number.isFinite(property.mortgageInterestRate)
                  ? property.mortgageInterestRate
                  : 6.5
              }
              onSnapshotChange={setMortgageSnapshot}
              onScrollToInquiry={scrollToInquiryAndFocus}
            />
            <div className="property-inquiry-card">
            <h2>Send Inquiry</h2>
            <p><strong>Inquiry for:</strong> {property.title}</p>
            <p className="property-inquiry-helper">We’ll contact you within 24 hours.</p>
            <form onSubmit={handleSubmit} className="property-inquiry-form">
              {formError && <p className="form-error">{formError}</p>}
              <label>Name *</label>
              <input
                ref={inquiryNameInputRef}
                name="name"
                type="text"
                required
                value={form.name}
                onChange={handleChange}
                disabled={submitting}
              />
              <label>Email *</label>
              <input name="email" type="email" required value={form.email} onChange={handleChange} disabled={submitting} />
              <label>Phone *</label>
              <input name="phone" type="tel" required value={form.phone} onChange={handleChange} disabled={submitting} />
              <LeadQualificationFields
                values={{
                  budgetRange: form.budgetRange,
                  buyingTimeline: form.buyingTimeline,
                  financingMethod: form.financingMethod,
                  employmentStatus: form.employmentStatus,
                }}
                onChange={handleChange}
                onBudgetUserEdit={() => {
                  budgetManualRef.current = true
                }}
                disabled={submitting}
              />
              <label>Message *</label>
              <textarea
                name="message"
                rows={4}
                required
                value={form.message}
                onChange={handleChange}
                disabled={submitting}
                placeholder="Tell us your budget, preferred move-in date, or your questions."
              />
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Sending...' : 'Submit Inquiry'}
              </button>
            </form>
            </div>
          </aside>
        </div>
      </section>

      {imageLightboxOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="property-image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Image viewer"
          >
            <button
              type="button"
              className="property-image-lightbox__backdrop"
              tabIndex={-1}
              aria-label="Close image viewer"
              onClick={() => setImageLightboxOpen(false)}
            />
            <div className="property-image-lightbox__inner">
              <button
                ref={lightboxCloseRef}
                type="button"
                className="property-image-lightbox__close"
                aria-label="Close"
                onClick={() => setImageLightboxOpen(false)}
              >
                <HiOutlineX />
              </button>
              {galleryUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    className="property-image-lightbox__nav property-image-lightbox__nav--prev"
                    aria-label="Previous image"
                    onClick={() =>
                      setActiveImageIndex((i) => (i - 1 + galleryUrls.length) % galleryUrls.length)
                    }
                  >
                    <HiOutlineChevronLeft />
                  </button>
                  <button
                    type="button"
                    className="property-image-lightbox__nav property-image-lightbox__nav--next"
                    aria-label="Next image"
                    onClick={() =>
                      setActiveImageIndex((i) => (i + 1) % galleryUrls.length)
                    }
                  >
                    <HiOutlineChevronRight />
                  </button>
                </>
              )}
              <div className="property-image-lightbox__frame">
                <img src={mainImage} alt={property.title} className="property-image-lightbox__img" />
              </div>
              {galleryUrls.length > 1 && (
                <p className="property-image-lightbox__counter" aria-live="polite">
                  {activeImageIndex + 1} / {galleryUrls.length}
                </p>
              )}
            </div>
          </div>,
          document.body
        )}

      {floorPlanLightboxOpen &&
        floorPlan &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="property-image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Floor plan viewer"
          >
            <button
              type="button"
              className="property-image-lightbox__backdrop"
              tabIndex={-1}
              aria-label="Close floor plan viewer"
              onClick={() => setFloorPlanLightboxOpen(false)}
            />
            <div className="property-image-lightbox__inner property-image-lightbox__inner--floorplan">
              <button
                ref={floorPlanLightboxCloseRef}
                type="button"
                className="property-image-lightbox__close"
                aria-label="Close"
                onClick={() => setFloorPlanLightboxOpen(false)}
              >
                <HiOutlineX />
              </button>
              <div className="property-image-lightbox__frame property-image-lightbox__frame--floorplan">
                {floorPlanIsPdf ? (
                  <iframe
                    src={floorPlan}
                    title={`Floor plan — ${property.title}`}
                    className="property-image-lightbox__iframe"
                  />
                ) : (
                  <img
                    src={floorPlan}
                    alt={`Floor plan — ${property.title}`}
                    className="property-image-lightbox__img"
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
