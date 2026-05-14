import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

function jsonRes(res: any, data: unknown, status = 200) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function readBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (c: string) => { body += c })
    req.on('end', () => { try { resolve(JSON.parse(body)) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

function adminApiPlugin() {
  return {
    name: 'admin-api',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: () => void) => {
        if (!req.url?.startsWith('/api/')) return next()
        const url = req.url.split('?')[0]
        // Live-data endpoint is handled by the Netlify Functions proxy — skip here
        if (url === '/api/get-routes') return next()

        // ── GET /api/admin-data ──────────────────────────────────────────────
        if (url === '/api/admin-data' && req.method === 'GET') {
          try {
            const dataDir = path.resolve('./src/data')
            const destinations = JSON.parse(fs.readFileSync(path.join(dataDir, 'destinations.json'), 'utf-8'))
            const settings    = JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'),     'utf-8'))
            const content     = JSON.parse(fs.readFileSync(path.join(dataDir, 'content.json'),      'utf-8'))
            return jsonRes(res, { destinations, settings, content })
          } catch (e: any) { return jsonRes(res, { error: e.message }, 500) }
        }

        // ── POST /api/save-settings ─────────────────────────────────────────
        if (url === '/api/save-settings' && req.method === 'POST') {
          try {
            const { settings } = await readBody(req)
            fs.writeFileSync('./src/data/settings.json', JSON.stringify(settings, null, 2) + '\n')
            return jsonRes(res, { ok: true })
          } catch (e: any) { return jsonRes(res, { error: e.message }, 500) }
        }

        // ── POST /api/save-content ──────────────────────────────────────────
        if (url === '/api/save-content' && req.method === 'POST') {
          try {
            const { content } = await readBody(req)
            fs.writeFileSync('./src/data/content.json', JSON.stringify(content, null, 2) + '\n')
            return jsonRes(res, { ok: true })
          } catch (e: any) { return jsonRes(res, { error: e.message }, 500) }
        }

        // ── POST /api/save-destinations ─────────────────────────────────────
        if (url === '/api/save-destinations' && req.method === 'POST') {
          try {
            const { destinations } = await readBody(req)
            fs.writeFileSync('./src/data/destinations.json', JSON.stringify(destinations, null, 2) + '\n')
            return jsonRes(res, { ok: true })
          } catch (e: any) { return jsonRes(res, { error: e.message }, 500) }
        }

        // ── GET /api/git-status ──────────────────────────────────────────────
        if (url === '/api/git-status' && req.method === 'GET') {
          try {
            const status     = execSync('git status --porcelain', { encoding: 'utf-8' }).trim()
            const changes    = status ? status.split('\n').length : 0
            const branch     = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()
            const lastCommit = execSync('git log -1 --format="%ar"', { encoding: 'utf-8' }).trim()
            return jsonRes(res, { changes, branch, lastCommit })
          } catch (e: any) { return jsonRes(res, { error: e.message }, 500) }
        }

        // ── POST /api/deploy ─────────────────────────────────────────────────
        if (url === '/api/deploy' && req.method === 'POST') {
          try {
            const { message } = await readBody(req).catch(() => ({ message: '' }))
            const msg = message?.trim() || `update: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
            execSync(`git add -A && git commit -m "${msg}" && git push`, { encoding: 'utf-8' })
            return jsonRes(res, { ok: true, message: msg })
          } catch (e: any) { return jsonRes(res, { error: e.message }, 500) }
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    adminApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/.*\.cartocdn\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
        ],
      },
      manifest: {
        name: 'RUN·A·WAY',
        short_name: 'RUNAWAY',
        description: 'Escape radius calculator — how far can your budget take you?',
        theme_color: '#0d0d0d',
        background_color: '#0d0d0d',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    strictPort: true,   // fail fast if 3000 is taken rather than silently bumping to 5174
    proxy: {
      // Forward live-data endpoint to Netlify Functions dev server (netlify dev runs on 8888).
      // Falls back silently if netlify dev isn't running — frontend uses static estimates.
      '/api/get-routes': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        rewrite: (path: string) =>
          path.replace('/api/get-routes', '/.netlify/functions/get-routes'),
      },
    },
  },
})
