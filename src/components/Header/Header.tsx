import { NavLink } from 'react-router-dom'
import { useClock } from '../../hooks/useClock'
import { useSearchStore } from '../../store/useSearchStore'
import { Wordmark } from '../Wordmark/Wordmark'
import styles from './Header.module.css'

export function Header() {
  const clock = useClock()
  const toggleAdmin = useSearchStore(s => s.toggleAdmin)
  const settings = useSearchStore(s => s.settings)

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Wordmark size={28} />
        <span className={styles.tagline}>{settings.ui.subTagline}</span>
      </div>

      <div className={styles.center}>
        <span className={styles.clock}>{clock}</span>
      </div>

      <div className={styles.right}>
        {settings.features.showMapLink && (
          <>
            <NavLink
              to="/board"
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
            >
              BOARD
            </NavLink>
            <NavLink
              to="/map"
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
            >
              MAP
            </NavLink>
          </>
        )}
        {import.meta.env.DEV && (
          <button className={styles.adminBtn} onClick={toggleAdmin} title="Admin (Ctrl+Shift+A)">
            ⚙
          </button>
        )}
      </div>
    </header>
  )
}
