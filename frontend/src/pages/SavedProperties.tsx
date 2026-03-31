import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import PropertyCard from '../components/PropertyCard'
import { setSavedPropertyIds } from '../data/savedPropertiesStorage'
import { useSavedPropertyIds } from '../hooks/useSavedProperties'
import { useMarketingLinkTo } from '../hooks/useMarketingLinkTo'
import { fetchProperties } from '../services/propertiesService'
import {
  getPublicPropertyCatalog,
  getRootPropertyByAnyId,
} from '../utils/propertyGrouping'
import './SavedProperties.css'

export default function SavedProperties() {
  const propertiesTo = useMarketingLinkTo('/properties')
  const savedIds = useSavedPropertyIds()

  useEffect(() => {
    const allProperties = fetchProperties()
    const normalizedIds = Array.from(
      new Set(
        savedIds
          .map((id) => getRootPropertyByAnyId(allProperties, id)?.id ?? null)
          .filter((id): id is string => id != null)
      )
    )
    if (normalizedIds.length === savedIds.length && normalizedIds.every((id, index) => id === savedIds[index])) {
      return
    }
    setSavedPropertyIds(normalizedIds)
  }, [savedIds])

  const savedProperties = useMemo(() => {
    const allProperties = fetchProperties()
    const catalog = getPublicPropertyCatalog(allProperties)
    const byId = new Map(catalog.map((item) => [item.rootProperty.id, item]))
    const list = []
    for (const id of savedIds) {
      const rootId = getRootPropertyByAnyId(allProperties, id)?.id
      if (!rootId) continue
      const item = byId.get(rootId)
      if (item) list.push(item)
    }
    return list
  }, [savedIds])

  return (
    <div className="saved-properties-page section">
      <div className="container">
        <header className="saved-properties-header">
          <h1 className="page-title">Saved properties</h1>
          <p className="page-subtitle saved-properties-subtitle">
            Properties you&apos;ve saved for later. Only active listings are shown.
          </p>
        </header>

        {savedProperties.length === 0 ? (
          <div className="saved-properties-empty">
            <p className="saved-properties-empty-text">You haven&apos;t saved any properties yet.</p>
            <Link to={propertiesTo} className="btn btn-primary">
              Browse properties
            </Link>
          </div>
        ) : (
          <ul className="saved-properties-grid">
            {savedProperties.map((item) => (
              <li key={item.rootProperty.id}>
                <PropertyCard property={item.displayProperty} metaNote={item.summaryNote} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
