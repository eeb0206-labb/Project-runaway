import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useSearchStore } from '../../store/useSearchStore'
import type { Destination } from '../../types'
import styles from './MapView.module.css'

const DEFAULT_COORDS: [number, number] = [51.5074, -0.1278]

const TRANSPORT_COLORS: Record<string, string> = {
  train: '#f5a623',
  plane: '#4caf50',
  bus:   '#5b9bd5',
  ferry: '#9b8fcf',
}

function modeColor(dest: Destination): string {
  const cheapest = dest.transport.reduce((min, t) =>
    t.returnPriceGBP < min.returnPriceGBP ? t : min,
  )
  return TRANSPORT_COLORS[cheapest.mode] ?? '#f5a623'
}

function FitBounds({ originCoords, results }: { originCoords: [number, number]; results: Destination[] }) {
  const map = useMap()
  useEffect(() => {
    if (results.length === 0) return
    const bounds: [number, number][] = [originCoords, ...results.map(d => [d.lat, d.lng] as [number, number])]
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [results, originCoords, map])
  return null
}

export function MapViewComponent() {
  const { results, selectedDestination, setSelected, originLat, originLng, origin } = useSearchStore()
  const originCoords: [number, number] = [
    originLat ?? DEFAULT_COORDS[0],
    originLng ?? DEFAULT_COORDS[1],
  ]

  return (
    <div className={styles.wrap}>
      <MapContainer
        className={styles.map}
        center={originCoords}
        zoom={5}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        {results.length > 0 && <FitBounds originCoords={originCoords} results={results} />}

        {/* Origin marker — pulsing amber dot */}
        <CircleMarker
          center={originCoords}
          radius={8}
          pathOptions={{ color: '#ffc84a', fillColor: '#f5a623', fillOpacity: 1, weight: 2 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#f5a623', background: '#111', padding: '2px 6px', letterSpacing: '0.1em' }}>
              {origin.toUpperCase()}
            </span>
          </Tooltip>
        </CircleMarker>

        {/* Corridor lines + destination markers */}
        {results.map(dest => {
          const color = modeColor(dest)
          const isSelected = selectedDestination?.id === dest.id
          return (
            <span key={dest.id}>
              <Polyline
                positions={[originCoords, [dest.lat, dest.lng]]}
                pathOptions={{
                  color,
                  weight: isSelected ? 2 : 1,
                  opacity: isSelected ? 0.9 : 0.4,
                  dashArray: isSelected ? undefined : '4 6',
                }}
              />
              <CircleMarker
                center={[dest.lat, dest.lng]}
                radius={isSelected ? 8 : 5}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: isSelected ? 1 : 0.6,
                  weight: isSelected ? 2 : 1,
                }}
                eventHandlers={{
                  click: () => setSelected(isSelected ? null : dest),
                }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: '#111' }}>
                    {dest.name.toUpperCase()} · £{dest.transport.reduce((min, t) => t.returnPriceGBP < min ? t.returnPriceGBP : min, Infinity)}
                  </span>
                </Tooltip>
              </CircleMarker>
            </span>
          )
        })}

        {results.length === 0 && (
          <div className={styles.noResults}>RUN A SEARCH TO SEE CORRIDORS</div>
        )}
      </MapContainer>
    </div>
  )
}
