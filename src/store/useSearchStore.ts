import { create } from 'zustand'
import type {
  CityEntry, Destination, TransportMode, TripType, TimeAtDest, Discount,
  Passengers, Settings, Content, SizeFilter, SortBy,
} from '../types'
import { SIZE_RANGES } from '../types'
import { haversineKm } from '../services/geocoding'
import { computeDestination } from '../services/computeDestination'

import defaultCities from '../data/cities.json'
import defaultSettings from '../data/settings.json'
import defaultContent from '../data/content.json'

export type TravelScope = 'any' | 'uk' | 'abroad'

const UK_COUNTRIES = new Set(['England', 'Scotland', 'Wales', 'Northern Ireland'])

interface StoreState {
  settings: Settings
  content: Content
  allCities: CityEntry[]
  allDestinations: Destination[]  // legacy / admin-managed curated entries

  // origin
  origin: string
  originLat: number | null
  originLng: number | null

  // core search
  budget: number
  tripType: TripType | ''
  timeAtDest: TimeAtDest | ''
  modes: TransportMode[]
  discounts: Discount[]
  passengers: Passengers

  // filters
  sizeFilter: SizeFilter
  selectedCountries: string[]
  selectedTags: string[]
  searchQuery: string
  sortBy: SortBy
  maxTravelMins: number        // 0 = no limit
  travelScope: TravelScope
  tripDirection: 'return' | 'oneway'
  departDate: string           // 'flexible' | 'tomorrow' | 'this-weekend' | 'next-weekend' | 'next-week'

  results: Destination[]
  selectedDestination: Destination | null
  hasSearched: boolean
  isLoading: boolean
  adminOpen: boolean
  needsAccommodation: boolean

  // actions
  setOrigin: (name: string, lat?: number, lng?: number) => void
  setBudget: (v: number) => void
  setTripType: (v: TripType | '') => void
  setTimeAtDest: (v: TimeAtDest | '') => void
  toggleMode: (m: TransportMode) => void
  toggleDiscount: (d: Discount) => void
  setPassengers: (v: Passengers) => void
  setSelected: (d: Destination | null) => void

  setSizeFilter: (s: SizeFilter) => void
  toggleCountry: (c: string) => void
  toggleTag: (t: string) => void
  setSearchQuery: (q: string) => void
  setSortBy: (s: SortBy) => void
  setMaxTravelMins: (v: number) => void
  setTravelScope: (s: TravelScope) => void
  setTripDirection: (d: 'return' | 'oneway') => void
  setDepartDate: (d: string) => void

  toggleNeedsAccommodation: () => void
  runSearch: () => void
  surpriseMe: () => void
  clearFilters: () => void
  setSettings: (s: Settings) => void
  setContent: (c: Content) => void
  setDestinations: (d: Destination[]) => void
  setCities: (c: CityEntry[]) => void
  toggleAdmin: () => void
  init: (data: { settings: Settings; content: Content; destinations: Destination[] }) => void

  availableCountries: () => string[]
  availableTags: () => string[]
}

function parseMins(s: string): number {
  const h = s.match(/(\d+)h/)
  const m = s.match(/(\d+)m/)
  return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0)
}

function filterAndSort(
  destinations: Destination[],
  originLat: number | null,
  originLng: number | null,
  budget: number,
  tripType: TripType | '',
  timeAtDest: TimeAtDest | '',
  modes: TransportMode[],
  discounts: Discount[],
  passengers: Passengers,
  sizeFilter: SizeFilter,
  selectedCountries: string[],
  selectedTags: string[],
  searchQuery: string,
  sortBy: SortBy,
  maxTravelMins: number,
  travelScope: TravelScope,
  tripDirection: 'return' | 'oneway',
): Destination[] {
  const totalPax = Math.max(
    passengers.adults + passengers.students + passengers.children + passengers.seniors,
    1,
  )

  // Precompute distances from current origin (if coords available)
  const withDist = destinations.map(dest => {
    const km = (originLat != null && originLng != null)
      ? haversineKm(originLat, originLng, dest.lat, dest.lng)
      : dest.distanceKm
    return { dest, km }
  })

  const filtered = withDist.filter(({ dest, km }) => {
    // Scope filter
    const isUK = UK_COUNTRIES.has(dest.country)
    if (travelScope === 'uk' && !isUK) return false
    if (travelScope === 'abroad' && isUK) return false

    // Transport + budget
    // A journey is only valid if its primary mode AND every mode it connects through
    // are all enabled.  e.g. "TRAIN → FLIGHT → TRAIN" is excluded if trains are off.
    const validTransport = dest.transport.filter(t => {
      if (!modes.includes(t.mode)) return false
      if (t.requiresConnection) {
        const conn = t.requiresConnection.toUpperCase()
        if (!modes.includes('train') && conn.includes('TRAIN')) return false
        if (!modes.includes('bus')   && (conn.includes('BUS') || conn.includes('COACH'))) return false
        if (!modes.includes('ferry') && conn.includes('FERRY')) return false
      }
      return true
    })
    if (validTransport.length === 0) return false

    const cheapest = validTransport.reduce((min, t) =>
      t.returnPriceGBP < min.returnPriceGBP ? t : min,
    )

    let price = tripDirection === 'oneway' ? cheapest.priceGBP : cheapest.returnPriceGBP
    if (discounts.includes('railcard1625') && cheapest.mode === 'train') {
      price *= 1 - (dest.discounts.railcard1625 ?? 0.33)
    }
    if (discounts.includes('senior') && cheapest.mode === 'train') {
      price *= 1 - (dest.discounts.railcard1625 ?? 0.33)
    }
    if (discounts.includes('totum')) {
      price *= 1 - (dest.discounts.totum ?? 0.1)
    }
    if (price * totalPax > budget) return false

    // Travel time filter
    if (maxTravelMins > 0) {
      const minTravelTime = Math.min(
        ...validTransport.map(t => parseMins(t.travelTime)),
      )
      if (minTravelTime > maxTravelMins) return false
    }

    // Trip / time compatibility
    if (tripType && !dest.tripCompatibility[tripType]) return false
    if (timeAtDest && !dest.timeAtDestCompatibility[timeAtDest]) return false

    // Population / size
    if (sizeFilter !== 'any') {
      const [min, max] = SIZE_RANGES[sizeFilter]
      const pop = dest.population ?? 0
      if (pop < min || pop >= max) return false
    }

    // Country
    if (selectedCountries.length > 0 && !selectedCountries.includes(dest.country)) return false

    // Tags — destination must have ALL selected tags
    if (selectedTags.length > 0 && !selectedTags.every(t => dest.tags.includes(t))) return false

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      if (
        !dest.name.toLowerCase().includes(q) &&
        !dest.country.toLowerCase().includes(q) &&
        !(dest.region ?? '').toLowerCase().includes(q) &&
        !dest.vibe.toLowerCase().includes(q)
      ) return false
    }

    // Don't show the origin city itself
    if (km < 5) return false

    return true
  })

  // Sort (use dynamic distance `km` where relevant)
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'price': {
        const mA = a.dest.transport.filter(t => modes.includes(t.mode))
        const mB = b.dest.transport.filter(t => modes.includes(t.mode))
        // Use one-way priceGBP when the user has selected one-way, not returnPriceGBP
        const pKey = tripDirection === 'oneway' ? 'priceGBP' : 'returnPriceGBP'
        const pA = mA.length ? Math.min(...mA.map(t => t[pKey])) : Infinity
        const pB = mB.length ? Math.min(...mB.map(t => t[pKey])) : Infinity
        return pA - pB
      }
      case 'time': {
        const mA = a.dest.transport.filter(t => modes.includes(t.mode))
        const mB = b.dest.transport.filter(t => modes.includes(t.mode))
        const tA = mA.length ? Math.min(...mA.map(t => parseMins(t.travelTime))) : Infinity
        const tB = mB.length ? Math.min(...mB.map(t => parseMins(t.travelTime))) : Infinity
        return tA - tB
      }
      case 'name':
        return a.dest.name.localeCompare(b.dest.name)
      case 'population':
        return (b.dest.population ?? 0) - (a.dest.population ?? 0)
      case 'distance-desc':
        return b.km - a.km
      case 'distance':
      default:
        return a.km - b.km
    }
  })

  return filtered.map(({ dest }) => dest)
}

// Default origin: London
const DEFAULT_ORIGIN_LAT = 51.5074
const DEFAULT_ORIGIN_LNG = -0.1278

// Helper: compute full Destination[] from CityEntry[] + current origin
function computeAll(cities: CityEntry[], lat: number, lng: number, originName: string): Destination[] {
  return cities.map(city => computeDestination(city, lat, lng, originName))
}

// ── Live flight data helpers ─────────────────────────────────────────────────

interface LiveFlight {
  cityTo:          string
  countryCode:     string
  countryName:     string
  /** Total cost = flightPrice + surfaceEstimate.  Used for budget filtering + sorting. */
  price:           number
  /** Raw Skyscanner fare — flight only, no surface leg. */
  flightPrice:     number
  /** Estimated cost: origin → hub airport (haversine × £0.25/km). */
  surfaceEstimate: number
  flyDuration:     string
  latTo:           number
  lngTo:           number
  bookingUrl:      string
  direct?:         boolean
  originSkyId?:    string
  destSkyId?:      string
}

/** Convert a store departDate token → YYYY-MM-DD local date string.
 *  Exported so DestinationDetail can derive Date objects from the same
 *  calendar logic — prevents a three-way split between the UI, URL builders, and API. */
export function departDateToISO(option: string): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay()
  switch (option) {
    case 'tomorrow':
      d.setDate(d.getDate() + 1); break
    case 'this-weekend': {
      const toSat = dow === 6 ? 7 : Math.max(1, 6 - dow)
      d.setDate(d.getDate() + toSat); break
    }
    case 'next-weekend': {
      const toSat = dow === 6 ? 7 : Math.max(1, 6 - dow)
      d.setDate(d.getDate() + toSat + 7); break
    }
    case 'next-week': {
      const toMon = dow === 0 ? 1 : (8 - dow)
      d.setDate(d.getDate() + toMon); break
    }
    default: // 'flexible' → 2 weeks out
      d.setDate(d.getDate() + 14); break
  }
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

interface FetchFlightsResult {
  flights:      LiveFlight[]
  /** true = RAPIDAPI_KEY was present and the API was called, regardless of whether
   *  results came back.  false = no key configured (offline / dev mode).
   *  Used by runSearch to decide whether to strip static plane routes from results:
   *  if the API was live but returned nothing, static £80 estimates must not be shown. */
  liveAttempted: boolean
}

/** Call the Netlify Function proxy and return live flights */
async function fetchLiveFlights(params: {
  originCity:    string
  originLat:     number
  originLng:     number
  budget:        number
  departDate:    string
  passengers:    number
  tripDirection: 'return' | 'oneway'
}): Promise<FetchFlightsResult> {
  try {
    const resp = await fetch('/api/get-routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!resp.ok) {
      const ct = resp.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        const text = await resp.text()
        console.error(`[runaway] Backend error (HTTP ${resp.status}, non-JSON):`, text)
      }
      return { flights: [], liveAttempted: true }
    }

    // Guard against non-JSON success responses (e.g. Netlify "Function not found" HTML/text)
    const ct = resp.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) {
      const text = await resp.text()
      console.error('[runaway] Backend returned non-JSON body:', text)
      return { flights: [], liveAttempted: true }
    }

    const data = await resp.json()
    // no_key = no RAPIDAPI_KEY configured — offline/dev mode, keep static estimates
    if (data.source === 'no_key') return { flights: [], liveAttempted: false }
    if (data.source !== 'live') {
      console.warn(
        `[runaway] Live flights unavailable — source: "${data.source}"`,
        data.error ? `| reason: ${data.error}` : '',
      )
      // API was called but returned no usable data — liveAttempted stays true
      return { flights: [], liveAttempted: true }
    }
    return { flights: (data.flights as LiveFlight[]) ?? [], liveAttempted: true }
  } catch {
    return { flights: [], liveAttempted: true }
  }
}

/** Remove all plane-mode transport from destinations.
 *  Called when the live flight API was reachable but returned 0 results, so we
 *  never show the static hardcoded £80 estimates — an honest empty state beats
 *  misleading prices.  Train / bus / ferry routes are preserved unchanged. */
function stripPlaneTransport(destinations: Destination[]): Destination[] {
  return destinations
    .map(dest => ({
      ...dest,
      transport: dest.transport.filter(t => t.mode !== 'plane'),
    }))
    .filter(dest => dest.transport.length > 0)   // drop cities that are flight-only
}

/** Replace static flight estimates with live Skyscanner prices where city name matches */
function enrichWithLiveFlights(destinations: Destination[], live: LiveFlight[]): Destination[] {
  if (live.length === 0) return destinations
  const map = new Map<string, LiveFlight>()
  live.forEach(f => map.set(f.cityTo.toLowerCase().trim(), f))

  return destinations.map(dest => {
    const flight = map.get(dest.name.toLowerCase().trim())
    if (!flight) return dest
    const directTag = flight.direct ? ' · direct' : ''
    const updatedTransport = dest.transport.map(t => {
      if (t.mode !== 'plane') return t
      return {
        ...t,
        // priceGBP = total journey cost (flight + surface) for accurate sorting & budget
        priceGBP:           flight.price,
        returnPriceGBP:     flight.price,
        travelTime:         flight.flyDuration || t.travelTime,
        bookingUrl:         flight.bookingUrl || t.bookingUrl,
        operator:           `★ Live — Skyscanner${directTag}`,
        originSkyId:        flight.originSkyId,
        destSkyId:          flight.destSkyId,
        // Cost components forwarded so DestinationDetail can show the breakdown
        flightPriceGBP:     flight.flightPrice,
        surfaceEstimateGBP: flight.surfaceEstimate,
      }
    })
    return { ...dest, transport: updatedTransport }
  })
}

// Helper: re-apply filter+sort to existing data instantly (no loading spinner).
// Call after any set() that changes a filter value, so results stay live.
function reapply(get: () => StoreState, set: (p: Partial<StoreState>) => void) {
  const s = get()
  if (!s.hasSearched) return
  const oLat = s.originLat ?? DEFAULT_ORIGIN_LAT
  const oLng = s.originLng ?? DEFAULT_ORIGIN_LNG
  const computed = computeAll(s.allCities, oLat, oLng, s.origin)
  const merged = [...computed, ...s.allDestinations.filter(d => !computed.find(c => c.id === d.id))]
  const results = filterAndSort(
    merged, s.originLat, s.originLng,
    s.budget, s.tripType, s.timeAtDest, s.modes, s.discounts, s.passengers,
    s.sizeFilter, s.selectedCountries, s.selectedTags, s.searchQuery, s.sortBy,
    s.maxTravelMins, s.travelScope, s.tripDirection,
  )
  set({ results, selectedDestination: null })
}

export const useSearchStore = create<StoreState>((set, get) => ({
  settings: defaultSettings as Settings,
  content: defaultContent as Content,
  allCities: defaultCities as CityEntry[],
  allDestinations: [],  // admin-managed curated entries (merged at search time)

  origin: (defaultSettings as Settings).ui.defaultOrigin,
  originLat: DEFAULT_ORIGIN_LAT,
  originLng: DEFAULT_ORIGIN_LNG,

  budget: (defaultSettings as Settings).ui.defaultBudget,
  tripType: '',
  timeAtDest: '',
  modes: ['train', 'plane', 'bus', 'ferry'],
  discounts: [],
  passengers: { adults: 1, students: 0, children: 0, seniors: 0 },

  sizeFilter: 'any',
  selectedCountries: [],
  selectedTags: [],
  searchQuery: '',
  sortBy: 'price',
  maxTravelMins: 0,
  travelScope: 'any',
  tripDirection: 'return',
  departDate: 'flexible',

  results: [],
  selectedDestination: null,
  hasSearched: false,
  isLoading: false,
  adminOpen: false,
  needsAccommodation: false,

  setOrigin: (name, lat, lng) => {
    const newLat = lat ?? null
    const newLng = lng ?? null
    set({ origin: name, originLat: newLat, originLng: newLng })
    // Auto-refresh results when origin changes if we've already searched
    const s = get()
    if (s.hasSearched) {
      const oLat = newLat ?? DEFAULT_ORIGIN_LAT
      const oLng = newLng ?? DEFAULT_ORIGIN_LNG
      const computed = computeAll(s.allCities, oLat, oLng, name)
      const merged = [...computed, ...s.allDestinations.filter(d => !computed.find(c => c.id === d.id))]
      const results = filterAndSort(
        merged, newLat, newLng,
        s.budget, s.tripType, s.timeAtDest, s.modes, s.discounts, s.passengers,
        s.sizeFilter, s.selectedCountries, s.selectedTags, s.searchQuery, s.sortBy,
        s.maxTravelMins, s.travelScope, s.tripDirection,
      )
      set({ results, selectedDestination: null })
    }
  },

  setBudget: v => { set({ budget: v }); reapply(get, set) },
  setTripType: v => { set({ tripType: v }); reapply(get, set) },
  setTimeAtDest: v => { set({ timeAtDest: v }); reapply(get, set) },

  toggleMode: m => {
    set(s => ({ modes: s.modes.includes(m) ? s.modes.filter(x => x !== m) : [...s.modes, m] }))
    reapply(get, set)
  },

  toggleDiscount: d => {
    set(s => ({ discounts: s.discounts.includes(d) ? s.discounts.filter(x => x !== d) : [...s.discounts, d] }))
    reapply(get, set)
  },

  setPassengers: v => { set({ passengers: v }); reapply(get, set) },
  setSelected: d => set({ selectedDestination: d }),
  toggleNeedsAccommodation: () => set(s => ({ needsAccommodation: !s.needsAccommodation })),

  setSizeFilter: s => { set({ sizeFilter: s }); reapply(get, set) },

  toggleCountry: c => {
    set(s => ({
      selectedCountries: s.selectedCountries.includes(c)
        ? s.selectedCountries.filter(x => x !== c)
        : [...s.selectedCountries, c],
    }))
    reapply(get, set)
  },

  toggleTag: t => {
    set(s => ({
      selectedTags: s.selectedTags.includes(t)
        ? s.selectedTags.filter(x => x !== t)
        : [...s.selectedTags, t],
    }))
    reapply(get, set)
  },

  setSearchQuery: q => { set({ searchQuery: q }); reapply(get, set) },

  setSortBy: s => { set({ sortBy: s }); reapply(get, set) },

  setMaxTravelMins: v => { set({ maxTravelMins: v }); reapply(get, set) },
  setTravelScope: s => { set({ travelScope: s }); reapply(get, set) },
  setTripDirection: d => { set({ tripDirection: d }); reapply(get, set) },
  setDepartDate: d => { set({ departDate: d }); reapply(get, set) },

  runSearch: () => {
    const s = get()
    set({ isLoading: true })

    // Run async, but keep the action signature as () => void
    ;(async () => {
      const oLat = s.originLat ?? DEFAULT_ORIGIN_LAT
      const oLng = s.originLng ?? DEFAULT_ORIGIN_LNG

      // 1. Always compute static destinations as the base dataset
      const computed = computeAll(s.allCities, oLat, oLng, s.origin)
      const merged   = [
        ...computed,
        ...s.allDestinations.filter(d => !computed.find(c => c.id === d.id)),
      ]

      // 2. Attempt to enrich flight prices with live Skyscanner data via RapidAPI
      const totalPax = Math.max(
        s.passengers.adults + s.passengers.students +
        s.passengers.children + s.passengers.seniors,
        1,
      )
      const { flights: liveFlights, liveAttempted } = await fetchLiveFlights({
        originCity:    s.origin,
        originLat:     oLat,
        originLng:     oLng,
        budget:        s.budget,
        departDate:    departDateToISO(s.departDate),
        passengers:    totalPax,
        tripDirection: s.tripDirection,
      })

      // 3. Merge live data — or strip static plane prices when the API was tried but failed
      //    liveAttempted=true + 0 flights → API live but returned nothing (error / no results).
      //    In that case we remove plane transport entirely rather than show stale £80 estimates.
      //    liveAttempted=false → no RAPIDAPI_KEY configured (dev/offline), keep static data.
      const base    = liveAttempted && liveFlights.length === 0 ? stripPlaneTransport(merged) : merged
      const enriched = enrichWithLiveFlights(base, liveFlights)

      // 4. Filter + sort exactly as before
      const results = filterAndSort(
        enriched,
        s.originLat, s.originLng,
        s.budget, s.tripType, s.timeAtDest, s.modes, s.discounts, s.passengers,
        s.sizeFilter, s.selectedCountries, s.selectedTags, s.searchQuery, s.sortBy,
        s.maxTravelMins, s.travelScope, s.tripDirection,
      )

      set({ results, isLoading: false, hasSearched: true, selectedDestination: null })
    })()
  },

  surpriseMe: () => {
    const { results } = get()
    if (results.length === 0) return
    set({ selectedDestination: results[Math.floor(Math.random() * results.length)] })
  },

  clearFilters: () => set({
    sizeFilter: 'any',
    selectedCountries: [],
    selectedTags: [],
    searchQuery: '',
    sortBy: 'price',
    maxTravelMins: 0,
    travelScope: 'any',
  }),

  setSettings: s => set({ settings: s }),
  setContent: c => set({ content: c }),
  setDestinations: d => set({ allDestinations: d }),
  setCities: c => set({ allCities: c }),
  toggleAdmin: () => set(s => ({ adminOpen: !s.adminOpen })),

  init: ({ settings, content, destinations }) => {
    set({
      settings: settings as Settings,
      content: content as Content,
      allDestinations: destinations as Destination[],
      origin: settings.ui.defaultOrigin,
      budget: settings.ui.defaultBudget,
    })
  },

  availableCountries: () => {
    const all = get().allCities
    return [...new Set(all.map(d => d.country))].sort()
  },

  availableTags: () => {
    const tags = new Set<string>()
    get().allCities.forEach(d => d.tags.forEach(t => tags.add(t)))
    return [...tags].sort()
  },
}))
