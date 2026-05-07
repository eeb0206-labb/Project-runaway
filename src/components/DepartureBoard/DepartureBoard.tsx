import { motion, AnimatePresence } from 'framer-motion'
import { useSearchStore } from '../../store/useSearchStore'
import { SplitFlap } from '../SplitFlap/SplitFlap'
import { SurpriseMe } from '../SurpriseMe/SurpriseMe'
import type { Destination } from '../../types'
import styles from './DepartureBoard.module.css'

function modeClass(mode: string) {
  if (mode === 'train') return styles.modeTrain
  if (mode === 'plane') return styles.modePlane
  if (mode === 'bus')   return styles.modeBus
  return styles.modeFerry
}

function cheapestTransport(dest: Destination) {
  return dest.transport.reduce((min, t) =>
    t.returnPriceGBP < min.returnPriceGBP ? t : min,
  )
}

function BoardRow({ dest, index, selected, onClick }: {
  dest: Destination
  index: number
  selected: boolean
  onClick: () => void
}) {
  const transport = cheapestTransport(dest)
  const stagger = index * 60

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
            value={dest.name.toUpperCase()}
            length={16}
            baseDelay={stagger}
            charDelay={18}
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
        <SplitFlap value={`${dest.distanceKm}KM`} length={7} baseDelay={stagger + 140} charDelay={18} speed={44} />
      </span>

      {/* Price */}
      <span className={styles.price}>
        <SplitFlap value={`£${transport.returnPriceGBP}`} length={7} baseDelay={stagger + 180} charDelay={18} speed={44} />
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

export function DepartureBoard() {
  const { results, selectedDestination, setSelected, isLoading, hasSearched, content } = useSearchStore()

  if (isLoading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>
          <span className={styles.emptyTagline}>SCANNING ROUTES</span>
          <div className={styles.scanLine} />
          <span className={styles.emptyText}>{content.statusMessages?.searching}</span>
        </div>
      </div>
    )
  }

  if (!hasSearched) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>
          <span className={styles.emptyTagline}>HOW FAR CAN YOU RUN?</span>
          <span className={styles.emptyText}>SET YOUR BUDGET AND HIT SEARCH</span>
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
          <strong>{results.length}</strong> DESTINATIONS WITHIN BUDGET · SORTED BY DISTANCE
        </span>
        <SurpriseMe />
      </div>

      {/* Column headers */}
      <div className={styles.headerRow}>
        <span className={styles.headerCell}>#</span>
        <span className={styles.headerCell}>DESTINATION</span>
        <span className={styles.headerCell}>TRAVEL</span>
        <span className={styles.headerCell}>VIA</span>
        <span className={styles.headerCell}>KM</span>
        <span className={styles.headerCell}>FROM</span>
      </div>

      <div className={styles.list}>
        <AnimatePresence>
          {results.map((dest, i) => (
            <BoardRow
              key={dest.id}
              dest={dest}
              index={i}
              selected={selectedDestination?.id === dest.id}
              onClick={() => setSelected(selectedDestination?.id === dest.id ? null : dest)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
