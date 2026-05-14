/**
 * TravelTime API — isochrone-based destination filtering.
 *
 * Instead of straight-line distance filtering, TravelTime calculates
 * which locations are actually reachable within a time budget using
 * real transport networks (trains, buses, flights, walking).
 *
 * Free tier: 10,000 queries/month at traveltimeplatform.com
 * Set VITE_TRAVELTIME_APP_ID and VITE_TRAVELTIME_API_KEY in .env.local
 *
 * Falls back to haversine distance filtering if no API key is set.
 */

const APP_ID = import.meta.env.VITE_TRAVELTIME_APP_ID as string | undefined
const API_KEY = import.meta.env.VITE_TRAVELTIME_API_KEY as string | undefined
const BASE = 'https://api.traveltimeapp.com/v4'

export const hasTravelTimeKey = !!(APP_ID && API_KEY)

export interface TTLocation {
  id: string
  lat: number
  lng: number
}

export interface TTResult {
  id: string
  travelTimeSecs: number  // actual travel time, 0 if API unavailable
}

/**
 * Filter a list of candidate locations to only those reachable within
 * `maxSeconds` from `origin` using public transport + walking.
 *
 * Returns an array of reachable location IDs with their actual travel times.
 * If no API key, returns all locations with travelTimeSecs = 0 (no filtering).
 *
 * TravelTime accepts max 2000 locations per request — batch automatically.
 */
export async function filterReachable(
  origin: { lat: number; lng: number },
  candidates: TTLocation[],
  maxSeconds: number,
): Promise<TTResult[]> {
  if (!hasTravelTimeKey || candidates.length === 0) {
    return candidates.map(c => ({ id: c.id, travelTimeSecs: 0 }))
  }

  const BATCH = 2000
  const allResults: TTResult[] = []

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH)
    const results = await fetchBatch(origin, batch, maxSeconds)
    allResults.push(...results)
  }

  return allResults
}

async function fetchBatch(
  origin: { lat: number; lng: number },
  locations: TTLocation[],
  maxSeconds: number,
): Promise<TTResult[]> {
  const body = {
    locations: [
      { id: '__origin__', coords: { lat: origin.lat, lng: origin.lng } },
      ...locations.map(l => ({ id: l.id, coords: { lat: l.lat, lng: l.lng } })),
    ],
    departure_searches: [{
      id: 'search',
      departure_location_id: '__origin__',
      arrival_location_ids: locations.map(l => l.id),
      departure_time: new Date().toISOString(),
      travel_time: maxSeconds,
      properties: ['travel_time'],
      transportation: { type: 'public_transport' },
    }],
  }

  try {
    const res = await fetch(`${BASE}/time-filter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Application-Id': APP_ID!,
        'X-Api-Key': API_KEY!,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) return locations.map(l => ({ id: l.id, travelTimeSecs: 0 }))

    const data = await res.json()
    const reached: { id: string; properties: { travel_time: number }[] }[] =
      data.results?.[0]?.locations ?? []

    const reachableSet = new Map(reached.map(r => [r.id, r.properties?.[0]?.travel_time ?? 0]))

    // Only return reachable locations
    return locations
      .filter(l => reachableSet.has(l.id))
      .map(l => ({ id: l.id, travelTimeSecs: reachableSet.get(l.id)! }))
  } catch {
    // Fallback: return all as reachable
    return locations.map(l => ({ id: l.id, travelTimeSecs: 0 }))
  }
}
