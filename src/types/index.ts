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
  lat: number
  lng: number
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
