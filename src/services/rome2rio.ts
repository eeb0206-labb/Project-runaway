/**
 * Rome2Rio API — fetches live routes between two locations.
 * API key set via VITE_ROME2RIO_KEY in .env.local
 * Free tier: https://www.rome2rio.com/api/1.4/
 *
 * Called when a user clicks a destination to see live routes.
 * NOT called on every board search (would burn quota).
 */

const API_KEY = import.meta.env.VITE_ROME2RIO_KEY as string | undefined
const BASE = 'https://free.rome2rio.com/api/1.4/json'

export interface R2RRoute {
  name: string           // "Train", "Fly", "Drive", "Bus"
  duration: number       // minutes total
  price: number | null   // GBP, indicative
  segments: R2RSegment[]
  bookingLinks: R2RBooking[]
}

export interface R2RSegment {
  kind: string           // "surface", "air", "ferry"
  mode: string           // "train", "plane", "bus", "ferry"
  depPlace: string
  arrPlace: string
  duration: number       // minutes
  agencies?: string[]
}

export interface R2RBooking {
  bookingLinks: { url: string }[]
}

/** Returns null if no API key is configured */
export async function fetchRoutes(
  originName: string,
  destName: string,
  originLat?: number,
  originLng?: number,
  destLat?: number,
  destLng?: number,
): Promise<R2RRoute[] | null> {
  if (!API_KEY) return null

  const params = new URLSearchParams({
    key: API_KEY,
    oName: originName,
    dName: destName,
    languageCode: 'en',
    currencyCode: 'GBP',
  })
  if (originLat != null && originLng != null) {
    params.set('oPos', `${originLat},${originLng}`)
  }
  if (destLat != null && destLng != null) {
    params.set('dPos', `${destLat},${destLng}`)
  }

  try {
    const res = await fetch(`${BASE}/Search?${params}`)
    if (!res.ok) return null
    const data = await res.json()

    if (!data.routes) return []

    return (data.routes as RawRoute[]).map(r => ({
      name: r.name,
      duration: r.duration ?? 0,
      price: r.indicativePrice?.price ?? null,
      segments: (r.segments ?? []).map(s => ({
        kind: s.kind ?? '',
        mode: inferMode(s),
        depPlace: s.depPlace?.shortName ?? '',
        arrPlace: s.arrPlace?.shortName ?? '',
        duration: s.duration ?? 0,
        agencies: s.agencies?.map((a: { name: string }) => a.name),
      })),
      bookingLinks: r.bookingLinks ?? [],
    }))
  } catch {
    return null
  }
}

interface RawRoute {
  name: string
  duration?: number
  indicativePrice?: { price: number }
  segments?: RawSegment[]
  bookingLinks?: R2RBooking[]
}

interface RawSegment {
  kind?: string
  depPlace?: { shortName?: string }
  arrPlace?: { shortName?: string }
  duration?: number
  agencies?: { name: string }[]
  transitMode?: string
  vehicle?: { kind?: string }
}

function inferMode(s: RawSegment): string {
  const kind = s.kind ?? ''
  const tm = s.transitMode ?? ''
  const vk = s.vehicle?.kind ?? ''
  if (kind === 'air' || vk === 'plane') return 'plane'
  if (kind === 'ferry') return 'ferry'
  if (tm === 'rail' || vk === 'train') return 'train'
  if (tm === 'bus' || vk === 'bus') return 'bus'
  return kind
}

export const hasApiKey = !!API_KEY
