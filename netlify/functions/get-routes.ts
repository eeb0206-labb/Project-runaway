/**
 * Netlify Function: get-routes
 *
 * Proxies RapidAPI "Sky Scrapper" (Skyscanner wrapper) to fetch live flight
 * prices from an origin city to everywhere within budget.
 *
 * Env vars:
 *   RAPIDAPI_KEY  — your key from rapidapi.com
 *                   (subscribe to "Sky Scrapper" by apiheya or similar provider)
 *
 * If RAPIDAPI_KEY is absent the function returns { flights: [], source: 'no_key' }
 * and the frontend falls back gracefully to static estimates.
 *
 * Flow:
 *   1. POST body → { originCity, budget, departDate, passengers, tripDirection }
 *   2. GET /api/v1/flights/searchAirport?query={originCity}  →  entityId + skyId
 *   3. GET /api/v1/flights/searchEveryWhere?originEntityId=…  →  destination list
 *   4. Filter by budget, map to LiveFlight[], return to frontend
 */

import type { Handler, HandlerEvent } from '@netlify/functions'

const RAPIDAPI_HOST = 'sky-scrapper.p.rapidapi.com'
const BASE          = `https://${RAPIDAPI_HOST}`

const KIWI_HOST = 'kiwi-com-cheap-flights.p.rapidapi.com'
const KIWI_BASE = `https://${KIWI_HOST}`

// ── Sky Scrapper response types (defensive — API has version inconsistencies) ─

interface AirportItem {
  skyId:        string
  entityId:     string
  presentation?: { title?: string; suggestionTitle?: string }
  navigation?:  {
    entityId?:    string
    entityType?:  string     // "MAC" | "CITY" | "AIRPORT" | "COUNTRY"
    localizedName?: string
    relevantFlightParams?: {
      skyId?:           string
      entityId?:        string
      flightPlaceType?: string
    }
  }
}

interface EverywhereItem {
  id?: string
  content?: {
    location?: {
      skyCode?:     string
      name?:        string
      country?:     string
      countryName?: string
      countryCode?: string
      isCountry?:   boolean
    }
    flightQuotes?: {
      cheapest?: {
        price?:       string    // "£29" — string form
        rawPrice?:    number    // numeric form (preferred)
        direct?:      boolean
        // Sky Scrapper returns the booking deep-link under various field names
        // depending on API version — capture all of them
        deepLink?:    string
        deeplinkUrl?: string
        link?:        string
        outboundLeg?: {
          deepLink?:    string
          deeplinkUrl?: string
          link?:        string
        }
      }
    }
  }
}

// ── Kiwi API response types ───────────────────────────────────────────────────

interface KiwiFlight {
  /** Numeric GBP price returned by Kiwi */
  price?:     number
  /** Destination city name, e.g. "Barcelona" */
  cityTo?:    string
  /** Destination IATA code, e.g. "BCN" */
  flyTo?:     string
  countryTo?: { code?: string; name?: string }
  /** Kiwi affiliate deep-link for booking */
  deep_link?: string
  /** Route legs — length 1 = direct, >1 = connecting */
  route?:     unknown[]
}

// ── Shape returned to the frontend ───────────────────────────────────────────

export interface LiveFlight {
  cityTo:          string
  countryCode:     string
  countryName:     string
  /** Total journey cost = flightPrice + surfaceEstimate.  Used for budget filtering
   *  and sorting so cheaper origins don't unfairly beat pricier-flight destinations. */
  price:           number
  /** Raw Skyscanner fare (flight only, no surface leg).
   *  Forwarded to the frontend so the UI can show the breakdown. */
  flightPrice:     number
  /** Haversine-based estimate for origin → hub airport (UK train, ~£0.25/km).
   *  Forwarded to the frontend for the cost breakdown display. */
  surfaceEstimate: number
  flyDuration:     string    // empty — this endpoint does not return duration
  latTo:           number    // 0 — client-side name-matching used for enrichment
  lngTo:           number
  bookingUrl:      string
  direct:          boolean
  originSkyId:     string    // 3-letter IATA code for departure hub (e.g. 'LON')
  destSkyId:       string    // 3-letter IATA code for destination  (e.g. 'BCN')
}

// ── Hub airport coordinates for surface-cost estimation ──────────────────────
// Lat/lng for every airport in the HUB_STATION map in DestinationDetail.tsx.
// Used to compute haversine distance from the user's origin to the departure hub.

const HUB_COORDS: Record<string, { lat: number; lng: number }> = {
  // London airports
  STN: { lat: 51.885,  lng:  0.235  },   // Stansted
  LHR: { lat: 51.470,  lng: -0.454  },   // Heathrow
  LGW: { lat: 51.148,  lng: -0.190  },   // Gatwick
  LTN: { lat: 51.875,  lng: -0.368  },   // Luton
  LCY: { lat: 51.503,  lng:  0.050  },   // London City
  SEN: { lat: 51.572,  lng:  0.695  },   // Southend
  LON: { lat: 51.507,  lng: -0.128  },   // London Any (centroid)
  // UK regional
  MAN: { lat: 53.354,  lng: -2.275  },   // Manchester
  BHX: { lat: 52.454,  lng: -1.748  },   // Birmingham
  NCL: { lat: 55.038,  lng: -1.692  },   // Newcastle
  SOU: { lat: 50.950,  lng: -1.357  },   // Southampton
  BRS: { lat: 51.383,  lng: -2.719  },   // Bristol
  EXT: { lat: 50.734,  lng: -3.414  },   // Exeter
  ABZ: { lat: 57.202,  lng: -2.198  },   // Aberdeen
  EDI: { lat: 55.950,  lng: -3.373  },   // Edinburgh
  GLA: { lat: 55.509,  lng: -4.595  },   // Glasgow Airport (EGPF)
  PIK: { lat: 55.509,  lng: -4.595  },   // Glasgow Prestwick (alias)
  LBA: { lat: 53.866,  lng: -1.661  },   // Leeds Bradford
  EMA: { lat: 52.831,  lng: -1.328  },   // East Midlands
  BOH: { lat: 50.780,  lng: -1.843  },   // Bournemouth
  CWL: { lat: 51.397,  lng: -3.343  },   // Cardiff
  BHD: { lat: 54.618,  lng: -5.873  },   // Belfast City
  BFS: { lat: 54.657,  lng: -6.216  },   // Belfast International
  INV: { lat: 57.543,  lng: -4.048  },   // Inverness
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return YYYY-MM-DD for today + offsetDays, using local date parts */
function localISO(offsetDays = 0): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** Add N days to a YYYY-MM-DD string (uses local midnight to avoid UTC shift) */
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** Parse "£29" / "€34" / "$45" → numeric price, returns 0 on failure */
function parsePriceStr(s?: string): number {
  if (!s) return 0
  const n = parseFloat(s.replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

/** Haversine great-circle distance in km between two lat/lng points. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Estimate the cost in GBP of the surface leg from the user's origin to a hub airport.
 *
 *  Formula: haversine(origin → hub) × £0.25/km
 *    min  £10  (very short / local journey)
 *    max  £80  (longest UK rail journey before flying from a closer hub)
 *
 *  Falls back to a hub-specific flat rate when no origin coordinates are supplied
 *  (e.g., unknown or un-geocoded origin city). */
function estimateSurfaceCost(
  originLat: number | null,
  originLng: number | null,
  hubSkyId:  string,
): number {
  const hub = HUB_COORDS[hubSkyId]
  if (originLat != null && originLng != null && hub) {
    const km = haversineKm(originLat, originLng, hub.lat, hub.lng)
    return Math.min(80, Math.max(10, Math.round(km * 0.25)))
  }
  // No coordinates — use a hub-specific flat estimate based on typical UK journey costs.
  // Values are approximate midlands/average-UK baselines; they vary less than the
  // distance-based formula but beat a single £25 flat fee for all hubs.
  const HUB_FLAT: Record<string, number> = {
    STN: 30, LHR: 45, LGW: 35, LTN: 28, LCY: 40, SEN: 25,
    LON: 40,   // London Any
    MAN: 20, BHX: 18, NCL: 35, SOU: 30, BRS: 28, EXT: 38,
    ABZ: 55, EDI: 35, GLA: 38, PIK: 40, LBA: 22, EMA: 18,
    BOH: 32, CWL: 30, BHD: 60, BFS: 62, INV: 65,
  }
  return HUB_FLAT[hubSkyId] ?? 30   // 30 = conservative default for unlisted hubs
}

/** Build a Skyscanner search URL using the IATA/sky city codes (e.g. 'LON', 'BCN').
 *  fromSkyId / toSkyId are ALWAYS sky codes — never city names like "London".
 *  They come from cityEntity.skyId (origin) and loc.skyCode (destination).
 *
 *  One-way:    /transport/flights/{from}/{to}/YYMMDD/          ← single date, no trailing segment
 *  Round-trip: /transport/flights/{from}/{to}/YYMMDD/YYMMDD/  ← two dates
 *
 *  returnISO defaults to deptISO + 7 days when not supplied. */
function skyscannerUrl(
  fromSkyId:   string,
  toSkyId:     string,
  deptISO:     string,
  isRoundTrip: boolean,
  returnISO?:  string,
): string {
  console.log(`[get-routes] skyscannerUrl isRoundTrip=${isRoundTrip} ${fromSkyId}→${toSkyId} dept=${deptISO}`)
  const fmt  = (d: string) => d.replace(/-/g, '').slice(2)   // YYYY-MM-DD → YYMMDD
  const from = fromSkyId.toLowerCase()    // e.g. 'lon'  — sky code, never a city name
  const to   = toSkyId.toLowerCase()      // e.g. 'bcn'  — sky code, never a city name
  const base = `https://www.skyscanner.net/transport/flights/${from}/${to}`
  const ret  = returnISO ?? addDays(deptISO, 7)
  return isRoundTrip
    ? `${base}/${fmt(deptISO)}/${fmt(ret)}/`   // round-trip: two YYMMDD segments
    : `${base}/${fmt(deptISO)}/`               // one-way:    one  YYMMDD segment only
}

/** Authenticated GET to the RapidAPI host */
async function rapidGet(path: string, apiKey: string): Promise<Response> {
  const url = `${BASE}${path}`
  // Print enough to diagnose host/key mismatches — compare these values against your RapidAPI playground
  console.log(`[get-routes] → GET ${url}`)
  console.log(`[get-routes]   x-rapidapi-host: ${RAPIDAPI_HOST}`)
  console.log(`[get-routes]   x-rapidapi-key:  ${apiKey.slice(0, 8)}…[masked] (${apiKey.length} chars total)`)
  return fetch(url, {
    headers: {
      'x-rapidapi-key':  apiKey,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  })
}

/** Call the Kiwi cheap-flights API for a specific hub → destination pair.
 *
 *  Uses its own host header — completely independent of Sky Scrapper.
 *  Pass destIata = null to search "everywhere" (no destination filter).
 *
 *  CRITICAL: enableSelfTransfer=false prevents stressful multi-airline
 *  self-transfer itineraries from appearing in results. */
async function searchKiwi(
  originIata:    string,
  destIata:      string | null,
  dateIso:       string,
  isReturn:      boolean,
  numPassengers: number,
  apiKey:        string,
): Promise<KiwiFlight[]> {
  const endpoint = isReturn ? '/round-trip' : '/oneway'
  const params   = new URLSearchParams()
  params.set('source',             originIata)
  if (destIata) params.set('destination', destIata)
  params.set('date',               dateIso)
  params.set('enableSelfTransfer', 'false')
  params.set('adults',             String(Math.max(1, numPassengers)))
  params.set('currency',           'GBP')
  if (isReturn) params.set('returnDate', addDays(dateIso, 7))

  const url = `${KIWI_BASE}${endpoint}?${params}`
  console.log(`[get-routes] Kiwi → ${endpoint} source=${originIata} date=${dateIso}`)
  console.log(`[get-routes]   x-rapidapi-host: ${KIWI_HOST}`)

  let resp: Response
  try {
    resp = await fetch(url, {
      headers: {
        'x-rapidapi-key':  apiKey,
        'x-rapidapi-host': KIWI_HOST,
      },
    })
  } catch (e: unknown) {
    console.warn('[get-routes] Kiwi fetch error:', e)
    return []
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    console.warn(`[get-routes] Kiwi HTTP ${resp.status}: ${text.slice(0, 200)}`)
    // Don't throw — a Kiwi failure is non-fatal; Sky Scrapper data stands alone
    return []
  }

  const json = await resp.json() as unknown
  console.log('[get-routes] Kiwi sample:', JSON.stringify(json).slice(0, 400))

  // Kiwi wraps results in { data: [...] }
  const raw = json as Record<string, unknown>
  return Array.isArray(raw.data) ? (raw.data as KiwiFlight[]) : []
}

/** Merge Sky Scrapper and Kiwi result sets, keeping the cheapest fare per destination.
 *
 *  - Destinations found by both engines: the lower total price (flight + surface) wins.
 *  - Destinations found only by one engine: that engine's data is used as-is.
 *  - Final list is re-sorted by ascending total price. */
function mergeFlights(ssFlights: LiveFlight[], kiwiFlights: LiveFlight[]): LiveFlight[] {
  // Index Kiwi results by IATA code (upper-cased for case-insensitive matching)
  const kiwiByDest = new Map<string, LiveFlight>()
  for (const f of kiwiFlights) {
    if (f.destSkyId) kiwiByDest.set(f.destSkyId.toUpperCase(), f)
  }

  // Start from Sky Scrapper baseline, substituting Kiwi price where cheaper
  const merged: LiveFlight[] = ssFlights.map(ss => {
    const kiwi = kiwiByDest.get(ss.destSkyId.toUpperCase())
    if (!kiwi) return ss
    if (kiwi.price < ss.price) {
      console.log(
        `[get-routes] Kiwi beats SS for ${ss.destSkyId}:` +
        ` £${kiwi.flightPrice} vs £${ss.flightPrice} (saving £${ss.flightPrice - kiwi.flightPrice})`
      )
      return kiwi
    }
    return ss
  })

  // Append any Kiwi-exclusive destinations (routes SS doesn't index)
  const ssByDest = new Set(ssFlights.map(f => f.destSkyId.toUpperCase()))
  for (const kf of kiwiFlights) {
    if (kf.destSkyId && !ssByDest.has(kf.destSkyId.toUpperCase())) {
      merged.push(kf)
    }
  }

  return merged.sort((a, b) => a.price - b.price)
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' }
  }

  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ flights: [], source: 'no_key' }),
    }
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const {
      originCity    = 'London',
      originLat     = null,
      originLng     = null,
      budget        = 200,
      departDate,
      passengers    = 1,
      tripDirection = 'return',
    }: {
      originCity?:    string
      originLat?:     number | null
      originLng?:     number | null
      budget?:        number
      departDate?:    string       // YYYY-MM-DD, or undefined for flexible
      passengers?:    number
      tripDirection?: 'return' | 'oneway'
    } = body

    const deptISO = departDate ?? localISO(1)   // default to tomorrow for immediate Skyscanner results

    // ── Step 1: Resolve origin city → Skyscanner entityId + skyId ────────────

    // Use up to two comma-parts for geographic context — "Lincoln, England" disambiguates
    // from Lincoln, Nebraska, USA, while still being short enough for the API to parse cleanly.
    const originParts = originCity.split(',').map(s => s.trim()).filter(Boolean)
    const originQuery = originParts.length >= 2
      ? `${originParts[0]}, ${originParts[1]}`
      : (originParts[0] ?? originCity)
    console.log(`[get-routes] searchAirport query: "${originQuery}" (raw origin: "${originCity}")`)

    const airportResp = await rapidGet(
      `/api/v1/flights/searchAirport?query=${encodeURIComponent(originQuery)}&locale=en-GB`,
      apiKey,
    )

    if (!airportResp.ok) {
      const errText = await airportResp.text()
      console.error('[get-routes] searchAirport HTTP', airportResp.status, errText.slice(0, 400))
      if (airportResp.status === 403) {
        console.error(
          '[get-routes] 403 = your RapidAPI key is not subscribed to this API, ' +
          'OR the x-rapidapi-host header does not match the API host shown in your RapidAPI dashboard. ' +
          `Current host value: "${RAPIDAPI_HOST}" — verify this matches exactly in the playground.`
        )
      }
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ flights: [], source: 'api_error' }),
      }
    }

    const airportJson = await airportResp.json() as { status?: boolean; data?: unknown }

    // data can be a plain array or an object with nested arrays
    let airportItems: AirportItem[] = []
    if (Array.isArray(airportJson.data)) {
      airportItems = airportJson.data as AirportItem[]
    } else if (airportJson.data && typeof airportJson.data === 'object') {
      const d = airportJson.data as Record<string, unknown>
      // Also handle double-nesting: { data: { data: [...] } }
      const inner = d.data
      if (Array.isArray(inner)) {
        airportItems = inner as AirportItem[]
      } else {
        airportItems = (d.airports ?? d.cities ?? d.results ?? []) as AirportItem[]
      }
    }

    // Log the first raw result so we can see the actual response shape
    console.log('[get-routes] airportItems count:', airportItems.length)
    if (airportItems.length > 0) {
      console.log('[get-routes] airportItems[0] sample:', JSON.stringify(airportItems[0]).slice(0, 400))
    }

    // entityId can live at the top level OR nested inside navigation — check both.
    // skyId similarly may be at top level or inside navigation.relevantFlightParams.
    const resolveEntityId = (a: AirportItem): string =>
      a.entityId || a.navigation?.entityId || ''
    const resolveSkyId = (a: AirportItem): string =>
      a.skyId ||
      a.navigation?.relevantFlightParams?.skyId ||
      ''

    // Hub-and-spoke selection: MAC (Metropolitan Area Code, e.g. LON/NYC/TYO) gives the
    // widest global flight coverage; fall back to CITY, then to any usable AIRPORT.
    const entityTypePriority = (a: AirportItem): number => {
      const t = a.navigation?.entityType?.toUpperCase()
      if (t === 'MAC')     return 0
      if (t === 'CITY')    return 1
      if (t === 'AIRPORT') return 2
      return 3
    }
    const validItems = airportItems.filter(a => resolveEntityId(a))

    // Country-bias: prefer results in the user's country when the query hints at one.
    // "Lincoln, England" → prefer UK hubs so Nebraska doesn't win.
    const queryRegionHints = originParts.slice(1).join(' ').toLowerCase()
    const UK_HINTS = ['united kingdom', 'england', 'scotland', 'wales', 'northern ireland', 'uk', 'gb']
    const biasUK   = UK_HINTS.some(k => queryRegionHints.includes(k))
    validItems.sort((a, b) => {
      if (biasUK) {
        const nameA = (a.navigation?.localizedName ?? a.presentation?.suggestionTitle ?? '').toLowerCase()
        const nameB = (b.navigation?.localizedName ?? b.presentation?.suggestionTitle ?? '').toLowerCase()
        const UK_NAMES = ['london', 'manchester', 'birmingham', 'glasgow', 'edinburgh', 'uk', 'england', 'scotland', 'wales']
        const aUK = UK_NAMES.some(k => nameA.includes(k))
        const bUK = UK_NAMES.some(k => nameB.includes(k))
        if (aUK && !bUK) return -1
        if (!aUK && bUK) return 1
      }
      return entityTypePriority(a) - entityTypePriority(b)
    })

    if (validItems.length === 0) {
      console.error('[get-routes] No usable entityId for:', originQuery, '— results:', airportItems.length)
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ flights: [], source: 'no_entity' }),
      }
    }
    console.log('[get-routes] hub candidates:', validItems.slice(0, 3).map(
      a => `${a.navigation?.entityType}:${resolveSkyId(a)||resolveEntityId(a)}`
    ).join(' → '))

    // ── Helper: build searchFlightEverywhere params for a given hub ──────────────
    // apiheya Sky Scrapper parameter names for this specific endpoint:
    //   originSkyId  — IATA/sky string code (e.g. 'LON', 'LHR', 'STN'), NOT the numeric entityId
    //   travelDate   — YYYY-MM-DD departure date  (not 'departDate')

    const buildEwParams = (hubSkyId: string): URLSearchParams => {
      const p = new URLSearchParams({
        originSkyId: hubSkyId,
        cabinClass:  'economy',
        adults:      String(Math.max(1, passengers)),
        currency:    'GBP',
        market:      'UK',
        countryCode: 'GB',
      })
      p.set('travelDate', deptISO)
      if (tripDirection === 'return') {
        p.set('returnDate', addDays(deptISO, 7))
        p.set('tripType', 'round_trip')
      } else {
        p.set('tripType', 'one_way')
      }
      return p
    }

    // ── Helper: call searchFlightEverywhere (singular) with v1 → v2 fallback ────
    // Endpoint is /searchFlightEverywhere — singular 'Flight', not plural 'Flights'.

    const callSearchEverywhere = async (hubSkyId: string): Promise<EverywhereItem[]> => {
      const params = buildEwParams(hubSkyId)
      console.log(`[get-routes] searchFlightEverywhere originSkyId=${hubSkyId} tripDirection=${tripDirection} travelDate=${deptISO}`)
      let resp = await rapidGet(`/api/v1/flights/searchFlightEverywhere?${params}`, apiKey)
      if (resp.status === 404) {
        console.log('[get-routes] searchFlightEverywhere v1 → 404, trying v2')
        resp = await rapidGet(`/api/v2/flights/searchFlightEverywhere?${params}`, apiKey)
      }
      if (!resp.ok) {
        const errText = await resp.text()
        console.error('[get-routes] searchFlightEverywhere HTTP', resp.status, errText.slice(0, 300))
        // Throw so the hub loop can propagate a real error rather than silently returning [].
        throw new Error(`searchFlightEverywhere HTTP ${resp.status}: ${errText.slice(0, 120)}`)
      }
      // Accept as unknown first so we can inspect the real shape before parsing
      const json = await resp.json() as unknown
      const top  = json as Record<string, unknown>

      // ── Debug: log response shape so we can fix the parser if needed ──────────
      console.log('[get-routes] API RESPONSE KEYS:', Object.keys(top))
      console.log('[get-routes] API SAMPLE:', JSON.stringify(json).substring(0, 400))

      // ── Probe every plausible result path for this endpoint ───────────────────
      // searchFlightEverywhere may nest results differently from searchEverywhere.
      // We try the widest set of known paths; the first non-empty array wins.
      const grab = (obj: unknown, ...keys: string[]): unknown[] | null => {
        let cur: unknown = obj
        for (const k of keys) {
          if (cur == null || typeof cur !== 'object') return null
          cur = (cur as Record<string, unknown>)[k]
        }
        return Array.isArray(cur) && cur.length > 0 ? cur : null
      }

      const rawItems: unknown[] =
        grab(top, 'data', 'everywhereDestination', 'results') ??
        grab(top, 'data', 'everyWhereDestination', 'results') ??
        grab(top, 'data', 'results')                           ??
        grab(top, 'data', 'destinations')                      ??
        grab(top, 'data', 'itineraries')                       ??
        grab(top, 'data', 'flights')                           ??
        grab(top, 'results')                                    ??
        grab(top, 'destinations')                               ??
        []

      // Log the first raw item so we can see the actual field names in the terminal
      if (rawItems.length > 0) {
        console.log('[get-routes] first raw item:', JSON.stringify(rawItems[0]).substring(0, 300))
      } else {
        console.log('[get-routes] no results found in any known path — full keys:', JSON.stringify(Object.keys(top.data as object ?? {})))
      }

      return rawItems as EverywhereItem[]
    }

    // ── Helper: map raw results → LiveFlight[] for a given hub ────────────────
    // Price strategy:
    //   flightPrice     = raw Skyscanner fare (flight only)
    //   surfaceEstimate = haversine(origin → hub) × £0.25/km  (min £10, max £80)
    //   price           = flightPrice + surfaceEstimate  ← used for budget filter + sorting
    // Sending all three to the frontend lets the UI show a transparent cost breakdown.

    const buildFlights = (rawResults: EverywhereItem[], hubSkyId: string): LiveFlight[] =>
      rawResults
        .map((r): LiveFlight => {
          const loc          = r.content?.location             ?? {}
          const quote        = r.content?.flightQuotes?.cheapest ?? {}
          const flightPrice  = quote.rawPrice != null ? quote.rawPrice : parsePriceStr(quote.price)
          const surfaceEst   = estimateSurfaceCost(originLat, originLng, hubSkyId)
          const totalPrice   = flightPrice + surfaceEst
          const bookingUrl   = loc.skyCode
            ? skyscannerUrl(hubSkyId, loc.skyCode, deptISO, tripDirection === 'return')
            : `https://www.skyscanner.net/flights/${hubSkyId.toLowerCase()}/anywhere/`
          return {
            cityTo:          loc.name        ?? '',
            countryCode:     loc.countryCode ?? '',
            countryName:     loc.countryName ?? loc.country ?? '',
            price:           totalPrice,
            flightPrice,
            surfaceEstimate: surfaceEst,
            flyDuration:     '',
            latTo:           0,
            lngTo:           0,
            bookingUrl,
            direct:          quote.direct ?? false,
            originSkyId:     hubSkyId,
            destSkyId:       loc.skyCode ?? '',
          }
        })
        .filter(f => f.cityTo.length > 0 && f.flightPrice > 0 && f.price <= budget)
        .sort((a, b) => a.price - b.price)

    /** Normalize raw Kiwi results into the shared LiveFlight shape.
     *  Applies the same surfaceEstimate + budget filter as buildFlights so both
     *  engines produce comparable totals. */
    const buildKiwiFlights = (kiwiResults: KiwiFlight[], hubSkyId: string): LiveFlight[] =>
      kiwiResults
        .map((r): LiveFlight => {
          const flightPrice  = r.price ?? 0
          const surfaceEst   = estimateSurfaceCost(originLat, originLng, hubSkyId)
          const totalPrice   = flightPrice + surfaceEst
          const destCode     = r.flyTo ?? ''
          const isDirect     = r.route != null && r.route.length === 1
          // Prefer Kiwi's own deep-link; fall back to a Skyscanner URL so the
          // DestinationDetail link-builder always has something to work with.
          const bookingUrl   = r.deep_link
            ?? skyscannerUrl(hubSkyId, destCode, deptISO, tripDirection === 'return')
          return {
            cityTo:          r.cityTo          ?? '',
            countryCode:     r.countryTo?.code ?? '',
            countryName:     r.countryTo?.name ?? '',
            price:           totalPrice,
            flightPrice,
            surfaceEstimate: surfaceEst,
            flyDuration:     '',
            latTo:           0,
            lngTo:           0,
            bookingUrl,
            direct:          isDirect,
            originSkyId:     hubSkyId,
            destSkyId:       destCode,
          }
        })
        .filter(f => f.cityTo.length > 0 && f.flightPrice > 0 && f.price <= budget)
        .sort((a, b) => a.price - b.price)

    // ── Step 2: Dual-engine search — Sky Scrapper + Kiwi in parallel ────────────
    // For each hub we fire both APIs simultaneously with Promise.allSettled so
    // a failure in one never blocks the other.
    //
    // Cross-examination:
    //   • Both succeed      → merge, keeping the cheapest fare per destination
    //   • Only SS succeeds  → use SS results as-is
    //   • Only Kiwi succeeds (SS 429 / empty) → use Kiwi as primary
    //   • Both fail         → try next hub

    let flights: LiveFlight[] = []
    let lastError             = ''
    for (const hub of validItems.slice(0, 3)) {
      const hubEntityId = resolveEntityId(hub)   // kept for logging only
      const hubSkyId    = resolveSkyId(hub)
      // searchFlightEverywhere requires a sky-code string — skip hubs that don't have one
      if (!hubSkyId) continue
      console.log(`[get-routes] trying hub: ${hub.navigation?.entityType} skyId=${hubSkyId} entityId=${hubEntityId}`)

      // Fire both engines simultaneously
      const [ssSettled, kiwiSettled] = await Promise.allSettled([
        callSearchEverywhere(hubSkyId),
        searchKiwi(hubSkyId, null, deptISO, tripDirection === 'return', passengers, apiKey),
      ])

      // Unpack Sky Scrapper result
      let ssFlights:    LiveFlight[] = []
      let ssRateLimited              = false
      if (ssSettled.status === 'fulfilled') {
        ssFlights = buildFlights(ssSettled.value, hubSkyId)
        console.log(`[get-routes] SS    hub ${hubSkyId}: ${ssFlights.length} within budget £${budget}`)
      } else {
        const msg  = ssSettled.reason instanceof Error ? ssSettled.reason.message : String(ssSettled.reason)
        ssRateLimited = msg.includes('429')
        lastError  = msg
        console.warn(`[get-routes] SS    hub ${hubSkyId} failed: ${msg}`)
      }

      // Unpack Kiwi result
      let kiwiFlights: LiveFlight[] = []
      if (kiwiSettled.status === 'fulfilled') {
        kiwiFlights = buildKiwiFlights(kiwiSettled.value, hubSkyId)
        console.log(`[get-routes] Kiwi  hub ${hubSkyId}: ${kiwiFlights.length} within budget £${budget}`)
      } else {
        const msg = kiwiSettled.reason instanceof Error ? kiwiSettled.reason.message : String(kiwiSettled.reason)
        console.warn(`[get-routes] Kiwi  hub ${hubSkyId} failed: ${msg}`)
      }

      // Cross-examine and build combined result set
      let combined: LiveFlight[] = []
      if (ssFlights.length > 0 && kiwiFlights.length > 0) {
        combined = mergeFlights(ssFlights, kiwiFlights)
        console.log(
          `[get-routes] ⚡ Dual-engine hub ${hubSkyId}: ` +
          `SS ${ssFlights.length} + Kiwi ${kiwiFlights.length} → ${combined.length} merged`
        )
      } else if (ssFlights.length > 0) {
        combined = ssFlights
        console.log(`[get-routes] SS-only hub ${hubSkyId}: ${combined.length} results (Kiwi empty)`)
      } else if (kiwiFlights.length > 0) {
        combined = kiwiFlights
        console.log(
          `[get-routes] Kiwi fallback hub ${hubSkyId}: ${combined.length} results` +
          (ssRateLimited ? ' (SS rate-limited 429)' : ' (SS returned 0 results)')
        )
      }

      if (combined.length > 0) {
        flights = combined
        break
      }

      lastError = lastError || 'no_results'
      console.log(`[get-routes] hub ${hubSkyId}: 0 results from both engines — trying next hub`)
    }

    // Only return source:'live' when we actually have data.
    // Any other outcome gets source:'api_error' so the frontend shows the failure clearly.
    if (flights.length === 0) {
      console.error(`[get-routes] All hubs failed — source: api_error, reason: ${lastError}`)
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ flights: [], source: 'api_error', error: lastError }),
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ flights, source: 'live' }),
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[get-routes] Unhandled error:', msg)
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ flights: [], source: 'api_error', error: msg }),
    }
  }
}
