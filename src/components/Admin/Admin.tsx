import { createPortal } from 'react-dom'
import { useState, useEffect, useRef } from 'react'
import { useSearchStore } from '../../store/useSearchStore'
import type { Settings, Content, Destination, GitStatus } from '../../types'
import styles from './Admin.module.css'

type Tab = 'design' | 'destinations' | 'content' | 'deploy'

const isDev = import.meta.env.DEV

// ── Design tab ────────────────────────────────────────────────────────────────

const COLOR_LABELS: Record<string, string> = {
  bd:   'Background',
  bg2:  'Alt background',
  am:   'Amber (primary)',
  amd:  'Amber dim',
  amb:  'Amber bright',
  wh:   'Body text',
  sep:  'Separator',
  grn:  'Green (flights)',
  red:  'Red (warnings)',
  blue: 'Blue (coach)',
}

const FONT_PRESETS = [
  { label: 'Bebas Neue',        url: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap' },
  { label: 'Anton',             url: 'https://fonts.googleapis.com/css2?family=Anton&display=swap' },
  { label: 'Black Han Sans',    url: 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap' },
  { label: 'Teko',              url: 'https://fonts.googleapis.com/css2?family=Teko:wght@600&display=swap' },
]

const MONO_PRESETS = [
  { label: 'Share Tech Mono', url: 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap' },
  { label: 'VT323',           url: 'https://fonts.googleapis.com/css2?family=VT323&display=swap' },
  { label: 'Courier Prime',   url: 'https://fonts.googleapis.com/css2?family=Courier+Prime&display=swap' },
  { label: 'Roboto Mono',     url: 'https://fonts.googleapis.com/css2?family=Roboto+Mono&display=swap' },
]

function ColorRow({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className={styles.row}>
      <span className={styles.fieldLabel}>{COLOR_LABELS[name] ?? name}</span>
      <div className={styles.colorWrap}>
        <div
          className={styles.colorSwatch}
          style={{ background: value }}
          onClick={() => inputRef.current?.click()}
        />
        <input
          ref={inputRef}
          type="color"
          className={styles.colorInput}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <input
          className={styles.colorHex}
          value={value}
          onChange={e => onChange(e.target.value)}
          maxLength={7}
          spellCheck={false}
        />
      </div>
    </div>
  )
}

function DesignTab({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const updateColor = (key: string, val: string) => {
    onChange({ ...settings, theme: { ...settings.theme, colors: { ...settings.theme.colors, [key]: val } } })
  }
  const updateFont = (key: 'heading' | 'mono' | 'body', preset: { label: string; url: string }) => {
    onChange({
      ...settings,
      theme: {
        ...settings.theme,
        fonts: {
          ...settings.theme.fonts,
          [key]: preset.label,
          [`${key}Url`]: preset.url,
        },
      },
    })
  }

  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>COLOURS</div>
        {Object.entries(settings.theme.colors).map(([key, val]) => (
          <ColorRow key={key} name={key} value={val} onChange={v => updateColor(key, v)} />
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>FONTS</div>
        <div className={styles.row}>
          <span className={styles.fieldLabel}>Headings</span>
          <select className={styles.select} value={settings.theme.fonts.heading} onChange={e => {
            const p = FONT_PRESETS.find(f => f.label === e.target.value)
            if (p) updateFont('heading', p)
          }}>
            {FONT_PRESETS.map(f => <option key={f.label} value={f.label}>{f.label}</option>)}
          </select>
        </div>
        <div className={styles.row}>
          <span className={styles.fieldLabel}>Monospace / UI</span>
          <select className={styles.select} value={settings.theme.fonts.mono} onChange={e => {
            const p = MONO_PRESETS.find(f => f.label === e.target.value)
            if (p) updateFont('mono', p)
          }}>
            {MONO_PRESETS.map(f => <option key={f.label} value={f.label}>{f.label}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>UI TEXT</div>
        <div className={styles.row}>
          <span className={styles.fieldLabel}>Tagline</span>
          <input
            className={styles.input}
            value={settings.ui.tagline}
            onChange={e => onChange({ ...settings, ui: { ...settings.ui, tagline: e.target.value } })}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.fieldLabel}>Sub-tagline</span>
          <input
            className={styles.input}
            value={settings.ui.subTagline}
            onChange={e => onChange({ ...settings, ui: { ...settings.ui, subTagline: e.target.value } })}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.fieldLabel}>Default origin</span>
          <input
            className={styles.input}
            value={settings.ui.defaultOrigin}
            onChange={e => onChange({ ...settings, ui: { ...settings.ui, defaultOrigin: e.target.value } })}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.fieldLabel}>Default budget (£)</span>
          <input
            type="number"
            className={styles.input}
            value={settings.ui.defaultBudget}
            onChange={e => onChange({ ...settings, ui: { ...settings.ui, defaultBudget: Number(e.target.value) } })}
          />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>FEATURES</div>
        {(Object.entries(settings.features) as [keyof typeof settings.features, boolean][]).map(([key, val]) => (
          <div key={key} className={styles.row}>
            <span className={styles.fieldLabel}>{key}</span>
            <button
              className={`${styles.toggle} ${val ? styles.on : ''}`}
              onClick={() => onChange({ ...settings, features: { ...settings.features, [key]: !val } })}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
        ))}
        <div className={styles.row}>
          <span className={styles.fieldLabel}>ntfy topic</span>
          <input
            className={styles.input}
            value={settings.ntfy.topic}
            onChange={e => onChange({ ...settings, ntfy: { topic: e.target.value } })}
            placeholder="leave blank to disable"
          />
        </div>
      </div>
    </>
  )
}

// ── Content tab ───────────────────────────────────────────────────────────────

function ContentTab({ content, onChange }: { content: Content; onChange: (c: Content) => void }) {
  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>TICKER MESSAGES</div>
        <div className={styles.tickerList}>
          {content.ticker.map((item, i) => (
            <div key={i} className={styles.tickerItem}>
              <input
                className={styles.tickerItemText}
                value={item}
                onChange={e => {
                  const ticker = [...content.ticker]
                  ticker[i] = e.target.value
                  onChange({ ...content, ticker })
                }}
              />
              <button
                className={styles.removeBtn}
                onClick={() => onChange({ ...content, ticker: content.ticker.filter((_, j) => j !== i) })}
              >✕</button>
            </div>
          ))}
        </div>
        <button
          className={styles.addBtn}
          onClick={() => onChange({ ...content, ticker: [...content.ticker, 'NEW MESSAGE'] })}
        >+ ADD</button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>STATUS MESSAGES</div>
        {Object.entries(content.statusMessages).map(([key, val]) => (
          <div key={key} className={styles.row}>
            <span className={styles.fieldLabel}>{key}</span>
            <input
              className={styles.input}
              value={val}
              onChange={e => onChange({ ...content, statusMessages: { ...content.statusMessages, [key]: e.target.value } })}
            />
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>SEARCH PANEL LABELS</div>
        {Object.entries(content.searchPanel).map(([key, val]) => (
          <div key={key} className={styles.row}>
            <span className={styles.fieldLabel}>{key}</span>
            <input
              className={styles.input}
              value={val}
              onChange={e => onChange({ ...content, searchPanel: { ...content.searchPanel, [key]: e.target.value } })}
            />
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>BOARD COLUMN HEADERS</div>
        {Object.entries(content.boardColumns).map(([key, val]) => (
          <div key={key} className={styles.row}>
            <span className={styles.fieldLabel}>{key}</span>
            <input
              className={styles.input}
              value={val}
              onChange={e => onChange({ ...content, boardColumns: { ...content.boardColumns, [key]: e.target.value } })}
            />
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>FOOTER</div>
        <div className={styles.row}>
          <textarea
            className={styles.textarea}
            value={content.footer}
            onChange={e => onChange({ ...content, footer: e.target.value })}
          />
        </div>
      </div>
    </>
  )
}

// ── Destinations tab ──────────────────────────────────────────────────────────

function DestCard({ dest, onChange, onDelete }: {
  dest: Destination
  onChange: (d: Destination) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={styles.destItem}>
      <div className={styles.destHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.destHeaderName}>{dest.name.toUpperCase()}</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className={styles.destHeaderMeta}>{dest.country} · {dest.distanceKm}km</span>
          <span style={{ color: 'var(--am)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div className={styles.destBody}>
          <div className={styles.twoCol}>
            <div className={styles.row}>
              <span className={styles.fieldLabel}>Name</span>
              <input className={styles.input} value={dest.name} onChange={e => onChange({ ...dest, name: e.target.value })} />
            </div>
            <div className={styles.row}>
              <span className={styles.fieldLabel}>Country</span>
              <input className={styles.input} value={dest.country} onChange={e => onChange({ ...dest, country: e.target.value })} />
            </div>
          </div>
          <div className={styles.twoCol}>
            <div className={styles.row}>
              <span className={styles.fieldLabel}>Lat</span>
              <input type="number" className={styles.input} value={dest.lat} onChange={e => onChange({ ...dest, lat: Number(e.target.value) })} />
            </div>
            <div className={styles.row}>
              <span className={styles.fieldLabel}>Lng</span>
              <input type="number" className={styles.input} value={dest.lng} onChange={e => onChange({ ...dest, lng: Number(e.target.value) })} />
            </div>
          </div>
          <div className={styles.row}>
            <span className={styles.fieldLabel}>Distance (km)</span>
            <input type="number" className={styles.input} value={dest.distanceKm} onChange={e => onChange({ ...dest, distanceKm: Number(e.target.value) })} />
          </div>
          <div className={styles.row}>
            <span className={styles.fieldLabel}>Vibe</span>
            <input className={styles.input} value={dest.vibe} onChange={e => onChange({ ...dest, vibe: e.target.value })} />
          </div>
          <div className={styles.row}>
            <span className={styles.fieldLabel}>Tags (comma-sep)</span>
            <input className={styles.input} value={dest.tags.join(', ')} onChange={e => onChange({ ...dest, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} />
          </div>

          {/* Transport options */}
          {dest.transport.map((t, ti) => (
            <div key={ti} style={{ border: '1px solid var(--sep)', padding: '10px', marginTop: 8 }}>
              <div className={styles.sectionTitle} style={{ fontSize: 9, marginBottom: 8 }}>TRANSPORT {ti + 1} — {t.mode.toUpperCase()}</div>
              <div className={styles.twoCol}>
                <div className={styles.row}>
                  <span className={styles.fieldLabel}>Mode</span>
                  <select className={styles.select} value={t.mode} onChange={e => {
                    const transport = [...dest.transport]
                    transport[ti] = { ...t, mode: e.target.value as 'train' | 'plane' | 'bus' | 'ferry' }
                    onChange({ ...dest, transport })
                  }}>
                    <option value="train">Train</option>
                    <option value="plane">Plane</option>
                    <option value="bus">Bus/Coach</option>
                    <option value="ferry">Ferry</option>
                  </select>
                </div>
                <div className={styles.row}>
                  <span className={styles.fieldLabel}>Operator</span>
                  <input className={styles.input} value={t.operator} onChange={e => {
                    const transport = [...dest.transport]
                    transport[ti] = { ...t, operator: e.target.value }
                    onChange({ ...dest, transport })
                  }} />
                </div>
              </div>
              <div className={styles.twoCol}>
                <div className={styles.row}>
                  <span className={styles.fieldLabel}>Travel time</span>
                  <input className={styles.input} value={t.travelTime} onChange={e => {
                    const transport = [...dest.transport]
                    transport[ti] = { ...t, travelTime: e.target.value }
                    onChange({ ...dest, transport })
                  }} />
                </div>
                <div className={styles.row}>
                  <span className={styles.fieldLabel}>Return price £</span>
                  <input type="number" className={styles.input} value={t.returnPriceGBP} onChange={e => {
                    const transport = [...dest.transport]
                    transport[ti] = { ...t, returnPriceGBP: Number(e.target.value), priceGBP: Number(e.target.value) / 2 }
                    onChange({ ...dest, transport })
                  }} />
                </div>
              </div>
              <div className={styles.row}>
                <span className={styles.fieldLabel}>Booking URL</span>
                <input className={styles.input} value={t.bookingUrl} onChange={e => {
                  const transport = [...dest.transport]
                  transport[ti] = { ...t, bookingUrl: e.target.value }
                  onChange({ ...dest, transport })
                }} />
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className={styles.addBtn} onClick={() => onChange({
              ...dest,
              transport: [...dest.transport, { mode: 'train', operator: '', travelTime: '', priceGBP: 0, returnPriceGBP: 0, bookingUrl: '' }],
            })}>+ ADD TRANSPORT</button>
            <button className={styles.removeBtn} style={{ marginLeft: 'auto', fontSize: 12, border: '1px solid var(--red)', padding: '4px 10px' }} onClick={onDelete}>
              DELETE DESTINATION
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DestinationsTab({ destinations, onChange }: { destinations: Destination[]; onChange: (d: Destination[]) => void }) {
  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{destinations.length} DESTINATIONS</div>
        <div className={styles.destList}>
          {destinations.map((dest, i) => (
            <DestCard
              key={dest.id}
              dest={dest}
              onChange={updated => {
                const next = [...destinations]
                next[i] = updated
                onChange(next)
              }}
              onDelete={() => onChange(destinations.filter((_, j) => j !== i))}
            />
          ))}
        </div>
        <button className={styles.addBtn} style={{ marginTop: 10 }} onClick={() => onChange([...destinations, {
          id: `dest-${Date.now()}`,
          name: 'New Destination',
          country: '',
          region: '',
          lat: 0,
          lng: 0,
          population: 0,
          distanceKm: 0,
          transport: [{ mode: 'train', operator: '', travelTime: '', priceGBP: 0, returnPriceGBP: 0, bookingUrl: '' }],
          tags: [],
          vibe: '',
          discounts: {},
          itinerary: [],
          tripCompatibility: { daytrip: true, weekend: true, longweekend: true, week: true, oneway: true },
          timeAtDestCompatibility: { few_hours: true, full_day: true, overnight: true, '2nights': true, '3nights': true, week: true, open: true },
        }])}>
          + ADD DESTINATION
        </button>
      </div>
    </>
  )
}

// ── Deploy tab ────────────────────────────────────────────────────────────────

function DeployTab() {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [message, setMessage] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [deployMsg, setDeployMsg] = useState('')
  const [deployError, setDeployError] = useState('')

  useEffect(() => {
    if (!isDev) return
    fetch('/api/git-status')
      .then(r => r.json())
      .then(setGitStatus)
      .catch(() => {})
  }, [])

  const deploy = async () => {
    setDeploying(true)
    setDeployMsg('')
    setDeployError('')
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      if (data.ok) {
        setDeployMsg(`✓ PUSHED — "${data.message}"`)
        setMessage('')
      } else {
        setDeployError(data.error ?? 'Push failed')
      }
    } catch (e: any) {
      setDeployError(e.message)
    } finally {
      setDeploying(false)
    }
  }

  if (!isDev) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>DEPLOY</div>
        <p style={{ color: 'var(--amd)', fontSize: 12 }}>Deploy is only available in dev mode (localhost).</p>
      </div>
    )
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>GIT STATUS</div>
      {gitStatus && (
        <div className={styles.gitStatus}>
          <div className={styles.gitRow}>
            <span className={styles.gitKey}>BRANCH</span>
            <span className={styles.gitVal}>{gitStatus.branch}</span>
          </div>
          <div className={styles.gitRow}>
            <span className={styles.gitKey}>CHANGES</span>
            <span className={`${styles.gitVal} ${gitStatus.changes > 0 ? styles.dirty : styles.clean}`}>
              {gitStatus.changes > 0 ? `${gitStatus.changes} UNCOMMITTED` : 'CLEAN'}
            </span>
          </div>
          <div className={styles.gitRow}>
            <span className={styles.gitKey}>LAST COMMIT</span>
            <span className={styles.gitVal}>{gitStatus.lastCommit}</span>
          </div>
        </div>
      )}

      <div className={styles.row} style={{ marginBottom: 12 }}>
        <span className={styles.fieldLabel}>COMMIT MESSAGE</span>
        <input
          className={styles.input}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="leave blank for auto-date message"
        />
      </div>

      <button
        className={styles.deployBtn}
        onClick={deploy}
        disabled={deploying}
      >
        {deploying ? 'PUSHING...' : '🚀 DEPLOY TO NETLIFY'}
      </button>
      <div className={styles.deployNote}>Runs: git add -A → git commit → git push → Netlify auto-builds (~1 min)</div>

      {deployMsg  && <div className={styles.savedMsg}  style={{ marginTop: 12 }}>{deployMsg}</div>}
      {deployError && <div className={styles.errorMsg} style={{ marginTop: 12 }}>{deployError}</div>}
    </div>
  )
}

// ── Main Admin component ──────────────────────────────────────────────────────

export function Admin() {
  const { adminOpen, toggleAdmin, settings, content, allDestinations, setSettings, setContent, setDestinations } = useSearchStore()
  const [tab, setTab] = useState<Tab>('design')
  const [localSettings, setLocalSettings] = useState<Settings>(settings)
  const [localContent, setLocalContent]  = useState<Content>(content)
  const [localDests, setLocalDests]       = useState<Destination[]>(allDestinations)
  const [saving, setSaving]   = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [saveError, setSaveError] = useState('')

  // Sync from store when admin opens
  useEffect(() => {
    if (adminOpen) {
      setLocalSettings(settings)
      setLocalContent(content)
      setLocalDests(allDestinations)
    }
  }, [adminOpen])

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        toggleAdmin()
      }
      if (e.key === 'Escape' && adminOpen) toggleAdmin()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [adminOpen, toggleAdmin])

  if (!adminOpen) return null

  const save = async () => {
    setSaving(true)
    setSavedMsg('')
    setSaveError('')
    try {
      if (isDev) {
        await Promise.all([
          fetch('/api/save-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: localSettings }) }),
          fetch('/api/save-content',  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content:  localContent }) }),
          fetch('/api/save-destinations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destinations: localDests }) }),
        ])
      }
      // Apply immediately in memory
      setSettings(localSettings)
      setContent(localContent)
      setDestinations(localDests)
      setSavedMsg('SAVED')
      setTimeout(() => setSavedMsg(''), 2500)
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) toggleAdmin() }}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>⚙ RUNAWAY ADMIN</span>
          <button className={styles.closeBtn} onClick={toggleAdmin}>✕</button>
        </div>

        <div className={styles.tabs}>
          {(['design', 'destinations', 'content', 'deploy'] as Tab[]).map(t => (
            <button key={t} className={`${styles.tab} ${tab === t ? styles.active : ''}`} onClick={() => setTab(t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {tab === 'design'       && <DesignTab       settings={localSettings} onChange={setLocalSettings} />}
          {tab === 'destinations' && <DestinationsTab destinations={localDests} onChange={setLocalDests} />}
          {tab === 'content'      && <ContentTab      content={localContent}   onChange={setLocalContent} />}
          {tab === 'deploy'       && <DeployTab />}
        </div>

        {tab !== 'deploy' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', borderTop: '1px solid var(--sep)', flexShrink: 0 }}>
            <button className={styles.saveBtn} onClick={save} disabled={saving}>
              {saving ? 'SAVING...' : 'SAVE CHANGES'}
            </button>
            {savedMsg  && <span className={styles.savedMsg}>{savedMsg}</span>}
            {saveError && <span className={styles.errorMsg}>{saveError}</span>}
            {!isDev && <span className={styles.savedMsg} style={{ opacity: 0.5 }}>In-memory only — open from localhost to persist</span>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
