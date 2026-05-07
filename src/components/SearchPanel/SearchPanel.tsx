import { useSearchStore } from '../../store/useSearchStore'
import type { TransportMode, TripType, Discount } from '../../types'
import styles from './SearchPanel.module.css'

const MODES: { id: TransportMode; label: string }[] = [
  { id: 'train', label: 'TRAIN' },
  { id: 'plane', label: 'FLIGHT' },
  { id: 'bus',   label: 'COACH' },
  { id: 'ferry', label: 'FERRY' },
]

const DISCOUNTS: { id: Discount; label: string }[] = [
  { id: 'railcard1625', label: '16-25' },
  { id: 'totum',        label: 'TOTUM' },
  { id: 'twotogether',  label: '2GETHER' },
  { id: 'senior',       label: 'SENIOR' },
]

const TRIP_TYPES: { id: TripType | ''; label: string }[] = [
  { id: '', label: 'ANY' },
  { id: 'daytrip',     label: 'DAY TRIP' },
  { id: 'weekend',     label: 'WEEKEND' },
  { id: 'longweekend', label: 'LONG WKND' },
  { id: 'week',        label: 'WEEK' },
  { id: 'oneway',      label: 'ONE WAY' },
]

export function SearchPanel() {
  const {
    origin, setOrigin,
    budget, setBudget,
    tripType, setTripType,
    modes, toggleMode,
    discounts, toggleDiscount,
    passengers, setPassengers,
    runSearch, isLoading,
    content,
  } = useSearchStore()

  const totalPax = passengers.adults + passengers.students + passengers.children + passengers.seniors

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') runSearch()
  }

  return (
    <div className={styles.panel}>
      {/* Origin */}
      <div className={styles.group}>
        <span className={styles.label}>DEPART FROM</span>
        <input
          className={styles.input}
          value={origin}
          onChange={e => setOrigin(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="LONDON"
          maxLength={24}
          spellCheck={false}
        />
      </div>

      <div className={styles.separator} />

      {/* Budget */}
      <div className={styles.group}>
        <span className={styles.label}>BUDGET</span>
        <div className={styles.budgetWrap}>
          <span className={styles.budgetValue}>£{budget}</span>
          <input
            type="range"
            className={styles.slider}
            min={20}
            max={500}
            step={5}
            value={budget}
            onChange={e => setBudget(Number(e.target.value))}
          />
        </div>
      </div>

      <div className={styles.separator} />

      {/* Trip type */}
      <div className={styles.group}>
        <span className={styles.label}>TRIP TYPE</span>
        <select
          className={styles.select}
          value={tripType}
          onChange={e => setTripType(e.target.value as TripType | '')}
        >
          {TRIP_TYPES.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.separator} />

      {/* Transport modes */}
      <div className={styles.group}>
        <span className={styles.label}>TRANSPORT</span>
        <div className={styles.modes}>
          {MODES.map(m => {
            const isActive = modes.includes(m.id)
            const activeClass = isActive
              ? m.id === 'train' ? styles.activeTrain
                : m.id === 'plane' ? styles.activePlane
                : m.id === 'bus' ? styles.activeBus
                : styles.activeFerry
              : ''
            return (
              <button
                key={m.id}
                className={`${styles.modeBtn} ${isActive ? styles.active : ''} ${activeClass}`}
                onClick={() => toggleMode(m.id)}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.separator} />

      {/* Passengers */}
      <div className={styles.group}>
        <span className={styles.label}>PAX</span>
        <div className={styles.budgetWrap}>
          <span className={styles.budgetValue}>{totalPax}</span>
          <button
            className={styles.modeBtn}
            onClick={() => totalPax > 1 && setPassengers({ ...passengers, adults: Math.max(1, passengers.adults - 1) })}
          >−</button>
          <button
            className={styles.modeBtn}
            onClick={() => setPassengers({ ...passengers, adults: passengers.adults + 1 })}
          >+</button>
        </div>
      </div>

      <div className={styles.separator} />

      {/* Discounts */}
      <div className={styles.group}>
        <span className={styles.label}>DISCOUNTS</span>
        <div className={styles.discounts}>
          {DISCOUNTS.map(d => (
            <button
              key={d.id}
              className={`${styles.discountChip} ${discounts.includes(d.id) ? styles.active : ''}`}
              onClick={() => toggleDiscount(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <button
        className={styles.searchBtn}
        onClick={runSearch}
        disabled={isLoading}
      >
        {isLoading ? 'SCANNING...' : (content.searchPanel?.searchButton ?? 'FIND ESCAPES')}
      </button>
    </div>
  )
}
