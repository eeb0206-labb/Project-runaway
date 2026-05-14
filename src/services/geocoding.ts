/**
 * Geocoding via OpenStreetMap Nominatim — free, no API key required.
 * Used for:
 *  - Forward geocoding: city name → lat/lng
 *  - Reverse geocoding: lat/lng → city name (for the "Find me" button)
 *  - Autocomplete suggestions for the origin input
 */

export interface GeoResult {
  name: string        // display name (city, Country)
  lat: number
  lng: number
  country: string
  placeId: string
}

const BASE = 'https://nominatim.openstreetmap.org'
const HEADERS = { 'Accept-Language': 'en', 'User-Agent': 'runaway-travel-app/1.0' }

/** Search for a place by name or address — returns up to 6 suggestions */
export async function geocodeSearch(query: string): Promise<GeoResult[]> {
  if (!query || query.trim().length < 2) return []
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '6',
    addressdetails: '1',
  })
  const res = await fetch(`${BASE}/search?${params}`, { headers: HEADERS })
  if (!res.ok) return []
  const data = await res.json() as NominatimResult[]
  return data.map(toGeoResult).filter(Boolean) as GeoResult[]
}

/** Reverse-geocode a lat/lng to the nearest city */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'json', zoom: '10' })
  const res = await fetch(`${BASE}/reverse?${params}`, { headers: HEADERS })
  if (!res.ok) return null
  const data = await res.json() as NominatimResult
  return toGeoResult(data)
}

interface NominatimResult {
  place_id: string
  display_name: string
  lat: string
  lon: string
  address?: {
    house_number?: string
    road?: string
    city?: string
    town?: string
    village?: string
    county?: string
    state?: string
    country?: string
    country_code?: string
  }
}

function toGeoResult(r: NominatimResult): GeoResult | null {
  if (!r?.lat || !r?.lon) return null
  const addr = r.address ?? {}
  const country = addr.country ?? ''
  // Build a meaningful display label — address-aware
  const road = addr.road
  const houseNumber = addr.house_number
  const city = addr.city ?? addr.town ?? addr.village ?? addr.county ?? ''
  const state = addr.state ?? addr.county ?? ''

  let name: string
  if (road) {
    // It's an address-level result
    const streetPart = houseNumber ? `${houseNumber} ${road}` : road
    name = [streetPart, city, country].filter(Boolean).join(', ')
  } else if (city) {
    name = state && state !== city ? `${city}, ${state}, ${country}` : `${city}, ${country}`
  } else {
    // Fallback to first 3 parts of display_name
    name = r.display_name.split(',').slice(0, 3).join(',').trim()
  }

  return {
    name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    country,
    placeId: String(r.place_id),
  }
}

/** Haversine distance in km between two lat/lng points */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
