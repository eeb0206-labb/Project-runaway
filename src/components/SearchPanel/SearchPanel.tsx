import { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useSearchStore } from '../../store/useSearchStore'
import type { TransportMode, TripType, Discount, SizeFilter, SortBy } from '../../types'
import type { TravelScope } from '../../store/useSearchStore'
import { geocodeSearch, reverseGeocode } from '../../services/geocoding'
import styles from './SearchPanel.module.css'

const MODES: { id: TransportMode; label: string }[] = [
  { id: 'train', label: '🚆 TRAIN' },
  { id: 'plane', label: '✈ FLIGHT' },
  { id: 'bus',   label: '🚌 COACH' },
  { id: 'ferry', label: '⛴ FERRY' },
]

const DISCOUNTS: { id: Discount; label: string }[] = [
  { id: 'railcard1625', label: '16-25' },
  { id: 'totum',        label: 'TOTUM' },
  { id: 'twotogether',  label: '2GETHER' },
  { id: 'senior',       label: 'SENIOR' },
]

const TRIP_TYPES: { id: TripType | ''; label: string }[] = [
  { id: '',            label: 'ANY' },
  { id: 'daytrip',     label: 'DAY TRIP' },
  { id: 'weekend',     label: 'WEEKEND' },
  { id: 'longweekend', label: 'LONG WKND' },
  { id: 'week',        label: 'WEEK' },
]

const SCOPE_OPTS: { id: TravelScope; label: string }[] = [
  { id: 'any',    label: 'ANYWHERE' },
  { id: 'uk',     label: 'UK ONLY' },
  { id: 'abroad', label: 'ABROAD' },
]

const SIZE_OPTS: { id: SizeFilter; label: string; sub: string }[] = [
  { id: 'any',        label: 'ANY SIZE',  sub: '' },
  { id: 'village',    label: 'VILLAGE',   sub: '<10K' },
  { id: 'town',       label: 'TOWN',      sub: '10-100K' },
  { id: 'city',       label: 'CITY',      sub: '100-500K' },
  { id: 'large-city', label: 'BIG CITY',  sub: '500K-1M' },
  { id: 'metropolis', label: 'METROPOLIS',sub: '1M+' },
]

const SORT_OPTS: { id: SortBy; label: string }[] = [
  { id: 'distance',      label: 'NEAREST' },
  { id: 'distance-desc', label: 'FURTHEST' },
  { id: 'price',         label: 'CHEAPEST' },
  { id: 'time',          label: 'FASTEST' },
  { id: 'name',          label: 'A → Z' },
  { id: 'population',    label: 'BIGGEST' },
]

const TAG_OPTS = [
  'COASTAL', 'HISTORIC', 'CITY BREAK', 'CULTURE', 'NIGHTLIFE',
  'FOODIE', 'MOUNTAINS', 'BEACH', 'UNIVERSITY', 'MARKET TOWN',
  'SPA', 'MEDIEVAL', 'CATHEDRAL', 'ART', 'MUSIC', 'BEER', 'WINE',
  'HIDDEN GEM', 'ISLANDS', 'DESIGN', 'PORT',
]

const TRAVEL_TIME_OPTS = [
  { value: 0,   label: 'ANY' },
  { value: 60,  label: '1H' },
  { value: 120, label: '2H' },
  { value: 180, label: '3H' },
  { value: 240, label: '4H' },
  { value: 300, label: '5H' },
  { value: 360, label: '6H' },
  { value: 420, label: '7H' },
  { value: 480, label: '8H+' },
]

const DEPART_OPTS = [
  { id: 'flexible',     label: 'FLEXIBLE' },
  { id: 'tomorrow',     label: 'TOMORROW' },
  { id: 'this-weekend', label: 'THIS WKND' },
  { id: 'next-weekend', label: 'NEXT WKND' },
  { id: 'next-week',    label: 'NEXT WEEK' },
]

function computeDepartDate(option: string): Date | null {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay() // 0=Sun, 1=Mon … 6=Sat
  switch (option) {
    case 'tomorrow':
      d.setDate(d.getDate() + 1)
      return d
    case 'this-weekend': {
      const toSat = dow === 6 ? 7 : Math.max(1, 6 - dow)
      d.setDate(d.getDate() + toSat)
      return d
    }
    case 'next-weekend': {
      const toSat = dow === 6 ? 7 : Math.max(1, 6 - dow)
      d.setDate(d.getDate() + toSat + 7)
      return d
    }
    case 'next-week': {
      const toMon = dow === 0 ? 1 : (8 - dow)
      d.setDate(d.getDate() + toMon)
      return d
    }
    default: return null
  }
}

export function SearchPanel() {
  const {
    origin, setOrigin,
    budget, setBudget,
    tripType, setTripType,
    modes, toggleMode,
    discounts, toggleDiscount,
    passengers, setPassengers,
    sizeFilter, setSizeFilter,
    selectedCountries, toggleCountry,
    selectedTags, toggleTag,
    searchQuery, setSearchQuery,
    sortBy, setSortBy,
    maxTravelMins, setMaxTravelMins,
    travelScope, setTravelScope,
    tripDirection, setTripDirection,
    departDate, setDepartDate,
    runSearch, isLoading,
    content, clearFilters,
    availableCountries,
    needsAccommodation, toggleNeedsAccommodation,
    boardScrollDir,
    settings,
  } = useSearchStore()

  const [filtersOpen, setFiltersOpen] = useState(false)
  // Hide full panel on scroll down; show mini-bar on scroll up
  const panelHidden = boardScrollDir !== 'none'
  const miniBarVisible = boardScrollDir === 'up'
  const [suggestions, setSuggestions] = useState<{ name: string; lat: number; lng: number }[]>([])
  const [geoLoading, setGeoLoading] = useState(false)
  const [originInput, setOriginInput] = useState(origin)
  const [budgetInput, setBudgetInput] = useState(String(budget))
  const [countryDropOpen, setCountryDropOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestRef = useRef<HTMLDivElement>(null)
  const countryDropRef = useRef<HTMLDivElement>(null)

  // Keep budgetInput in sync when slider moves
  function commitBudget(raw: string) {
    const n = parseInt(raw.replace(/[^0-9]/g, ''), 10)
    if (!isNaN(n)) {
      const clamped = Math.max(10, Math.min(500, Math.round(n / 5) * 5))
      setBudget(clamped)
      setBudgetInput(String(clamped))
    } else {
      setBudgetInput(String(budget))
    }
  }

  const totalPax = passengers.adults + passengers.students + passengers.children + passengers.seniors
  const activeFilterCount =
    (sizeFilter !== 'any' ? 1 : 0) +
    selectedCountries.length +
    selectedTags.length +
    (searchQuery.trim() ? 1 : 0) +
    (sortBy !== 'distance' ? 1 : 0) +
    (travelScope !== 'any' ? 1 : 0)

  // Autocomplete origin
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (originInput.trim().length < 2) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      const results = await geocodeSearch(originInput)
      setSuggestions(results.slice(0, 5))
    }, 350)
  }, [originInput])

  // Close suggestions on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setSuggestions([])
      }
      if (countryDropRef.current && !countryDropRef.current.contains(e.target as Node)) {
        setCountryDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Mini-bar values
  const pillOrigin = origin.split(',')[0].trim() || 'LOCATION'

  function pickSuggestion(s: { name: string; lat: number; lng: number }) {
    setOriginInput(s.name)
    setOrigin(s.name, s.lat, s.lng)
    setSuggestions([])
  }

  async function findMe() {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const result = await reverseGeocode(lat, lng)
        if (result) {
          setOriginInput(result.name)
          setOrigin(result.name, result.lat, result.lng)
        } else {
          setOriginInput(`${lat.toFixed(3)}, ${lng.toFixed(3)}`)
          setOrigin('My Location', lat, lng)
        }
        setGeoLoading(false)
      },
      () => setGeoLoading(false),
      { timeout: 8000 },
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { setSuggestions([]); runSearch() }
    if (e.key === 'Escape') setSuggestions([])
  }

  const countries = availableCountries()

  return (
    <div className={`${styles.wrap} ${panelHidden ? styles.wrapScrolled : ''}`}>

      {/* ── Compact mini-bar (mobile only, visible when scrolled) ──────────── */}
      {/* Shows location + budget + sort so user can adjust without scrolling back up */}
      <div className={`${styles.miniBar} ${miniBarVisible ? styles.miniBarVisible : ''}`}>

        {/* Map / Board toggle */}
        {settings.features.showMapLink && (
          <>
            <NavLink
              to="/board"
              className={({ isActive }) => `${styles.miniNavLink} ${isActive ? styles.miniNavLinkActive : ''}`}
            >
              LIST
            </NavLink>
            <NavLink
              to="/map"
              className={({ isActive }) => `${styles.miniNavLink} ${isActive ? styles.miniNavLinkActive : ''}`}
            >
              MAP
            </NavLink>
            <span className={styles.miniSep} />
          </>
        )}

        {/* Location chip — tap to scroll back up and reveal full panel */}
        <button
          className={styles.miniOrigin}
          onClick={() => window.dispatchEvent(new CustomEvent('board-scroll-top'))}
          title="Tap to edit full search"
        >
          📍 {pillOrigin}
        </button>

        <span className={styles.miniSep} />

        {/* Budget — live slider */}
        <div className={styles.miniGroup}>
          <span className={styles.miniLabel}>£{budget}</span>
          <input
            type="range"
            className={styles.miniSlider}
            min={10} max={500} step={5}
            value={budget}
            onChange={e => { const v = Number(e.target.value); setBudget(v); setBudgetInput(String(v)) }}
          />
        </div>

        <span className={styles.miniSep} />

        {/* Sort — dropdown */}
        <div className={styles.miniSortWrap}>
          <span className={styles.miniSortLabel}>SORT</span>
          <select
            className={styles.miniSortSelect}
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortBy)}
          >
            {SORT_OPTS.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

      </div>

      {/* ── Expanded panel (hidden on mobile when scrolled) ──────────────── */}
      <div className={panelHidden ? styles.panelOuterHidden : ''}>

      {/* ── Main row ─────────────────────────────────────────────────────── */}
      <div className={styles.panel}>

        {/* Origin */}
        <div className={styles.group} ref={suggestRef as React.RefObject<HTMLDivElement>}>
          <span className={styles.label}>DEPART FROM</span>
          <div className={styles.originWrap}>
            <input
              className={styles.input}
              value={originInput}
              onChange={e => setOriginInput(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="LONDON"
              maxLength={60}
              spellCheck={false}
              autoComplete="off"
            />
            <button
              className={`${styles.geoBtn} ${geoLoading ? styles.geoBtnLoading : ''}`}
              onClick={findMe}
              title="Use my location"
              type="button"
            >
              {geoLoading ? '…' : '📍'}
            </button>
            {suggestions.length > 0 && (
              <div className={styles.suggestions}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className={styles.suggestion}
                    onMouseDown={() => pickSuggestion(s)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.separator} />

        {/* Budget */}
        <div className={styles.group}>
          <span className={styles.label}>BUDGET</span>
          <div className={styles.inlineRow}>
            <span className={styles.budgetPrefix}>£</span>
            <input
              type="text"
              inputMode="numeric"
              className={styles.budgetInput}
              value={budgetInput}
              onChange={e => setBudgetInput(e.target.value)}
              onBlur={e => commitBudget(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { commitBudget((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur() }
              }}
              maxLength={3}
              spellCheck={false}
              autoComplete="off"
            />
            <input
              type="range"
              className={styles.slider}
              min={10} max={500} step={5}
              value={budget}
              onChange={e => { const v = Number(e.target.value); setBudget(v); setBudgetInput(String(v)) }}
            />
          </div>
        </div>

        <div className={styles.separator} />

        {/* Transport modes */}
        <div className={styles.group}>
          <span className={styles.label}>TRAVEL BY</span>
          <div className={styles.chips}>
            {MODES.map(m => {
              const on = modes.includes(m.id)
              return (
                <button
                  key={m.id}
                  className={`${styles.chip} ${on ? (
                    m.id === 'train' ? styles.chipTrain :
                    m.id === 'plane' ? styles.chipPlane :
                    m.id === 'bus'   ? styles.chipBus   : styles.chipFerry
                  ) : ''}`}
                  onClick={() => toggleMode(m.id)}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className={styles.separator} />

        {/* Accommodation toggle */}
        <div className={styles.group}>
          <span className={styles.label}>STAY</span>
          <button
            className={`${styles.chip} ${needsAccommodation ? styles.chipAmber : ''}`}
            onClick={toggleNeedsAccommodation}
            title="Show accommodation options in destination cards"
          >
            🛏 {needsAccommodation ? 'HOTEL ON' : 'HOTEL OFF'}
          </button>
        </div>

        <div className={styles.separator} />

        {/* Scope */}
        <div className={styles.group}>
          <span className={styles.label}>WHERE</span>
          <div className={styles.chips}>
            {SCOPE_OPTS.map(s => (
              <button
                key={s.id}
                className={`${styles.chip} ${travelScope === s.id ? styles.chipAmber : ''}`}
                onClick={() => setTravelScope(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.separator} />

        {/* Return / One-way */}
        <div className={styles.group}>
          <span className={styles.label}>JOURNEY</span>
          <div className={styles.chips}>
            <button
              className={`${styles.chip} ${tripDirection === 'return' ? styles.chipAmber : ''}`}
              onClick={() => setTripDirection('return')}
            >⇄ RETURN</button>
            <button
              className={`${styles.chip} ${tripDirection === 'oneway' ? styles.chipAmber : ''}`}
              onClick={() => setTripDirection('oneway')}
            >→ ONE WAY</button>
          </div>
        </div>

        <div className={styles.separator} />

        {/* Departure date */}
        <div className={styles.group}>
          <span className={styles.label}>LEAVING</span>
          <div className={styles.chips}>
            {DEPART_OPTS.map(o => {
              const active = departDate === o.id
              return (
                <button
                  key={o.id}
                  className={`${styles.chip} ${active ? styles.chipAmber : ''}`}
                  onClick={() => setDepartDate(o.id)}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
          {departDate !== 'flexible' && (() => {
            const d = computeDepartDate(departDate)
            return d ? (
              <span className={styles.departDateLabel}>
                {d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
              </span>
            ) : null
          })()}
        </div>

        <div className={styles.separator} />

        {/* Passengers */}
        <div className={styles.group}>
          <span className={styles.label}>PAX</span>
          <div className={styles.inlineRow}>
            <span className={styles.budgetValue}>{totalPax}</span>
            <button className={styles.chip}
              onClick={() => totalPax > 1 && setPassengers({ ...passengers, adults: Math.max(1, passengers.adults - 1) })}>−</button>
            <button className={styles.chip}
              onClick={() => setPassengers({ ...passengers, adults: passengers.adults + 1 })}>+</button>
          </div>
        </div>

        <div className={styles.separator} />

        {/* Travel time */}
        <div className={styles.group}>
          <span className={styles.label}>TRAVEL TIME</span>
          <div className={styles.chips}>
            {TRAVEL_TIME_OPTS.map(o => (
              <button
                key={o.value}
                className={`${styles.chip} ${maxTravelMins === o.value ? styles.chipAmber : ''}`}
                onClick={() => setMaxTravelMins(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.separator} />

        {/* Sort */}
        <div className={styles.group}>
          <span className={styles.label}>SORT</span>
          <div className={styles.chips}>
            {SORT_OPTS.map(s => (
              <button
                key={s.id}
                className={`${styles.chip} ${sortBy === s.id ? styles.chipAmber : ''}`}
                onClick={() => setSortBy(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.rightGroup}>
          <button
            className={`${styles.filterToggle} ${filtersOpen ? styles.filterToggleOpen : ''}`}
            onClick={() => setFiltersOpen(v => !v)}
          >
            FILTERS{activeFilterCount > 0 && <span className={styles.badge}>{activeFilterCount}</span>}
          </button>
          <button className={styles.searchBtn} onClick={runSearch} disabled={isLoading}>
            {isLoading ? 'SCANNING…' : (content.searchPanel?.searchButton ?? 'FIND ESCAPES')}
          </button>
        </div>
      </div>

      {/* ── Filter drawer ────────────────────────────────────────────────── */}
      {filtersOpen && !panelHidden && (
        <div className={styles.drawer}>

          {/* Trip type */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>TRIP LENGTH</span>
            <div className={styles.chips}>
              {TRIP_TYPES.map(t => (
                <button
                  key={t.id}
                  className={`${styles.chip} ${tripType === t.id ? styles.chipAmber : ''}`}
                  onClick={() => setTripType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.drawerSep} />

          {/* Vibe / tags */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>VIBE</span>
            <div className={styles.chips}>
              {TAG_OPTS.map(t => (
                <button
                  key={t}
                  className={`${styles.chip} ${selectedTags.includes(t) ? styles.chipAmber : ''}`}
                  onClick={() => toggleTag(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.drawerSep} />

          {/* Size */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>DESTINATION SIZE</span>
            <div className={styles.chips}>
              {SIZE_OPTS.map(s => (
                <button
                  key={s.id}
                  className={`${styles.chip} ${sizeFilter === s.id ? styles.chipAmber : ''}`}
                  onClick={() => setSizeFilter(s.id)}
                >
                  {s.label}{s.sub && <span className={styles.chipSub}> {s.sub}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.drawerSep} />

          {/* Country — multi-select dropdown */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>COUNTRY</span>
            <div className={styles.countryDropWrap} ref={countryDropRef}>
              <button
                className={`${styles.countryDropBtn} ${selectedCountries.length > 0 ? styles.countryDropBtnActive : ''}`}
                onClick={() => setCountryDropOpen(v => !v)}
                type="button"
              >
                <span>
                  {selectedCountries.length === 0
                    ? 'ANY COUNTRY'
                    : selectedCountries.length === 1
                      ? selectedCountries[0]
                      : selectedCountries.length === 2
                        ? selectedCountries.join(', ')
                        : `${selectedCountries.length} COUNTRIES`}
                </span>
                <span className={styles.countryDropCaret}>{countryDropOpen ? '▴' : '▾'}</span>
              </button>
              {countryDropOpen && (
                <div className={styles.countryDropPanel}>
                  {countries.map(c => {
                    const active = selectedCountries.includes(c)
                    return (
                      <button
                        key={c}
                        className={`${styles.countryDropItem} ${active ? styles.countryDropItemActive : ''}`}
                        onClick={() => toggleCountry(c)}
                        type="button"
                      >
                        <span className={styles.countryDropCheck}>{active ? '✓' : ''}</span>
                        {c}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className={styles.drawerSep} />

          {/* Discounts + sort + search + clear */}
          <div className={styles.drawerBottom}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>DISCOUNT CARDS</span>
              <div className={styles.chips}>
                {DISCOUNTS.map(d => (
                  <button
                    key={d.id}
                    className={`${styles.chip} ${discounts.includes(d.id) ? styles.chipAmber : ''}`}
                    onClick={() => toggleDiscount(d.id)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>SEARCH</span>
              <input
                className={styles.searchInput}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="CITY, COUNTRY, VIBE..."
                spellCheck={false}
              />
            </div>

            {activeFilterCount > 0 && (
              <button className={styles.clearBtn} onClick={clearFilters}>
                CLEAR ALL ({activeFilterCount})
              </button>
            )}
          </div>
        </div>
      )}

      </div>{/* end panelOuter */}
    </div>
  )
}
