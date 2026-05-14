import { useEffect, useRef, useState } from 'react'
import styles from './SplitFlap.module.css'

// Character set the flap cycles through (order matters — always cycles forward)
const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-/:()&+£€$@#!'

/** Transliterate accented / non-ASCII characters to their nearest ASCII equivalent
 *  so city names like "São Paulo", "Düsseldorf", "Malmö" display correctly. */
function toAscii(str: string): string {
  return str
    .normalize('NFD')                    // decompose e.g. é → e + combining accent
    .replace(/[̀-ͯ]/g, '')     // strip combining diacritical marks
    .replace(/[ðÐ]/g, 'D')
    .replace(/[þÞ]/g, 'TH')
    .replace(/[øØ]/g, 'O')
    .replace(/[æÆ]/g, 'AE')
    .replace(/[œŒ]/g, 'OE')
    .replace(/[ßẞ]/g, 'SS')
    .replace(/[^A-Za-z0-9 .,'/:()&+£€$@#!\-]/g, '')  // drop anything still non-ASCII
}

interface CharProps {
  target: string
  delay?: number
  speed?: number
  /** Skip alphabet cycling — one single flip directly to the target character */
  direct?: boolean
}

function SplitFlapChar({ target, delay = 0, speed = 38, direct = false }: CharProps) {
  const targetChar = CHARS.includes(target.toUpperCase()) ? target.toUpperCase() : ' '

  const [displayed, setDisplayed] = useState(' ')
  const [prev, setPrev] = useState(' ')
  const [flipping, setFlipping] = useState(false)

  const displayedRef = useRef(' ')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (direct) {
      // Single flip straight to the target — no cycling
      timerRef.current = setTimeout(() => {
        if (displayedRef.current === targetChar) return
        setPrev(displayedRef.current)
        displayedRef.current = targetChar
        setDisplayed(targetChar)
        setFlipping(true)
      }, delay)
      return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }

    // Already showing the right character — nothing to do
    if (displayedRef.current === targetChar) return

    // Random tumble: flash N random characters quickly, then snap to target.
    // Cap: delay + tumbleCount*speed must stay ≤ 1 500 ms so the whole board
    // resolves within ~1.5 s of the search completing.
    const budget = Math.max(120, 1500 - delay)           // time left for the tumble itself
    const maxFlips = Math.floor(budget / speed)
    const tumbleCount = Math.min(maxFlips, 3 + Math.floor(Math.random() * 3)) // 3–5 flips
    let flipped = 0

    const step = () => {
      flipped++
      const isLast = flipped >= tumbleCount
      const next = isLast
        ? targetChar
        : CHARS[Math.floor(Math.random() * CHARS.length)]

      setPrev(displayedRef.current)
      displayedRef.current = next
      setDisplayed(next)
      setFlipping(true)

      if (!isLast) {
        timerRef.current = setTimeout(step, speed)
      }
    }

    timerRef.current = setTimeout(step, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetChar, direct])

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
  /** Skip cycling — each character does one flip directly to its target */
  direct?: boolean
}

export function SplitFlap({
  value,
  length,
  baseDelay = 0,
  charDelay = 18,
  speed = 38,
  className,
  direct = false,
}: SplitFlapProps) {
  const safe = toAscii(value)
  const padded = safe.toUpperCase().padEnd(length ?? safe.length, ' ').slice(0, length ?? safe.length)

  return (
    <span className={`${styles.word} ${className ?? ''}`} aria-label={value}>
      {padded.split('').map((char, i) => (
        <SplitFlapChar
          key={i}
          target={char}
          delay={baseDelay + i * charDelay}
          speed={speed}
          direct={direct}
        />
      ))}
    </span>
  )
}

export default SplitFlap
