import { DepartureBoard } from '../components/DepartureBoard/DepartureBoard'
import { DestinationDetail } from '../components/DestinationDetail/DestinationDetail'
import { useSearchStore } from '../store/useSearchStore'
import styles from './BoardView.module.css'

export function BoardView() {
  const selectedDestination = useSearchStore(s => s.selectedDestination)

  return (
    <div className={styles.wrap}>
      <div className={styles.board}>
        <DepartureBoard />
      </div>
      {/* Side panel — desktop only. On mobile, detail renders inline in the board list */}
      {selectedDestination && (
        <div className={styles.sideDetail}>
          <DestinationDetail />
        </div>
      )}
    </div>
  )
}
