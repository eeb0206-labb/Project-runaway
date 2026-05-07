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
      {selectedDestination && (
        <DestinationDetail />
      )}
    </div>
  )
}
