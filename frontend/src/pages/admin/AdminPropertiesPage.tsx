import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import {
  HiOutlineArchive,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineEye,
  HiOutlineMenu,
  HiOutlinePencil,
} from 'react-icons/hi'
import { logActivity } from '../../data/activityLog'
import { PROPERTY_TYPES } from '../../data/properties'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import {
  fetchProperties,
  getNextPropertyCode,
  getPropertyById,
  getPropertyStatusDescription,
  logPropertyActivity,
  PROPERTY_STATUS_LABELS,
  savePropertyStore,
  type Property,
  type PropertyStatus,
  type PropertyType,
} from '../../services/propertiesService'
import {
  deletePropertyFromApi,
  persistPropertyToApi,
  type PropertyImageUpload,
} from '../../services/propertiesApi'
import { resolveStorageUrl } from '../../utils/mediaUrl'
import {
  getAdminPropertyCatalog,
  getPropertyUnitLocation,
  getPropertyUnits,
  isPropertyUnitRecord,
  type PropertyCatalogItem,
} from '../../utils/propertyGrouping'
import PropertyFormModal from './PropertyFormModal'
import PropertyUnitFormModal from './PropertyUnitFormModal'
import './admin-common.css'
import './AdminProperties.css'

const EMPTY_UPLOAD: PropertyImageUpload = {
  coverFile: null,
  galleryFiles: [],
  floorPlanFile: null,
  documentContractFile: null,
  documentReservationFormFile: null,
  documentTitleCopyFile: null,
}

const VALID_STATUSES: PropertyStatus[] = [
  'draft',
  'available',
  'reserved',
  'under_negotiation',
  'processing_docs',
  'sold',
  'cancelled',
  'archived',
]

type SortCol = 'title' | 'location' | 'price' | 'leads' | 'updated'

function parsePriceValue(priceStr: string): number {
  if (!priceStr || typeof priceStr !== 'string') return 0
  const cleaned = priceStr.replace(/[^\d.\sM]/gi, '').trim()
  const shortMillions = cleaned.match(/^([\d.]+)\s*M$/i)
  if (shortMillions) return parseFloat(shortMillions[1]) * 1_000_000
  return parseFloat(cleaned) || 0
}

function formatDate(dateValue: string): string {
  if (!dateValue) return '-'
  const [year, month, day] = dateValue.split('-')
  if (!year || !month || !day) return '-'
  return `${month.padStart(2, '0')}-${day.padStart(2, '0')}-${year}`
}

function buildUnitDisplayLocation(form: Partial<Property>, fallbackLocation: string): string {
  const custom = String(form.location ?? '').trim()
  if (custom) return custom

  const structured = [
    form.phase ? `Phase ${String(form.phase).trim()}` : '',
    form.block ? `Block ${String(form.block).trim()}` : '',
    form.lot ? `Lot ${String(form.lot).trim()}` : '',
  ].filter(Boolean)

  if (structured.length > 0) return structured.join(', ')
  return fallbackLocation
}

function buildUnitListingLabel(unit: Property, parent?: Property | null): string {
  if (!parent && !unit.parentPropertyId) return unit.title
  const unitLocation = getPropertyUnitLocation(unit)
  return parent ? `${parent.title} - ${unitLocation}` : unitLocation
}

function buildSearchableText(item: PropertyCatalogItem): string {
  const unitDetails = item.units
    .map((unit) =>
      [
        unit.propertyCode,
        unit.unitLabel,
        unit.phase,
        unit.block,
        unit.lot,
        unit.location,
        unit.address,
        unit.price,
        unit.status,
        String(unit.leads ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
    )
    .join(' ')

  return [
    item.rootProperty.title,
    item.rootProperty.propertyCode,
    item.rootProperty.developer,
    item.rootProperty.yearBuilt,
    item.rootProperty.address,
    item.rootProperty.city,
    item.rootProperty.province,
    item.displayProperty.location,
    item.displayProperty.price,
    item.displayProperty.status,
    item.summaryNote,
    unitDetails,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function buildUnitRecord(parentProperty: Property, form: Partial<Property>, existing?: Property | null): Property {
  const updatedAt = new Date().toISOString().slice(0, 10)
  const propertyCode = String(form.propertyCode ?? existing?.propertyCode ?? getNextPropertyCode())
  const nextLocation = buildUnitDisplayLocation(form, existing?.location ?? parentProperty.location)

  return {
    ...existing,
    ...form,
    // Use the pre-assigned property code as the DB primary key so id and
    // propertyCode stay in sync. Fall back to timestamp if no code was set.
    id: existing?.id ?? String(form.propertyCode ?? Date.now()),
    title: parentProperty.title,
    location: nextLocation,
    price: String(form.price ?? existing?.price ?? parentProperty.price ?? '').trim() || 'P0',
    image: existing?.image ?? parentProperty.image ?? '',
    status: (form.status as PropertyStatus | undefined) ?? existing?.status ?? 'available',
    type: parentProperty.type,
    beds: form.beds ?? existing?.beds ?? parentProperty.beds ?? 0,
    baths: form.baths ?? existing?.baths ?? parentProperty.baths ?? 0,
    area: String(form.area ?? existing?.area ?? parentProperty.area ?? '').trim(),
    leads: existing?.leads ?? 0,
    updatedAt,
    propertyCode,
    isPropertyGroup: false,
    parentPropertyId: parentProperty.id,
    unitLabel: String(form.unitLabel ?? existing?.unitLabel ?? '').trim() || undefined,
    phase: String(form.phase ?? existing?.phase ?? '').trim() || undefined,
    block: String(form.block ?? existing?.block ?? '').trim() || undefined,
    lot: String(form.lot ?? existing?.lot ?? '').trim() || undefined,
    address: String(form.address ?? existing?.address ?? '').trim() || undefined,
    city: parentProperty.city,
    province: parentProperty.province,
    developer: parentProperty.developer,
    yearBuilt: parentProperty.yearBuilt,
    floorArea: String(form.floorArea ?? existing?.floorArea ?? parentProperty.floorArea ?? '').trim(),
    lotArea: String(form.lotArea ?? existing?.lotArea ?? parentProperty.lotArea ?? '').trim(),
    parking: form.parking ?? existing?.parking ?? parentProperty.parking ?? 0,
    furnished: form.furnished ?? existing?.furnished ?? parentProperty.furnished,
    publicDescription: parentProperty.publicDescription,
    paymentOptions: parentProperty.paymentOptions,
    downpayment: String(form.downpayment ?? existing?.downpayment ?? parentProperty.downpayment ?? '').trim(),
    monthlyEst: String(form.monthlyEst ?? existing?.monthlyEst ?? parentProperty.monthlyEst ?? '').trim(),
    negotiable: form.negotiable ?? existing?.negotiable ?? parentProperty.negotiable,
    mortgageInterestRate: parentProperty.mortgageInterestRate,
    showOnWebsite: parentProperty.showOnWebsite !== false,
    featuredListing: false,
    archived: false,
  }
}

export default function AdminPropertiesPage() {
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
  const [sortBy, setSortBy] = useState<SortCol | ''>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [searchQuery, setSearchQuery] = useState('')
  const [properties, setProperties] = useState<Property[]>(() =>
    fetchProperties().filter((property) => !property.archived)
  )
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Property | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<Partial<Property>>({})
  const [editingUnit, setEditingUnit] = useState<Property | null>(null)
  const [unitParent, setUnitParent] = useState<Property | null>(null)
  const [unitForm, setUnitForm] = useState<Partial<Property>>({})
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([])
  const [archiveModalProperty, setArchiveModalProperty] = useState<Property | null>(null)
  const [archiveReason, setArchiveReason] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [savingProperty, setSavingProperty] = useState(false)
  const [savingUnit, setSavingUnit] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const catalogItems = useMemo(() => getAdminPropertyCatalog(properties), [properties])

  useEffect(() => {
    setProperties(fetchProperties().filter((property) => !property.archived))
    setLoading(false)
  }, [])

  useEffect(() => {
    const editId = (location.state as { editId?: string } | null)?.editId
    if (!editId) return

    const property = getPropertyById(editId)
    if (property && !property.archived) {
      if (isPropertyUnitRecord(property) && property.parentPropertyId) {
        const parent = getPropertyById(property.parentPropertyId)
        if (parent && !parent.archived) {
          setUnitParent(parent)
          setEditingUnit(property)
          setUnitForm({ ...property })
          setExpandedGroupIds((prev) => (prev.includes(parent.id) ? prev : [...prev, parent.id]))
        }
      } else {
        setForm({ ...property })
        setEditing(property)
        setShowAdd(false)
      }
    }

    navigate('/admin/properties', { replace: true, state: {} })
  }, [location.state, navigate])

  useEffect(() => {
    const propertyIdFromQuery = searchParams.get('propertyId')
    if (!propertyIdFromQuery) return

    const property = getPropertyById(propertyIdFromQuery)
    if (!property || property.archived || isPropertyUnitRecord(property)) return
    setForm({ ...property })
    setEditing(property)
    setShowAdd(false)
  }, [searchParams])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
        setStatusDropdownOpen(false)
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(target)) {
        setTypeDropdownOpen(false)
      }
    }

    if (!statusDropdownOpen && !typeDropdownOpen) return
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [statusDropdownOpen, typeDropdownOpen])

  const displayedProperties = useMemo(() => {
    let list = catalogItems

    if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
      list = list.filter(
        (item) =>
          item.displayProperty.status === statusFilter ||
          item.units.some((unit) => unit.status === statusFilter)
      )
    }

    if (typeFilter && typeFilter !== 'all') {
      list = list.filter((item) => item.displayProperty.type === typeFilter)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      list = list.filter((item) => buildSearchableText(item).includes(query))
    }

    const sorted = [...list]

    if (sortBy === 'price') {
      sorted.sort((a, b) => {
        const cmp = parsePriceValue(a.displayProperty.price) - parsePriceValue(b.displayProperty.price)
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else if (sortBy === 'title') {
      sorted.sort((a, b) => {
        const cmp = (a.displayProperty.title ?? '').localeCompare(b.displayProperty.title ?? '')
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else if (sortBy === 'location') {
      sorted.sort((a, b) => {
        const cmp = (a.displayProperty.location ?? '').localeCompare(b.displayProperty.location ?? '')
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else if (sortBy === 'leads') {
      sorted.sort((a, b) => {
        const cmp = (a.displayProperty.leads ?? 0) - (b.displayProperty.leads ?? 0)
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else if (sortBy === 'updated') {
      sorted.sort((a, b) => {
        const cmp = (a.displayProperty.updatedAt ?? '').localeCompare(b.displayProperty.updatedAt ?? '')
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else {
      sorted.sort((a, b) => {
        const left = new Date(a.displayProperty.updatedAt || 0).getTime()
        const right = new Date(b.displayProperty.updatedAt || 0).getTime()
        return right - left
      })
    }

    return sorted
  }, [catalogItems, searchQuery, sortBy, sortDir, statusFilter, typeFilter])

  function handleSort(column: SortCol) {
    if (sortBy !== column) {
      setSortBy(column)
      setSortDir('asc')
      return
    }
    if (sortDir === 'asc') {
      setSortDir('desc')
      return
    }
    setSortBy('')
    setSortDir('asc')
  }

  function openArchiveModal(property: Property) {
    setArchiveModalProperty(property)
    setArchiveReason('')
    setArchiveError('')
  }

  async function confirmArchiveProperty() {
    if (!archiveModalProperty) return

    const reason = archiveReason.trim()
    if (!reason) {
      setArchiveError('Please provide a reason for archiving.')
      return
    }

    const childIds = archiveModalProperty.parentPropertyId
      ? []
      : getPropertyUnits(properties, archiveModalProperty.id).map((unit) => unit.id)
    const idsToRemove = new Set([archiveModalProperty.id, ...childIds])

    try {
      await deletePropertyFromApi(archiveModalProperty.id)
      const next = savePropertyStore((prev) => prev.filter((property) => !idsToRemove.has(property.id)))
      setProperties(next.filter((property) => !property.archived))
      setExpandedGroupIds((prev) => prev.filter((groupId) => groupId !== archiveModalProperty.id))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not archive on server.'
      setArchiveError(message)
      Swal.fire({ icon: 'error', title: 'Archive failed', text: message })
      return
    }

    const parent = archiveModalProperty.parentPropertyId
      ? properties.find((property) => property.id === archiveModalProperty.parentPropertyId)
      : null
    const targetLabel = buildUnitListingLabel(archiveModalProperty, parent)

    logPropertyActivity({
      actor,
      action: 'archived',
      entityType: 'property',
      entityId: archiveModalProperty.id,
      entityLabel: targetLabel,
      details: `Archived listing ${targetLabel}. Reason: ${reason}`,
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

  async function saveProperty(upload: PropertyImageUpload = EMPTY_UPLOAD) {
    const updatedAt = new Date().toISOString().slice(0, 10)
    const nowIso = new Date().toISOString()
    const hasFileUpload = !!(
      upload.coverFile ||
      upload.galleryFiles.length > 0 ||
      upload.floorPlanFile ||
      upload.documentContractFile ||
      upload.documentReservationFormFile ||
      upload.documentTitleCopyFile
    )

    if (editing && form.id) {
      const prev = fetchProperties().find((property) => property.id === form.id)
      const effectivePrice = (form.promoPrice ?? '').trim() || (form.price ?? '')
      const priceChanged =
        !!prev &&
        ((form.price ?? '') !== (prev.price ?? '') ||
          (form.promoPrice ?? '') !== (prev.promoPrice ?? ''))
      const nextHistory =
        priceChanged && effectivePrice
          ? [...(prev?.priceHistory ?? []), { price: effectivePrice, at: nowIso }]
          : (form.priceHistory ?? prev?.priceHistory ?? [])
      const hasChildUnits = properties.some((property) => property.parentPropertyId === form.id)
      const merged = {
        ...prev,
        ...form,
        updatedAt,
        leads: prev?.leads ?? 0,
        priceHistory: nextHistory,
        isPropertyGroup: hasChildUnits ? true : form.isPropertyGroup,
      } as Property

      setSavingProperty(true)
      if (hasFileUpload) setUploadProgress(0)

      try {
        const saved = await persistPropertyToApi(
          merged,
          upload,
          hasFileUpload ? (ratio) => setUploadProgress(ratio) : undefined
        )
        const next = savePropertyStore((prevStore) =>
          prevStore.map((property) => (property.id === form.id ? saved : property))
        )
        setProperties(next.filter((property) => !property.archived))
        setEditing(null)
        setForm({})

        const logUpdate = (details: string) =>
          logPropertyActivity({
            actor,
            action: 'updated',
            entityType: 'property',
            entityId: form.id ?? null,
            entityLabel: saved.title,
            details,
          })

        if (priceChanged) logUpdate('Price changed')
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
        if (!priceChanged && !(prev && form.status !== prev.status)) {
          logUpdate('Updated')
        }

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
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save property.'
        Swal.fire({ icon: 'error', title: 'Save failed', text: message })
      } finally {
        setSavingProperty(false)
        setUploadProgress(null)
      }
      return
    }

    if (showAdd && form.title) {
      const effectivePrice = (form.promoPrice ?? '').trim() || (form.price ?? '')
      const newProperty = {
        ...form,
        // Use the pre-assigned property code as the DB primary key so id and
        // propertyCode stay in sync (CHR-YEAR-NNNNNN). Fall back to timestamp
        // only if somehow no code was set.
        id: String(form.propertyCode ?? Date.now()),
        updatedAt,
        leads: 0,
        isPropertyGroup: form.isPropertyGroup === true,
        priceHistory: effectivePrice ? [{ price: effectivePrice, at: nowIso }] : [],
      } as Property

      setSavingProperty(true)
      if (hasFileUpload) setUploadProgress(0)

      try {
        const saved = await persistPropertyToApi(
          newProperty,
          upload,
          hasFileUpload ? (ratio) => setUploadProgress(ratio) : undefined
        )
        const next = savePropertyStore((prev) => [...prev, saved])
        setProperties(next.filter((property) => !property.archived))
        setShowAdd(false)
        setForm({})

        logActivity({
          actor,
          action: 'created',
          entityType: 'property',
          entityId: saved.id,
          entityLabel: saved.title,
          details: saved.isPropertyGroup ? 'New grouped property added' : 'New property added',
        })

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
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save property.'
        Swal.fire({ icon: 'error', title: 'Save failed', text: message })
      } finally {
        setSavingProperty(false)
        setUploadProgress(null)
      }
      return
    }

    setForm({})
  }

  async function saveUnit() {
    if (!unitParent) return

    const nextUnit = buildUnitRecord(unitParent, unitForm, editingUnit)
    setSavingUnit(true)

    try {
      const saved = await persistPropertyToApi(nextUnit, EMPTY_UPLOAD)
      const next = savePropertyStore((prev) => {
        if (editingUnit) {
          return prev.map((property) => (property.id === saved.id ? saved : property))
        }
        return [...prev, saved]
      })
      setProperties(next.filter((property) => !property.archived))
      setExpandedGroupIds((prev) => (prev.includes(unitParent.id) ? prev : [...prev, unitParent.id]))

      logPropertyActivity({
        actor,
        action: editingUnit ? 'updated' : 'created',
        entityType: 'property',
        entityId: saved.id,
        entityLabel: buildUnitListingLabel(saved, unitParent),
        details: editingUnit ? 'Unit updated' : 'Unit added',
      })

      closeUnitForm()

      window.setTimeout(() => {
        void Swal.fire({
          icon: 'success',
          title: editingUnit ? 'Unit updated' : 'Unit added',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2500,
          timerProgressBar: true,
        })
      }, 0)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save unit.'
      Swal.fire({ icon: 'error', title: 'Save failed', text: message })
    } finally {
      setSavingUnit(false)
    }
  }

  function deleteProperty(id: string) {
    const property = fetchProperties().find((item) => item.id === id)
    if (property) openArchiveModal(property)
  }

  function openEdit(property: Property) {
    setForm({ ...property })
    setEditing(property)
    setShowAdd(false)
  }

  function openAddUnitFromParentEdit() {
    if (!editing?.id) return
    const persistedParent = getPropertyById(editing.id)
    const parentProperty = {
      ...persistedParent,
      ...editing,
      ...form,
      id: editing.id,
    } as Property
    closeForm()
    openAddUnit(parentProperty)
  }

  function openAdd() {
    setForm({
      status: 'draft',
      type: 'House',
      beds: 0,
      baths: 0,
      updatedAt: new Date().toISOString().slice(0, 10),
      showOnWebsite: true,
      propertyCode: getNextPropertyCode(),
      mortgageInterestRate: 6.5,
      isPropertyGroup: false,
    })
    setShowAdd(true)
    setEditing(null)
  }

  function openAddUnit(parentProperty: Property) {
    setUnitParent(parentProperty)
    setEditingUnit(null)
    setUnitForm({
      propertyCode: getNextPropertyCode(),
      parentPropertyId: parentProperty.id,
      price: parentProperty.price,
      status: 'available',
      location: parentProperty.location,
    })
  }

  function openEditUnit(parentProperty: Property, unitProperty: Property) {
    setUnitParent(parentProperty)
    setEditingUnit(unitProperty)
    setUnitForm({ ...unitProperty })
  }

  function closeForm() {
    setEditing(null)
    setShowAdd(false)
    setForm({})
  }

  function closeUnitForm() {
    setEditingUnit(null)
    setUnitParent(null)
    setUnitForm({})
  }

  function toggleExpandedGroup(groupId: string) {
    setExpandedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    )
  }

  const propertyCodeDisplay = form.id
    ? (form.propertyCode ?? form.id)
    : (form.propertyCode ?? '(auto on save)')

  const unitPropertyCodeDisplay = unitForm.id
    ? (unitForm.propertyCode ?? unitForm.id)
    : (unitForm.propertyCode ?? '(auto on save)')

  return (
    <div className="admin-properties">
      <h1 className="admin-page-title">Property Management</h1>
      <p className="admin-page-subtitle">Manage property listings, codes, status, and grouped units.</p>

      <div className="admin-toolbar">
        <input
          type="search"
          className="admin-input admin-properties-search"
          placeholder="Search properties..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          aria-label="Search properties"
        />
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          Add Property
        </button>
        {statusFilter && VALID_STATUSES.includes(statusFilter) && (
          <span className="admin-filter-chip">
            Status: {PROPERTY_STATUS_LABELS[statusFilter]}
            <button
              type="button"
              className="admin-filter-chip-clear"
              onClick={() => setSearchParams({})}
              aria-label="Clear status filter"
            >
              x
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
              x
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
                  <button type="button" className="th-label-btn" onClick={() => setTypeDropdownOpen((open) => !open)} aria-label="Filter by type" aria-expanded={typeDropdownOpen}>
                    <span className="th-label">Type</span>
                  </button>
                  <button
                    type="button"
                    className={`th-dropdown-trigger ${typeDropdownOpen ? 'th-dropdown-trigger--open' : ''}`}
                    onClick={() => setTypeDropdownOpen((open) => !open)}
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
                      {PROPERTY_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          role="menuitem"
                          className={`th-dropdown-item ${typeFilter === type ? 'th-dropdown-item--active' : ''}`}
                          onClick={() => {
                            setTypeFilter(type)
                            setTypeDropdownOpen(false)
                          }}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </th>
              <th className="th-filter col-status">
                <div className="th-status-wrap" ref={statusDropdownRef}>
                  <button type="button" className="th-label-btn" onClick={() => setStatusDropdownOpen((open) => !open)} aria-label="Filter by status" aria-expanded={statusDropdownOpen}>
                    <span className="th-label">Status</span>
                  </button>
                  <button
                    type="button"
                    className={`th-dropdown-trigger ${statusDropdownOpen ? 'th-dropdown-trigger--open' : ''}`}
                    onClick={() => setStatusDropdownOpen((open) => !open)}
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
                        className={`th-dropdown-item ${!statusFilter || !VALID_STATUSES.includes(statusFilter) ? 'th-dropdown-item--active' : ''}`}
                        onClick={() => {
                          setSearchParams({})
                          setStatusDropdownOpen(false)
                        }}
                      >
                        All
                      </button>
                      {VALID_STATUSES.filter((status) => status !== 'archived').map((status) => (
                        <button
                          key={status}
                          type="button"
                          role="menuitem"
                          className={`th-dropdown-item ${statusFilter === status ? 'th-dropdown-item--active' : ''}`}
                          onClick={() => {
                            setSearchParams({ status })
                            setStatusDropdownOpen(false)
                          }}
                        >
                          {PROPERTY_STATUS_LABELS[status]}
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
                <td colSpan={9} className="admin-empty-cell">Loading properties...</td>
              </tr>
            ) : displayedProperties.length === 0 ? (
              <tr>
                <td colSpan={9} className="admin-empty-cell">No properties match your filters.</td>
              </tr>
            ) : (
              displayedProperties.map((item) => {
                const property = item.displayProperty
                const thumb = resolveStorageUrl(property.image)
                const expanded = expandedGroupIds.includes(item.rootProperty.id)

                return (
                  <Fragment key={item.rootProperty.id}>
                    <tr
                      className={item.isGrouped ? 'admin-group-row' : ''}
                      onClick={() => {
                        if (item.isGrouped) toggleExpandedGroup(item.rootProperty.id)
                      }}
                    >
                      <td className="col-photo">
                        {thumb ? (
                          <img src={thumb} alt="" className="admin-property-thumb" loading="lazy" />
                        ) : (
                          <span className="admin-property-thumb-placeholder" aria-hidden />
                        )}
                      </td>
                      <td className="col-title">
                        {item.isGrouped ? (
                          <button
                            type="button"
                            className="admin-group-row-trigger"
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleExpandedGroup(item.rootProperty.id)
                            }}
                            aria-expanded={expanded}
                          >
                            <span className="admin-group-row-chevron" aria-hidden>
                              {expanded ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />}
                            </span>
                            <span className="admin-group-row-copy">
                              <span className="admin-group-row-title">{property.title}</span>
                              <span className="admin-group-row-note">
                                {item.summaryNote ?? `${item.totalUnits} unit${item.totalUnits === 1 ? '' : 's'}`}
                              </span>
                            </span>
                          </button>
                        ) : (
                          property.title
                        )}
                      </td>
                      <td className="col-location">{property.location}</td>
                      <td className="col-price">{property.price}</td>
                      <td className="col-type">{property.type}</td>
                      <td className="col-status">
                        <span className={`admin-badge admin-badge--${property.status}`} title={getPropertyStatusDescription(property.status)}>
                          {PROPERTY_STATUS_LABELS[property.status]}
                        </span>
                      </td>
                      <td className="col-leads">{property.leads ?? 0}</td>
                      <td className="col-updated">{formatDate(property.updatedAt ?? '')}</td>
                      <td className="col-actions" onClick={(event) => event.stopPropagation()}>
                        <Link
                          to={`/admin/properties/${item.rootProperty.id}`}
                          className="btn-icon-btn"
                          title="View property profile"
                          aria-label="View property profile"
                        >
                          <HiOutlineEye />
                        </Link>
                        <button type="button" className="btn-icon-btn" title="Edit property" aria-label="Edit property" onClick={() => openEdit(item.rootProperty)}>
                          <HiOutlinePencil />
                        </button>
                        <button type="button" className="btn-icon-btn btn-icon-btn--danger" title="Archive property" aria-label="Archive property" onClick={() => deleteProperty(item.rootProperty.id)}>
                          <HiOutlineArchive />
                        </button>
                      </td>
                    </tr>
                    {item.isGrouped && expanded ? (
                      <tr className="admin-group-row-details">
                        <td colSpan={9}>
                          <div className="admin-group-units-panel" onClick={(event) => event.stopPropagation()}>
                            {item.units.length === 0 ? (
                              <p className="admin-group-units-empty">
                                No units added yet. Add the first unit to start tracking block, lot, price, and status separately.
                              </p>
                            ) : (
                              <div className="admin-group-units-table-wrap">
                                <table className="admin-group-units-table">
                                  <thead>
                                    <tr>
                                      <th>Location</th>
                                      <th>Price</th>
                                      <th>Status</th>
                                      <th>Leads</th>
                                      <th>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {item.units.map((unit) => (
                                      <tr key={unit.id}>
                                        <td>{getPropertyUnitLocation(unit)}</td>
                                        <td>{unit.price}</td>
                                        <td>
                                          <span className={`admin-badge admin-badge--${unit.status}`}>
                                            {PROPERTY_STATUS_LABELS[unit.status]}
                                          </span>
                                        </td>
                                        <td>{unit.leads ?? 0}</td>
                                        <td className="col-actions">
                                          <button type="button" className="btn-icon-btn" title="Edit unit" aria-label="Edit unit" onClick={() => openEditUnit(item.rootProperty, unit)}>
                                            <HiOutlinePencil />
                                          </button>
                                          <button type="button" className="btn-icon-btn btn-icon-btn--danger" title="Archive unit" aria-label="Archive unit" onClick={() => deleteProperty(unit.id)}>
                                            <HiOutlineArchive />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
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
          onAddUnit={editing && form.isPropertyGroup === true ? openAddUnitFromParentEdit : null}
          onClose={closeForm}
          isEdit={!!editing}
          propertyCodeDisplay={propertyCodeDisplay}
          primaryDisabled={savingProperty}
          uploadProgress={uploadProgress}
        />
      )}

      {unitParent && (
        <PropertyUnitFormModal
          key={editingUnit?.id ?? 'add-unit'}
          parentProperty={unitParent}
          form={unitForm}
          setForm={setUnitForm}
          onSave={saveUnit}
          onClose={closeUnitForm}
          isEdit={!!editingUnit}
          propertyCodeDisplay={unitPropertyCodeDisplay}
          primaryDisabled={savingUnit}
        />
      )}

      {archiveModalProperty && (
        <div className="admin-modal-overlay" onClick={() => setArchiveModalProperty(null)} role="dialog" aria-modal="true" aria-labelledby="property-archive-modal-title">
          <div className="admin-modal archive-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 id="property-archive-modal-title">Archive listing</h2>
              <button type="button" className="admin-modal-close" onClick={() => setArchiveModalProperty(null)} aria-label="Close">
                x
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="archive-warning">
                <p className="archive-warning-title">Confirmation</p>
                <p>
                  You are about to archive{' '}
                  <strong>
                    {buildUnitListingLabel(
                      archiveModalProperty,
                      archiveModalProperty.parentPropertyId
                        ? properties.find((property) => property.id === archiveModalProperty.parentPropertyId) ?? null
                        : null
                    )}
                  </strong>.
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
                  onChange={(event) => {
                    setArchiveReason(event.target.value)
                    setArchiveError('')
                  }}
                  placeholder="e.g. Listing withdrawn, sold elsewhere, duplicate"
                  rows={3}
                  required
                />
              </div>
              {archiveError && <p className="form-error">{archiveError}</p>}
              <div className="archive-actions">
                <button type="button" className="btn btn-primary" onClick={confirmArchiveProperty}>Archive listing</button>
                <button type="button" className="btn btn-outline" onClick={() => setArchiveModalProperty(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
