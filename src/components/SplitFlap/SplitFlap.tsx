import { useEffect, useRef, useState } from 'react'
import styles from './SplitFlap.module.css'

// Character set the flap cycles through (order matters — always cycles forward)
const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-/:()&+£€$@#!'

interface CharProps {
  target: string
  delay?: number
  speed?: number
}

function SplitFlapChar({ target, delay = 0, speed = 48 }: CharProps) {
  const targetChar = CHARS.includes(target.toUpperCase()) ? target.toUpperCase() : ' '

  const [displayed, setDisplayed] = useState(' ')
  const [prev, setPrev] = useState(' ')
  const [flipping, setFlipping] = useState(false)

  const displayedRef = useRef(' ')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    const step = () => {
      const current = displayedRef.current
      if (current === targetChar) return

      const idx = CHARS.indexOf(current)
      const nextIdx = (idx + 1) % CHARS.length
      const next = CHARS[nextIdx]

      setPrev(current)
      displayedRef.current = next
      setDisplayed(next)
      setFlipping(true)

      if (next !== targetChar) {
        timerRef.current = setTimeout(step, speed)
      }
    }

    timerRef.current = setTimeout(step, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetChar])

  const handleAnimEnd = () => setFlipping(false)

  return (
    <span className={styles.cell}>
      {/* Layer 1: bottom half — always shows new char */}
      <span
        className={styles.charLayer}
        style={{ clipPath: 'inset(50% 0 0 0)' }}
        aria-hidden="true"
      >
        {displayed}
      </span>
      {/* Layer 2: top half (static) — new char top, visible behind falling flap */}
      <span
        className={styles.charLayer}
        style={{ clipPath: 'inset(0 0 50% 0)' }}
        aria-hidden="true"
      >
        {displayed}
      </span>
      {/* Layer 3: animated falling flap — old char top, rotates away to reveal layer 2 */}
      <span
        className={`${styles.charLayer} ${styles.topFlap} ${flipping ? styles.falling : ''}`}
        style={{ clipPath: 'inset(0 0 50% 0)' }}
        onAnimationEnd={handleAnimEnd}
        aria-hidden="true"
      >
        {flipping ? prev : displayed}
      </span>
      <span className={styles.divider} aria-hidden="true" />
    </span>
  )
}

interface SplitFlapProps {
  value: string
  length?: number
  baseDelay?: number
  charDelay?: number
  speed?: number
  className?: string
}

export function SplitFlap({
  value,
  length,
  baseDelay = 0,
  charDelay = 22,
  speed = 48,
  className,
}: SplitFlapProps) {
  const padded = value.toUpperCase().padEnd(length ?? value.length, ' ').slice(0, length ?? value.length)

  return (
    <span className={`${styles.word} ${className ?? ''}`} aria-label={value}>
      {padded.split('').map((char, i) => (
        <SplitFlapChar
          key={i}
          target={char}
          delay={baseDelay + i * charDelay}
          speed={speed}
        />
      ))}
    </span>
  )
}

export default SplitFlap
