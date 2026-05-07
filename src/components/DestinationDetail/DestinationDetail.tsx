import { useSearchStore } from '../../store/useSearchStore'
import type { Transport } from '../../types'
import styles from './DestinationDetail.module.css'

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

function TransportCard({ t }: { t: Transport }) {
  return (
    <div className={styles.transportCard}>
      <div className={styles.transportTop}>
        <span className={`${styles.transportMode} ${modeClass(t.mode)}`}>{modeLabel(t.mode)}</span>
        <span className={styles.transportTime}>{t.travelTime}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className={styles.transportOperator}>{t.operator}</div>
          {t.requiresConnection && (
            <div className={styles.transportPriceSub}>via {t.requiresConnection}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={styles.transportPrice}>£{t.returnPriceGBP}</div>
          <div className={styles.transportPriceSub}>approx return</div>
        </div>
      </div>
      <a
        href={t.bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.bookBtn}
      >
        BOOK NOW →
      </a>
      <div className={styles.bookNote}>Pre-searches {t.operator} for this route. Prices may vary.</div>
    </div>
  )
}

export function DestinationDetail() {
  const { selectedDestination, setSelected } = useSearchStore()

  if (!selectedDestination) return null

  const dest = selectedDestination

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={() => setSelected(null)}>
          ← BACK TO BOARD
        </button>
        <div className={styles.destName}>{dest.name.toUpperCase()}</div>
        <div className={styles.destMeta}>
          <span className={styles.country}>{dest.country.toUpperCase()}</span>
          <span className={styles.distance}>{dest.distanceKm} KM</span>
        </div>
        <div className={styles.vibe}>{dest.vibe}</div>
      </div>

      <div className={styles.body}>
        {/* Tags */}
        <div className={styles.section}>
          <div className={styles.tagsRow}>
            {dest.tags.map(tag => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>
        </div>

        {/* Transport options */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>HOW TO GET THERE</div>
          {dest.transport.map((t, i) => (
            <TransportCard key={i} t={t} />
          ))}
        </div>

        {/* Discounts */}
        {(dest.discounts.railcard1625 || dest.discounts.totum || dest.discounts.studentUniverse) && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>STUDENT DISCOUNTS</div>
            <div className={styles.discountRow}>
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
      </div>
    </div>
  )
}
