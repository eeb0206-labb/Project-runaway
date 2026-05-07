import { useSearchStore } from '../../store/useSearchStore'
import styles from './Ticker.module.css'

export function Ticker() {
  const content = useSearchStore(s => s.content)
  const settings = useSearchStore(s => s.settings)
  const isOffline = !navigator.onLine

  if (isOffline && settings.features.offlineBanner) {
    return (
      <div className={`${styles.ticker} ${styles.offline}`}>
        <span className={styles.offlineText}>{content.offlineBanner}</span>
      </div>
    )
  }

  // Duplicate items for seamless loop
  const items = [...content.ticker, ...content.ticker]

  return (
    <div className={styles.ticker}>
      <div className={styles.track}>
        {items.map((item, i) => (
          <span key={i} className={styles.item}>{item}</span>
        ))}
      </div>
    </div>
  )
}
