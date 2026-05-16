import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchStore } from '../../store/useSearchStore'
import { SplitFlap } from '../SplitFlap/SplitFlap'
import { SurpriseMe } from '../SurpriseMe/SurpriseMe'
import { DestinationDetail } from '../DestinationDetail/DestinationDetail'
import type { Destination } from '../../types'
import styles from './DepartureBoard.module.css'

function modeClass(mode: string) {
  if (mode === 'train') return styles.modeTrain
  if (mode === 'plane') return styles.modePlane
  if (mode === 'bus')   return styles.modeBus
  return styles.modeFerry
}

function cheapestTransport(dest: Destination, direction: 'return' | 'oneway') {
  return dest.transport.reduce((min, t) => {
    const price = direction === 'oneway' ? t.priceGBP : t.returnPriceGBP
    const minPrice = direction === 'oneway' ? min.priceGBP : min.returnPriceGBP
    return price < minPrice ? t : min
  })
}

function BoardRow({ dest, index, selected, onClick, direction }: {
  dest: Destination
  index: number
  selected: boolean
  onClick: () => void
  direction: 'return' | 'oneway'
}) {
  const transport = cheapestTransport(dest, direction)
  const displayPrice = direction === 'oneway' ? transport.priceGBP : transport.returnPriceGBP
  const stagger = Math.min(index * 28, 800)

  return (
    <motion.div
      className={`${styles.row} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <span className={`${styles.modeBar} ${modeClass(transport.mode)}`} />

      {/* Rank */}
      <span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span>

      {/* Destination */}
      <span className={styles.destination}>
        <span className={styles.destName}>
          <SplitFlap
            value={dest.name}
            length={20}
            baseDelay={stagger}
            charDelay={12}
            speed={44}
          />
        </span>
        <span className={styles.destCountry}>{dest.country.toUpperCase()}</span>
      </span>

      {/* Travel time */}
      <span className={styles.travelTime}>
        <SplitFlap value={transport.travelTime} length={7} baseDelay={stagger + 80} charDelay={20} speed={44} />
      </span>

      {/* Route / operator */}
      <span className={styles.route}>
        {transport.requiresConnection ?? transport.operator}
      </span>

      {/* Distance */}
      <span className={styles.distance}>
        <SplitFlap value={`${Math.round(dest.distanceKm)}KM`} length={7} baseDelay={stagger + 140} charDelay={18} speed={44} />
      </span>

      {/* Price */}
      <span className={styles.price}>
        <SplitFlap value={`£${displayPrice}`} length={7} baseDelay={stagger + 180} charDelay={18} speed={44} />
      </span>

      {/* Tags (first 2 only) */}
      {dest.tags.slice(0, 2).length > 0 && (
        <span className={styles.tags}>
          {dest.tags.slice(0, 2).map(tag => (
            <span key={tag} className={styles.tag}>{tag}</span>
          ))}
        </span>
      )}
    </motion.div>
  )
}

const SORT_LABELS: Record<string, string> = {
  'distance':      'NEAREST FIRST',
  'distance-desc': 'FURTHEST FIRST',
  'price':         'CHEAPEST FIRST',
  'time':          'FASTEST FIRST',
  'name':          'A → Z',
  'population':    'BIGGEST FIRST',
}

function SkeletonRow({ index }: { index: number }) {
  return (
    <div className={styles.skeletonRow} style={{ animationDelay: `${index * 60}ms` }}>
      <span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span>
      <span className={styles.skeletonDest}>
        <span className={styles.skeletonPulse} style={{ width: `${100 + (index % 5) * 20}px` }} />
        <span className={styles.skeletonSub} />
      </span>
      <span className={styles.skeletonCell} style={{ width: '60px' }} />
      <span className={styles.skeletonCell} style={{ width: '120px' }} />
      <span className={styles.skeletonCell} style={{ width: '50px' }} />
      <span className={styles.skeletonCell} style={{ width: '44px' }} />
    </div>
  )
}

export function DepartureBoard() {
  const { results, selectedDestination, setSelected, isLoading, hasSearched, content, settings, sortBy, tripDirection, setBoardScrollDir } = useSearchStore()
  const listRef    = useRef<HTMLDivElement>(null)
  const prevScroll = useRef(0)

  // Listen for 'board-scroll-top' event dispatched by the mini-bar location button
  useEffect(() => {
    const handler = () => listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    window.addEventListener('board-scroll-top', handler)
    return () => window.removeEventListener('board-scroll-top', handler)
  }, [])

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const top = e.currentTarget.scrollTop
    if (top <= 0) {
      setBoardScrollDir('none')          // at the very top — full panel
    } else if (top > prevScroll.current) {
      setBoardScrollDir('down')          // scrolling down — hide everything
    } else {
      setBoardScrollDir('up')            // scrolling up — show mini-bar
    }
    prevScroll.current = top
  }

  // Column header labels — editable via Admin → Content → Board Column Headers
  const col = content.boardColumns ?? {}
  const hRank  = col.rank        ?? '#'
  const hDest  = col.destination ?? 'DESTINATION'
  const hTime  = col.travelTime  ?? 'TRAVEL'
  const hVia   = col.route       ?? 'VIA'
  const hKm    = col.distance    ?? 'KM'
  const hPrice = col.price       ?? 'FROM'

  if (isLoading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.toolbar}>
          <span className={styles.count}>{content.statusMessages?.searching ?? 'SCANNING ROUTES…'}</span>
        </div>
        <div className={styles.headerRow}>
          <span className={styles.headerCell}>{hRank}</span>
          <span className={styles.headerCell}>{hDest}</span>
          <span className={styles.headerCell}>{hTime}</span>
          <span className={styles.headerCell}>{hVia}</span>
          <span className={styles.headerCell}>{hKm}</span>
          <span className={styles.headerCell}>{hPrice}</span>
        </div>
        <div className={styles.list}>
          {Array.from({ length: 12 }).map((_, i) => <SkeletonRow key={i} index={i} />)}
        </div>
      </div>
    )
  }

  if (!hasSearched) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>
          <span className={styles.emptyTagline}>{settings.ui.tagline.toUpperCase()}</span>
          <span className={styles.emptyText}>{content.statusMessages?.ready ?? 'SET YOUR BUDGET AND HIT SEARCH'}</span>
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>
          <span className={styles.emptyTagline}>NO ROUTES FOUND</span>
          <span className={styles.emptyText}>{content.statusMessages?.noResults}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span className={styles.count}>
          <strong>{results.length}</strong> DESTINATIONS WITHIN BUDGET · {SORT_LABELS[sortBy] ?? 'SORTED'}
        </span>
        <SurpriseMe />
      </div>

      {/* Column headers — labels come from content.boardColumns, editable in Admin */}
      <div className={styles.headerRow}>
        <span className={styles.headerCell}>{hRank}</span>
        <span className={styles.headerCell}>{hDest}</span>
        <span className={styles.headerCell}>{hTime}</span>
        <span className={styles.headerCell}>{hVia}</span>
        <span className={styles.headerCell}>{hKm}</span>
        <span className={styles.headerCell}>{hPrice}</span>
      </div>

      <div
        ref={listRef}
        className={styles.list}
        onScroll={handleScroll}
      >
        <AnimatePresence>
          {results.map((dest, i) => (
            <div key={dest.id}>
              <BoardRow
                dest={dest}
                index={i}
                selected={selectedDestination?.id === dest.id}
                onClick={() => setSelected(selectedDestination?.id === dest.id ? null : dest)}
                direction={tripDirection}
              />
              {/* Inline accordion detail — mobile only (hidden on desktop via CSS) */}
              {selectedDestination?.id === dest.id && (
                <div className={styles.inlineDetail}>
                  <DestinationDetail inline />
                </div>
              )}
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
