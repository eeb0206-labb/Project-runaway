/** Lightweight city record — stored in cities.json, no route data needed */
export interface CityEntry {
  id: string
  name: string
  country: string
  region: string
  lat: number
  lng: number
  population: number
  tags: string[]
  vibe: string
}

export type TransportMode = 'train' | 'plane' | 'bus' | 'ferry'
export type TripType = 'daytrip' | 'weekend' | 'longweekend' | 'week' | 'oneway'
export type TimeAtDest = 'few_hours' | 'full_day' | 'overnight' | '2nights' | '3nights' | 'week' | 'open'
export type Discount = 'railcard1625' | 'totum' | 'twotogether' | 'senior'

export interface Transport {
  mode: TransportMode
  operator: string
  travelTime: string
  priceGBP: number
  returnPriceGBP: number
  bookingUrl: string
  requiresConnection?: string
  /** Skyscanner 3-letter IATA code for the departure hub (e.g. 'LON', 'LHR', 'STN').
   *  Set by enrichWithLiveFlights; absent on static/estimated transport rows. */
  originSkyId?: string
  /** Skyscanner 3-letter IATA code for the destination (e.g. 'BCN', 'AMS'). */
  destSkyId?: string
  /** Raw Skyscanner fare only — does not include any surface leg to the airport.
   *  Present when the transport row has been enriched with live API data.
   *  Used to show the "Flight: £X + Train to hub: £Y" breakdown in the UI. */
  flightPriceGBP?: number
  /** Estimated cost to travel from the user's origin to the hub airport.
   *  Computed server-side via haversine distance at ~£0.25/km (min £10, max £80).
   *  Present alongside flightPriceGBP. */
  surfaceEstimateGBP?: number
}

export interface ItineraryStep {
  time: string
  icon: string
  description: string
  note: string
}

export interface Destination {
  id: string
  name: string
  country: string
  region: string
  lat: number
  lng: number
  population: number
  distanceKm: number
  transport: Transport[]
  tags: string[]
  vibe: string
  discounts: {
    railcard1625?: number
    totum?: number
    studentUniverse?: boolean
  }
  itinerary: ItineraryStep[]
  tripCompatibility: Record<TripType, boolean>
  timeAtDestCompatibility: Record<TimeAtDest, boolean>
}

export type SizeFilter = 'any' | 'village' | 'town' | 'city' | 'large-city' | 'metropolis'
export type SortBy = 'distance' | 'distance-desc' | 'price' | 'time' | 'name' | 'population'

export const SIZE_RANGES: Record<SizeFilter, [number, number]> = {
  any:         [0,       Infinity],
  village:     [0,       10_000],
  town:        [10_000,  100_000],
  city:        [100_000, 500_000],
  'large-city':[500_000, 1_000_000],
  metropolis:  [1_000_000, Infinity],
}

export interface Passengers {
  adults: number
  students: number
  children: number
  seniors: number
}

export interface Settings {
  theme: {
    colors: Record<string, string>
    fonts: {
      heading: string
      mono: string
      body: string
      headingUrl: string
      monoUrl: string
      bodyUrl: string
    }
  }
  ui: {
    tagline: string
    subTagline: string
    defaultOrigin: string
    defaultBudget: number
    currency: string
    boardColumns: {
      showRank: boolean
      showDistance: boolean
      showRoute: boolean
    }
  }
  features: {
    enableAudioEasterEgg: boolean
    showSurpriseMe: boolean
    showMapLink: boolean
    offlineBanner: boolean
  }
  ntfy: { topic: string }
}

export interface Content {
  ticker: string[]
  offlineBanner: string
  statusMessages: Record<string, string>
  searchPanel: Record<string, string>
  boardColumns: Record<string, string>
  footer: string
}

export interface GitStatus {
  changes: number
  branch: string
  lastCommit: string
}
