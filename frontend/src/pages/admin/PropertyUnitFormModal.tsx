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
            <div className="admin-form-row">
              <label>Location (display line)</label>
              <input
                className="admin-input"
                value={form.location ?? ''}
                onChange={(event) => update('location', event.target.value)}
                placeholder="e.g. Phase 1, Block 3, Lot 12"
              />
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
