import { useEffect } from 'react'
import { useSearchStore } from '../store/useSearchStore'

export function useThemeApply() {
  const settings = useSearchStore(s => s.settings)

  useEffect(() => {
    const root = document.documentElement

    // Apply color tokens as CSS custom properties
    Object.entries(settings.theme.colors).forEach(([key, val]) => {
      root.style.setProperty(`--${key}`, val)
    })

    // Apply font CSS vars
    root.style.setProperty('--font-heading', `'${settings.theme.fonts.heading}', sans-serif`)
    root.style.setProperty('--font-mono', `'${settings.theme.fonts.mono}', monospace`)
    root.style.setProperty('--font-body', `'${settings.theme.fonts.body}', sans-serif`)

    // Dynamically load Google Fonts
    loadFont('runaway-font-heading', settings.theme.fonts.headingUrl)
    loadFont('runaway-font-mono', settings.theme.fonts.monoUrl)
    loadFont('runaway-font-body', settings.theme.fonts.bodyUrl)
  }, [settings])
}

function loadFont(id: string, url: string) {
  if (!url) return
  const existing = document.getElementById(id)
  if (existing) {
    if ((existing as HTMLLinkElement).href === url) return
    existing.remove()
  }
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
}
