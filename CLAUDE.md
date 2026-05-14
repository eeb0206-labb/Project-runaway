# RUN·A·WAY — Project Handoff

A travel escape-radius calculator. Enter a budget and passenger count → see every destination reachable from London, sorted by distance (furthest first), displayed on a split-flap departure board.

React 18 + Vite 5 + TypeScript. Run with `npm run dev` (port 5174).
Deployed at: **GitHub → Netlify (auto-deploy on push to main)**

---

## Architecture

```
src/
  App.tsx                 Root. HashRouter → AppShell. Always renders: Header, SearchPanel, Ticker, Admin.
                          On mount (dev mode): fetches /api/admin-data → calls store.init() with fresh data.
                          Routes: / → /board, /board → BoardView, /map → MapView.
  main.tsx                React 18 createRoot, StrictMode, AppProvider wrapper.
  index.css               CSS custom properties (--bd, --am, --text-primary, etc.) — overridden at runtime
                          by useThemeApply hook when admin settings change.
  store/
    useSearchStore.ts     Zustand. filterAndSort() filters by budget, modes, trip type, railcard/TOTUM
                          discounts, pax count. runSearch() adds 400ms delay for split-flap drama.
                          Sorted furthest first. init() reloads fresh data from API (dev) on startup.
  hooks/
    useThemeApply.ts      Watches settings in Zustand. Calls root.style.setProperty() for all CSS tokens.
                          loadFont() creates/replaces <link> elements for Google Fonts — live without reload.
  types/index.ts          Destination, Transport, Passengers, Settings, Content, GitStatus interfaces.
  data/
    destinations.json     15 destinations with transport options, prices, itineraries, booking URLs.
    settings.json         Design tokens (colors, fonts + Google Fonts URLs), UI defaults, feature flags.
    content.json          Ticker messages, status messages, search labels, board column headers.
  components/
    SplitFlap/            Split-flap display board character animation.
                          CHARS: ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-/:()&+£€$@#!'
                          3-layer clip-path architecture: bottom half (new), top half (new, static behind
                          flap), topFlap (shows prev char, animates rotateX 0→-90deg then snaps to new).
                          Authentic airport Solari board behavior.
    DepartureBoard/       Grid: 40px 1fr 90px 1fr 70px 80px.
                          Each row: SplitFlap for name (length=16), travelTime (7), distance (7), price (7).
                          Mode color bar (3px left edge). Framer Motion entrance animations.
    Header/               RUN·A·WAY wordmark, live clock, nav tabs (BOARD / MAP), tagline.
    SearchPanel/          Budget slider, passenger panel (adults/children/railcard/TOTUM), mode toggles.
                          FIND ESCAPES button triggers store.runSearch().
    MapView/              Leaflet + CartoDB Dark Matter tiles. FitBounds component. Polylines + CircleMarkers.
                          Clicking a marker selects destination in store.
    Ticker/               Horizontal scrolling marquee of admin-editable messages.
    Admin/                Ctrl+Shift+A to open. Portal to document.body. 4 tabs (see below).
    DestinationDetail/    Right panel detail card when a destination is selected.
    SurpriseMe/           Random destination picker button.
    Wordmark/             Site logo / wordmark component.
    PassengerPanel/       Sub-component of SearchPanel for passenger counts.
  views/
    BoardView.tsx         Left: SearchPanel + DepartureBoard. Right: DestinationDetail or MapView.
    MapView.tsx           Full-page map (alternate route).
assets/                   Fonts, images (if any added later).
public/                   Static files served as-is.
```

---

## Admin panel (Ctrl+Shift+A)

Opens via keyboard shortcut, closes on Escape. Portalled to `document.body`.

| Tab | What it does |
|---|---|
| 🎨 DESIGN | Color pickers + hex inputs for all CSS tokens. Font preset dropdowns (body + mono). UI text fields. Feature toggles. ntfy topic. |
| 📍 DESTINATIONS | Collapsible cards per destination. Edit all fields inline: name, country, lat/lng, transport options, prices, itineraries, booking URLs. |
| 📝 CONTENT | Ticker messages (add/remove/edit). Status messages. Search panel labels. Board column headers. |
| 🚀 DEPLOY | Git status (branch, changes, last commit). Commit message input. Deploy button. |

**How saves work:**
- Save button POSTs to all 3 API endpoints (dev only): `/api/save-settings`, `/api/save-content`, `/api/save-destinations`
- Also calls `setSettings/setContent/setDestinations` in Zustand immediately — live preview without reload
- In production, saves to memory only (API routes are dev-only)

**Deploy button** runs: `git add -A && git commit -m "..." && git push`
Netlify auto-deploys on push to main (~1–2 min).

---

## Data files

All in `src/data/` — JSON source of truth for destinations, settings, and content.
Read/written by the Vite dev server plugin (`adminApiPlugin` in `vite.config.ts`).
At build time, statically imported by components.

**Changes require a dev server restart to take effect** (files are in Vite's ignored watch list).

---

## Transport modes

| Mode | Color | Key |
|---|---|---|
| train | amber `#f5a623` | `--am` |
| plane | green `#4caf50` | — |
| bus/coach | blue `#5b9bd5` | — |
| ferry | purple `#9b8fcf` | — |

---

## Budget logic

`returnPriceGBP * totalPassengers <= budget`

Discounts applied before comparison:
- Railcard: −33% on train fares
- TOTUM: −10% on all fares

`totalPassengers = adults + children`

Sorting: furthest (`distanceKm`) first, so most dramatic escapes appear at the top.

---

## Vite config

`vite.config.ts` — dev-only `adminApiPlugin()` middleware:
- `GET /api/admin-data` — returns all 3 data files as `{ settings, content, destinations }`
- `POST /api/save-settings` — writes to `src/data/settings.json`
- `POST /api/save-content` — writes to `src/data/content.json`
- `POST /api/save-destinations` — writes to `src/data/destinations.json`
- `GET /api/git-status` — returns `{ branch, changes, lastCommit }` from git
- `POST /api/deploy` — runs `git add -A && git commit -m "..." && git push`

VitePWA plugin: Workbox, offline caching of all assets.

---

## CSS / theming

CSS Modules per component — no Tailwind, no component libraries.

CSS custom properties in `index.css`:
```css
--bd: #0a0a0a;          /* board background */
--am: #f5a623;          /* amber / accent */
--text-primary: #f5a623;
--text-secondary: #888;
--font-display: 'Share Tech Mono', monospace;
--font-body: 'Inter', sans-serif;
/* ...etc */
```

All overridden at runtime via `useThemeApply` hook when admin changes a value.

---

## Deployment

1. Create GitHub repo
2. `git remote add origin <url>`
3. `git push -u origin main`
4. Connect repo to Netlify (auto-deploy on push)
5. Use Admin → DEPLOY tab to push future updates

`netlify.toml` has SPA redirect: `/* → /index.html 200`

---

## Key conventions

- TypeScript strict mode — all `.tsx`/`.ts`, no `any`
- CSS Modules only — no inline styles except for dynamic values
- CSS custom properties for all design tokens — admin changes them at runtime
- Zustand for global state — no prop drilling
- All font changes go through `useThemeApply.loadFont()` so Google Fonts load immediately
- Split-flap: `delay = baseDelay + charIndex * charDelay` — columns stagger left-to-right
- Audio: none currently — can add ambient airport sounds if desired
- Large video files: host on YouTube/Vimeo, link via URL
- Dev API endpoints are stripped from production build (guarded by `command === 'serve'` in vite.config.ts)
