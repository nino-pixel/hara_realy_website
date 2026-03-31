import { formatPesoAmount, parsePesoAmount } from '../data/deals'
import {
  isPropertyPublicListing,
  type Property,
  type PropertyStatus,
} from '../data/properties'

const STATUS_PRIORITY: PropertyStatus[] = [
  'available',
  'under_negotiation',
  'reserved',
  'processing_docs',
  'draft',
  'sold',
  'cancelled',
  'archived',
]

const UNIT_STATUS_SORT_ORDER: Record<PropertyStatus, number> = {
  available: 0,
  under_negotiation: 1,
  reserved: 2,
  processing_docs: 3,
  draft: 4,
  sold: 5,
  cancelled: 6,
  archived: 7,
}

export type PropertyCatalogItem = {
  rootProperty: Property
  displayProperty: Property
  units: Property[]
  publicUnits: Property[]
  isGrouped: boolean
  totalUnits: number
  availableUnits: number
  reservedUnits: number
  soldUnits: number
  summaryNote: string | null
}

function formatLocationPart(label: string, value?: string): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return `${label} ${trimmed}`
}

function parsePriceValue(price: string | undefined): number | null {
  const parsed = parsePesoAmount(price)
  return parsed != null && Number.isFinite(parsed) ? parsed : null
}

function getLatestTimestamp(...values: Array<string | undefined>): string {
  const valid = values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  return valid[0] ?? new Date().toISOString().slice(0, 10)
}

function summarizeStatuses(units: Property[]): {
  status: PropertyStatus
  availableUnits: number
  reservedUnits: number
  soldUnits: number
} {
  const counts = units.reduce<Record<PropertyStatus, number>>(
    (acc, unit) => {
      acc[unit.status] += 1
      return acc
    },
    {
      draft: 0,
      available: 0,
      reserved: 0,
      under_negotiation: 0,
      processing_docs: 0,
      sold: 0,
      cancelled: 0,
      archived: 0,
    }
  )

  const status =
    STATUS_PRIORITY.find((candidate) => counts[candidate] > 0) ??
    'draft'

  return {
    status,
    availableUnits: counts.available,
    reservedUnits: counts.reserved + counts.under_negotiation + counts.processing_docs,
    soldUnits: counts.sold,
  }
}

function buildSummaryNote(
  units: Property[],
  availableUnits: number,
  reservedUnits: number,
  soldUnits: number,
  priceValue: number | null,
  hasMultiplePrices: boolean
): string | null {
  if (units.length === 0) return 'No units added yet'

  const segments: string[] = []

  if (availableUnits > 0) {
    segments.push(`${availableUnits} unit${availableUnits === 1 ? '' : 's'} available`)
  } else if (soldUnits === units.length) {
    segments.push('Sold out')
  } else {
    segments.push(`${units.length} unit${units.length === 1 ? '' : 's'} listed`)
  }

  if (reservedUnits > 0) {
    segments.push(`${reservedUnits} reserved`)
  }

  if (hasMultiplePrices && priceValue != null) {
    segments.push(`Starts at ${formatPesoAmount(priceValue)}`)
  }

  return segments.join(' · ')
}

function buildDisplayProperty(
  rootProperty: Property,
  units: Property[],
  baseUnits: Property[]
): {
  displayProperty: Property
  availableUnits: number
  reservedUnits: number
  soldUnits: number
  summaryNote: string | null
} {
  if (units.length === 0) {
    return {
      displayProperty: { ...rootProperty },
      availableUnits: rootProperty.status === 'available' ? 1 : 0,
      reservedUnits:
        rootProperty.status === 'reserved' ||
        rootProperty.status === 'under_negotiation' ||
        rootProperty.status === 'processing_docs'
          ? 1
          : 0,
      soldUnits: rootProperty.status === 'sold' ? 1 : 0,
      summaryNote: rootProperty.isPropertyGroup ? 'No units added yet' : null,
    }
  }

  const statusSummary = summarizeStatuses(units)
  const priceValues = units
    .map((unit) => parsePriceValue(unit.price))
    .filter((value): value is number => value != null)
  const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : parsePriceValue(rootProperty.price)
  const uniquePrices = new Set(priceValues)
  const hasMultiplePrices = uniquePrices.size > 1
  const leads = units.reduce((sum, unit) => sum + (unit.leads ?? 0), rootProperty.leads ?? 0)
  const displayLocation =
    rootProperty.location?.trim() ||
    units.find((unit) => unit.location?.trim())?.location ||
    'Location on request'

  return {
    displayProperty: {
      ...rootProperty,
      status: statusSummary.status,
      price: minPrice != null ? formatPesoAmount(minPrice) : rootProperty.price,
      location: displayLocation,
      leads,
      updatedAt: getLatestTimestamp(
        rootProperty.updatedAt,
        ...baseUnits.map((unit) => unit.updatedAt)
      ),
    },
    availableUnits: statusSummary.availableUnits,
    reservedUnits: statusSummary.reservedUnits,
    soldUnits: statusSummary.soldUnits,
    summaryNote: buildSummaryNote(
      units,
      statusSummary.availableUnits,
      statusSummary.reservedUnits,
      statusSummary.soldUnits,
      minPrice,
      hasMultiplePrices
    ),
  }
}

function sortUnits(units: Property[]): Property[] {
  return [...units].sort((a, b) => {
    const statusCmp = UNIT_STATUS_SORT_ORDER[a.status] - UNIT_STATUS_SORT_ORDER[b.status]
    if (statusCmp !== 0) return statusCmp
    const locationCmp = getPropertyUnitLocation(a).localeCompare(getPropertyUnitLocation(b))
    if (locationCmp !== 0) return locationCmp
    return (a.propertyCode ?? a.id).localeCompare(b.propertyCode ?? b.id)
  })
}

export function isPropertyGroupRecord(property: Property): boolean {
  return property.isPropertyGroup === true
}

export function isPropertyUnitRecord(property: Property): boolean {
  return typeof property.parentPropertyId === 'string' && property.parentPropertyId.trim().length > 0
}

export function isTopLevelPropertyRecord(property: Property): boolean {
  return !isPropertyUnitRecord(property)
}

export function getPropertyUnits(allProperties: Property[], parentPropertyId: string): Property[] {
  return sortUnits(
    allProperties.filter(
      (property) =>
        !property.archived &&
        property.parentPropertyId === parentPropertyId
    )
  )
}

export function getPropertyUnitLabel(property: Property): string {
  const explicit = property.unitLabel?.trim()
  if (explicit) return explicit

  const structured = [
    formatLocationPart('Phase', property.phase),
    formatLocationPart('Block', property.block),
    formatLocationPart('Lot', property.lot),
  ].filter(Boolean)

  if (structured.length > 0) return structured.join(', ')

  return property.location?.trim() || property.propertyCode || property.id
}

export function getPropertyUnitLocation(property: Property): string {
  const structured = [
    formatLocationPart('Phase', property.phase),
    formatLocationPart('Block', property.block),
    formatLocationPart('Lot', property.lot),
  ].filter(Boolean) as string[]

  const explicitLabel = property.unitLabel?.trim()
  const displayLocation = property.location?.trim()

  if (explicitLabel && structured.length > 0) {
    return `${explicitLabel} · ${structured.join(', ')}`
  }
  if (explicitLabel) return explicitLabel
  if (structured.length > 0) {
    if (displayLocation && !structured.includes(displayLocation)) {
      return `${structured.join(', ')} · ${displayLocation}`
    }
    return structured.join(', ')
  }
  return displayLocation || property.address?.trim() || property.propertyCode || property.id
}

export function buildPropertyCatalogItem(
  rootProperty: Property,
  allProperties: Property[],
  options?: {
    publicOnlyUnits?: boolean
  }
): PropertyCatalogItem {
  const units = getPropertyUnits(allProperties, rootProperty.id)
  const publicUnits = units.filter((unit) => isPropertyPublicListing(unit))
  const visibleUnits = options?.publicOnlyUnits ? publicUnits : units
  const derived = buildDisplayProperty(rootProperty, visibleUnits, units)
  const isGrouped = isPropertyGroupRecord(rootProperty) || units.length > 0

  return {
    rootProperty,
    displayProperty: derived.displayProperty,
    units,
    publicUnits,
    isGrouped,
    totalUnits: units.length,
    availableUnits: derived.availableUnits,
    reservedUnits: derived.reservedUnits,
    soldUnits: derived.soldUnits,
    summaryNote: derived.summaryNote,
  }
}

export function getAdminPropertyCatalog(allProperties: Property[]): PropertyCatalogItem[] {
  return allProperties
    .filter((property) => !property.archived && isTopLevelPropertyRecord(property))
    .map((property) => buildPropertyCatalogItem(property, allProperties))
}

export function getPublicPropertyCatalog(allProperties: Property[]): PropertyCatalogItem[] {
  return allProperties
    .filter((property) => isTopLevelPropertyRecord(property))
    .filter((property) => {
      if (!isPropertyPublicListing(property)) return false
      const units = getPropertyUnits(allProperties, property.id)
      if (units.length === 0 && !isPropertyGroupRecord(property)) return true
      return units.some((unit) => isPropertyPublicListing(unit))
    })
    .map((property) => buildPropertyCatalogItem(property, allProperties, { publicOnlyUnits: true }))
}

export function getRootPropertyByAnyId(
  allProperties: Property[],
  propertyId: string | undefined | null
): Property | undefined {
  if (!propertyId) return undefined
  const exact = allProperties.find((property) => property.id === propertyId)
  if (!exact) return undefined
  if (!isPropertyUnitRecord(exact)) return exact
  return allProperties.find((property) => property.id === exact.parentPropertyId) ?? exact
}

export function resolveCatalogItemByPropertyId(
  allProperties: Property[],
  propertyId: string | undefined | null,
  options?: {
    publicOnlyUnits?: boolean
  }
): {
  item: PropertyCatalogItem
  selectedUnit: Property | null
} | null {
  if (!propertyId) return null
  const requested = allProperties.find((property) => property.id === propertyId)
  if (!requested) return null

  const root =
    requested.parentPropertyId != null
      ? allProperties.find((property) => property.id === requested.parentPropertyId) ?? requested
      : requested

  const item = buildPropertyCatalogItem(root, allProperties, options)
  const selectedUnit =
    requested.id === root.id
      ? null
      : item.units.find((unit) => unit.id === requested.id) ?? null

  return { item, selectedUnit }
}
