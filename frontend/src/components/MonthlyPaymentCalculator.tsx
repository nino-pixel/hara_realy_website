import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  computeAmortization,
  formatPeso,
  getAffordabilityInsight,
  parsePropertyPriceToNumber,
  type AmortizationResult,
  type MortgageCalculatorSnapshot,
} from '../utils/mortgageUtils'
import { trackEvent } from '../services/analyticsService'
import './MonthlyPaymentCalculator.css'

const TERM_OPTIONS = [5, 10, 15, 20, 25, 30] as const
const DEFAULT_TERM = 20
const DEFAULT_RATE = 6.5
const DEFAULT_DP_PERCENT = 20

const STORAGE_PREFIX = 'chara_mpc_v1_'

type DownMode = 'percent' | 'amount'

type StoredState = {
  v: 1
  downMode: DownMode
  downPercent: number
  downAmountInput: string
  loanTermYears: number
  /** Only persisted when rate is user-editable (not listing-locked). */
  interestRate?: number
}

function loadStored(propertyId: string): Partial<StoredState> | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${propertyId}`)
    if (!raw) return null
    const p = JSON.parse(raw) as StoredState
    if (p.v !== 1) return null
    return p
  } catch {
    return null
  }
}

function saveStored(propertyId: string, data: Omit<StoredState, 'v'>) {
  try {
    const payload: StoredState = { v: 1, ...data }
    localStorage.setItem(`${STORAGE_PREFIX}${propertyId}`, JSON.stringify(payload))
  } catch {
    /* quota */
  }
}

type Props = {
  propertyId: string
  /** Raw price from listing e.g. "₱4,200,000" */
  propertyPriceDisplay: string
  /**
   * Annual interest % set by admin on the property. When provided, the rate is read-only for visitors
   * (not saved in localStorage as user preference).
   */
  lockedAnnualInterestRate?: number
  /** Called whenever inputs or derived payment change (for inquiry submit). */
  onSnapshotChange?: (s: MortgageCalculatorSnapshot) => void
  /** Scroll to inquiry form and focus first field (CTA). */
  onScrollToInquiry?: () => void
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export default function MonthlyPaymentCalculator({
  propertyId,
  propertyPriceDisplay,
  lockedAnnualInterestRate,
  onSnapshotChange,
  onScrollToInquiry,
}: Props) {
  const priceNum = useMemo(() => parsePropertyPriceToNumber(propertyPriceDisplay), [propertyPriceDisplay])

  const stored = useMemo(() => loadStored(propertyId), [propertyId])

  const rateLocked =
    typeof lockedAnnualInterestRate === 'number' && Number.isFinite(lockedAnnualInterestRate)

  const [downMode, setDownMode] = useState<DownMode>(() => (stored?.downMode === 'amount' ? 'amount' : 'percent'))
  const [downPercent, setDownPercent] = useState(() =>
    typeof stored?.downPercent === 'number' ? clamp(stored.downPercent, 0, 99) : DEFAULT_DP_PERCENT
  )
  const [downAmountInput, setDownAmountInput] = useState(() => stored?.downAmountInput ?? '')
  const [loanTermYears, setLoanTermYears] = useState(() =>
    typeof stored?.loanTermYears === 'number' && TERM_OPTIONS.includes(stored.loanTermYears as (typeof TERM_OPTIONS)[number])
      ? stored.loanTermYears
      : DEFAULT_TERM
  )
  const [interestRate, setInterestRate] = useState(() => {
    if (
      typeof lockedAnnualInterestRate === 'number' &&
      Number.isFinite(lockedAnnualInterestRate)
    ) {
      return clamp(lockedAnnualInterestRate, 0, 40)
    }
    const fromStored = stored?.interestRate
    return typeof fromStored === 'number' ? clamp(fromStored, 0, 40) : DEFAULT_RATE
  })

  // Sync: ensure interestRate is up-to-date with locked value from props
  const [prevLockRate, setPrevLockRate] = useState(lockedAnnualInterestRate)
  if (lockedAnnualInterestRate !== prevLockRate) {
    setPrevLockRate(lockedAnnualInterestRate)
    if (rateLocked) setInterestRate(clamp(lockedAnnualInterestRate!, 0, 40))
  }

  useEffect(() => {
    saveStored(propertyId, {
      downMode,
      downPercent,
      downAmountInput,
      loanTermYears,
      ...(rateLocked ? {} : { interestRate }),
    })
  }, [propertyId, downMode, downPercent, downAmountInput, loanTermYears, interestRate, rateLocked])

  const downPaymentAmount = useMemo(() => {
    if (priceNum == null) return 0
    if (downMode === 'percent') {
      return (priceNum * clamp(downPercent, 0, 99)) / 100
    }
    const parsed = parseFloat(String(downAmountInput).replace(/,/g, ''))
    if (!Number.isFinite(parsed) || parsed < 0) return 0
    return Math.min(parsed, priceNum * 0.999)
  }, [priceNum, downMode, downPercent, downAmountInput])

  const effectiveDpPercent = useMemo(() => {
    if (priceNum == null || priceNum <= 0) return null
    return (downPaymentAmount / priceNum) * 100
  }, [priceNum, downPaymentAmount])

  const loanAmount = useMemo(() => {
    if (priceNum == null) return 0
    return Math.max(0, priceNum - downPaymentAmount)
  }, [priceNum, downPaymentAmount])

  const amort: AmortizationResult | null = useMemo(() => {
    return computeAmortization(loanAmount, interestRate, loanTermYears)
  }, [loanAmount, interestRate, loanTermYears])

  const downpaymentLabel = useMemo(() => {
    if (priceNum == null) return null
    if (downMode === 'percent') {
      return `${clamp(downPercent, 0, 99)}% (${formatPeso(Math.round(downPaymentAmount))})`
    }
    return formatPeso(Math.round(downPaymentAmount))
  }, [priceNum, downMode, downPercent, downPaymentAmount])

  const snapshot = useMemo((): MortgageCalculatorSnapshot => {
    const valid =
      priceNum != null &&
      loanAmount > 0 &&
      amort != null &&
      Number.isFinite(interestRate) &&
      interestRate >= 0 &&
      loanTermYears > 0

    const dpPct =
      valid && effectiveDpPercent != null ? Math.round(effectiveDpPercent * 100) / 100 : null

    const monthly = valid && amort ? amort.monthlyPayment : null
    const highIntent =
      !!valid &&
      monthly != null &&
      monthly > 0 &&
      effectiveDpPercent != null &&
      effectiveDpPercent >= 20

    return {
      estimatedMonthly: monthly,
      downpayment: valid && downpaymentLabel ? downpaymentLabel : null,
      downpaymentPercent: dpPct,
      loanTerm: valid ? loanTermYears : null,
      interestRate: valid ? interestRate : null,
      isValid: !!valid,
      highBuyingIntent: highIntent,
    }
  }, [
    priceNum,
    loanAmount,
    amort,
    interestRate,
    loanTermYears,
    downpaymentLabel,
    effectiveDpPercent,
  ])

  const emit = useCallback(() => {
    onSnapshotChange?.(snapshot)
  }, [onSnapshotChange, snapshot])

  useEffect(() => {
    emit()
  }, [emit])

  const affordability = useMemo(() => {
    if (!snapshot.isValid || !amort) return null
    return getAffordabilityInsight(amort.monthlyPayment)
  }, [snapshot.isValid, amort])

  const handleModeChange = (mode: DownMode) => {
    if (mode === 'amount' && priceNum != null && downMode === 'percent') {
      setDownAmountInput(String(Math.round((priceNum * clamp(downPercent, 0, 99)) / 100)))
    }
    setDownMode(mode)
  }

  const priceMissing = priceNum == null

  useEffect(() => {
    if (priceMissing || !snapshot.isValid) return
    const t = window.setTimeout(() => {
      trackEvent('calculator_use', { propertyId })
    }, 750)
    return () => window.clearTimeout(t)
  }, [
    propertyId,
    priceMissing,
    snapshot.isValid,
    downPercent,
    downAmountInput,
    loanTermYears,
    interestRate,
    downMode,
  ])

  const loanBlocked = priceMissing || loanAmount <= 0
  const showCta = !loanBlocked && amort != null && snapshot.isValid

  const handleCtaPrimary = () => {
    onScrollToInquiry?.()
  }

  return (
    <div className="mpc-card" aria-labelledby="mpc-title">
      <div className="mpc-card-header">
        <h2 id="mpc-title" className="mpc-title">
          Monthly payment estimate
        </h2>
      </div>

      <div className="mpc-field">
        <label htmlFor="mpc-price">Property price</label>
        <input
          id="mpc-price"
          type="text"
          className="mpc-input mpc-input--readonly"
          readOnly
          value={propertyPriceDisplay || '—'}
          aria-readonly="true"
        />
      </div>

      {priceMissing && (
        <p className="mpc-warn" role="status">
          Price isn’t shown as a number on this listing. Add a numeric price in admin to use the calculator.
        </p>
      )}

      <div className="mpc-field">
        <div className="mpc-label-row">
          <label htmlFor={downMode === 'percent' ? 'mpc-dp-range' : 'mpc-dp-amt'}>Down payment</label>
          <div className="mpc-toggle" role="group" aria-label="Down payment input type">
            <button
              type="button"
              className={`mpc-toggle-btn ${downMode === 'percent' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('percent')}
            >
              %
            </button>
            <button
              type="button"
              className={`mpc-toggle-btn ${downMode === 'amount' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('amount')}
            >
              ₱
            </button>
          </div>
        </div>
        {downMode === 'percent' ? (
          <>
            <div className="mpc-row mpc-row--slider">
              <input
                id="mpc-dp-range"
                type="range"
                min={0}
                max={90}
                step={1}
                value={clamp(downPercent, 0, 90)}
                onChange={(e) => setDownPercent(Number(e.target.value))}
                disabled={priceMissing}
                aria-valuemin={0}
                aria-valuemax={90}
                aria-valuenow={downPercent}
              />
              <input
                id="mpc-dp-pct"
                type="number"
                className="mpc-input mpc-input--narrow"
                min={0}
                max={99}
                step={0.5}
                value={downPercent}
                onChange={(e) => setDownPercent(clamp(Number(e.target.value) || 0, 0, 99))}
                disabled={priceMissing}
                aria-label="Down payment percent"
              />
              <span className="mpc-suffix">%</span>
            </div>
          </>
        ) : (
          <input
            id="mpc-dp-amt"
            type="number"
            className="mpc-input"
            min={0}
            placeholder="Amount in pesos"
            value={downAmountInput}
            onChange={(e) => setDownAmountInput(e.target.value)}
            disabled={priceMissing}
            aria-label="Down payment amount"
          />
        )}
      </div>

      <div className="mpc-field mpc-field--inline">
        <label htmlFor="mpc-term">Loan term</label>
        <select
          id="mpc-term"
          className="mpc-input"
          value={loanTermYears}
          onChange={(e) => setLoanTermYears(Number(e.target.value))}
          disabled={priceMissing}
        >
          {TERM_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y} years
            </option>
          ))}
        </select>
      </div>

      <div className="mpc-field">
        <label htmlFor="mpc-rate">Interest rate (per year)</label>
        <div className="mpc-row">
          <input
            id="mpc-rate"
            type="number"
            className={`mpc-input ${rateLocked ? 'mpc-input--readonly' : ''}`}
            min={0}
            max={40}
            step={0.1}
            value={interestRate}
            readOnly={rateLocked}
            aria-readonly={rateLocked}
            onChange={(e) => {
              if (rateLocked) return
              setInterestRate(clamp(Number(e.target.value) || 0, 0, 40))
            }}
            disabled={!rateLocked && priceMissing}
          />
          <span className="mpc-suffix">%</span>
        </div>
      </div>

      <div className={`mpc-result ${loanBlocked || !amort ? 'mpc-result--muted' : ''}`}>
        <p className="mpc-result-label">Estimated monthly payment</p>
        <p className="mpc-result-hero">
          {loanBlocked || !amort ? '—' : formatPeso(Math.round(amort.monthlyPayment))}
          {!loanBlocked && amort ? <span className="mpc-result-per">/mo</span> : null}
        </p>
        {affordability && (
          <p className={`mpc-afford-hint mpc-afford-hint--${affordability.tier}`}>
            <span className="mpc-afford-hint-label">{affordability.label}</span>
            <span className="mpc-afford-hint-desc">
              {affordability.tier === 'affordable' && 'Typically easier to qualify for on typical incomes.'}
              {affordability.tier === 'mid' && 'Plan for steady cash flow and emergency buffer.'}
              {affordability.tier === 'premium' && 'Often chosen for prime locations or larger units—invest wisely.'}
            </span>
          </p>
        )}
        <dl className="mpc-breakdown">
          <div>
            <dt>Total down payment</dt>
            <dd>{loanBlocked ? '—' : formatPeso(Math.round(downPaymentAmount))}</dd>
          </div>
          <div>
            <dt>Loan amount</dt>
            <dd>{loanBlocked ? '—' : formatPeso(Math.round(loanAmount))}</dd>
          </div>
          <div>
            <dt>Total interest (estimate)</dt>
            <dd>{loanBlocked || !amort ? '—' : formatPeso(Math.round(amort.totalInterest))}</dd>
          </div>
          <div>
            <dt>Total payment</dt>
            <dd>{loanBlocked || !amort ? '—' : formatPeso(Math.round(amort.totalPayment))}</dd>
          </div>
        </dl>
      </div>

      {showCta && amort && (
        <div className="mpc-cta" role="region" aria-label="Next steps">
          <p className="mpc-cta-summary">
            This property is estimated at{' '}
            <strong>{formatPeso(Math.round(amort.monthlyPayment))}/month</strong>
            {effectiveDpPercent != null ? (
              <>
                {' '}
                with <strong>{effectiveDpPercent.toFixed(1)}%</strong> down
              </>
            ) : null}
            .
          </p>
          <div className="mpc-cta-buttons">
            <button type="button" className="btn btn-primary mpc-cta-btn" onClick={handleCtaPrimary}>
              I can afford this — contact me
            </button>
            <button type="button" className="btn btn-outline mpc-cta-btn" onClick={handleCtaPrimary}>
              Help me get this plan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
