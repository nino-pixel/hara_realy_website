import FormActions from '../../components/FormActions'
import {
  PROPERTY_STATUS_LABELS,
  type Property,
  type PropertyStatus,
} from '../../data/properties'
import { formatPesoInputFromRaw } from '../../utils/mortgageUtils'
import './AdminProperties.css'

type Props = {
  parentProperty: Property
  form: Partial<Property>
  setForm: React.Dispatch<React.SetStateAction<Partial<Property>>>
  onSave: () => void | Promise<void>
  onClose: () => void
  isEdit: boolean
  propertyCodeDisplay: string
  primaryDisabled?: boolean
}

export default function PropertyUnitFormModal({
  parentProperty,
  form,
  setForm,
  onSave,
  onClose,
  isEdit,
  propertyCodeDisplay,
  primaryDisabled = false,
}: Props) {
  const update = (key: keyof Property, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="property-sidebar-overlay" onClick={onClose} role="presentation">
      <div
        className="property-sidebar property-sidebar--unit"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={isEdit ? 'Edit Unit' : 'Add Unit'}
      >
        <div className="property-sidebar-header">
          <div>
            <h2>{isEdit ? 'Edit Unit' : 'Add Unit'}</h2>
            <p className="property-unit-parent-label">{parentProperty.title}</p>
          </div>
          <button type="button" className="property-sidebar-close" onClick={onClose} aria-label="Close">
            x
          </button>
        </div>

        <div className="property-sidebar-body">
          <section className="property-form-section">
            <h3 className="property-form-section-title">Unit Info</h3>
            <div className="admin-form-row">
              <label>Property Code / ID</label>
              <input value={propertyCodeDisplay} readOnly className="admin-input--readonly" />
            </div>
            <div className="admin-form-row">
              <label>Unit label (optional)</label>
              <input
                className="admin-input"
                value={form.unitLabel ?? ''}
                onChange={(event) => update('unitLabel', event.target.value)}
                placeholder="e.g. Corner unit, Model A"
              />
            </div>
            <div className="admin-form-inline-row">
              <div className="admin-form-row">
                <label>Phase</label>
                <input
                  className="admin-input"
                  value={form.phase ?? ''}
                  onChange={(event) => update('phase', event.target.value)}
                  placeholder="e.g. 1"
                />
              </div>
              <div className="admin-form-row">
                <label>Block</label>
                <input
                  className="admin-input"
                  value={form.block ?? ''}
                  onChange={(event) => update('block', event.target.value)}
                  placeholder="e.g. 3"
                />
              </div>
              <div className="admin-form-row">
                <label>Lot</label>
                <input
                  className="admin-input"
                  value={form.lot ?? ''}
                  onChange={(event) => update('lot', event.target.value)}
                  placeholder="e.g. 12"
                />
              </div>
            </div>
            <div className="admin-form-row">
              <label>Address (optional)</label>
              <input
                className="admin-input"
                value={form.address ?? ''}
                onChange={(event) => update('address', event.target.value)}
                placeholder="Street or landmark"
              />
            </div>
          </section>
          
          <section className="property-form-section">
            <h3 className="property-form-section-title">Unit Details</h3>
            <div className="admin-form-inline-row">
              <div className="admin-form-row">
                <label>Floor Area</label>
                <input
                  className="admin-input"
                  value={form.floorArea ?? form.area ?? ''}
                  onChange={(event) => update('floorArea', event.target.value)}
                  placeholder="e.g. 95 sqm"
                />
              </div>
              <div className="admin-form-row">
                <label>Lot Area</label>
                <input
                  className="admin-input"
                  value={form.lotArea ?? ''}
                  onChange={(event) => update('lotArea', event.target.value)}
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
                  value={form.beds ?? ''}
                  onChange={(event) => update('beds', parseInt(event.target.value, 10) || 0)}
                />
              </div>
              <div className="admin-form-row">
                <label>Bathrooms</label>
                <input
                  className="admin-input"
                  type="number"
                  min={0}
                  value={form.baths ?? ''}
                  onChange={(event) => update('baths', parseInt(event.target.value, 10) || 0)}
                />
              </div>
              <div className="admin-form-row">
                <label>Parking</label>
                <input
                  className="admin-input"
                  type="number"
                  min={0}
                  value={form.parking ?? ''}
                  onChange={(event) => update('parking', parseInt(event.target.value, 10) || 0)}
                />
              </div>
            </div>
            <div className="admin-form-row">
              <label>Furnished?</label>
              <select
                className="admin-input"
                value={form.furnished === true ? 'yes' : form.furnished === false ? 'no' : ''}
                onChange={(event) => update('furnished', event.target.value === 'yes')}
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </section>

          <section className="property-form-section">
            <h3 className="property-form-section-title">Pricing & Status</h3>
            <div className="admin-form-row">
              <label>Price</label>
              <input
                className="admin-input"
                inputMode="numeric"
                autoComplete="off"
                value={formatPesoInputFromRaw(String(form.price ?? ''))}
                onChange={(event) => update('price', formatPesoInputFromRaw(event.target.value))}
                placeholder="P0"
              />
            </div>
            <div className="admin-form-row">
              <label>Status</label>
              <select
                className="admin-input"
                value={form.status ?? 'available'}
                onChange={(event) => update('status', event.target.value as PropertyStatus)}
              >
                {(Object.keys(PROPERTY_STATUS_LABELS) as PropertyStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {PROPERTY_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
          </section>
        </div>

        <FormActions
          primaryLabel={isEdit ? 'Save Unit' : 'Add Unit'}
          onPrimary={() => void onSave()}
          onCancel={onClose}
          primaryDisabled={primaryDisabled}
          className="property-sidebar-footer"
        />
      </div>
    </div>
  )
}
