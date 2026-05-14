/**
 * computeDestination.ts
 *
 * Converts a lightweight CityEntry into a full Destination object by
 * estimating transport options from the current origin, rather than
 * storing static route data. Rome2Rio provides real routes on click.
 *
 * Price heuristics are intentionally rough — just enough to let the
 * budget filter work. The departure board shows "~£XX" for estimated
 * values and Rome2Rio live data replaces them on destination open.
 */

import type { CityEntry, Destination, Transport, TripType, TimeAtDest } from '../types'
import { haversineKm } from './geocoding'
import { ACCOMMODATION } from '../data/accommodation'

const UK_COUNTRIES = new Set(['England', 'Scotland', 'Wales', 'Northern Ireland'])
const EUROSTAR_COUNTRIES = new Set(['France', 'Belgium', 'Netherlands'])
const NEAR_RAIL_COUNTRIES = new Set(['Germany', 'Luxembourg', 'Switzerland', 'Austria', 'Spain', 'Italy'])
const FERRY_COUNTRIES = new Set(['Ireland', 'Isle of Man', 'Jersey', 'Guernsey', 'France', 'Belgium', 'Netherlands', 'Norway', 'Denmark'])

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function flightEstimate(distanceKm: number): { mins: number; price: number } {
  if (distanceKm < 600)   return { mins: 85,  price: 55 }
  if (distanceKm < 1200)  return { mins: 120, price: 80 }
  if (distanceKm < 2000)  return { mins: 165, price: 110 }
  if (distanceKm < 3500)  return { mins: 240, price: 180 }
  if (distanceKm < 6000)  return { mins: 390, price: 320 }
  if (distanceKm < 9000)  return { mins: 570, price: 500 }
  if (distanceKm < 12000) return { mins: 720, price: 680 }
  return                         { mins: 960, price: 850 }
}

/** Convert a city name to a URL-friendly slug, e.g. "Kingston upon Hull" → "kingston-upon-hull" */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''']/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export function estimateTransport(
  distanceKm: number,
  destCountry: string,
  destName: string,
  originName: string,
): Transport[] {
  const isUK = UK_COUNTRIES.has(destCountry)
  const isEurostar = EUROSTAR_COUNTRIES.has(destCountry) && distanceKm < 900
  const isNearRail = NEAR_RAIL_COUNTRIES.has(destCountry) && distanceKm < 1600
  const isFerry = FERRY_COUNTRIES.has(destCountry) && distanceKm < 800

  const transports: Transport[] = []

  const oSlug = toSlug(originName)
  const dSlug = toSlug(destName)
  const oEnc  = encodeURIComponent(originName)
  const dEnc  = encodeURIComponent(destName)

  // ── Local coach / bus (< 120km) ─────────────────────────────────────────
  if (distanceKm < 120) {
    const mins = Math.max(15, Math.round(distanceKm * 2.2))
    const price = Math.max(2, Math.round(distanceKm * 0.2))
    transports.push({
      mode: 'bus',
      operator: 'National Express / Megabus',
      travelTime: fmtMins(mins),
      priceGBP: price,
      returnPriceGBP: Math.round(price * 1.8),
      bookingUrl: `https://www.google.com/search?q=coach+from+${oEnc}+to+${dEnc}+tickets`,
      // Short bus hops are direct point-to-point
    })
  }

  // ── Domestic / near-Europe train ────────────────────────────────────────
  if ((isUK && distanceKm >= 25) || isEurostar || isNearRail) {
    const speedKmh = isEurostar ? 250 : isNearRail ? 180 : 130
    const trainMins = Math.max(20, Math.round((distanceKm / speedKmh) * 60 * 1.2))
    const pricePerKm = isEurostar ? 0.14 : isNearRail ? 0.12 : 0.1
    const trainPrice = Math.max(8, Math.round(distanceKm * pricePerKm))
    // Eurostar needs a connecting train at the far end to reach city centre;
    // Rail Europe journeys typically involve at least one change en route.
    const trainConnection: string | undefined =
      isNearRail  ? 'EUROSTAR → TRAIN' :
      isEurostar  ? 'EUROSTAR + METRO' :
      undefined   // UK direct train — no connection shown
    transports.push({
      mode: 'train',
      operator: isEurostar ? 'Eurostar / Rail Europe' : isNearRail ? 'Rail Europe / DB' : 'National Rail',
      travelTime: fmtMins(trainMins),
      priceGBP: trainPrice,
      returnPriceGBP: Math.round(trainPrice * 1.9),
      bookingUrl: `https://www.thetrainline.com/train-times/${oSlug}-to-${dSlug}`,
      requiresConnection: trainConnection,
    })
  }

  // ── Ferry ───────────────────────────────────────────────────────────────
  if (isFerry && distanceKm < 600) {
    const ferryMins = Math.max(90, Math.round(distanceKm * 4.5))
    const ferryPrice = Math.max(20, Math.round(distanceKm * 0.18))
    transports.push({
      mode: 'ferry',
      operator: 'Irish Ferries / Brittany Ferries / DFDS',
      travelTime: fmtMins(ferryMins),
      priceGBP: ferryPrice,
      returnPriceGBP: Math.round(ferryPrice * 1.8),
      bookingUrl: `https://www.google.com/search?q=ferry+from+${oEnc}+to+${dEnc}+tickets`,
      requiresConnection: 'TRAIN → FERRY → TRAIN', // need train to port both ends
    })
  }

  // ── Flight ──────────────────────────────────────────────────────────────
  const needsFlight = !isUK && !isEurostar && distanceKm > 80
  const flightAsOption = distanceKm > 300
  if (needsFlight || flightAsOption) {
    const { mins, price } = flightEstimate(distanceKm)
    // Work out the likely legs:
    //   < 500km  (short-hop, e.g. London–Edinburgh domestic): might drive to airport, direct
    //   500–8000km (most international): train to departure airport, flight, train at far end
    //   > 8000km (long-haul, likely connection): train, connecting flight, second flight
    const flightConnection: string =
      distanceKm > 8000 ? 'TRAIN → FLIGHT → FLIGHT' :
      distanceKm > 400  ? 'TRAIN → FLIGHT → TRAIN'  :
                          'TRAIN → FLIGHT'
    transports.push({
      mode: 'plane',
      operator: 'Various airlines',
      travelTime: fmtMins(mins),
      priceGBP: price,
      returnPriceGBP: Math.round(price * 1.9),
      // Google Flights accepts any city name pair — reliable fallback since we don't store IATA codes
      bookingUrl: `https://www.google.com/travel/flights?q=Flights+from+${oEnc}+to+${dEnc}`,
      requiresConnection: flightConnection,
    })
  }

  // Fallback — should never hit but just in case
  if (transports.length === 0) {
    transports.push({
      mode: 'bus',
      operator: 'Local transport',
      travelTime: fmtMins(Math.max(10, Math.round(distanceKm * 3))),
      priceGBP: Math.max(2, Math.round(distanceKm * 0.25)),
      returnPriceGBP: Math.max(3, Math.round(distanceKm * 0.4)),
      bookingUrl: `https://www.google.com/search?q=coach+from+${oEnc}+to+${dEnc}+tickets`,
    })
  }

  return transports
}

function computeDiscounts(destCountry: string, transports: Transport[]) {
  const isUK = UK_COUNTRIES.has(destCountry)
  const hasTrain = transports.some(t => t.mode === 'train')
  return {
    railcard1625: (isUK && hasTrain) ? 0.33 : undefined,
    totum: isUK ? 0.1 : 0.05,
    studentUniverse: true as const,
  }
}

function computeTripCompat(distanceKm: number): Record<TripType, boolean> {
  return {
    daytrip:     distanceKm < 450,
    weekend:     distanceKm < 4000,
    longweekend: true,
    week:        true,
    oneway:      true,
  }
}

function computeTimeCompat(distanceKm: number): Record<TimeAtDest, boolean> {
  return {
    few_hours:  distanceKm < 200,
    full_day:   distanceKm < 600,
    overnight:  true,
    '2nights':  distanceKm > 50,
    '3nights':  distanceKm > 150,
    week:       distanceKm > 300,
    open:       true,
  }
}

/**
 * Convert a CityEntry into a full Destination, computing transport
 * estimates from the given origin coordinates.
 */
export function computeDestination(
  city: CityEntry,
  originLat: number,
  originLng: number,
  originName: string = 'London',
): Destination {
  const distanceKm = haversineKm(originLat, originLng, city.lat, city.lng)
  const transport = estimateTransport(distanceKm, city.country, city.name, originName)
  return {
    ...city,
    distanceKm,
    transport,
    discounts: computeDiscounts(city.country, transport),
    itinerary: [],
    tripCompatibility: computeTripCompat(distanceKm),
    timeAtDestCompatibility: computeTimeCompat(distanceKm),
    accommodation: ACCOMMODATION[city.id] ?? [],
  }
}
