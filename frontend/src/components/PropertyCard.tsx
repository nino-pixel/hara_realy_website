import { Link } from 'react-router-dom'
import { useMarketingLinkTo } from '../hooks/useMarketingLinkTo'
import type { Property } from '../data/properties'
import { PROPERTY_STATUS_LABELS } from '../data/properties'
import { resolveStorageUrl } from '../utils/mediaUrl'
import SavePropertyButton from './SavePropertyButton'
import './PropertyCard.css'
import { MdOutlineBed, MdOutlineBathtub, MdOutlineSquareFoot } from 'react-icons/md'

type Props = {
  property: Property
  featured?: boolean
  /** Short label e.g. “Most inquired this week” — shown on image */
  contextPill?: string
}

export default function PropertyCard({ property, featured, contextPill }: Props) {
  const { id, title, location, price, image, status, beds, baths, area } = property
  const label = PROPERTY_STATUS_LABELS[status]
  const detailTo = useMarketingLinkTo(`/properties/${id}`)
  return (
    <article className={`property-card ${featured ? 'property-card--featured' : ''}`}>
      <div className="property-card-image">
        <Link to={detailTo} className="property-card-image-link" aria-label={`View ${title}`}>
          <img src={resolveStorageUrl(image)} alt="" />
          {contextPill ? (
            <span className="property-card-context-pill">{contextPill}</span>
          ) : null}
          <span className={`property-card-status property-card-status--${status}`}>
            {label}
          </span>
        </Link>
        <SavePropertyButton propertyId={id} variant="card" />
      </div>
      <Link to={detailTo} className="property-card-body-link">
        <div className="property-card-body">
          <p className="property-card-price">{price}</p>
          <h3 className="property-card-title">{title}</h3>
          <p className="property-card-location">{location}</p>
          {(beds > 0 || baths > 0 || area) && (
            <div className="property-card-specs">
              {beds > 0 && (
                <div className="property-card-spec-item">
                  <MdOutlineBed className="spec-icon" />
                  <span>{beds}</span>
                </div>
              )}
              {baths > 0 && (
                <div className="property-card-spec-item">
                  <MdOutlineBathtub className="spec-icon" />
                  <span>{baths}</span>
                </div>
              )}
              {area && (
                <div className="property-card-spec-item">
                  <MdOutlineSquareFoot className="spec-icon" />
                  <span>{area}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Link>
    </article>
  )
}
