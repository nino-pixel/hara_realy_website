/**
 * PaymentSchemeBuilder
 * --------------------
 * Lets admin define one or more payment computation sheets for a property,
 * each with flexible line items (works for ANY developer) and a financing
 * terms table with PMT auto-calculation.
 */
import { useState } from 'react'
import type {
  PaymentScheme,
  PaymentLineItem,
  FinancingTerm,
  PaymentLineItemType,
} from '../data/properties'
import './PaymentSchemeBuilder.css'

// ─── Utilities ────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
}

function pesoFmt(n: number): string {
  return '₱' + Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Standard PMT formula. Returns monthly payment amount. */
function pmt(principal: number, annualPct: number, termYears: number): number {
  if (principal <= 0 || annualPct <= 0 || termYears <= 0) return 0
  const r = annualPct / 100 / 12
  const n = termYears * 12
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

// Annotated line items with computed values
type ComputedLine = PaymentLineItem & { computedPeso: number; computedMonthly?: number }

/** Walk the line items in order, computing running totals and subtotals. */
function computeLines(items: PaymentLineItem[]): ComputedLine[] {
  let running = 0
  let lastSubtotal = 0

  return items.map((item) => {
    let computedPeso = 0
    let computedMonthly: number | undefined

    switch (item.type) {
      case 'fixed':
        computedPeso = item.value ?? 0
        running += computedPeso
        break

      case 'percent': {
        // Apply % to the last subtotal (or running total if no subtotal yet)
        const base = Math.abs(lastSubtotal !== 0 ? lastSubtotal : running)
        computedPeso = base * (item.value ?? 0)
        running += computedPeso
        break
      }

      case 'subtotal':
        computedPeso = running
        lastSubtotal = running
        break

      case 'installment':
        computedPeso = item.value ?? 0
        running += computedPeso
        if ((item.termMonths ?? 0) > 0) {
          computedMonthly = computedPeso / item.termMonths!
        }
        break
    }

    return { ...item, computedPeso, computedMonthly }
  })
}

/** Return the last subtotal value (used as financing principal for PMT). */
function getFinancingPrincipal(items: PaymentLineItem[]): number {
  const lines = computeLines(items)
  let last = 0
  for (const l of lines) {
    if (l.type === 'subtotal') last = l.computedPeso
  }
  // Fall back to the running total at the end
  if (last === 0 && lines.length > 0) last = lines[lines.length - 1].computedPeso
  return Math.abs(last)
}

// ─── Default factory helpers ──────────────────────────────────────────────────

function newScheme(): PaymentScheme {
  return { id: uid(), label: '', promoNotes: '', lineItems: [], financingTerms: [] }
}

function newLineItem(type: PaymentLineItemType = 'fixed'): PaymentLineItem {
  return { id: uid(), label: '', type, value: 0 }
}

function newFinancingTerm(): FinancingTerm {
  return { id: uid(), institution: '', termYears: 30, ratePercent: 6.5 }
}

// ─── Line item row ────────────────────────────────────────────────────────────

function LineRow({
  item,
  idx,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  item: ComputedLine
  idx: number
  total: number
  onChange: (u: PaymentLineItem) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const isSub = item.type === 'subtotal'

  return (
    <tr className={`psb-line${isSub ? ' psb-line--sub' : ''}`}>
      {/* Label */}
      <td className="psb-td psb-td--label">
        <input
          className="psb-inp"
          value={item.label}
          placeholder={isSub ? 'Subtotal label (e.g. TCP)' : 'Line item label'}
          onChange={(e) => onChange({ ...item, label: e.target.value })}
        />
      </td>

      {/* Type selector */}
      <td className="psb-td psb-td--type">
        <select
          className="psb-inp psb-sel"
          value={item.type}
          onChange={(e) =>
            onChange({ ...item, type: e.target.value as PaymentLineItemType, value: 0, termMonths: undefined })
          }
        >
          <option value="fixed">Fixed ₱</option>
          <option value="percent">% of above</option>
          <option value="subtotal">Subtotal ↵</option>
          <option value="installment">Instalment</option>
        </select>
      </td>

      {/* Input column — changes based on type */}
      <td className="psb-td psb-td--input">
        {item.type === 'fixed' && (
          <input
            className="psb-inp psb-inp--num"
            type="number"
            placeholder="0 (negative = deduction)"
            value={item.value !== 0 ? item.value : ''}
            onChange={(e) => onChange({ ...item, value: parseFloat(e.target.value) || 0 })}
          />
        )}

        {item.type === 'percent' && (
          <span className="psb-pct-wrap">
            <input
              className="psb-inp psb-inp--num psb-inp--xs"
              type="number"
              min={0}
              max={100}
              step={0.01}
              placeholder="e.g. 10"
              value={item.value ? +(item.value * 100).toFixed(4) : ''}
              onChange={(e) => onChange({ ...item, value: (parseFloat(e.target.value) || 0) / 100 })}
            />
            <span className="psb-pct-sign">%</span>
          </span>
        )}

        {item.type === 'subtotal' && (
          <span className="psb-auto-badge">AUTO-SUM</span>
        )}

        {item.type === 'installment' && (
          <span className="psb-inst-wrap">
            <input
              className="psb-inp psb-inp--num"
              type="number"
              placeholder="Total ₱"
              value={item.value !== 0 ? item.value : ''}
              onChange={(e) => onChange({ ...item, value: parseFloat(e.target.value) || 0 })}
            />
            <input
              className="psb-inp psb-inp--num psb-inp--xs"
              type="number"
              min={1}
              placeholder="Mos."
              value={item.termMonths ?? ''}
              onChange={(e) => onChange({ ...item, termMonths: parseInt(e.target.value) || undefined })}
            />
          </span>
        )}
      </td>

      {/* Computed peso amount */}
      <td className="psb-td psb-td--amount">
        {isSub ? (
          <strong className="psb-sub-val">{pesoFmt(item.computedPeso)}</strong>
        ) : item.computedPeso !== 0 ? (
          <span className={`psb-amt-val${item.computedPeso < 0 ? ' psb-amt-val--neg' : ''}`}>
            {item.computedPeso < 0 ? '− ' : ''}{pesoFmt(item.computedPeso)}
          </span>
        ) : null}
      </td>

      {/* Monthly (for installments) */}
      <td className="psb-td psb-td--monthly">
        {item.computedMonthly != null && (
          <span className="psb-monthly-val">
            {pesoFmt(item.computedMonthly)}
            <small className="psb-monthly-suffix">/mo</small>
          </span>
        )}
        {item.type === 'percent' && item.computedPeso !== 0 && (
          <span className="psb-pct-result">{pesoFmt(item.computedPeso)}</span>
        )}
      </td>

      {/* Note */}
      <td className="psb-td psb-td--note">
        <input
          className="psb-inp psb-inp--note"
          value={item.note ?? ''}
          placeholder="Note (optional)"
          onChange={(e) => onChange({ ...item, note: e.target.value || undefined })}
        />
      </td>

      {/* Actions */}
      <td className="psb-td psb-td--acts">
        <button type="button" className="psb-act" onClick={() => onMove(-1)} disabled={idx === 0} title="Move up" aria-label="Move up">↑</button>
        <button type="button" className="psb-act" onClick={() => onMove(1)} disabled={idx >= total - 1} title="Move down" aria-label="Move down">↓</button>
        <button type="button" className="psb-act psb-act--del" onClick={onRemove} title="Remove" aria-label="Remove line">×</button>
      </td>
    </tr>
  )
}

// ─── Financing term row ───────────────────────────────────────────────────────

function FTermRow({
  term,
  principal,
  onChange,
  onRemove,
}: {
  term: FinancingTerm
  principal: number
  onChange: (u: FinancingTerm) => void
  onRemove: () => void
}) {
  const autoMonthly = pmt(principal, term.ratePercent, term.termYears)
  const displayMonthly = term.monthlyAmort ?? (autoMonthly > 0 ? autoMonthly : undefined)

  return (
    <tr className="psb-fterm">
      <td className="psb-td">
        <input
          className="psb-inp"
          placeholder="e.g. Pag-IBIG / BPI"
          value={term.institution}
          onChange={(e) => onChange({ ...term, institution: e.target.value })}
        />
      </td>
      <td className="psb-td">
        <input
          className="psb-inp psb-inp--num psb-inp--xs"
          type="number"
          min={1}
          max={50}
          placeholder="yrs"
          value={term.termYears || ''}
          onChange={(e) => onChange({ ...term, termYears: parseInt(e.target.value) || 0 })}
        />
      </td>
      <td className="psb-td">
        <input
          className="psb-inp psb-inp--num psb-inp--xs"
          type="number"
          step={0.01}
          min={0}
          placeholder="%"
          value={term.ratePercent || ''}
          onChange={(e) => onChange({ ...term, ratePercent: parseFloat(e.target.value) || 0 })}
        />
      </td>
      {/* Monthly amort — auto from PMT, admin can override */}
      <td className="psb-td psb-td--fmonthly">
        <div className="psb-fmonthly-wrap">
          <input
            className="psb-inp psb-inp--num"
            type="number"
            step={0.01}
            placeholder={autoMonthly > 0 ? `${autoMonthly.toFixed(2)} (auto)` : '—'}
            value={term.monthlyAmort ?? ''}
            onChange={(e) => onChange({ ...term, monthlyAmort: parseFloat(e.target.value) || undefined })}
          />
          {autoMonthly > 0 && !term.monthlyAmort && (
            <span className="psb-auto-hint" title="PMT auto-calc">≈ {pesoFmt(autoMonthly)}</span>
          )}
          {term.monthlyAmort && (
            <button
              type="button"
              className="psb-reset-btn"
              title="Reset to auto-calculated PMT"
              onClick={() => onChange({ ...term, monthlyAmort: undefined })}
            >
              ↺
            </button>
          )}
        </div>
        {displayMonthly && displayMonthly > 0 && (
          <span className="psb-fmonthly-display">{pesoFmt(displayMonthly)}/mo</span>
        )}
      </td>
      {/* Required income */}
      <td className="psb-td">
        <input
          className="psb-inp psb-inp--num"
          type="number"
          placeholder="—"
          value={term.requiredIncome ?? ''}
          onChange={(e) => onChange({ ...term, requiredIncome: parseFloat(e.target.value) || undefined })}
        />
      </td>
      {/* Note */}
      <td className="psb-td">
        <input
          className="psb-inp psb-inp--note"
          placeholder="Note"
          value={term.note ?? ''}
          onChange={(e) => onChange({ ...term, note: e.target.value || undefined })}
        />
      </td>
      <td className="psb-td psb-td--acts">
        <button type="button" className="psb-act psb-act--del" onClick={onRemove} title="Remove" aria-label="Remove financing row">×</button>
      </td>
    </tr>
  )
}

// ─── Single scheme card ───────────────────────────────────────────────────────

function SchemeCard({
  scheme,
  index,
  totalSchemes,
  onChange,
  onRemove,
  onDuplicate,
  onMoveScheme,
}: {
  scheme: PaymentScheme
  index: number
  totalSchemes: number
  onChange: (s: PaymentScheme) => void
  onRemove: () => void
  onDuplicate: () => void
  onMoveScheme: (dir: -1 | 1) => void
}) {
  const [open, setOpen] = useState(true)

  const computed = computeLines(scheme.lineItems)
  const principal = getFinancingPrincipal(scheme.lineItems)

  function updateLineItem(i: number, updated: PaymentLineItem) {
    const next = scheme.lineItems.map((li, j) => (j === i ? updated : li))
    onChange({ ...scheme, lineItems: next })
  }

  function removeLineItem(i: number) {
    onChange({ ...scheme, lineItems: scheme.lineItems.filter((_, j) => j !== i) })
  }

  function moveLineItem(i: number, dir: -1 | 1) {
    const arr = [...scheme.lineItems]
    const target = i + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[i], arr[target]] = [arr[target], arr[i]]
    onChange({ ...scheme, lineItems: arr })
  }

  function addLineItem(type: PaymentLineItemType) {
    onChange({ ...scheme, lineItems: [...scheme.lineItems, newLineItem(type)] })
  }

  function updateFTerm(i: number, updated: FinancingTerm) {
    const next = scheme.financingTerms.map((ft, j) => (j === i ? updated : ft))
    onChange({ ...scheme, financingTerms: next })
  }

  function removeFTerm(i: number) {
    onChange({ ...scheme, financingTerms: scheme.financingTerms.filter((_, j) => j !== i) })
  }

  return (
    <div className="psb-card">
      {/* Card header */}
      <div className="psb-card-header">
        <button
          type="button"
          className="psb-card-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className="psb-card-chevron">{open ? '▼' : '▶'}</span>
          <span className="psb-card-label">
            {scheme.label || `Payment Option ${index + 1}`}
          </span>
        </button>
        <div className="psb-card-header-acts">
          <button type="button" className="psb-hdr-btn" onClick={() => onMoveScheme(-1)} disabled={index === 0} title="Move scheme up">↑</button>
          <button type="button" className="psb-hdr-btn" onClick={() => onMoveScheme(1)} disabled={index >= totalSchemes - 1} title="Move scheme down">↓</button>
          <button type="button" className="psb-hdr-btn" onClick={onDuplicate} title="Duplicate this scheme">⎘</button>
          <button type="button" className="psb-hdr-btn psb-hdr-btn--del" onClick={onRemove} title="Remove scheme">×</button>
        </div>
      </div>

      {open && (
        <div className="psb-card-body">
          {/* Scheme meta */}
          <div className="psb-meta-row">
            <div className="psb-meta-field">
              <label className="psb-label">Option name</label>
              <input
                className="psb-inp psb-inp--full"
                placeholder='e.g. "10% DP – Pag-IBIG (18 mos.)"'
                value={scheme.label}
                onChange={(e) => onChange({ ...scheme, label: e.target.value })}
              />
            </div>
            <div className="psb-meta-field psb-meta-field--grow">
              <label className="psb-label">Key highlights / promo notes</label>
              <textarea
                className="psb-inp psb-inp--ta"
                placeholder="e.g. • Up to ₱150K discount  • Move-in upon loan takeout"
                value={scheme.promoNotes ?? ''}
                rows={2}
                onChange={(e) => onChange({ ...scheme, promoNotes: e.target.value })}
              />
            </div>
          </div>

          {/* ── LINE ITEMS ── */}
          <div className="psb-section-title">
            Payment Line Items
            <span className="psb-section-hint">
              Add rows in the same order as the developer's computation sheet.
            </span>
          </div>

          <div className="psb-table-wrap">
            <table className="psb-table">
              <thead>
                <tr>
                  <th className="psb-th psb-th--label">Label</th>
                  <th className="psb-th psb-th--type">Type</th>
                  <th className="psb-th psb-th--input">Input</th>
                  <th className="psb-th psb-th--amount">Amount</th>
                  <th className="psb-th psb-th--monthly">/ Month</th>
                  <th className="psb-th psb-th--note">Note</th>
                  <th className="psb-th psb-th--acts" />
                </tr>
              </thead>
              <tbody>
                {computed.length === 0 && (
                  <tr>
                    <td colSpan={7} className="psb-empty-row">
                      No line items yet. Add rows below to build the computation sheet.
                    </td>
                  </tr>
                )}
                {computed.map((item, i) => (
                  <LineRow
                    key={item.id}
                    item={item}
                    idx={i}
                    total={computed.length}
                    onChange={(u) => updateLineItem(i, u)}
                    onRemove={() => removeLineItem(i)}
                    onMove={(dir) => moveLineItem(i, dir)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Add line item buttons */}
          <div className="psb-add-line-row">
            <span className="psb-add-label">Add row:</span>
            {(['fixed', 'percent', 'subtotal', 'installment'] as PaymentLineItemType[]).map((t) => (
              <button
                key={t}
                type="button"
                className="psb-add-btn"
                onClick={() => addLineItem(t)}
              >
                + {t === 'fixed' ? 'Fixed ₱' : t === 'percent' ? '% of above' : t === 'subtotal' ? 'Subtotal' : 'Instalment'}
              </button>
            ))}
          </div>

          {/* ── FINANCING TERMS ── */}
          <div className="psb-section-title psb-section-title--fin">
            Financing Terms
            {principal > 0 && (
              <span className="psb-principal-badge">
                Financing principal (last subtotal): <strong>{pesoFmt(principal)}</strong>
              </span>
            )}
          </div>

          <div className="psb-table-wrap">
            <table className="psb-table psb-fterms-table">
              <thead>
                <tr>
                  <th className="psb-th">Institution</th>
                  <th className="psb-th psb-th--xs">Term (yrs)</th>
                  <th className="psb-th psb-th--xs">Rate %</th>
                  <th className="psb-th psb-th--fmonthly">Monthly Amort</th>
                  <th className="psb-th">Req. Income / mo.</th>
                  <th className="psb-th psb-th--note">Note</th>
                  <th className="psb-th psb-th--acts" />
                </tr>
              </thead>
              <tbody>
                {scheme.financingTerms.length === 0 && (
                  <tr>
                    <td colSpan={7} className="psb-empty-row">
                      No financing terms yet. Add rows below.
                    </td>
                  </tr>
                )}
                {scheme.financingTerms.map((ft, i) => (
                  <FTermRow
                    key={ft.id}
                    term={ft}
                    principal={principal}
                    onChange={(u) => updateFTerm(i, u)}
                    onRemove={() => removeFTerm(i)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="psb-add-line-row">
            <button
              type="button"
              className="psb-add-btn"
              onClick={() =>
                onChange({ ...scheme, financingTerms: [...scheme.financingTerms, newFinancingTerm()] })
              }
            >
              + Add Financing Row
            </button>
            {principal <= 0 && scheme.financingTerms.length > 0 && (
              <span className="psb-warn">
                ⚠ No subtotal found — add a "Subtotal ↵" row at the financing balance line so PMT can auto-calculate.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface PaymentSchemeBuilderProps {
  schemes: PaymentScheme[]
  onChange: (schemes: PaymentScheme[]) => void
}

export default function PaymentSchemeBuilder({ schemes, onChange }: PaymentSchemeBuilderProps) {
  function addScheme() {
    onChange([...schemes, newScheme()])
  }

  function updateScheme(i: number, s: PaymentScheme) {
    onChange(schemes.map((sc, j) => (j === i ? s : sc)))
  }

  function removeScheme(i: number) {
    onChange(schemes.filter((_, j) => j !== i))
  }

  function duplicateScheme(i: number) {
    const clone: PaymentScheme = {
      ...schemes[i],
      id: uid(),
      label: schemes[i].label ? `${schemes[i].label} (copy)` : '',
      lineItems: schemes[i].lineItems.map((li) => ({ ...li, id: uid() })),
      financingTerms: schemes[i].financingTerms.map((ft) => ({ ...ft, id: uid() })),
    }
    const next = [...schemes]
    next.splice(i + 1, 0, clone)
    onChange(next)
  }

  function moveScheme(i: number, dir: -1 | 1) {
    const target = i + dir
    if (target < 0 || target >= schemes.length) return
    const arr = [...schemes]
    ;[arr[i], arr[target]] = [arr[target], arr[i]]
    onChange(arr)
  }

  return (
    <div className="psb-root">
      {schemes.length === 0 && (
        <div className="psb-empty-state">
          <p className="psb-empty-title">No payment schemes yet</p>
          <p className="psb-empty-desc">
            Add one payment option for each financing strategy offered by the developer
            (e.g. "10% DP – Pag-IBIG", "5% All-In Equity – Bank", "Spot Cash").
            Each scheme can have its own line items and financing term table.
          </p>
        </div>
      )}

      {schemes.map((scheme, i) => (
        <SchemeCard
          key={scheme.id}
          scheme={scheme}
          index={i}
          totalSchemes={schemes.length}
          onChange={(s) => updateScheme(i, s)}
          onRemove={() => removeScheme(i)}
          onDuplicate={() => duplicateScheme(i)}
          onMoveScheme={(dir) => moveScheme(i, dir)}
        />
      ))}

      <button type="button" className="psb-add-scheme-btn" onClick={addScheme}>
        + Add Payment Option
      </button>
    </div>
  )
}
