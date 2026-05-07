import { useSearchStore } from '../../store/useSearchStore'
import styles from './SurpriseMe.module.css'

export function SurpriseMe() {
  const { surpriseMe, results, settings } = useSearchStore()

  if (!settings.features.showSurpriseMe || results.length === 0) return null

  return (
    <button className={styles.btn} onClick={surpriseMe} title="Pick a random destination from your results">
      <span className={styles.pulse} />
      SURPRISE ME
    </button>
  )
}
