import styles from './Wordmark.module.css'

interface Props {
  size?: number
}

// The A is an SVG runway triangle — a triangle with a vanishing-point road cut in
function RunwayA({ size = 32 }: { size: number }) {
  const w = size * 0.68
  const h = size
  return (
    <svg
      className={styles.aSvg}
      width={w}
      height={h}
      viewBox="0 0 34 48"
      aria-hidden="true"
    >
      {/* Outer triangle — the A shape */}
      <polygon
        points="17,2 33,46 1,46"
        fill="var(--am)"
      />
      {/* Road / vanishing point cut-out */}
      <polygon
        points="17,10 22,46 12,46"
        fill="#0d0d0d"
      />
      {/* Crossbar */}
      <rect x="8" y="32" width="18" height="3" fill="#0d0d0d" />
      {/* Road markings — dashes on the road */}
      <rect x="16" y="16" width="2" height="4" fill="var(--am)" />
      <rect x="16" y="24" width="2" height="3" fill="var(--am)" />
    </svg>
  )
}

export function Wordmark({ size = 32 }: Props) {
  return (
    <span className={styles.wordmark} style={{ fontSize: size }}>
      <span className={styles.part}>RUN</span>
      <span className={styles.dot}>·</span>
      <span className={styles.aWrapper}>
        <RunwayA size={size} />
      </span>
      <span className={styles.dot}>·</span>
      <span className={styles.part}>WAY</span>
    </span>
  )
}
