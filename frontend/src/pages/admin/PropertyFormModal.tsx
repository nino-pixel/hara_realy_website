import { useState, useEffect, useMemo } from 'react'
import Swal from 'sweetalert2'
import FormActions from '../../components/FormActions'
import { PROPERTY_TYPES, PROPERTY_STATUS_LABELS, PAYMENT_OPTION_LABELS, type Property, type PropertyType, type PropertyStatus, type PaymentOption, type PriceHistoryEntry } from '../../data/properties'
import type { PropertyImageUpload } from '../../services/propertiesApi'
import { optimizeImageForUpload, optimizeImageFiles } from '../../utils/imageUploadOptimize'
import { resolveStorageUrl } from '../../utils/mediaUrl'
import { formatPesoInputFromRaw } from '../../utils/mortgageUtils'
import './AdminProperties.css'

const PAYMENT_OPTIONS: PaymentOption[] = ['cash', 'bank_loan', 'in_house', 'installment']

const TABS = [
  { id: 'basic', label: 'Basic' },
  { id: 'media', label: 'Media' },
  { id: 'sales', label: 'Sales' },
  { id: 'legal', label: 'Legal' },
  { id: 'admin', label: 'Admin' },
] as const
type TabId = (typeof TABS)[number]['id']
type PropertyDocumentField = 'documentContract' | 'documentReservationForm' | 'documentTitleCopy'

const PROPERTY_DOCUMENT_FIELDS: Array<{
  key: PropertyDocumentField
  label: string
  attachedLabel: string
}> = [
  { key: 'documentContract', label: 'Contract', attachedLabel: 'Contract attached' },
  { key: 'documentReservationForm', label: 'Reservation Form', attachedLabel: 'Reservation form attached' },
  { key: 'documentTitleCopy', label: 'Title Copy', attachedLabel: 'Title copy attached' },
]

/** Parse price string (e.g. "₱5,000,000" or "200000") to number. */
function parsePriceToNumber(s: string | undefined): number {
  if (!s || !String(s).trim()) return 0
  const digits = String(s).replace(/\D/g, '')
  return digits ? parseInt(digits, 10) : 0
}

type Props = {
  form: Partial<Property>
  setForm: React.Dispatch<React.SetStateAction<Partial<Property>>>
  onSave: (upload: PropertyImageUpload) => void | Promise<void>
  onAddUnit?: (() => void) | null
  onClose: () => void
  isEdit: boolean
  propertyCodeDisplay: string
  /** Disable Save while submitting to API */
  primaryDisabled?: boolean
  /** 0–1 while uploading multipart */
  uploadProgress?: number | null
}

export default function PropertyFormModal({
  form,
  setForm,
  onSave,
  onAddUnit = null,
  onClose,
  isEdit,
  propertyCodeDisplay,
  primaryDisabled = false,
  uploadProgress = null,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('basic')
  /** Pending uploads (sent as multipart — not base64 in JSON) */
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [galleryFiles, setGalleryFiles] = useState<File[]>([])
  const [floorPlanFile, setFloorPlanFile] = useState<File | null>(null)
  const [documentFiles, setDocumentFiles] = useState<Record<PropertyDocumentField, File | null>>({
    documentContract: null,
    documentReservationForm: null,
    documentTitleCopy: null,
  })

  const coverPreviewUrl = useMemo(() => {
    if (!coverFile) return null
    return URL.createObjectURL(coverFile)
  }, [coverFile])

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl)
    }
  }, [coverPreviewUrl])

  const galleryPreviewUrls = useMemo(
    () => galleryFiles.map((f) => URL.createObjectURL(f)),
    [galleryFiles]
  )

  useEffect(() => {
    return () => {
      galleryPreviewUrls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [galleryPreviewUrls])

  const floorPlanPreviewUrl = useMemo(() => {
    if (!floorPlanFile) return null
    return URL.createObjectURL(floorPlanFile)
  }, [floorPlanFile])

  useEffect(() => {
    return () => {
      if (floorPlanPreviewUrl) URL.revokeObjectURL(floorPlanPreviewUrl)
    }
  }, [floorPlanPreviewUrl])

  const update = (key: keyof Property, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }))

  const setDocumentFile = (key: PropertyDocumentField, file: File | null) =>
    setDocumentFiles((prev) => ({ ...prev, [key]: file }))

  const galleryUrlCount = (form.gallery ?? []).length
  const removeGalleryAt = (index: number) => {
    if (index < galleryUrlCount) {
      update(
        'gallery',
        (form.gallery ?? []).filter((_, j) => j !== index)
      )
    } else {
      const fi = index - galleryUrlCount
      setGalleryFiles((prev) => prev.filter((_, j) => j !== fi))
    }
  }

  return (
    <div className="property-sidebar-overlay" onClick={onClose} role="presentation">
      <div
        className="property-sidebar"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={isEdit ? 'Edit Property' : 'Add Property'}
      >
        <div className="property-sidebar-header">
          <h2>{isEdit ? 'Edit Property' : 'Add Property'}</h2>
          <button type="button" className="property-sidebar-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <nav className="property-form-tabs" aria-label="Form sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`property-form-tab ${activeTab === tab.id ? 'property-form-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="property-sidebar-body">
          {activeTab === 'basic' && (
            <>
          <section className="property-form-section">
            <h3 className="property-form-section-title">Basic Info</h3>
            <div className="admin-form-row">
              <label>Title</label>
              <input
                className="admin-input"
                value={form.title ?? ''}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Listing name"
              />
            </div>
            <div className="admin-form-row">
              <label>Property Code / ID</label>
              <input value={propertyCodeDisplay} readOnly className="admin-input--readonly" />
              <p className="form-field-hint">Format: CHR-YEAR-SEQUENCE (e.g. CHR-2026-000123). Auto-generated.</p>
            </div>
            <div className="admin-form-row admin-form-row--toggle">
              <label className="form-toggle-label">
                  <span className="form-toggle-row">
                    <span className="form-toggle-wrap">
                      <input
                        type="checkbox"
                      className="form-toggle-input"
                      checked={form.isPropertyGroup === true}
                      onChange={(e) => update('isPropertyGroup', e.target.checked)}
                    />
                    <span className="form-toggle-slider" />
                  </span>
                  <span className="form-toggle-text">Multiple units only</span>
                </span>
              </label>
            </div>
            <div className="admin-form-row">
              <label>Type</label>
              <select
                className="admin-input"
                value={form.type ?? 'House'}
                onChange={(e) => update('type', e.target.value as PropertyType)}
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="admin-form-row">
              <label>Developer / Subdivision</label>
              <input
                className="admin-input"
                value={form.developer ?? ''}
                onChange={(e) => update('developer', e.target.value)}
                placeholder="e.g. Ayala Land"
              />
            </div>
            <div className="admin-form-row">
              <label>Year Built (optional)</label>
              <input
                className="admin-input"
                type="text"
                value={form.yearBuilt ?? ''}
                onChange={(e) => update('yearBuilt', e.target.value)}
                placeholder="e.g. 2020"
              />
            </div>
            <div className="admin-form-row">
              <label>Status</label>
              <select
                className="admin-input"
                value={form.status ?? 'draft'}
                onChange={(e) => update('status', e.target.value as PropertyStatus)}
              >
                {(Object.keys(PROPERTY_STATUS_LABELS) as PropertyStatus[]).map((s) => (
                  <option key={s} value={s}>{PROPERTY_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="property-form-section">
            <h3 className="property-form-section-title">Location</h3>
            <div className="admin-form-row">
              <label>Address</label>
              <input
                className="admin-input"
                value={form.address ?? ''}
                onChange={(e) => update('address', e.target.value)}
                placeholder="Street, building"
              />
            </div>
            <div className="admin-form-inline-row">
              <div className="admin-form-row">
                <label>City</label>
                <input
                  className="admin-input"
                  value={form.city ?? ''}
                  onChange={(e) => update('city', e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="admin-form-row">
                <label>Province</label>
                <input
                  className="admin-input"
                  value={form.province ?? ''}
                  onChange={(e) => update('province', e.target.value)}
                  placeholder="Province"
                />
              </div>
            </div>
            <div className="admin-form-row">
              <label>Location (display line)</label>
              <input
                className="admin-input"
                value={form.location ?? ''}
                onChange={(e) => update('location', e.target.value)}
                placeholder="e.g. Angeles City, Pampanga"
              />
            </div>
          </section>

          <section className="property-form-section">
            <h3 className="property-form-section-title">Pricing</h3>
            <div className="admin-form-row">
              <label>Price</label>
              <input
                className="admin-input"
                inputMode="numeric"
                autoComplete="off"
                value={formatPesoInputFromRaw(String(form.price ?? ''))}
                onChange={(e) => update('price', formatPesoInputFromRaw(e.target.value))}
                placeholder="₱0"
              />
            </div>
            {(() => {
              const priceNum = parsePriceToNumber(form.price)
              const promoNum = parsePriceToNumber(form.promoPrice)
              const netNum = priceNum > 0 && promoNum >= 0 ? Math.max(0, priceNum - promoNum) : null
              return netNum !== null && (priceNum > 0 || promoNum > 0) ? (
                <div className="admin-form-row property-form-net-price">
                  <label>Net price after discount</label>
                  <p className="property-form-net-price-value">
                    ₱{netNum.toLocaleString('en-PH')}
                  </p>
                  <p className="form-field-hint">Auto-calculated: Price − Promo discount.</p>
                </div>
              ) : null
            })()}
            <div className="admin-form-inline-row">
              <div className="admin-form-row">
                <label>Downpayment</label>
                <input
                  className="admin-input"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formatPesoInputFromRaw(String(form.downpayment ?? ''))}
                  onChange={(e) => update('downpayment', formatPesoInputFromRaw(e.target.value))}
                  placeholder="₱0"
                />
              </div>
              <div className="admin-form-row">
                <label>Monthly Est.</label>
                <input
                  className="admin-input"
                  value={form.monthlyEst ?? ''}
                  onChange={(e) => update('monthlyEst', e.target.value)}
                  placeholder="₱0"
                />
              </div>
            </div>
            <div className="admin-form-row">
              <label>Negotiable?</label>
              <select
                className="admin-input"
                value={form.negotiable === true ? 'yes' : form.negotiable === false ? 'no' : ''}
                onChange={(e) => update('negotiable', e.target.value === 'yes')}
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="admin-form-row">
              <label className="property-form-label-block">Payment options</label>
              <div className="property-form-checkbox-group">
                {PAYMENT_OPTIONS.map((opt) => (
                  <label key={opt} className="property-form-checkbox-option">
                    <input
                      type="checkbox"
                      checked={(form.paymentOptions ?? []).includes(opt)}
                      onChange={(e) => {
                        const current = form.paymentOptions ?? []
                        const next = e.target.checked
                          ? [...current, opt]
                          : current.filter((o) => o !== opt)
                        update('paymentOptions', next)
                      }}
                    />
                    <span>{PAYMENT_OPTION_LABELS[opt]}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          </>
          )}

          {activeTab === 'media' && (
          <section className="property-form-section">
            <h3 className="property-form-section-title">Media</h3>
            <div className="admin-form-row">
              <label>Cover Photo (URL)</label>
              <input
                className="admin-input"
                value={coverFile ? '' : form.image ?? ''}
                onChange={(e) => {
                  setCoverFile(null)
                  update('image', e.target.value)
                }}
                placeholder="https://… (optional if you upload a file below)"
              />
            </div>
            <div className="admin-form-row">
              <label>Cover Photo (upload)</label>
              <div className="file-input-wrap">
                <span className="file-input-btn">
                  <span className="file-input-icon">📁</span>
                  Choose cover image…
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const input = e.target
                    void (async () => {
                      try {
                        const optimized = await optimizeImageForUpload(file)
                        setCoverFile(optimized)
                        update('image', '')
                      } catch (err) {
                        Swal.fire({
                          icon: 'error',
                          title: 'Could not process image',
                          text: err instanceof Error ? err.message : 'Try a smaller JPG/PNG/WebP.',
                        })
                      } finally {
                        input.value = ''
                      }
                    })()
                  }}
                  className="file-input-hidden"
                  aria-label="Upload cover image"
                />
              </div>
              {(coverPreviewUrl ||
                (!coverFile &&
                  form.image &&
                  (/^https?:\/\//i.test(form.image) || String(form.image).startsWith('/storage')))) && (
                <div className="property-form-cover-preview">
                  <img
                    src={coverPreviewUrl ?? form.image}
                    alt=""
                    className="property-form-cover-preview-img"
                  />
                  {coverFile && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => setCoverFile(null)}
                    >
                      Remove uploaded cover
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="admin-form-row">
              <label>Gallery (choose files)</label>
              <div className="file-input-wrap">
                <span className="file-input-btn">
                  <span className="file-input-icon">📁</span>
                  Add gallery images…
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/webp"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files
                    if (!files?.length) return
                    const input = e.target
                    void (async () => {
                      try {
                        const optimized = await optimizeImageFiles(Array.from(files))
                        setGalleryFiles((prev) => [...prev, ...optimized])
                      } catch (err) {
                        Swal.fire({
                          icon: 'error',
                          title: 'Could not process images',
                          text: err instanceof Error ? err.message : 'Try smaller JPG/PNG/WebP files.',
                        })
                      } finally {
                        input.value = ''
                      }
                    })()
                  }}
                  className="file-input-hidden"
                  aria-label="Choose gallery images"
                />
              </div>
              {galleryUrlCount + galleryFiles.length > 0 && (
                <div className="property-form-gallery-preview">
                  <span className="property-form-gallery-count">
                    {galleryUrlCount + galleryFiles.length} image(s)
                    {galleryUrlCount > 0 && ` (${galleryUrlCount} saved URL${galleryUrlCount === 1 ? '' : 's'})`}
                    {galleryFiles.length > 0 && ` (${galleryFiles.length} new upload${galleryFiles.length === 1 ? '' : 's'})`}
                  </span>
                  <div className="property-form-gallery-thumbs">
                    {(form.gallery ?? []).map((src, i) => (
                      <span key={`url-${i}`} className="property-form-gallery-thumb-wrap">
                        <img src={src} alt="" className="property-form-gallery-thumb" />
                        <button
                          type="button"
                          className="property-form-gallery-remove"
                          onClick={() => removeGalleryAt(i)}
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {galleryPreviewUrls.map((src, i) => (
                      <span key={`file-${i}`} className="property-form-gallery-thumb-wrap">
                        <img src={src} alt="" className="property-form-gallery-thumb" />
                        <button
                          type="button"
                          className="property-form-gallery-remove"
                          onClick={() => removeGalleryAt(galleryUrlCount + i)}
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      update('gallery', [])
                      setGalleryFiles([])
                    }}
                  >
                    Clear gallery
                  </button>
                </div>
              )}
            </div>
            <div className="admin-form-row">
              <label>Floor Plan (choose file)</label>
              <div className="file-input-wrap">
                <span className="file-input-btn">
                  <span className="file-input-icon">📄</span>
                  Choose image or PDF…
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const input = e.target
                    setFloorPlanFile(file)
                    update('floorPlan', undefined)
                    input.value = ''
                  }}
                  className="file-input-hidden"
                  aria-label="Choose floor plan file"
                />
              </div>
              {(floorPlanFile || (form.floorPlan && !String(form.floorPlan).startsWith('data:'))) && (
                <div className="property-form-file-preview">
                  <span className="property-form-file-label">
                    {floorPlanFile
                      ? floorPlanFile.type === 'application/pdf'
                        ? `PDF: ${floorPlanFile.name}`
                        : `Image: ${floorPlanFile.name}`
                      : form.floorPlan?.toLowerCase().includes('.pdf')
                        ? 'PDF on server'
                        : 'Image on server'}
                  </span>
                  {floorPlanPreviewUrl && floorPlanFile?.type !== 'application/pdf' && (
                    <img
                      src={floorPlanPreviewUrl}
                      alt=""
                      className="property-form-cover-preview-img"
                      style={{ maxHeight: 120, marginTop: 8 }}
                    />
                  )}
                  {floorPlanPreviewUrl && floorPlanFile?.type === 'application/pdf' && (
                    <p className="form-field-hint" style={{ marginTop: 8 }}>
                      <a href={floorPlanPreviewUrl} target="_blank" rel="noopener noreferrer">
                        Preview PDF
                      </a>
                    </p>
                  )}
                  {!floorPlanFile && form.floorPlan && !String(form.floorPlan).startsWith('data:') && (
                    <p className="form-field-hint" style={{ marginTop: 8 }}>
                      Current:{' '}
                      <a
                        href={resolveStorageUrl(form.floorPlan)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open current floor plan
                      </a>
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      setFloorPlanFile(null)
                      update('floorPlan', undefined)
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            <div className="admin-form-row">
              <label>Virtual Tour (link)</label>
              <input
                className="admin-input"
                value={form.virtualTourUrl ?? ''}
                onChange={(e) => update('virtualTourUrl', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </section>
          )}

          {activeTab === 'sales' && (
          <section className="property-form-section">
            <h3 className="property-form-section-title">Status & Sales</h3>
            <div className="admin-form-row">
              <label>Status</label>
              <select
                className="admin-input"
                value={form.status ?? 'draft'}
                onChange={(e) => update('status', e.target.value as PropertyStatus)}
              >
                {(Object.keys(PROPERTY_STATUS_LABELS) as PropertyStatus[]).map((s) => (
                  <option key={s} value={s}>{PROPERTY_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="admin-form-row">
              <label>Availability Date</label>
              <input
                className="admin-input"
                type="date"
                value={form.availabilityDate ?? ''}
                onChange={(e) => update('availabilityDate', e.target.value)}
              />
            </div>
            <div className="admin-form-inline-row">
              <div className="admin-form-row">
                <label>Promo price</label>
                <input
                  className="admin-input"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formatPesoInputFromRaw(String(form.promoPrice ?? ''))}
                  onChange={(e) => update('promoPrice', formatPesoInputFromRaw(e.target.value))}
                  placeholder="₱0 (discount amount)"
                />
              </div>
              <div className="admin-form-row">
                <label>Promo until</label>
                <input
                  className="admin-input"
                  type="date"
                  value={form.promoUntil ?? ''}
                  onChange={(e) => update('promoUntil', e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            {(() => {
              const priceNum = parsePriceToNumber(form.price)
              const promoNum = parsePriceToNumber(form.promoPrice)
              const netNum = priceNum > 0 && promoNum >= 0 ? Math.max(0, priceNum - promoNum) : null
              return netNum !== null && priceNum > 0 ? (
                <div className="admin-form-row property-form-net-price">
                  <label>Net price after discount</label>
                  <p className="property-form-net-price-value">₱{netNum.toLocaleString('en-PH')}</p>
                  <p className="form-field-hint">Auto-calculated: Price − Promo discount.</p>
                </div>
              ) : null
            })()}
            {(form.priceHistory ?? []).length > 0 && (
              <div className="admin-form-row property-form-price-history">
                <label className="property-form-label-block">Price history</label>
                <p className="property-form-price-history-value">
                  {(form.priceHistory ?? [])
                    .map((e: PriceHistoryEntry) => e.price)
                    .join(' → ')}
                </p>
                <p className="property-form-price-history-hint">Auto-logged. Display only.</p>
              </div>
            )}
            <div className="admin-form-row">
              <label htmlFor="property-mortgage-rate">Annual interest rate (%)</label>
              <input
                id="property-mortgage-rate"
                type="number"
                min={0}
                max={40}
                step={0.1}
                className="admin-input"
                value={
                  form.mortgageInterestRate != null && Number.isFinite(form.mortgageInterestRate)
                    ? form.mortgageInterestRate
                    : 6.5
                }
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') {
                    update('mortgageInterestRate', 6.5)
                    return
                  }
                  const v = parseFloat(raw)
                  if (!Number.isFinite(v)) {
                    update('mortgageInterestRate', 6.5)
                    return
                  }
                  update('mortgageInterestRate', Math.min(40, Math.max(0, v)))
                }}
              />
            </div>
          </section>
          )}

          {activeTab === 'basic' && (
          <section className="property-form-section">
            <h3 className="property-form-section-title">Details</h3>
            <div className="admin-form-inline-row">
              <div className="admin-form-row">
                <label>Floor Area</label>
                <input
                  className="admin-input"
                  value={form.floorArea ?? form.area ?? ''}
                  onChange={(e) => update('floorArea', e.target.value)}
                  placeholder="e.g. 95 sqm"
                />
              </div>
              <div className="admin-form-row">
                <label>Lot Area</label>
                <input
                  className="admin-input"
                  value={form.lotArea ?? ''}
                  onChange={(e) => update('lotArea', e.target.value)}
                  placeholder="e.g. 120 sqm"
                />
              </div>
            </div>
            <div className="admin-form-inline-row">
              <div className="admin-form-row">
                <label>Bedrooms</label>
                <input
                  className="admin-input"
                  type="number"
                  min={0}
                  value={form.beds ?? 0}
                  onChange={(e) => update('beds', parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="admin-form-row">
                <label>Bathrooms</label>
                <input
                  className="admin-input"
                  type="number"
                  min={0}
                  value={form.baths ?? 0}
                  onChange={(e) => update('baths', parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="admin-form-row">
                <label>Parking</label>
                <input
                  className="admin-input"
                  type="number"
                  min={0}
                  value={form.parking ?? 0}
                  onChange={(e) => update('parking', parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>
            <div className="admin-form-row">
              <label>Area (display)</label>
              <input
                className="admin-input"
                value={form.area ?? ''}
                onChange={(e) => update('area', e.target.value)}
                placeholder="e.g. 95 sqm"
              />
            </div>
            <div className="admin-form-row">
              <label>Furnished?</label>
              <select
                className="admin-input"
                value={form.furnished === true ? 'yes' : form.furnished === false ? 'no' : ''}
                onChange={(e) => update('furnished', e.target.value === 'yes')}
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </section>
          )}

          {activeTab === 'admin' && (
          <section className="property-form-section">
            <h3 className="property-form-section-title">Visibility</h3>
            <div className="admin-form-row admin-form-row--toggle">
              <label className="form-toggle-label">
                <span className="form-toggle-row">
                  <span className="form-toggle-wrap">
                    <input
                      type="checkbox"
                      className="form-toggle-input"
                      checked={form.showOnWebsite === true}
                      onChange={(e) => update('showOnWebsite', e.target.checked)}
                    />
                    <span className="form-toggle-slider" />
                  </span>
                  <span className="form-toggle-text">Show on Website</span>
                </span>
              </label>
            </div>
            <div className="admin-form-row">
              <label htmlFor="property-fb-link">Facebook Post Link</label>
              <input
                className="admin-input"
                id="property-fb-link"
                type="url"
                value={typeof form.showOnFacebook === 'string' ? form.showOnFacebook : ''}
                onChange={(e) => update('showOnFacebook', e.target.value || undefined)}
                placeholder="https://facebook.com/..."
              />
            </div>
            <div className="admin-form-row admin-form-row--toggle">
              <label className="form-toggle-label">
                <span className="form-toggle-row">
                  <span className="form-toggle-wrap">
                    <input
                      type="checkbox"
                      className="form-toggle-input"
                      checked={form.featuredListing === true}
                      onChange={(e) => update('featuredListing', e.target.checked)}
                    />
                    <span className="form-toggle-slider" />
                  </span>
                  <span className="form-toggle-text">Mark as Featured</span>
                </span>
              </label>
            </div>
          </section>
          )}

          {activeTab === 'legal' && (
          <>
          <section className="property-form-section">
            <h3 className="property-form-section-title">Legal & Ownership</h3>
            <div className="admin-form-row">
              <label>Title type</label>
              <select
                className="admin-input"
                value={form.titleType ?? ''}
                onChange={(e) => update('titleType', e.target.value === '' ? undefined : (e.target.value as 'TCT' | 'CCT'))}
              >
                <option value="">—</option>
                <option value="TCT">TCT</option>
                <option value="CCT">CCT</option>
              </select>
            </div>
            <div className="admin-form-row">
              <label>Title number</label>
              <input
                className="admin-input"
                value={form.titleNumber ?? ''}
                onChange={(e) => update('titleNumber', e.target.value)}
                placeholder="e.g. 12345"
              />
            </div>
            <div className="admin-form-row">
              <label>Registered owner</label>
              <input
                className="admin-input"
                value={form.registeredOwner ?? ''}
                onChange={(e) => update('registeredOwner', e.target.value)}
                placeholder="As shown on title"
              />
            </div>
            <div className="admin-form-row">
              <label>Tax declaration no.</label>
              <input
                className="admin-input"
                value={form.taxDeclarationNo ?? ''}
                onChange={(e) => update('taxDeclarationNo', e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="admin-form-row">
              <label>Last transfer date</label>
              <input
                className="admin-input"
                type="date"
                value={form.lastTransferDate ?? ''}
                onChange={(e) => update('lastTransferDate', e.target.value)}
              />
            </div>
            <div className="admin-form-row">
              <label>With encumbrance?</label>
              <select
                className="admin-input"
                value={form.withEncumbrance === true ? 'yes' : form.withEncumbrance === false ? 'no' : ''}
                onChange={(e) => update('withEncumbrance', e.target.value === 'yes')}
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="admin-form-row">
              <label>Remarks (legal)</label>
              <input
                className="admin-input"
                value={form.legalStatus ?? ''}
                onChange={(e) => update('legalStatus', e.target.value)}
                placeholder="e.g. Clean title, other notes"
              />
            </div>
          </section>

          <section className="property-form-section">
            <h3 className="property-form-section-title">Documents</h3>
            {PROPERTY_DOCUMENT_FIELDS.map((field) => {
              const currentValue = form[field.key]
              const selectedFile = documentFiles[field.key]
              const currentUrl =
                typeof currentValue === 'string' && currentValue && !currentValue.startsWith('data:')
                  ? resolveStorageUrl(currentValue)
                  : ''

              return (
                <div key={field.key} className="admin-form-row">
                  <label>{field.label}</label>
                  <div className="file-input-wrap">
                    <span className="file-input-btn">
                      <span className="file-input-icon">📄</span>
                      {(selectedFile || currentValue) ? 'Change file…' : 'Choose file…'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setDocumentFile(field.key, file)
                        update(field.key, undefined)
                        e.target.value = ''
                      }}
                      className="file-input-hidden"
                      aria-label={field.label}
                    />
                  </div>
                  {(selectedFile || currentValue) && (
                    <div className="property-form-file-preview">
                      <span className="property-form-file-label">
                        {selectedFile ? selectedFile.name : field.attachedLabel}
                      </span>
                      {!selectedFile && currentUrl && (
                        <p className="form-field-hint" style={{ marginTop: 8 }}>
                          <a href={currentUrl} target="_blank" rel="noopener noreferrer">
                            Open current file
                          </a>
                        </p>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          setDocumentFile(field.key, null)
                          update(field.key, undefined)
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
          </>
          )}

          {activeTab === 'admin' && (
          <>
          <section className="property-form-section">
            <h3 className="property-form-section-title">Notes (Admin Only)</h3>
            <div className="admin-form-row">
              <label>Internal notes</label>
              <textarea
                className="admin-input"
                value={form.internalNotes ?? ''}
                onChange={(e) => update('internalNotes', e.target.value)}
                rows={2}
                placeholder="Internal notes"
              />
            </div>
            <div className="admin-form-row">
              <label>Owner instructions</label>
              <textarea
                className="admin-input"
                value={form.ownerInstructions ?? ''}
                onChange={(e) => update('ownerInstructions', e.target.value)}
                rows={2}
                placeholder="Owner instructions"
              />
            </div>
          </section>
          </>
          )}

        </div>
        {uploadProgress != null && (
          <div
            className="property-upload-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(uploadProgress * 100)}
          >
            <div
              className="property-upload-progress-fill"
              style={{ width: `${Math.min(100, Math.round(uploadProgress * 100))}%` }}
            />
            <span className="property-upload-progress-label">
              Uploading… {Math.round(uploadProgress * 100)}%
            </span>
          </div>
        )}
        <FormActions
          primaryLabel={isEdit ? 'Save' : 'Add Property'}
          onPrimary={() =>
            void onSave({
              coverFile,
              galleryFiles,
              floorPlanFile,
              documentContractFile: documentFiles.documentContract,
              documentReservationFormFile: documentFiles.documentReservationForm,
              documentTitleCopyFile: documentFiles.documentTitleCopy,
            })
          }
          onCancel={onClose}
          primaryDisabled={primaryDisabled}
          className="property-sidebar-footer"
        >
          <>
            {isEdit && form.isPropertyGroup === true && typeof onAddUnit === 'function' ? (
              <button type="button" className="btn btn-outline" onClick={onAddUnit}>
                Add Unit
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                void onSave({
                  coverFile,
                  galleryFiles,
                  floorPlanFile,
                  documentContractFile: documentFiles.documentContract,
                  documentReservationFormFile: documentFiles.documentReservationForm,
                  documentTitleCopyFile: documentFiles.documentTitleCopy,
                })
              }
              disabled={primaryDisabled}
            >
              {isEdit ? 'Save' : 'Add Property'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
          </>
        </FormActions>
      </div>
    </div>
  )
}
