import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  HiOutlineEye,
  HiOutlinePencil,
  HiOutlineArchive,
  HiOutlineMenu,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
} from 'react-icons/hi'
import { logActivity } from '../../data/activityLog'
import {
  fetchProperties,
  savePropertyStore,
  getNextPropertyCode,
  getPropertyById,
  PROPERTY_STATUS_LABELS,
  getPropertyStatusDescription,
  logPropertyActivity,
  type Property,
  type PropertyStatus,
  type PropertyType,
} from '../../services/propertiesService'
import { persistPropertyToApi, deletePropertyFromApi, type PropertyImageUpload } from '../../services/propertiesApi'
import { resolveStorageUrl } from '../../utils/mediaUrl'
import { useAdminAuth } from '../../context/AdminAuth'
import PropertyFormModal from './PropertyFormModal'
import './admin-common.css'
import './AdminProperties.css'

export default function AdminProperties() {
  const { user } = useAdminAuth()
  const actor = user?.name ?? 'Unknown'
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('status') as PropertyStatus | null
  const [typeFilter, setTypeFilter] = useState<PropertyType | 'all' | ''>('')
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const typeDropdownRef = useRef<HTMLDivElement>(null)
  const [sortBy, setSortBy] = useState<'title' | 'location' | 'price' | 'leads' | 'updated' | ''>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [searchQuery, setSearchQuery] = useState('')
  const [properties, setProperties] = useState<Property[]>(() =>
    fetchProperties().filter((p) => !p.archived)
  )
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Property | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<Partial<Property>>({})
  const [archiveModalProperty, setArchiveModalProperty] = useState<Property | null>(null)
  const [archiveReason, setArchiveReason] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [savingProperty, setSavingProperty] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  useEffect(() => {
    const editId = (location.state as { editId?: string } | null)?.editId
    if (editId) {
      const p = getPropertyById(editId)
      if (p && !p.archived) {
        setForm({ ...p })
        setEditing(p)
        setShowAdd(false)
      }
      navigate('/admin/properties', { replace: true, state: {} })
      return
    }

    const propertyIdFromQuery = searchParams.get('propertyId')
    if (propertyIdFromQuery) {
      const p = getPropertyById(propertyIdFromQuery)
      if (p && !p.archived) {
        setForm({ ...p })
        setEditing(p)
        setShowAdd(false)
      }
    }
  }, [location.state, navigate, searchParams])

  useEffect(() => {
    setProperties(fetchProperties().filter((p) => !p.archived))
    setLoading(false)
  }, [editing, showAdd, archiveModalProperty])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(target)) setStatusDropdownOpen(false)
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(target)) setTypeDropdownOpen(false)
    }
    if (statusDropdownOpen || typeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [statusDropdownOpen, typeDropdownOpen])

  const validStatuses: PropertyStatus[] = ['draft', 'available', 'reserved', 'under_negotiation', 'processing_docs', 'sold', 'cancelled', 'archived']
  const PROPERTY_TYPES: PropertyType[] = ['Condo', 'House', 'Lot', 'Commercial']

  /** Parse price string (e.g. "₱7,867,263" or "₱2.5M") to number for sorting */
  const parsePriceValue = (priceStr: string): number => {
    if (!priceStr || typeof priceStr !== 'string') return 0
    const s = priceStr.replace(/[₱,\s]/g, '').trim()
    const m = s.match(/^([\d.]+)\s*M$/i)
    if (m) return parseFloat(m[1]) * 1_000_000
    return parseFloat(s) || 0
  }

  const effectivePrice = (p: Property): number => {
    const raw = (p.promoPrice ?? '').trim() || p.price
    return parsePriceValue(raw)
  }

  type SortCol = 'title' | 'location' | 'price' | 'leads' | 'updated'
  const handleSort = (col: SortCol) => {
    if (sortBy !== col) {
      setSortBy(col)
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else {
      setSortBy('')
      setSortDir('asc')
    }
  }

  const displayedProperties = useMemo(() => {
    let list = properties
    if (statusFilter && validStatuses.includes(statusFilter)) {
      list = list.filter((p) => p.status === statusFilter)
    }
    if (typeFilter && typeFilter !== 'all') {
      list = list.filter((p) => p.type === typeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((p) => {
        const statusLabel = (PROPERTY_STATUS_LABELS[p.status] ?? '').toLowerCase()
        const priceHistoryDates = (p.priceHistory ?? []).map((e) => e.at).join(' ')
        const searchable =
          [
            p.title,
            p.location,
            p.price,
            p.promoPrice,
            p.type,
            statusLabel,
            p.updatedAt,
            p.propertyCode,
            p.developer,
            p.yearBuilt,
            p.address,
            p.city,
            p.province,
            p.downpayment,
            p.monthlyEst,
            p.promoUntil,
            p.availabilityDate,
            p.floorArea,
            p.lotArea,
            p.internalNotes,
            p.ownerInstructions,
            p.titleType,
            p.titleNumber,
            p.registeredOwner,
            p.taxDeclarationNo,
            p.lastTransferDate,
            p.legalStatus,
            p.archivedAt,
            p.archiveReason,
            p.area,
            String(p.beds ?? ''),
            String(p.baths ?? ''),
            String(p.leads ?? ''),
            String(p.parking ?? ''),
            priceHistoryDates,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
        return searchable.includes(q)
      })
    }
    if (sortBy === 'price') {
      list = [...list].sort((a, b) => {
        const va = effectivePrice(a)
        const vb = effectivePrice(b)
        const cmp = va - vb
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else if (sortBy === 'title') {
      list = [...list].sort((a, b) => {
        const cmp = (a.title ?? '').localeCompare(b.title ?? '')
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else if (sortBy === 'location') {
      list = [...list].sort((a, b) => {
        const cmp = (a.location ?? '').localeCompare(b.location ?? '')
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else if (sortBy === 'leads') {
      list = [...list].sort((a, b) => {
        const va = a.leads ?? 0
        const vb = b.leads ?? 0
        const cmp = va - vb
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else if (sortBy === 'updated') {
      list = [...list].sort((a, b) => {
        const cmp = (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '')
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else {
      /** Walang column sort: pinakabagong update sa taas. */
      list = [...list].sort((a, b) => {
        const ta = new Date(a.updatedAt || 0).getTime()
        const tb = new Date(b.updatedAt || 0).getTime()
        return tb - ta
      })
    }
    return list
  }, [properties, statusFilter, typeFilter, searchQuery, sortBy, sortDir])

  const openArchiveModal = (p: Property) => {
    setArchiveModalProperty(p)
    setArchiveReason('')
    setArchiveError('')
  }

  const confirmArchiveProperty = async () => {
    if (!archiveModalProperty) return
    const reason = archiveReason.trim()
    if (!reason) {
      setArchiveError('Please provide a reason for archiving.')
      return
    }
    try {
      await deletePropertyFromApi(archiveModalProperty.id)
      const next = savePropertyStore((prev) => prev.filter((p) => p.id !== archiveModalProperty.id))
      setProperties(next.filter((q) => !q.archived))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not archive on server.'
      setArchiveError(msg)
      Swal.fire({ icon: 'error', title: 'Archive failed', text: msg })
      return
    }
    logPropertyActivity({
      actor,
      action: 'archived',
      entityType: 'property',
      entityId: archiveModalProperty.id,
      entityLabel: archiveModalProperty.title,
      details: `Archived property ${archiveModalProperty.title} — Reason: ${reason}`,
    })
    setArchiveModalProperty(null)
    setArchiveReason('')
    setArchiveError('')
    Swal.fire({
      icon: 'success',
      title: 'Archived successfully',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    })
  }

  const saveProperty = async (upload: PropertyImageUpload = { coverFile: null, galleryFiles: [], floorPlanFile: null }) => {
    const updatedAt = new Date().toISOString().slice(0, 10)
    const nowIso = new Date().toISOString()
    const hasFileUpload = !!(upload.coverFile || upload.galleryFiles.length > 0 || upload.floorPlanFile)
    if (editing && form.id) {
      const prev = fetchProperties().find((p) => p.id === form.id)
      const effectivePrice = (form.promoPrice ?? '').trim() || (form.price ?? '')
      const priceChanged = prev && (
        (form.price ?? '') !== (prev.price ?? '') ||
        (form.promoPrice ?? '') !== (prev.promoPrice ?? '')
      )
      const nextHistory = priceChanged && effectivePrice
        ? [...(prev?.priceHistory ?? []), { price: effectivePrice, at: nowIso }]
        : (form.priceHistory ?? prev?.priceHistory ?? [])
      const merged = {
        ...prev,
        ...form,
        updatedAt,
        leads: prev?.leads ?? 0,
        priceHistory: nextHistory,
      } as Property
      setSavingProperty(true)
      if (hasFileUpload) setUploadProgress(0)
      try {
        const saved = await persistPropertyToApi(
          merged,
          upload,
          hasFileUpload ? (r) => setUploadProgress(r) : undefined
        )
        const next = savePropertyStore((prevStore) =>
          prevStore.map((p) => (p.id === form.id ? saved : p))
        )
        setProperties(next.filter((q) => !q.archived))
        setEditing(null)
        const logProp = (details: string) =>
          logPropertyActivity({
            actor,
            action: 'updated',
            entityType: 'property',
            entityId: form.id ?? null,
            entityLabel: saved.title,
            details,
          })
        if (priceChanged) logProp('Price changed')
        if (prev && typeof form.showOnFacebook === 'string' && form.showOnFacebook.trim() && form.showOnFacebook !== (prev.showOnFacebook ?? '')) {
          logPropertyActivity({
            actor,
            action: 'updated',
            entityType: 'property',
            entityId: form.id ?? null,
            entityLabel: saved.title,
            details: 'Posted to FB',
          })
        }
        if (prev && form.status !== prev.status) {
          logPropertyActivity({
            actor,
            action: 'status_changed',
            entityType: 'property',
            entityId: form.id ?? null,
            entityLabel: saved.title,
            details: PROPERTY_STATUS_LABELS[form.status ?? 'draft'],
          })
        }
        if (!priceChanged && !(prev && typeof form.showOnFacebook === 'string' && form.showOnFacebook.trim() && form.showOnFacebook !== (prev.showOnFacebook ?? '')) && !(prev && form.status !== prev.status)) {
          logProp('Updated')
        }
        setForm({})
        window.setTimeout(() => {
          void Swal.fire({
            icon: 'success',
            title: 'Property updated',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          })
        }, 0)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not save property.'
        Swal.fire({ icon: 'error', title: 'Save failed', text: msg })
      } finally {
        setSavingProperty(false)
        setUploadProgress(null)
      }
      return
    }
    if (showAdd && form.title) {
      const newId = String(Date.now())
      const effectivePrice = (form.promoPrice ?? '').trim() || (form.price ?? '')
      const initialHistory = effectivePrice
        ? [{ price: effectivePrice, at: nowIso }]
        : []
      const newProp = {
        ...form,
        id: newId,
        updatedAt,
        leads: 0,
        priceHistory: initialHistory,
      } as Property
      setSavingProperty(true)
      if (hasFileUpload) setUploadProgress(0)
      try {
        const saved = await persistPropertyToApi(
          newProp,
          upload,
          hasFileUpload ? (r) => setUploadProgress(r) : undefined
        )
        const next = savePropertyStore((prev) => [...prev, saved])
        setProperties(next.filter((q) => !q.archived))
        setShowAdd(false)
        logActivity({
          actor,
          action: 'created',
          entityType: 'property',
          entityId: saved.id,
          entityLabel: saved.title,
          details: 'New property added',
        })
        setForm({})
        window.setTimeout(() => {
          void Swal.fire({
            icon: 'success',
            title: 'Property added',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          })
        }, 0)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not save property.'
        Swal.fire({ icon: 'error', title: 'Save failed', text: msg })
      } finally {
        setSavingProperty(false)
        setUploadProgress(null)
      }
      return
    }
    setForm({})
  }

  const deleteProperty = (id: string) => {
    const prop = fetchProperties().find((p) => p.id === id)
    if (prop) openArchiveModal(prop)
  }

  const openEdit = (p: Property) => {
    setForm({ ...p })
    setEditing(p)
    setShowAdd(false)
  }
  const openAdd = () => {
    setForm({
      status: 'draft',
      type: 'House',
      beds: 0,
      baths: 0,
      updatedAt: new Date().toISOString().slice(0, 10),
      showOnWebsite: true,
      propertyCode: getNextPropertyCode(),
      mortgageInterestRate: 6.5,
    })
    setShowAdd(true)
    setEditing(null)
  }

  const closeForm = () => {
    setEditing(null)
    setShowAdd(false)
    setForm({})
  }

  const formatDate = (d: string) => {
    if (!d) return '—'
    const [y, m, day] = d.split('-')
    if (!y || !m || !day) return '—'
    const mm = m.padStart(2, '0')
    const dd = day.padStart(2, '0')
    return `${mm}-${dd}-${y}`
  }

  const propertyCodeDisplay = form.id
    ? (form.propertyCode ?? form.id)
    : (form.propertyCode ?? '(auto on save)')

  return (
    <div className="admin-properties">
      <h1 className="admin-page-title">Property Management</h1>
      <p className="admin-page-subtitle">Manage property listings, codes, and status.</p>
      <div className="admin-toolbar">
        <input
          type="search"
          className="admin-input admin-properties-search"
          placeholder="Search properties..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search properties"
        />
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          Add Property
        </button>
        {statusFilter && validStatuses.includes(statusFilter) && (
          <span className="admin-filter-chip">
            Status: {PROPERTY_STATUS_LABELS[statusFilter]}
            <button
              type="button"
              className="admin-filter-chip-clear"
              onClick={() => setSearchParams({})}
              aria-label="Clear status filter"
            >
              ×
            </button>
          </span>
        )}
        {typeFilter && typeFilter !== 'all' && (
          <span className="admin-filter-chip">
            Type: {typeFilter}
            <button
              type="button"
              className="admin-filter-chip-clear"
              onClick={() => setTypeFilter('')}
              aria-label="Clear type filter"
            >
              ×
            </button>
          </span>
        )}
      </div>

      <div className="admin-properties-table-wrap">
        <table className="admin-table admin-properties-table">
          <thead>
            <tr>
              <th className="col-photo">Photo</th>
              <th className={`th-filter th-sortable col-title ${sortBy === 'title' ? 'th--sorted' : ''}`}>
                <button type="button" className="th-sort-btn" onClick={() => handleSort('title')} aria-label="Sort by title">
                  <span className="th-label">Title</span>
                  <span className="th-sort-icon">
                    {sortBy === 'title' ? (
                      sortDir === 'asc' ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />
                    ) : (
                      <>
                        <HiOutlineChevronUp />
                        <HiOutlineChevronDown />
                      </>
                    )}
                  </span>
                </button>
              </th>
              <th className={`th-filter th-sortable col-location ${sortBy === 'location' ? 'th--sorted' : ''}`}>
                <button type="button" className="th-sort-btn" onClick={() => handleSort('location')} aria-label="Sort by location">
                  <span className="th-label">Location</span>
                  <span className="th-sort-icon">
                    {sortBy === 'location' ? (
                      sortDir === 'asc' ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />
                    ) : (
                      <>
                        <HiOutlineChevronUp />
                        <HiOutlineChevronDown />
                      </>
                    )}
                  </span>
                </button>
              </th>
              <th className={`th-filter th-sortable col-price ${sortBy === 'price' ? 'th--sorted' : ''}`}>
                <button type="button" className="th-sort-btn" onClick={() => handleSort('price')} aria-label="Sort by price">
                  <span className="th-label">Price</span>
                  <span className="th-sort-icon">
                    {sortBy === 'price' ? (
                      sortDir === 'asc' ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />
                    ) : (
                      <>
                        <HiOutlineChevronUp />
                        <HiOutlineChevronDown />
                      </>
                    )}
                  </span>
                </button>
              </th>
              <th className="th-filter col-type">
                <div className="th-status-wrap" ref={typeDropdownRef}>
                  <button type="button" className="th-label-btn" onClick={() => setTypeDropdownOpen((o) => !o)} aria-label="Filter by type" aria-expanded={typeDropdownOpen}>
                    <span className="th-label">Type</span>
                  </button>
                  <button
                    type="button"
                    className={`th-dropdown-trigger ${typeDropdownOpen ? 'th-dropdown-trigger--open' : ''}`}
                    onClick={() => setTypeDropdownOpen((o) => !o)}
                    aria-label="Filter by type"
                    aria-expanded={typeDropdownOpen}
                  >
                    <span className="th-dropdown-trigger-icon">
                      <HiOutlineMenu />
                      <HiOutlineChevronDown />
                    </span>
                  </button>
                  {typeDropdownOpen && (
                    <div className="th-dropdown-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className={`th-dropdown-item ${!typeFilter || typeFilter === 'all' ? 'th-dropdown-item--active' : ''}`}
                        onClick={() => {
                          setTypeFilter('')
                          setTypeDropdownOpen(false)
                        }}
                      >
                        All
                      </button>
                      {PROPERTY_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          role="menuitem"
                          className={`th-dropdown-item ${typeFilter === t ? 'th-dropdown-item--active' : ''}`}
                          onClick={() => {
                            setTypeFilter(t)
                            setTypeDropdownOpen(false)
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </th>
              <th className="th-filter col-status">
                <div className="th-status-wrap" ref={statusDropdownRef}>
                  <button type="button" className="th-label-btn" onClick={() => setStatusDropdownOpen((o) => !o)} aria-label="Filter by status" aria-expanded={statusDropdownOpen}>
                    <span className="th-label">Status</span>
                  </button>
                  <button
                    type="button"
                    className={`th-dropdown-trigger ${statusDropdownOpen ? 'th-dropdown-trigger--open' : ''}`}
                    onClick={() => setStatusDropdownOpen((o) => !o)}
                    aria-label="Filter by status"
                    aria-expanded={statusDropdownOpen}
                  >
                    <span className="th-dropdown-trigger-icon">
                      <HiOutlineMenu />
                      <HiOutlineChevronDown />
                    </span>
                  </button>
                  {statusDropdownOpen && (
                    <div className="th-dropdown-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className={`th-dropdown-item ${!statusFilter || !validStatuses.includes(statusFilter) ? 'th-dropdown-item--active' : ''}`}
                        onClick={() => {
                          setSearchParams({})
                          setStatusDropdownOpen(false)
                        }}
                      >
                        All
                      </button>
                      {validStatuses
                        .filter((s) => s !== 'archived')
                        .map((s) => (
                          <button
                            key={s}
                            type="button"
                            role="menuitem"
                            className={`th-dropdown-item ${statusFilter === s ? 'th-dropdown-item--active' : ''}`}
                            onClick={() => {
                              setSearchParams({ status: s })
                              setStatusDropdownOpen(false)
                            }}
                          >
                            {PROPERTY_STATUS_LABELS[s]}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </th>
              <th className={`th-filter th-sortable col-leads ${sortBy === 'leads' ? 'th--sorted' : ''}`}>
                <button type="button" className="th-sort-btn" onClick={() => handleSort('leads')} aria-label="Sort by leads">
                  <span className="th-label">Leads</span>
                  <span className="th-sort-icon">
                    {sortBy === 'leads' ? (
                      sortDir === 'asc' ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />
                    ) : (
                      <>
                        <HiOutlineChevronUp />
                        <HiOutlineChevronDown />
                      </>
                    )}
                  </span>
                </button>
              </th>
              <th className={`th-filter th-sortable col-updated ${sortBy === 'updated' ? 'th--sorted' : ''}`}>
                <button type="button" className="th-sort-btn" onClick={() => handleSort('updated')} aria-label="Sort by updated date">
                  <span className="th-label">Updated</span>
                  <span className="th-sort-icon">
                    {sortBy === 'updated' ? (
                      sortDir === 'asc' ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />
                    ) : (
                      <>
                        <HiOutlineChevronUp />
                        <HiOutlineChevronDown />
                      </>
                    )}
                  </span>
                </button>
              </th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="admin-empty-cell">
                  Loading properties…
                </td>
              </tr>
            ) : displayedProperties.length === 0 ? (
              <tr>
                <td colSpan={9} className="admin-empty-cell">
                  No properties match your filters.
                </td>
              </tr>
            ) : (
              displayedProperties.map((p) => {
                const thumb = resolveStorageUrl(p.image)
                return (
                  <tr key={p.id}>
                    <td className="col-photo">
                      {thumb ? (
                        <img src={thumb} alt="" className="admin-property-thumb" loading="lazy" />
                      ) : (
                        <span className="admin-property-thumb-placeholder" aria-hidden />
                      )}
                    </td>
                    <td className="col-title">{p.title}</td>
                    <td className="col-location">{p.location}</td>
                    <td className="col-price">{p.price}</td>
                    <td className="col-type">{p.type}</td>
                    <td className="col-status">
                      <span className={`admin-badge admin-badge--${p.status}`} title={getPropertyStatusDescription(p.status)}>
                        {PROPERTY_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="col-leads">{p.leads ?? 0}</td>
                    <td className="col-updated">{formatDate(p.updatedAt ?? '')}</td>
                    <td className="col-actions">
                      <Link
                        to={`/admin/properties/${p.id}`}
                        className="btn-icon-btn"
                        title="View property profile"
                        aria-label="View property profile"
                      >
                        <HiOutlineEye />
                      </Link>
                      <button
                        type="button"
                        className="btn-icon-btn"
                        title="Edit property"
                        aria-label="Edit property"
                        onClick={() => openEdit(p)}
                      >
                        <HiOutlinePencil />
                      </button>
                      <button
                        type="button"
                        className="btn-icon-btn btn-icon-btn--danger"
                        title="Archive property"
                        aria-label="Archive property"
                        onClick={() => deleteProperty(p.id)}
                      >
                        <HiOutlineArchive />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {(editing || showAdd) && (
        <PropertyFormModal
          key={editing?.id ?? (showAdd ? 'add-new' : 'closed')}
          form={form}
          setForm={setForm}
          onSave={saveProperty}
          onClose={closeForm}
          isEdit={!!editing}
          propertyCodeDisplay={propertyCodeDisplay}
          primaryDisabled={savingProperty}
          uploadProgress={uploadProgress}
        />
      )}

      {archiveModalProperty && (
        <div
          className="admin-modal-overlay"
          onClick={() => setArchiveModalProperty(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="property-archive-modal-title"
        >
          <div
            className="admin-modal archive-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h2 id="property-archive-modal-title">Archive property</h2>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setArchiveModalProperty(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="archive-warning">
                <p className="archive-warning-title">⚠️ Confirmation</p>
                <p>
                  You are about to archive <strong>{archiveModalProperty.title}</strong>.
                </p>
              </div>
              <div className="admin-form-row">
                <label htmlFor="property-archive-reason">
                  Reason for archiving <span className="required">*</span>
                </label>
                <textarea
                  id="property-archive-reason"
                  className="admin-input"
                  value={archiveReason}
                  onChange={(e) => {
                    setArchiveReason(e.target.value)
                    setArchiveError('')
                  }}
                  placeholder="e.g. Listing withdrawn, sold elsewhere, duplicate"
                  rows={3}
                  required
                />
              </div>
              {archiveError && <p className="form-error">{archiveError}</p>}
              <div className="archive-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={confirmArchiveProperty}
                >
                  Archive property
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setArchiveModalProperty(null)}
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
