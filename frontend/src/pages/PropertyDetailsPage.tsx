import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  HiOutlineCalendar,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineLocationMarker,
  HiOutlineOfficeBuilding,
  HiOutlineX,
  HiOutlineZoomIn,
} from 'react-icons/hi'
import {
  MdOutlineBathtub,
  MdOutlineBed,
  MdOutlineDirectionsCar,
  MdOutlineSquareFoot,
} from 'react-icons/md'
import Swal from 'sweetalert2'
import MonthlyPaymentCalculator from '../components/MonthlyPaymentCalculator'
import LeadQualificationFields from '../components/LeadQualificationFields'
import SavePropertyButton from '../components/SavePropertyButton'
import { estimatedMonthlyToBudgetRange } from '../data/leadQualification'
import {
  PROPERTY_STATUS_LABELS,
  PAYMENT_OPTION_LABELS,
  getPublicGalleryUrls,
  getPublicTitleTypeLabel,
  type Property,
} from '../services/propertiesService'
import { trackEvent } from '../services/analyticsService'
import { createWebsiteInquiry } from '../services/inquiriesService'
import { fetchProperties } from '../services/propertiesService'
import type { MortgageCalculatorSnapshot } from '../utils/mortgageUtils'
import { resolveStorageUrl } from '../utils/mediaUrl'
import { getMarketingAttribution } from '../utils/marketingAttribution'
import {
  getPropertyUnitLocation,
  resolveCatalogItemByPropertyId,
} from '../utils/propertyGrouping'
import { useMarketingLinkTo } from '../hooks/useMarketingLinkTo'
import '../components/PropertyCard.css'
import './PropertyDetails.css'

const RECENT_UPDATE_MS = 7 * 24 * 60 * 60 * 1000

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function getUnitPhaseBlockLot(unit: Property): string {
  const parts = [
    unit.phase ? `Phase ${String(unit.phase).trim()}` : '',
    unit.block ? `Block ${String(unit.block).trim()}` : '',
    unit.lot ? `Lot ${String(unit.lot).trim()}` : '',
  ].filter(Boolean)

  return parts.join(', ') || getPropertyUnitLocation(unit)
}

function getUnitHeading(unit: Property, fallbackTitle: string): string {
  const label = unit.unitLabel?.trim()
  if (label) return label
  return fallbackTitle
}

function getUnitLocationMeta(unit: Property): string | null {
  const explicitLocation = unit.location?.trim()
  const structured = getUnitPhaseBlockLot(unit)
  if (!explicitLocation || explicitLocation === structured) return null
  return explicitLocation
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

export default function PropertyDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedUnitParam = searchParams.get('unit')
  const propertiesListTo = useMarketingLinkTo('/properties')
  const inquiryRef = useRef<HTMLElement>(null)
  const inquiryNameInputRef = useRef<HTMLInputElement>(null)
  const budgetManualRef = useRef(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false)
  const [floorPlanLightboxOpen, setFloorPlanLightboxOpen] = useState(false)
  const lightboxCloseRef = useRef<HTMLButtonElement>(null)
  const floorPlanLightboxCloseRef = useRef<HTMLButtonElement>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(selectedUnitParam)
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

  const resolved = useMemo(
    () => resolveCatalogItemByPropertyId(fetchProperties(), id, { publicOnlyUnits: true }),
    [id]
  )

  const property = resolved?.item.displayProperty ?? null
  const rootProperty = resolved?.item.rootProperty ?? null
  const initialSelectedUnit = resolved?.selectedUnit ?? null
  const availableUnits = resolved?.item.publicUnits ?? []
  const selectedUnit =
    availableUnits.find((unit) => unit.id === selectedUnitId) ??
    (initialSelectedUnit && availableUnits.find((unit) => unit.id === initialSelectedUnit.id)) ??
    null
  const activeListing = selectedUnit ?? property
  const activeInquiryTitle = selectedUnit && rootProperty
    ? `${rootProperty.title} - ${getPropertyUnitLocation(selectedUnit)}`
    : rootProperty?.title ?? ''

  const galleryUrls = useMemo(
    () => (rootProperty ? getPublicGalleryUrls(rootProperty) : []),
    [rootProperty]
  )

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
    setSelectedUnitId(selectedUnitParam)
  }, [selectedUnitParam])

  useEffect(() => {
    if (budgetManualRef.current) return
    if (mortgageSnapshot?.isValid && mortgageSnapshot.estimatedMonthly != null) {
      const estimatedMonthly = mortgageSnapshot.estimatedMonthly
      setForm((prev) => ({
        ...prev,
        budgetRange: estimatedMonthlyToBudgetRange(estimatedMonthly),
      }))
    }
  }, [mortgageSnapshot?.estimatedMonthly, mortgageSnapshot?.isValid])

  useEffect(() => {
    if (!activeListing) return
    trackEvent('property_view', { propertyId: activeListing.id })
  }, [activeListing])

  useEffect(() => {
    if (!imageLightboxOpen && !floorPlanLightboxOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => {
      if (imageLightboxOpen) lightboxCloseRef.current?.focus()
      else if (floorPlanLightboxOpen) floorPlanLightboxCloseRef.current?.focus()
    }, 0)
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = previousOverflow
    }
  }, [floorPlanLightboxOpen, imageLightboxOpen])

  useEffect(() => {
    if (!imageLightboxOpen && !floorPlanLightboxOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setImageLightboxOpen(false)
        setFloorPlanLightboxOpen(false)
        return
      }
      if (!imageLightboxOpen) return
      const total = galleryUrls.length
      if (total <= 1) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setActiveImageIndex((index) => (index - 1 + total) % total)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        setActiveImageIndex((index) => (index + 1) % total)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [floorPlanLightboxOpen, galleryUrls.length, imageLightboxOpen])

  function updateSelectedUnit(nextUnitId: string | null) {
    setSelectedUnitId(nextUnitId)
    const params = new URLSearchParams(searchParams)
    if (nextUnitId) params.set('unit', nextUnitId)
    else params.delete('unit')
    setSearchParams(params, { replace: true })
  }

  function scrollToInquiry() {
    if (activeListing) trackEvent('inquire_click', { propertyId: activeListing.id })
    inquiryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function scrollToInquiryAndFocus() {
    if (activeListing) trackEvent('inquire_click', { propertyId: activeListing.id })
    inquiryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => inquiryNameInputRef.current?.focus(), 450)
  }

  if (!property || !rootProperty || !activeListing) {
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

  const statusLabel = PROPERTY_STATUS_LABELS[activeListing.status]
  const updatedAt = new Date(property.updatedAt).getTime()
  const isRecentlyUpdated = Date.now() - updatedAt < RECENT_UPDATE_MS && Number.isFinite(updatedAt)
  const mainImage = galleryUrls[activeImageIndex] ?? property.image
  const virtualTour = rootProperty.virtualTourUrl?.trim() && isSafeHttpUrl(rootProperty.virtualTourUrl)
    ? rootProperty.virtualTourUrl.trim()
    : null
  const floorPlanRaw = rootProperty.floorPlan?.trim()
  const floorPlanResolved = floorPlanRaw ? resolveStorageUrl(floorPlanRaw) : ''
  const floorPlan =
    floorPlanResolved &&
    (floorPlanResolved.startsWith('/storage/') || isSafeHttpUrl(floorPlanResolved))
      ? floorPlanResolved
      : null
  const floorPlanIsPdf = Boolean(floorPlan && floorPlan.toLowerCase().includes('.pdf'))
  const titleTypeLine = getPublicTitleTypeLabel(rootProperty.titleType)
  const paymentLabels = rootProperty.paymentOptions?.length
    ? rootProperty.paymentOptions.map((key) => PAYMENT_OPTION_LABELS[key] ?? key).join(' · ')
    : null
  const hasKeyFacts = Boolean(
    rootProperty.developer ||
    rootProperty.yearBuilt ||
    rootProperty.city ||
    rootProperty.province ||
    rootProperty.floorArea ||
    rootProperty.lotArea ||
    (rootProperty.parking != null && rootProperty.parking > 0) ||
    rootProperty.furnished != null ||
    paymentLabels ||
    rootProperty.downpayment ||
    rootProperty.monthlyEst ||
    rootProperty.negotiable ||
    rootProperty.promoPrice ||
    rootProperty.promoUntil ||
    rootProperty.availabilityDate
  )

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    if (!activeListing) return

    const name = form.name.trim()
    const email = form.email.trim()
    const phone = form.phone.trim()
    const message = form.message.trim()

    if (name.length < 2) {
      setFormError('Name must be at least 2 characters.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Please enter a valid email address.')
      return
    }
    if (phone.replace(/\D/g, '').length !== 11) {
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
      const utm_source = searchParams.get('utm_source')?.trim() || stored.utm_source || null
      const utm_medium = searchParams.get('utm_medium')?.trim() || stored.utm_medium || null
      const utm_campaign = searchParams.get('utm_campaign')?.trim() || stored.utm_campaign || null

      await createWebsiteInquiry({
        name,
        email,
        phone: phone.replace(/\D/g, ''),
        message,
        propertyId: activeListing.id,
        propertyTitle: activeInquiryTitle,
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

  function showSavedListToast(nowSaved: boolean) {
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
            <span className="property-type-tag">{rootProperty.type}</span>
            <span className={`property-status-tag property-status-tag--${activeListing.status}`}>
              {statusLabel}
            </span>
            {isRecentlyUpdated && <span className="property-details-recent">Recently updated</span>}
          </div>

          <div className="property-details-title-row">
            <h1 className="page-title">{rootProperty.title}</h1>
            <div className="property-details-hero-actions">
              <SavePropertyButton propertyId={rootProperty.id} variant="detail" onToggle={showSavedListToast} />
            </div>
          </div>
          {selectedUnit ? (
            <p className="property-details-unit-subheading">{getUnitPhaseBlockLot(selectedUnit)}</p>
          ) : null}

          <p className="property-details-location">
            <HiOutlineLocationMarker className="loc-icon" /> {property.location}
          </p>
          {resolved?.item.isGrouped && (selectedUnit ? getUnitLocationMeta(selectedUnit) : resolved.item.summaryNote) ? (
            <p className="property-details-unit-summary">
              {selectedUnit
                ? getUnitLocationMeta(selectedUnit)
                : resolved.item.summaryNote}
            </p>
          ) : null}

          <div className="property-details-hero-lower">
            <p className="property-details-price">{activeListing.price}</p>
            <button type="button" className="btn btn-primary" onClick={scrollToInquiry}>
              {selectedUnit ? 'Inquire About This Unit' : 'Inquire Now'}
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
                  <img src={mainImage} alt={rootProperty.title} className="property-details-image" />
                  <span className="property-details-gallery-zoom-hint" aria-hidden>
                    <HiOutlineZoomIn />
                    <span className="property-details-gallery-zoom-text">View larger</span>
                  </span>
                </button>
              </div>
              {galleryUrls.length > 1 && (
                <div className="property-details-gallery-thumbs" role="list">
                  {galleryUrls.map((url, index) => (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      className={`property-details-thumb ${index === activeImageIndex ? 'is-active' : ''}`}
                      onClick={() => setActiveImageIndex(index)}
                      aria-label={`Show photo ${index + 1}`}
                      aria-pressed={index === activeImageIndex}
                    >
                      <img src={url} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="property-details-specs-grid">
              {rootProperty.beds > 0 && <PropertySpecCard icon={<MdOutlineBed />} value={rootProperty.beds} label="Bedrooms" />}
              {rootProperty.baths > 0 && <PropertySpecCard icon={<MdOutlineBathtub />} value={rootProperty.baths} label="Bathrooms" />}
              {rootProperty.area && <PropertySpecCard icon={<MdOutlineSquareFoot />} value={rootProperty.area} label="Area" />}
              {rootProperty.yearBuilt && <PropertySpecCard icon={<HiOutlineCalendar />} value={rootProperty.yearBuilt} label="Year Built" />}
              {rootProperty.parking != null && rootProperty.parking > 0 && (
                <PropertySpecCard icon={<MdOutlineDirectionsCar />} value={rootProperty.parking} label="Parking" />
              )}
            </div>
            {rootProperty.publicDescription && (
              <section className="property-details-block property-details-block--description" aria-labelledby="pd-about">
                <h2 id="pd-about" className="property-details-block-title">Description</h2>
                <p className="property-details-description">{rootProperty.publicDescription}</p>
                {rootProperty.developer && (
                  <div className="property-details-developer">
                    <HiOutlineOfficeBuilding className="dev-icon" />
                    <span>Developer: <strong>{rootProperty.developer}</strong></span>
                  </div>
                )}
              </section>
            )}

            {resolved?.item.isGrouped && availableUnits.length > 0 && (
              <section className="property-details-block" aria-labelledby="pd-units">
                <div className="property-details-units-header">
                  <div>
                    <h2 id="pd-units" className="property-details-block-title">Available units</h2>
                    <p className="property-details-units-copy">
                      Select a row to switch the inquiry and pricing details to that exact unit.
                    </p>
                  </div>
                  {selectedUnit && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => updateSelectedUnit(null)}>
                      Clear unit selection
                    </button>
                  )}
                </div>
                <div className="property-details-units-table-wrap">
                  <table className="property-details-units-table">
                    <thead>
                      <tr>
                        <th>Unit</th>
                        <th>Price</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableUnits.map((unit) => {
                        const selected = selectedUnit?.id === unit.id
                        return (
                          <tr
                            key={unit.id}
                            className={`${selected ? 'is-selected' : ''} property-details-unit-row`}
                            onClick={() => updateSelectedUnit(unit.id)}
                          >
                            <td>
                              <div className="property-details-unit-cell">
                                <span className="property-details-unit-primary">
                                  {getUnitHeading(unit, rootProperty.title)}
                                </span>
                                <span className="property-details-unit-secondary">
                                  {getUnitPhaseBlockLot(unit)}
                                </span>
                              </div>
                            </td>
                            <td>{unit.price}</td>
                            <td>{PROPERTY_STATUS_LABELS[unit.status]}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {hasKeyFacts && (
              <section className="property-details-block" aria-labelledby="pd-facts">
                <h2 id="pd-facts" className="property-details-block-title">Key details</h2>
                <dl className="property-details-facts">
                  <Fact label="City" value={rootProperty.city} />
                  <Fact label="Province" value={rootProperty.province} />
                  <Fact label="Furnished" value={rootProperty.furnished === true ? 'Yes' : rootProperty.furnished === false ? 'No' : null} />
                  <Fact label="Payment options" value={paymentLabels} />
                  <Fact label="Down payment" value={rootProperty.downpayment} />
                  <Fact label="Estimated monthly" value={rootProperty.monthlyEst} />
                  {rootProperty.negotiable ? <Fact label="Price" value="Open to negotiation (confirm with us)" /> : null}
                  <Fact label="Promo / special price" value={rootProperty.promoPrice} />
                  <Fact label="Promo until" value={rootProperty.promoUntil} />
                  <Fact label="Availability" value={rootProperty.availabilityDate} />
                </dl>
              </section>
            )}

            {(titleTypeLine || rootProperty.legalStatus) && (
              <section className="property-details-block" aria-labelledby="pd-tenure">
                <h2 id="pd-tenure" className="property-details-block-title">Title & tenure (summary)</h2>
                <p className="property-details-tenure-note">
                  We only publish general tenure information here. Title numbers, registered owner names, tax declaration IDs, and document copies are <strong>not</strong> shown on the website and are discussed after you inquire.
                </p>
                <ul className="property-details-tenure-list">
                  {titleTypeLine ? <li>{titleTypeLine}</li> : null}
                  {rootProperty.legalStatus ? <li>{rootProperty.legalStatus}</li> : null}
                </ul>
              </section>
            )}

            {(virtualTour || floorPlan) && (
              <section className="property-details-block" aria-labelledby="pd-media">
                <h2 id="pd-media" className="property-details-block-title">Explore further</h2>
                {virtualTour && (
                  <p className="property-details-external-link">
                    <a href={virtualTour} target="_blank" rel="noopener noreferrer">Open virtual tour (new tab)</a>
                  </p>
                )}
                {floorPlan && (
                  <div className="property-details-floorplan">
                    <p className="property-details-floorplan-label">Floor plan</p>
                    <div className="property-details-gallery-main property-details-floorplan-main">
                      {floorPlanIsPdf ? (
                        <button type="button" className="property-details-gallery-zoom property-details-floorplan-zoom property-details-floorplan-zoom--pdf" onClick={() => setFloorPlanLightboxOpen(true)} aria-label="View floor plan full screen">
                          <span className="property-details-floorplan-pdf-badge" aria-hidden>PDF</span>
                          <span className="property-details-gallery-zoom-hint" aria-hidden>
                            <HiOutlineZoomIn />
                            <span className="property-details-gallery-zoom-text">View full screen</span>
                          </span>
                        </button>
                      ) : (
                        <button type="button" className="property-details-gallery-zoom" onClick={() => setFloorPlanLightboxOpen(true)} aria-label="View full size floor plan">
                          <img src={floorPlan} alt={`Floor plan for ${rootProperty.title}`} className="property-details-image" />
                          <span className="property-details-gallery-zoom-hint" aria-hidden>
                            <HiOutlineZoomIn />
                            <span className="property-details-gallery-zoom-text">View larger</span>
                          </span>
                        </button>
                      )}
                    </div>
                    <p className="property-details-external-link property-details-floorplan-open-tab">
                      <a href={floorPlan} target="_blank" rel="noopener noreferrer">Open in new tab</a>
                    </p>
                  </div>
                )}
              </section>
            )}

            <aside className="property-details-privacy" aria-label="Privacy note">
              <strong>Your privacy matters.</strong> You won&apos;t see full street addresses, seller names, or private paperwork here. Browse what we publish online, then send an inquiry and we&apos;ll share the right details with you directly.
            </aside>
          </article>

          <aside ref={inquiryRef} id="property-inquiry" className="property-details-inquiry-column property-inquiry-scroll-target">
            <MonthlyPaymentCalculator
              key={activeListing.id}
              propertyId={activeListing.id}
              propertyPriceDisplay={activeListing.price}
              lockedAnnualInterestRate={
                typeof activeListing.mortgageInterestRate === 'number' &&
                Number.isFinite(activeListing.mortgageInterestRate)
                  ? activeListing.mortgageInterestRate
                  : 6.5
              }
              onSnapshotChange={setMortgageSnapshot}
              onScrollToInquiry={scrollToInquiryAndFocus}
            />
            <div className="property-inquiry-card">
              <h2>Send Inquiry</h2>
              <p><strong>Inquiry for:</strong> {activeInquiryTitle}</p>
              <p className="property-inquiry-helper">We&apos;ll contact you within 24 hours.</p>
              <form onSubmit={handleSubmit} className="property-inquiry-form">
                {formError && <p className="form-error">{formError}</p>}
                <label>Name *</label>
                <input ref={inquiryNameInputRef} name="name" type="text" required value={form.name} onChange={handleChange} disabled={submitting} />
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

      {imageLightboxOpen && typeof document !== 'undefined' && createPortal(
        <div className="property-image-lightbox" role="dialog" aria-modal="true" aria-label="Image viewer">
          <button type="button" className="property-image-lightbox__backdrop" tabIndex={-1} aria-label="Close image viewer" onClick={() => setImageLightboxOpen(false)} />
          <div className="property-image-lightbox__inner">
            <button ref={lightboxCloseRef} type="button" className="property-image-lightbox__close" aria-label="Close" onClick={() => setImageLightboxOpen(false)}>
              <HiOutlineX />
            </button>
            {galleryUrls.length > 1 && (
              <>
                <button type="button" className="property-image-lightbox__nav property-image-lightbox__nav--prev" aria-label="Previous image" onClick={() => setActiveImageIndex((index) => (index - 1 + galleryUrls.length) % galleryUrls.length)}>
                  <HiOutlineChevronLeft />
                </button>
                <button type="button" className="property-image-lightbox__nav property-image-lightbox__nav--next" aria-label="Next image" onClick={() => setActiveImageIndex((index) => (index + 1) % galleryUrls.length)}>
                  <HiOutlineChevronRight />
                </button>
              </>
            )}
            <div className="property-image-lightbox__frame">
              <img src={mainImage} alt={rootProperty.title} className="property-image-lightbox__img" />
            </div>
          </div>
        </div>,
        document.body
      )}

      {floorPlanLightboxOpen && floorPlan && typeof document !== 'undefined' && createPortal(
        <div className="property-image-lightbox" role="dialog" aria-modal="true" aria-label="Floor plan viewer">
          <button type="button" className="property-image-lightbox__backdrop" tabIndex={-1} aria-label="Close floor plan viewer" onClick={() => setFloorPlanLightboxOpen(false)} />
          <div className="property-image-lightbox__inner property-image-lightbox__inner--floorplan">
            <button ref={floorPlanLightboxCloseRef} type="button" className="property-image-lightbox__close" aria-label="Close" onClick={() => setFloorPlanLightboxOpen(false)}>
              <HiOutlineX />
            </button>
            <div className="property-image-lightbox__frame property-image-lightbox__frame--floorplan">
              {floorPlanIsPdf ? (
                <iframe src={floorPlan} title={`Floor plan - ${rootProperty.title}`} className="property-image-lightbox__iframe" />
              ) : (
                <img src={floorPlan} alt={`Floor plan - ${rootProperty.title}`} className="property-image-lightbox__img" />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
