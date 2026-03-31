import { Link } from 'react-router-dom'
import { MdOutlineBathtub, MdOutlineBed, MdOutlineSquareFoot } from 'react-icons/md'
import { PROPERTY_STATUS_LABELS, type Property } from '../data/properties'
import { useMarketingLinkTo } from '../hooks/useMarketingLinkTo'
import { resolveStorageUrl } from '../utils/mediaUrl'
import SavePropertyButton from './SavePropertyButton'
import './PropertyCard.css'

type Props = {
  property: Property
  featured?: boolean
  contextPill?: string
  metaNote?: string | null
}

export default function PropertyCard({ property, featured, contextPill, metaNote }: Props) {
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
          {metaNote ? <p className="property-card-meta-note">{metaNote}</p> : null}
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
