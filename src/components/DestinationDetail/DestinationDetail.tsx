import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import emailjs from '@emailjs/browser'
import { useSearchStore, departDateToISO } from '../../store/useSearchStore'
import type { Transport, Destination } from '../../types'
import styles from './DestinationDetail.module.css'

// ── EmailJS credentials ──────────────────────────────────────────────────────
const EJS_SERVICE  = 'service_71mwa5f'
const EJS_TEMPLATE = 'template_ytsozrf'
const EJS_KEY      = 'NJAGuYKP6FBpR73sC'

// ── Tag → activity suggestions ──────────────────────────────────────────────

const TAG_ACTIVITIES: Record<string, string> = {
  'COASTAL':      'Walk the coastline or beach at sunrise',
  'HISTORIC':     'Explore the old town and historic landmarks',
  'CITY BREAK':   'Wander the city centre and find a rooftop bar',
  'CULTURE':      'Visit a local museum or art gallery',
  'NIGHTLIFE':    'Check out the local bar and club scene',
  'FOODIE':       'Try the local street food and independent restaurants',
  'MOUNTAINS':    'Hike a scenic trail with panoramic views',
  'BEACH':        'Spend an afternoon on the beach',
  'UNIVERSITY':   'Explore the university district and student cafes',
  'MARKET TOWN':  'Browse the local market for artisan goods',
  'SPA':          'Book a spa day or thermal bath session',
  'MEDIEVAL':     'Walk the medieval walls or castle',
  'CATHEDRAL':    'Visit the cathedral and surrounding squares',
  'ART':          'Tour independent galleries and street art',
  'MUSIC':        'Find a live music venue for the evening',
  'BEER':         'Sample craft beers at a local brewery or pub',
  'WINE':         'Visit a vineyard or wine bar',
  'HIDDEN GEM':   'Get lost in the lesser-known neighbourhoods',
  'ISLANDS':      'Take a boat trip to a nearby island',
  'DESIGN':       'Explore design shops and architecture',
  'PORT':         'Walk the harbour and watch the boats come in',
}

// ── Date helpers ────────────────────────────────────────────────────────────

/** Convert a store departDate token → Date object.
 *  Delegates to the exported departDateToISO from the store so the URL builders,
 *  the display labels, and the API POST body all derive from the exact same
 *  calendar arithmetic — no more three-way drift. */
function computeDepartDate(option: string): Date | null {
  return new Date(`${departDateToISO(option)}T00:00:00`)
}

function toISODate(d: Date): string {
  // Use local date parts to avoid UTC-midnight-shift issues
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}` // YYYY-MM-DD for Trainline ?departOn= and Google Flights
}

function toNaturalDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Booking URL helpers ─────────────────────────────────────────────────────

/** Strip everything after the first comma — turns "Lincoln, England, UK" → "Lincoln". */
function cityOnly(s: string): string {
  return s.split(',')[0].trim()
}

/** Map departure-hub IATA codes to their Trainline-searchable rail station names.
 *  These are the rail terminals inside or directly serving the airport, so a Trainline
 *  ticket to this station drops the traveller right at the check-in terminal. */
const HUB_STATION: Record<string, string> = {
  // London airports
  STN: 'London Stansted Airport',
  LHR: 'London Heathrow Airport',
  LGW: 'London Gatwick Airport',
  LTN: 'Luton Airport Parkway',
  LCY: 'London City Airport',
  SEN: 'London Southend Airport',
  // UK regional airports
  MAN: 'Manchester Airport',
  BHX: 'Birmingham International',
  NCL: 'Newcastle Airport',
  SOU: 'Southampton Airport Parkway',
  BRS: 'Bristol Parkway',
  EXT: 'Exeter St Davids',
  ABZ: 'Aberdeen Airport',
  EDI: 'Edinburgh Airport',
  GLA: 'Glasgow Prestwick Airport',
  // General London hub (Eurostar / MAC code)
  LON: 'London St Pancras International',
}

/** Build a Trainline deep-link for UK rail (including Eurostar).
 *  Uses explicit encodeURIComponent so station names with spaces encode as %20
 *  (Trainline requires percent-encoding, not the + that URLSearchParams produces).
 *
 *  One-way  → journeySearchType=single
 *  Return   → journeySearchType=return + inwardDate 7 days after outward */
function buildTrainlineUrl(
  from: string,
  to: string,
  date: Date | null,
  isReturn: boolean,
): string {
  // Trainline only accepts YYYY-MM-DD in the date params — never pass a time component.
  const outDate = toISODate(date ?? new Date())
  let url =
    `https://www.thetrainline.com/book/results` +
    `?origin=${encodeURIComponent(cityOnly(from))}` +
    `&destination=${encodeURIComponent(to)}` +
    `&outwardDate=${outDate}` +
    `&outwardDateType=departAfter` +
    `&journeySearchType=${isReturn ? 'return' : 'single'}`
  if (isReturn) {
    const retDate = new Date(`${outDate}T00:00:00`)
    retDate.setDate(retDate.getDate() + 7)
    url += `&inwardDate=${toISODate(retDate)}&inwardDateType=departAfter`
  }
  return url
}

/** Google Maps transit deep-link — reliable fallback for any surface leg where
 *  a direct booking URL is unavailable (ferries, cross-border coaches, onward
 *  European trains after Eurostar, etc.).  travelmode=transit covers rail, metro,
 *  bus, and ferry at the destination.
 *
 *  When a departure date is supplied, appends ttype/date/time so Google Maps
 *  opens the exact schedule rather than the generic route overview. */
function buildGoogleMapsTransit(from: string, to: string, date: Date | null = null): string {
  let url = (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${encodeURIComponent(from)}` +
    `&destination=${encodeURIComponent(to)}` +
    `&travelmode=transit`
  )
  if (date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    // Google Maps transit departure time — YYYY-MM-DD + 09:00 default
    url += `&ttype=dep&date=${y}-${m}-${d}&time=0900`
  }
  return url
}

/** Convert a YYYY-MM-DD ISO string to the YYMMDD path segment Skyscanner expects. */
function toYYMMDD(iso: string): string {
  return iso.replace(/-/g, '').slice(2)
}

/** Build a fresh Skyscanner search URL from IATA sky codes + trip direction.
 *  Always constructed at render time so it reflects the current UI state — never stale. */
function buildSkyscannerUrl(
  fromSkyId: string,
  toSkyId: string,
  outwardISO: string,
  isRoundTrip: boolean,
): string {
  const from = fromSkyId.toLowerCase()
  const to   = toSkyId.toLowerCase()
  const base = `https://www.skyscanner.net/transport/flights/${from}/${to}`
  if (isRoundTrip) {
    const ret = new Date(`${outwardISO}T00:00:00`)
    ret.setDate(ret.getDate() + 7)
    return `${base}/${toYYMMDD(outwardISO)}/${toYYMMDD(toISODate(ret))}/`
  }
  return `${base}/${toYYMMDD(outwardISO)}/`
}

/** Build a Google Flights plain-text query URL.
 *  Uses the literal "oneway" / "returning {date}" suffix which Google honours reliably. */
function buildGoogleFlightsUrl(
  fromCode: string,
  toCode: string,
  outwardISO: string,
  isRoundTrip: boolean,
): string {
  const base = `https://www.google.com/travel/flights?q=Flights%20from%20${encodeURIComponent(fromCode)}%20to%20${encodeURIComponent(toCode)}%20on%20${outwardISO}`
  if (isRoundTrip) {
    const ret = new Date(`${outwardISO}T00:00:00`)
    ret.setDate(ret.getDate() + 7)
    return `${base}%20returning%20${toISODate(ret)}`
  }
  return `${base}%20oneway`
}

// ── Per-leg booking URL builder ─────────────────────────────────────────────

interface Leg { label: string; url: string }

function buildLegs(
  t: Transport,
  origin: string,
  destName: string,
  date: Date | null,
  tripDirection: 'return' | 'oneway',
): Leg[] {
  const dEnc    = encodeURIComponent(destName)
  const conn    = t.requiresConnection
  const isReturn = tripDirection === 'return'

  // ── Flights ──────────────────────────────────────────────────────────────
  if (t.mode === 'plane') {
    const fromCode   = t.originSkyId
    const toCode     = t.destSkyId
    const outwardISO = toISODate(date ?? new Date())

    // Rebuild both URLs fresh from IATA codes + current tripDirection every render.
    // Never use t.bookingUrl — it was built at backend search time and may be stale.
    let flightUrl: string
    if (fromCode && toCode) {
      // IATA codes present (live-enriched row) — build precise Skyscanner deep-link
      const skyscanner = buildSkyscannerUrl(fromCode, toCode, outwardISO, isReturn)
      const google     = buildGoogleFlightsUrl(fromCode, toCode, outwardISO, isReturn)
      console.log('Generated Links:', { skyscanner, google })
      flightUrl = skyscanner
    } else {
      // Static unenriched row — no IATA codes yet.
      // Origin MUST be a hub, not the user's surface location (e.g. "Rutland" has no airport).
      // Default to LON (London Any) — covers LHR, LGW, STN, LTN, LCY.
      flightUrl = buildGoogleFlightsUrl('LON', destName, outwardISO, isReturn)
    }

    // Hub code and full station name for the "Train to airport" Trainline step
    const hubCode    = fromCode?.toUpperCase() ?? ''
    const destCode   = toCode?.toUpperCase()   ?? destName.slice(0, 3).toUpperCase()
    // Look up the exact Trainline station name; fall back to "<CODE> Airport" if unknown
    const hubStation = hubCode ? (HUB_STATION[hubCode] ?? `${hubCode} Airport`) : null

    // Step 1: train from user's origin to the departure hub airport (never to the final destination)
    const trainToHub: Leg = hubStation
      ? { label: `1. TRAIN TO ${hubCode}`,  url: buildTrainlineUrl(origin, hubStation, date, false) }
      // No IATA code on this row yet — send to Trainline with London as default hub
      // (the vast majority of UK departure airports are in or near London)
      : { label: `1. TRAIN TO AIRPORT`,     url: buildTrainlineUrl(origin, 'London', date, false) }

    if (conn === 'TRAIN → FLIGHT → TRAIN') {
      return [
        trainToHub,
        { label: `2. FLIGHT TO ${destCode}`, url: flightUrl },
        // Leg 3 is at the destination — use Google Maps transit for foreign arrivals
        { label: `3. LOCAL TRANSIT`,         url: `https://www.google.com/maps/dir/?api=1&destination=${dEnc}&travelmode=transit` },
      ]
    }
    if (conn === 'TRAIN → FLIGHT') {
      return [
        trainToHub,
        { label: `2. FLIGHT TO ${destCode}`, url: flightUrl },
      ]
    }
    if (conn === 'TRAIN → FLIGHT → FLIGHT') {
      return [
        trainToHub,
        { label: `2. CONNECTING FLIGHTS → ${destCode}`, url: flightUrl },
      ]
    }
    // Direct flight — no train leg needed, single prominent button
    return [{ label: `✈ FLIGHT TO ${destCode}`, url: flightUrl }]
  }

  // ── Ferry ─────────────────────────────────────────────────────────────────
  if (t.mode === 'ferry') {
    if (conn === 'TRAIN → FERRY → TRAIN') {
      return [
        { label: '1. TRAIN TO PORT',  url: buildTrainlineUrl(origin, 'Dover', date, false) },
        { label: '2. BOOK FERRY',     url: 'https://www.directferries.co.uk/' },
        { label: '3. LOCAL TRANSIT',  url: buildGoogleMapsTransit('ferry port', destName, date) },
      ]
    }
    return [{ label: `⛴ FERRY TO ${cityOnly(destName).toUpperCase()}`, url: 'https://www.directferries.co.uk/' }]
  }

  // ── Rail ──────────────────────────────────────────────────────────────────
  if (t.mode === 'train') {
    if (conn === 'EUROSTAR → TRAIN') {
      return [
        { label: '1. EUROSTAR TO PARIS', url: buildTrainlineUrl(origin, 'Paris Gare du Nord', date, false) },
        { label: '2. ONWARD TRAIN',      url: buildGoogleMapsTransit('Paris', destName, date) },
      ]
    }
    if (conn === 'EUROSTAR + METRO') {
      return [
        { label: '1. EUROSTAR',      url: buildTrainlineUrl(origin, 'Paris Gare du Nord', date, false) },
        { label: '2. LOCAL TRANSIT', url: buildGoogleMapsTransit('Paris Gare du Nord', destName, date) },
      ]
    }
    // Direct UK/European train — Trainline covers it
    return [{ label: `🚆 TRAIN TO ${cityOnly(destName).toUpperCase()}`, url: buildTrainlineUrl(origin, destName, date, isReturn) }]
  }

  // ── Coach ─────────────────────────────────────────────────────────────────
  // Trainline covers UK & cross-channel coaches (origin → destName is correct here
  // because the coach goes directly to the destination, no airport hub needed).
  if (t.mode === 'bus') {
    return [{ label: `🚌 COACH TO ${cityOnly(destName).toUpperCase()}`, url: buildTrainlineUrl(origin, destName, date, isReturn) }]
  }

  // Fallback — Google Maps transit rather than a broken Omio path
  return [{ label: `BOOK ${(t.mode as string).toUpperCase()}`, url: buildGoogleMapsTransit(origin, destName, date) }]
}

function buildSingleUrl(
  t: Transport,
  origin: string,
  destName: string,
  date: Date | null,
  tripDirection: 'return' | 'oneway',
): string {
  const isReturn = tripDirection === 'return'

  switch (t.mode) {
    case 'train': return buildTrainlineUrl(origin, destName, date, isReturn)
    case 'plane': {
      const fromCode = t.originSkyId
      const toCode   = t.destSkyId
      if (!fromCode || !toCode) {
        // Static unenriched row — no IATA codes yet.
        // Origin MUST be a hub: the user's surface location (e.g. "Rutland") has no airport.
        // Default to LON (London Any) — covers LHR, LGW, STN, LTN, LCY.
        const outwardISO = toISODate(date ?? new Date())
        return buildGoogleFlightsUrl('LON', destName, outwardISO, isReturn)
      }
      const outwardISO = toISODate(date ?? new Date())
      const skyscanner = buildSkyscannerUrl(fromCode, toCode, outwardISO, isReturn)
      const google     = buildGoogleFlightsUrl(fromCode, toCode, outwardISO, isReturn)
      console.log('Generated Links:', { skyscanner, google })
      return skyscanner
    }
    case 'bus':   return buildTrainlineUrl(origin, destName, date, isReturn)
    case 'ferry': return buildGoogleMapsTransit(origin, destName, date)
    default:      return t.bookingUrl || buildGoogleMapsTransit(origin, destName, date)
  }
}

function modeLabel(mode: string) {
  if (mode === 'train') return 'TRAIN'
  if (mode === 'plane') return 'FLIGHT'
  if (mode === 'bus')   return 'COACH'
  return 'FERRY'
}

function modeClass(mode: string) {
  if (mode === 'train') return styles.modeTrain
  if (mode === 'plane') return styles.modePlane
  if (mode === 'bus')   return styles.modeBus
  return styles.modeFerry
}

function TransportCard({ t, direction, origin, destName, date, onExpand }: {
  t: Transport
  direction: 'return' | 'oneway'
  origin: string
  destName: string
  date: Date | null
  onExpand: () => void
}) {
  const price = (direction === 'oneway' ? t.priceGBP : t.returnPriceGBP) ?? 0
  const priceLabel = direction === 'oneway' ? 'one way' : 'approx return'
  const legs = buildLegs(t, origin, destName, date, direction)
  const singleUrl = buildSingleUrl(t, origin, destName, date, direction)

  return (
    <div className={styles.transportCard} onClick={onExpand} style={{ cursor: 'pointer' }}>
      <div className={styles.transportTop}>
        <span className={`${styles.transportMode} ${modeClass(t.mode)}`}>{modeLabel(t.mode)}</span>
        <span className={styles.transportTime}>{t.travelTime}</span>
        <span className={styles.expandHint}>EXPAND ↗</span>
      </div>
      <div className={styles.transportRow}>
        <div>
          <div className={styles.transportOperator}>{t.operator}</div>
          {t.requiresConnection && (
            <div className={styles.transportSub}>{t.requiresConnection}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={styles.transportPrice}>£{price}</div>
          {/* Show cost breakdown for live-enriched flight rows */}
          {(t.flightPriceGBP ?? 0) > 0 && (t.surfaceEstimateGBP ?? 0) > 0 ? (
            <div className={styles.transportSub} style={{ fontSize: '0.7em', opacity: 0.75 }}>
              ✈ £{t.flightPriceGBP} flight + 🚆 £{t.surfaceEstimateGBP} to hub
            </div>
          ) : (
            <div className={styles.transportSub}>{priceLabel}</div>
          )}
        </div>
      </div>

      {legs.length > 1 ? (
        /* Multi-leg: one button per segment */
        <div className={styles.legBtns} onClick={e => e.stopPropagation()}>
          {legs.map((leg, i) => (
            <a key={i} href={leg.url} target="_blank" rel="noopener noreferrer" className={styles.legBtn}>
              {leg.label} →
            </a>
          ))}
          <div className={styles.connectionNote}>
            Book each step in order — opens a new tab per leg ↗
          </div>
        </div>
      ) : legs.length === 1 ? (
        <a
          href={legs[0].url} target="_blank" rel="noopener noreferrer"
          className={styles.bookBtn}
          onClick={e => e.stopPropagation()}
        >
          {legs[0].label} →
        </a>
      ) : (
        <a
          href={singleUrl} target="_blank" rel="noopener noreferrer"
          className={styles.bookBtn}
          onClick={e => e.stopPropagation()}
        >
          BOOK NOW →
        </a>
      )}
    </div>
  )
}

// ── Single-route email text builder ─────────────────────────────────────────

function buildRouteEmailText(
  t: Transport,
  dest: Destination,
  origin: string,
  date: Date | null,
  tripDirection: 'return' | 'oneway',
): string {
  const lines: string[] = []
  const price = (tripDirection === 'oneway' ? t.priceGBP : t.returnPriceGBP) ?? 0
  const priceStr = tripDirection === 'oneway' ? `£${price} one way` : `£${price} return`

  lines.push(`✈ GETTING TO ${dest.name.toUpperCase()}, ${dest.country.toUpperCase()}`)
  lines.push('Planned with RUNAWAY — runaway.app')
  lines.push('')
  lines.push('──────────────────────────────')
  lines.push('JOURNEY DETAILS')
  lines.push('──────────────────────────────')
  lines.push(`From:      ${origin}`)
  lines.push(`To:        ${dest.name}, ${dest.country}`)
  if (date) lines.push(`Departure: ${toNaturalDate(date)}`)
  lines.push(`Mode:      ${t.mode.toUpperCase()} — ${t.operator || 'Unknown'}`)
  lines.push(`Duration:  ${t.travelTime}`)
  lines.push(`Price:     ${priceStr}`)
  if (t.requiresConnection) lines.push(`Route:     ${t.requiresConnection}`)
  lines.push('')
  lines.push('──────────────────────────────')
  lines.push('BOOKING LINKS')
  lines.push('──────────────────────────────')
  const legs = buildLegs(t, origin, dest.name, date, tripDirection)
  if (legs.length > 1) {
    legs.forEach(leg => {
      lines.push(leg.label)
      lines.push(leg.url)
      lines.push('')
    })
  } else {
    lines.push(`Book: ${buildSingleUrl(t, origin, dest.name, date, tripDirection)}`)
    lines.push('')
  }
  lines.push('──────────────────────────────')
  lines.push('Have an amazing trip! 🌍')
  lines.push('──────────────────────────────')
  return lines.join('\n')
}

// ── Full-screen transport detail view ───────────────────────────────────────

function TransportFullscreen({ t, dest, direction, origin, date, onClose }: {
  t: Transport
  dest: Destination
  direction: 'return' | 'oneway'
  origin: string
  date: Date | null
  onClose: () => void
}) {
  const [routeCopied, setRouteCopied] = useState(false)
  const [tfEmail, setTfEmail]         = useState('')
  const [tfSending, setTfSending]     = useState(false)
  const [tfSent, setTfSent]           = useState<null | 'sent' | 'error'>(null)

  const price = (direction === 'oneway' ? t.priceGBP : t.returnPriceGBP) ?? 0
  const priceLabel = direction === 'oneway' ? 'one way' : 'approx return'
  const legs = buildLegs(t, origin, dest.name, date, direction)
  const singleUrl = buildSingleUrl(t, origin, dest.name, date, direction)
  const routeEmailText = buildRouteEmailText(t, dest, origin, date, direction)

  async function handleCopyRoute() {
    await navigator.clipboard.writeText(routeEmailText)
    setRouteCopied(true)
    setTimeout(() => setRouteCopied(false), 2000)
  }

  async function sendTfEmail() {
    if (!tfEmail.trim() || tfSending) return
    setTfSending(true)
    setTfSent(null)
    try {
      await emailjs.send(
        EJS_SERVICE, EJS_TEMPLATE,
        { user_email: tfEmail.trim(), message: routeEmailText },
        EJS_KEY,
      )
      setTfSent('sent')
      setTfEmail('')
    } catch {
      setTfSent('error')
    } finally {
      setTfSending(false)
    }
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div className={styles.tfOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.tfPanel}>
        {/* Header */}
        <div className={styles.tfHeader}>
          <button className={styles.tfBackBtn} onClick={onClose}>← BACK</button>
          <div className={styles.tfHeaderDest}>
            <span className={styles.tfDestName}>{dest.name.toUpperCase()}</span>
            <span className={styles.tfDestCountry}>{dest.country.toUpperCase()}</span>
          </div>
        </div>

        <div className={styles.tfBody}>
          {/* Mode pill + travel time */}
          <div className={styles.tfTopRow}>
            <span className={`${styles.transportMode} ${modeClass(t.mode)} ${styles.tfModePill}`}>
              {modeLabel(t.mode)}
            </span>
            <span className={styles.tfTime}>{t.travelTime}</span>
          </div>

          {/* Operator + connection + price */}
          <div className={styles.tfMetaRow}>
            <div>
              <div className={styles.tfOperator}>{t.operator}</div>
              {t.requiresConnection && (
                <div className={styles.tfConnection}>{t.requiresConnection}</div>
              )}
              {date && (
                <div className={styles.tfDateHint}>Departing {toNaturalDate(date)}</div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={styles.tfPrice}>£{price}</div>
              <div className={styles.tfPriceSub}>{priceLabel}</div>
            </div>
          </div>

          <div className={styles.tfDivider} />

          {/* Booking buttons */}
          <div className={styles.tfLegsLabel}>BOOK YOUR JOURNEY</div>
          <div className={styles.tfLegs}>
            {legs.length > 1 ? (
              <>
                {legs.map((leg, i) => (
                  <a key={i} href={leg.url} target="_blank" rel="noopener noreferrer" className={styles.tfLegBtn}>
                    {leg.label} →
                  </a>
                ))}
                <button
                  className={styles.tfOpenAllLegsBtn}
                  onClick={() => legs.forEach(leg => window.open(leg.url, '_blank', 'noopener,noreferrer'))}
                >
                  OPEN ALL LEGS IN TABS ↗
                </button>
                <div className={styles.connectionNote}>
                  Book each step in order — opens a new tab per leg ↗
                </div>
              </>
            ) : legs.length === 1 ? (
              <a href={legs[0].url} target="_blank" rel="noopener noreferrer" className={styles.tfLegBtn}>
                {legs[0].label} →
              </a>
            ) : (
              <a href={singleUrl} target="_blank" rel="noopener noreferrer" className={styles.tfLegBtn}>
                BOOK NOW →
              </a>
            )}
          </div>

          <div className={styles.tfDivider} />

          {/* Email / copy this route — EmailJS only, no mailto */}
          <div className={styles.tfEmailRow}>
            <input
              type="email"
              className={styles.tfEmailInput}
              placeholder="your@email.com"
              value={tfEmail}
              onChange={e => { setTfEmail(e.target.value); setTfSent(null) }}
              onKeyDown={e => { if (e.key === 'Enter') sendTfEmail() }}
              disabled={tfSending}
            />
            <button
              className={styles.tfEmailBtn}
              onClick={e => { e.preventDefault(); sendTfEmail() }}
              disabled={tfSending || !tfEmail.trim()}
            >
              {tfSending ? 'SENDING…' : tfSent === 'sent' ? 'SENT ✓' : 'EMAIL ROUTE →'}
            </button>
            <button className={styles.tfCopyBtn} onClick={handleCopyRoute}>
              {routeCopied ? 'COPIED ✓' : 'COPY DETAILS'}
            </button>
          </div>
          {tfSent === 'sent' && <div className={styles.emailStatusOk}>✓ Route details sent — check your inbox</div>}
          {tfSent === 'error' && <div className={styles.emailStatusErr}>✕ Send failed — use "Copy Details" instead</div>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Email text builder ───────────────────────────────────────────────────────

function buildEmailText(
  dest: Destination,
  origin: string,
  date: Date | null,
  tripDirection: 'return' | 'oneway',
): string {
  const lines: string[] = []

  // Header
  lines.push(`✈ YOUR ESCAPE TO ${dest.name.toUpperCase()}, ${dest.country.toUpperCase()}`)
  lines.push('Planned with RUNAWAY — runaway.app')
  lines.push('')

  // Summary
  lines.push('──────────────────────────────')
  lines.push('DESTINATION OVERVIEW')
  lines.push('──────────────────────────────')
  lines.push(`From:      ${origin}`)
  lines.push(`To:        ${dest.name}, ${dest.country}${dest.region ? ` (${dest.region})` : ''}`)
  lines.push(`Distance:  ~${Math.round(dest.distanceKm)} km`)
  if (date) {
    lines.push(`Departure: ${toNaturalDate(date)}`)
  }
  const cheapest = dest.transport.reduce((min, t) =>
    (t.returnPriceGBP ?? 0) < (min.returnPriceGBP ?? 0) ? t : min,
  )
  const priceLabel = tripDirection === 'oneway'
    ? `£${cheapest.priceGBP ?? 0} one way`
    : `£${cheapest.returnPriceGBP ?? 0} return`
  lines.push(`Est. price: from ${priceLabel} (${cheapest.operator || cheapest.mode})`)
  lines.push('')

  // Journey legs
  lines.push('──────────────────────────────')
  lines.push('HOW TO GET THERE')
  lines.push('──────────────────────────────')
  dest.transport.forEach(t => {
    const price = (tripDirection === 'oneway' ? t.priceGBP : t.returnPriceGBP) ?? 0
    const priceStr = tripDirection === 'oneway' ? `£${price} one way` : `£${price} return`
    lines.push(`${t.mode.toUpperCase()} — ${t.operator || 'Unknown'} — ${t.travelTime} — ${priceStr}`)
    if (t.requiresConnection) {
      lines.push(`  Route: ${t.requiresConnection}`)
    }
    const legs = buildLegs(t, origin, dest.name, date, tripDirection)
    if (legs.length > 1) {
      legs.forEach(leg => {
        lines.push(`  • ${leg.label}`)
        lines.push(`    ${leg.url}`)
      })
    } else {
      const url = buildSingleUrl(t, origin, dest.name, date, tripDirection)
      lines.push(`  Book: ${url}`)
    }
    lines.push('')
  })

  // Things to do
  const activities = dest.tags
    .map(tag => TAG_ACTIVITIES[tag])
    .filter(Boolean) as string[]

  if (activities.length > 0) {
    lines.push('──────────────────────────────')
    lines.push('THINGS TO DO')
    lines.push('──────────────────────────────')
    activities.forEach(a => lines.push(`• ${a}`))
    lines.push(`🔍 Google: https://www.google.com/search?q=things+to+do+in+${encodeURIComponent(dest.name)}`)
    lines.push('')
  }

  // Hotels
  lines.push('──────────────────────────────')
  lines.push('ACCOMMODATION')
  lines.push('──────────────────────────────')
  const checkIn  = date ? toISODate(date) : ''
  const checkOut = date ? (() => {
    const co = new Date(date)
    co.setDate(co.getDate() + 2)
    return toISODate(co)
  })() : ''
  const bookingUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(dest.name)}&group_adults=1${checkIn ? `&checkin=${checkIn}&checkout=${checkOut}` : ''}`
  lines.push(`Booking.com: ${bookingUrl}`)
  lines.push(`TripAdvisor: https://www.tripadvisor.com/Search?q=${encodeURIComponent(dest.name)}`)
  lines.push('')

  lines.push('──────────────────────────────')
  lines.push('Have an amazing trip! 🌍')
  lines.push('──────────────────────────────')

  return lines.join('\n')
}

export function DestinationDetail() {
  const { selectedDestination, setSelected, origin, tripDirection, departDate, needsAccommodation } = useSearchStore()
  const date = computeDepartDate(departDate)
  console.log('[DestinationDetail] tripDirection:', tripDirection)
  const [emailOpen, setEmailOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedTransport, setSelectedTransport] = useState<Transport | null>(null)
  // EmailJS send state
  const [emailAddr, setEmailAddr] = useState('')
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<null | 'sent' | 'error'>(null)
  // Popup-blocker warning
  const [tabsBlocked, setTabsBlocked] = useState(false)

  if (!selectedDestination) return null
  const dest = selectedDestination

  const emailText = dest ? buildEmailText(dest, origin, date, tripDirection) : ''
  const checkIn  = date ? toISODate(date) : ''
  const checkOut = date ? (() => { const co = new Date(date); co.setDate(co.getDate() + 2); return toISODate(co) })() : ''
  const bookingUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(dest.name)}&group_adults=1${checkIn ? `&checkin=${checkIn}&checkout=${checkOut}` : ''}`
  const activities = dest.tags.map(tag => TAG_ACTIVITIES[tag]).filter(Boolean) as string[]

  async function handleCopy() {
    await navigator.clipboard.writeText(emailText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSendEmail() {
    if (!emailAddr.trim() || sending) return
    setSending(true)
    setSendStatus(null)
    try {
      await emailjs.send(
        EJS_SERVICE,
        EJS_TEMPLATE,
        { user_email: emailAddr.trim(), message: emailText },
        EJS_KEY,
      )
      setSendStatus('sent')
      setEmailAddr('')
    } catch {
      setSendStatus('error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerTopRow}>
          <button className={styles.closeBtn} onClick={() => setSelected(null)}>← BACK TO BOARD</button>
          <button className={styles.emailBtn} onClick={() => setEmailOpen(true)}>EMAIL THIS ESCAPE →</button>
        </div>
        <div className={styles.destName}>{dest.name.toUpperCase()}</div>
        <div className={styles.destMeta}>
          <span className={styles.country}>{dest.country.toUpperCase()}</span>
          {dest.region && <span className={styles.country}>{dest.region.toUpperCase()}</span>}
          <span className={styles.distance}>{Math.round(dest.distanceKm)} KM</span>
          {dest.population > 0 && (
            <span className={styles.distance}>
              POP {dest.population >= 1_000_000
                ? `${(dest.population / 1_000_000).toFixed(1)}M`
                : `${Math.round(dest.population / 1000)}K`}
            </span>
          )}
        </div>
        <div className={styles.vibe}>{dest.vibe}</div>
      </div>

      <div className={styles.body}>
        {/* Tags */}
        {dest.tags.length > 0 && (
          <div className={styles.section}>
            <div className={styles.tagsRow}>
              {dest.tags.map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
            </div>
          </div>
        )}

        {/* Transport options */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            HOW TO GET THERE
            <button
              className={styles.openAllBtn}
              onClick={() => {
                let blocked = false
                dest.transport.forEach(t => {
                  const w = window.open(buildSingleUrl(t, origin, dest.name, date, tripDirection), '_blank')
                  if (!w) blocked = true
                })
                setTabsBlocked(blocked)
              }}
            >
              OPEN ALL TABS ↗
            </button>
          </div>
          {tabsBlocked && (
            <div className={styles.tabsBlockedWarning}>
              ⚠ Popup blocked — click the icon in your address bar to allow popups for this site, then try again.
            </div>
          )}
          {dest.transport.map((t, i) => (
            <TransportCard
              key={i} t={t} direction={tripDirection}
              origin={origin} destName={dest.name} date={date}
              onExpand={() => setSelectedTransport(t)}
            />
          ))}
        </div>

        {/* Discounts */}
        {(dest.discounts.railcard1625 || dest.discounts.totum || dest.discounts.studentUniverse) && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>STUDENT DISCOUNTS</div>
            {dest.discounts.railcard1625 && (
              <div className={styles.discountItem}>
                <span>16-25 Railcard (trains)</span>
                <span className={styles.discountSaving}>−{Math.round(dest.discounts.railcard1625 * 100)}%</span>
              </div>
            )}
            {dest.discounts.totum && (
              <div className={styles.discountItem}>
                <span>TOTUM card</span>
                <span className={styles.discountSaving}>−{Math.round(dest.discounts.totum * 100)}%</span>
              </div>
            )}
            {dest.discounts.studentUniverse && (
              <div className={styles.discountItem}>
                <span>Student Universe / ISIC</span>
                <span className={styles.discountSaving}>check site</span>
              </div>
            )}
          </div>
        )}

        {/* Sample itinerary */}
        {dest.itinerary.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>SAMPLE ITINERARY</div>
            {dest.itinerary.map((step, i) => (
              <div key={i} className={styles.itineraryStep}>
                <span className={styles.stepDot} />
                <span className={styles.stepTime}>{step.time}</span>
                <div className={styles.stepContent}>
                  <span className={styles.stepDesc}>{step.description}</span>
                  {step.note && <span className={styles.stepNote}>{step.note}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Where to Stay ─────────────────────────────────────────────
             Always renders when the toggle is ON — specific options when
             we have curated data, generic Booking/Hostelworld fallback
             otherwise (handles stale store objects + unknown destinations). */}
        {needsAccommodation && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>🛏 WHERE TO STAY</div>
            <div className={styles.accomGrid}>
              {dest.accommodation && dest.accommodation.length > 0
                ? dest.accommodation.map((a, i) => (
                    <a
                      key={i}
                      href={a.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.accomCard}
                    >
                      <span className={styles.accomType}>{a.type.toUpperCase()}</span>
                      <span className={styles.accomName}>{a.name}</span>
                      <span className={styles.accomPrice}>{a.price}</span>
                      <span className={styles.accomCta}>BOOK →</span>
                    </a>
                  ))
                : <>
                    <a
                      href={`https://www.booking.com/searchresults.en-gb.html?ss=${encodeURIComponent(dest.name)}&lang=en-gb`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.accomCardBooking}
                    >
                      <span className={styles.accomType}>BOOKING.COM</span>
                      <span className={styles.accomName}>Hotels &amp; Apartments in {dest.name}</span>
                      <span className={styles.accomPrice}>All budgets</span>
                      <span className={styles.accomCta}>SEARCH →</span>
                    </a>
                    <a
                      href={`https://www.hostelworld.com/hostelworldgroup/en/s/?q=${encodeURIComponent(dest.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.accomCardHostelworld}
                    >
                      <span className={styles.accomType}>HOSTELWORLD</span>
                      <span className={styles.accomName}>Hostels in {dest.name}</span>
                      <span className={styles.accomPrice}>Budget options</span>
                      <span className={styles.accomCta}>SEARCH →</span>
                    </a>
                  </>
              }
            </div>
          </div>
        )}
      </div>

      {/* ── Full-screen transport view ─────────────────────────────────── */}
      {selectedTransport && (
        <TransportFullscreen
          t={selectedTransport}
          dest={dest}
          direction={tripDirection}
          origin={origin}
          date={date}
          onClose={() => setSelectedTransport(null)}
        />
      )}

      {/* ── Email modal ────────────────────────────────────────────────── */}
      {emailOpen && createPortal(
        <div className={styles.emailOverlay} onClick={e => { if (e.target === e.currentTarget) setEmailOpen(false) }}>
          <div className={styles.emailModal}>
            <div className={styles.emailModalHeader}>
              <span className={styles.emailSection}>YOUR ESCAPE SUMMARY</span>
              <button className={styles.emailCloseBtn} onClick={() => setEmailOpen(false)}>✕</button>
            </div>

            <div className={styles.emailModalBody}>
              {/* Destination header */}
              <div className={styles.emailSection}>{dest.name.toUpperCase()}, {dest.country.toUpperCase()}</div>
              <div className={styles.emailLegLine}>
                From {origin} · ~{Math.round(dest.distanceKm)} km
                {date && ` · Departing ${toNaturalDate(date)}`}
              </div>

              {/* Journey legs */}
              <div className={styles.emailSection} style={{ marginTop: 14 }}>HOW TO GET THERE</div>
              {dest.transport.map((t, i) => {
                const legs = buildLegs(t, origin, dest.name, date, tripDirection)
                const price = (tripDirection === 'oneway' ? t.priceGBP : t.returnPriceGBP) ?? 0
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div className={styles.emailLegLine}>
                      {t.mode.toUpperCase()} — {t.operator || 'Unknown'} — {t.travelTime} — £{price} {tripDirection === 'oneway' ? 'one way' : 'return'}
                    </div>
                    {legs.length > 1
                      ? legs.map((leg, li) => (
                          <div key={li}>
                            <div className={styles.emailLegLine}>{leg.label}</div>
                            <div className={styles.emailLegUrl}>{leg.url}</div>
                          </div>
                        ))
                      : (() => {
                          const url = buildSingleUrl(t, origin, dest.name, date, tripDirection)
                          return <div className={styles.emailLegUrl}>{url}</div>
                        })()
                    }
                  </div>
                )
              })}

              {/* Things to do */}
              {activities.length > 0 && (
                <>
                  <div className={styles.emailSection} style={{ marginTop: 14 }}>THINGS TO DO</div>
                  {activities.map((a, i) => (
                    <div key={i} className={styles.emailActivityLine}>• {a}</div>
                  ))}
                  <div className={styles.emailLegUrl} style={{ marginTop: 4 }}>
                    google.com/search?q=things+to+do+in+{encodeURIComponent(dest.name)}
                  </div>
                </>
              )}

              {/* Hotels */}
              <div className={styles.emailSection} style={{ marginTop: 14 }}>ACCOMMODATION</div>
              <div className={styles.emailHotelLink}>
                Booking.com
              </div>
              <div className={styles.emailLegUrl}>{bookingUrl}</div>
              <div className={styles.emailHotelLink} style={{ marginTop: 6 }}>
                TripAdvisor
              </div>
              <div className={styles.emailLegUrl}>
                {`https://www.tripadvisor.com/Search?q=${encodeURIComponent(dest.name)}`}
              </div>
            </div>

            <div className={styles.emailModalActions}>
              {/* ── EmailJS send ── */}
              <div className={styles.emailSendRow}>
                <input
                  type="email"
                  className={styles.emailInput}
                  placeholder="your@email.com"
                  value={emailAddr}
                  onChange={e => { setEmailAddr(e.target.value); setSendStatus(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSendEmail() }}
                  disabled={sending}
                />
                <button
                  className={`${styles.emailActionBtn} ${styles.emailActionBtnFilled} ${styles.emailSendBtn}`}
                  onClick={handleSendEmail}
                  disabled={sending || !emailAddr.trim()}
                >
                  {sending ? 'SENDING…' : sendStatus === 'sent' ? 'SENT ✓' : 'SEND →'}
                </button>
              </div>
              {sendStatus === 'sent' && (
                <div className={styles.emailStatusOk}>✓ Itinerary sent — check your inbox</div>
              )}
              {sendStatus === 'error' && (
                <div className={styles.emailStatusErr}>✕ Send failed — try "Copy text" below</div>
              )}
              {/* ── Fallback: copy to clipboard ── */}
              <div className={styles.emailAltRow}>
                <button
                  className={`${styles.emailActionBtn} ${styles.emailActionBtnOutline}`}
                  onClick={handleCopy}
                >
                  {copied ? 'COPIED ✓' : 'COPY TEXT →'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
