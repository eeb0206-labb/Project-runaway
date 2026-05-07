import { create } from 'zustand'
import type { Destination, TransportMode, TripType, TimeAtDest, Discount, Passengers, Settings, Content } from '../types'

import defaultDestinations from '../data/destinations.json'
import defaultSettings from '../data/settings.json'
import defaultContent from '../data/content.json'

interface StoreState {
  settings: Settings
  content: Content
  allDestinations: Destination[]

  origin: string
  budget: number
  tripType: TripType | ''
  timeAtDest: TimeAtDest | ''
  modes: TransportMode[]
  discounts: Discount[]
  passengers: Passengers
  results: Destination[]
  selectedDestination: Destination | null
  hasSearched: boolean
  isLoading: boolean
  adminOpen: boolean

  setOrigin: (v: string) => void
  setBudget: (v: number) => void
  setTripType: (v: TripType | '') => void
  setTimeAtDest: (v: TimeAtDest | '') => void
  toggleMode: (m: TransportMode) => void
  toggleDiscount: (d: Discount) => void
  setPassengers: (v: Passengers) => void
  setSelected: (d: Destination | null) => void
  runSearch: () => void
  surpriseMe: () => void
  setSettings: (s: Settings) => void
  setContent: (c: Content) => void
  setDestinations: (d: Destination[]) => void
  toggleAdmin: () => void
  init: (data: { settings: Settings; content: Content; destinations: Destination[] }) => void
}

function filterAndSort(
  destinations: Destination[],
  budget: number,
  tripType: TripType | '',
  timeAtDest: TimeAtDest | '',
  modes: TransportMode[],
  discounts: Discount[],
  passengers: Passengers,
): Destination[] {
  const totalPax = Math.max(
    passengers.adults + passengers.students + passengers.children + passengers.seniors,
    1,
  )

  return destinations
    .filter(dest => {
      const validTransport = dest.transport.filter(t => modes.includes(t.mode))
      if (validTransport.length === 0) return false

      const cheapest = validTransport.reduce((min, t) =>
        t.returnPriceGBP < min.returnPriceGBP ? t : min,
      )

      let price = cheapest.returnPriceGBP
      if (discounts.includes('railcard1625') && cheapest.mode === 'train') {
        price *= 1 - (dest.discounts.railcard1625 ?? 0.33)
      }
      if (discounts.includes('senior') && cheapest.mode === 'train') {
        price *= 1 - (dest.discounts.railcard1625 ?? 0.33)
      }
      if (discounts.includes('totum')) {
        price *= 1 - (dest.discounts.totum ?? 0.1)
      }

      const totalCost = price * totalPax
      if (totalCost > budget) return false
      if (tripType && !dest.tripCompatibility[tripType]) return false
      if (timeAtDest && !dest.timeAtDestCompatibility[timeAtDest]) return false

      return true
    })
    .sort((a, b) => b.distanceKm - a.distanceKm)
}

export const useSearchStore = create<StoreState>((set, get) => ({
  settings: defaultSettings as Settings,
  content: defaultContent as Content,
  allDestinations: defaultDestinations as Destination[],

  origin: (defaultSettings as Settings).ui.defaultOrigin,
  budget: (defaultSettings as Settings).ui.defaultBudget,
  tripType: '',
  timeAtDest: '',
  modes: ['train', 'plane', 'bus', 'ferry'],
  discounts: [],
  passengers: { adults: 1, students: 0, children: 0, seniors: 0 },
  results: [],
  selectedDestination: null,
  hasSearched: false,
  isLoading: false,
  adminOpen: false,

  setOrigin: v => set({ origin: v }),
  setBudget: v => set({ budget: v }),
  setTripType: v => set({ tripType: v }),
  setTimeAtDest: v => set({ timeAtDest: v }),

  toggleMode: m => set(s => ({
    modes: s.modes.includes(m) ? s.modes.filter(x => x !== m) : [...s.modes, m],
  })),

  toggleDiscount: d => set(s => ({
    discounts: s.discounts.includes(d) ? s.discounts.filter(x => x !== d) : [...s.discounts, d],
  })),

  setPassengers: v => set({ passengers: v }),
  setSelected: d => set({ selectedDestination: d }),

  runSearch: () => {
    const { allDestinations, budget, tripType, timeAtDest, modes, discounts, passengers } = get()
    set({ isLoading: true })
    // Simulate brief loading for animation effect
    setTimeout(() => {
      const results = filterAndSort(allDestinations, budget, tripType, timeAtDest, modes, discounts, passengers)
      set({ results, isLoading: false, hasSearched: true, selectedDestination: null })
    }, 400)
  },

  surpriseMe: () => {
    const { results } = get()
    if (results.length === 0) return
    const pick = results[Math.floor(Math.random() * results.length)]
    set({ selectedDestination: pick })
  },

  setSettings: s => set({ settings: s }),
  setContent: c => set({ content: c }),
  setDestinations: d => set({ allDestinations: d }),
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
}))
