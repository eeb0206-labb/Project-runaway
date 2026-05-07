import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Header } from './components/Header/Header'
import { SearchPanel } from './components/SearchPanel/SearchPanel'
import { Ticker } from './components/Ticker/Ticker'
import { Admin } from './components/Admin/Admin'
import { BoardView } from './views/BoardView'
import { MapView } from './views/MapView'
import { useThemeApply } from './hooks/useThemeApply'
import { useSearchStore } from './store/useSearchStore'
import styles from './App.module.css'

function AppShell() {
  useThemeApply()

  const init = useSearchStore(s => s.init)

  // In dev mode, load latest data from disk on startup
  useEffect(() => {
    if (!import.meta.env.DEV) return
    fetch('/api/admin-data')
      .then(r => r.json())
      .then(data => {
        if (data.settings && data.content && data.destinations) {
          init(data)
        }
      })
      .catch(() => {}) // silently fall back to bundled defaults
  }, [])

  return (
    <div className={styles.layout}>
      <Header />
      <SearchPanel />
      <div className={styles.content}>
        <Routes>
          <Route path="/" element={<Navigate to="/board" replace />} />
          <Route path="/board" element={<BoardView />} />
          <Route path="/map"   element={<MapView />} />
        </Routes>
      </div>
      <Ticker />
      <Admin />
    </div>
  )
}

function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}

export default App
