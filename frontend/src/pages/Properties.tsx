import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PropertyCard from '../components/PropertyCard'
import { parsePesoAmount } from '../data/deals'
import { PROPERTY_TYPES, type PropertyStatus, type PropertyType } from '../data/properties'
import { trackEvent } from '../services/analyticsService'
import { fetchProperties } from '../services/propertiesService'
import { getPublicPropertyCatalog } from '../utils/propertyGrouping'
import './Properties.css'

const CLIENT_STATUS_OPTIONS: Array<{ value: PropertyStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All listings' },
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'under_negotiation', label: 'Under Negotiation' },
  { value: 'processing_docs', label: 'Processing Docs' },
  { value: 'sold', label: 'Sold' },
]

type SortOption = 'newest' | 'price-asc' | 'price-desc'

export default function Properties() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSearch = searchParams.get('q') ?? ''
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(initialSearch)
  const [typeFilter, setTypeFilter] = useState<PropertyType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | 'all'>('all')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')

  const catalogItems = useMemo(() => getPublicPropertyCatalog(fetchProperties()), [])

  // Sync: ensure search state matches URL ?q=
  const qFromUrl = searchParams.get('q') ?? ''
  const [prevQ, setPrevQ] = useState(qFromUrl)
  if (qFromUrl !== prevQ) {
    setPrevQ(qFromUrl)
    setSearch(qFromUrl)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 120)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!loading) trackEvent('page_view', { page: 'properties' })
  }, [loading])

  const filteredSorted = useMemo(() => {
    let list = catalogItems

    if (statusFilter === 'all') {
      list = list.filter((item) => item.displayProperty.status !== 'cancelled')
    } else {
      list = list.filter(
        (item) =>
          item.displayProperty.status === statusFilter ||
          item.publicUnits.some((unit) => unit.status === statusFilter)
      )
    }

    if (typeFilter !== 'all') {
      list = list.filter((item) => item.displayProperty.type === typeFilter)
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase()
      list = list.filter((item) =>
        [
          item.displayProperty.title,
          item.displayProperty.location,
          item.displayProperty.type,
          item.summaryNote,
          ...item.publicUnits.map((unit) => unit.location),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    }

    const minValue = priceMin.trim() ? parsePesoAmount(priceMin) : null
    const maxValue = priceMax.trim() ? parsePesoAmount(priceMax) : null
    if (minValue != null || maxValue != null) {
      list = list.filter((item) => {
        const value = parsePesoAmount(item.displayProperty.price)
        if (value == null) return false
        if (minValue != null && value < minValue) return false
        if (maxValue != null && value > maxValue) return false
        return true
      })
    }

    const sorted = [...list]
    if (sortBy === 'newest') {
      sorted.sort(
        (a, b) =>
          new Date(b.displayProperty.updatedAt).getTime() - new Date(a.displayProperty.updatedAt).getTime()
      )
    } else if (sortBy === 'price-asc') {
      sorted.sort(
        (a, b) =>
          (parsePesoAmount(a.displayProperty.price) ?? 0) - (parsePesoAmount(b.displayProperty.price) ?? 0)
      )
    } else {
      sorted.sort(
        (a, b) =>
          (parsePesoAmount(b.displayProperty.price) ?? 0) - (parsePesoAmount(a.displayProperty.price) ?? 0)
      )
    }

    return sorted
  }, [catalogItems, priceMax, priceMin, search, sortBy, statusFilter, typeFilter])

  function syncQueryToUrl(nextSearch: string) {
    const params = new URLSearchParams(searchParams)
    if (nextSearch.trim()) params.set('q', nextSearch.trim())
    else params.delete('q')
    setSearchParams(params, { replace: true })
  }

  if (loading) {
    return (
      <div className="properties-page">
        <div className="container section">
          <p className="client-page-loading">Loading properties...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="properties-page">
      <section className="page-hero">
        <div className="container">
          <h1 className="page-title">Properties</h1>
          <p className="page-subtitle">Houses and lots for sale. Browse listings and filter to match what you need.</p>
          <div className="properties-filters">
            <input
              type="search"
              className="properties-filter-input"
              placeholder="Search by title, location, type..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onBlur={() => syncQueryToUrl(search)}
              onKeyDown={(event) => event.key === 'Enter' && syncQueryToUrl(search)}
              aria-label="Search properties"
            />
            <select
              className="properties-filter-input"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as PropertyType | 'all')}
              aria-label="Filter property type"
            >
              <option value="all">All types</option>
              {PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <select
              className="properties-filter-input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as PropertyStatus | 'all')}
              aria-label="Filter status"
            >
              {CLIENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              type="text"
              className="properties-filter-input properties-filter-input--narrow"
              placeholder="Min price (e.g. 1000000)"
              value={priceMin}
              onChange={(event) => setPriceMin(event.target.value)}
              aria-label="Minimum price"
            />
            <input
              type="text"
              className="properties-filter-input properties-filter-input--narrow"
              placeholder="Max price (e.g. 5000000)"
              value={priceMax}
              onChange={(event) => setPriceMax(event.target.value)}
              aria-label="Maximum price"
            />
            <select
              className="properties-filter-input"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              aria-label="Sort properties"
            >
              <option value="newest">Newest updated</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </div>
        </div>
      </section>
      <section className="properties-list section">
        <div className="container">
          {filteredSorted.length === 0 ? (
            <p className="properties-empty">No properties match your search. Try adjusting filters.</p>
          ) : (
            <div className="property-grid property-grid--browse" role="list">
              {filteredSorted.map((item) => (
                <div key={item.rootProperty.id} className="property-grid__cell" role="listitem">
                  <PropertyCard property={item.displayProperty} metaNote={item.summaryNote} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
