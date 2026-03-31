import {
  getPropertyStore,
  setPropertyStore,
  getNextPropertyCode,
  getPropertyById,
  PROPERTY_TYPES,
  PROPERTY_STATUS_LABELS,
  getPropertyStatusDescription,
  isPropertyPublicListing,
  getPublicGalleryUrls,
  getPublicTitleTypeLabel,
  PAYMENT_OPTION_LABELS,
  type Property,
  type PropertyStatus,
  type PropertyType,
} from '../data/properties'
import { logActivity, type ActivityLogEntry } from '../data/activityLog'

/**
 * Properties service — wraps the in-memory properties store.
 * Real HTTP calls should be added here when a backend is available.
 */

export type { Property, PropertyStatus, PropertyType, ActivityLogEntry }
export {
  PROPERTY_TYPES,
  PROPERTY_STATUS_LABELS,
  getPropertyStatusDescription,
  getNextPropertyCode,
  getPropertyById,
  isPropertyPublicListing,
  getPublicGalleryUrls,
  getPublicTitleTypeLabel,
  PAYMENT_OPTION_LABELS,
}

export function fetchProperties(): Property[] {
  return getPropertyStore()
}

export function savePropertyStore(updater: (prev: Property[]) => Property[]): Property[] {
  const next = updater(getPropertyStore())
  setPropertyStore(() => next)
  return next
}

export function logPropertyActivity(entry: Omit<ActivityLogEntry, 'id' | 'at'>) {
  return logActivity(entry)
}
