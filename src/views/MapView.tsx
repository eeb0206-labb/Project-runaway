import { MapViewComponent } from '../components/MapView/MapView'
import { DestinationDetail } from '../components/DestinationDetail/DestinationDetail'
import { useSearchStore } from '../store/useSearchStore'
import styles from './MapView.module.css'

export function MapView() {
  const selectedDestination = useSearchStore(s => s.selectedDestination)

  return (
    <div className={styles.wrap}>
      <MapViewComponent />
      {selectedDestination && <DestinationDetail />}
    </div>
  )
}
