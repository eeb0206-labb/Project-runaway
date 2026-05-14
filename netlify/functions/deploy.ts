/**
 * Netlify Function: deploy
 *
 * Triggers a production build via a Netlify Build Hook URL.
 * No auth headers or site IDs needed — the hook URL is self-authenticating.
 *
 * Env var required:
 *   NETLIFY_BUILD_HOOK_URL  — from Netlify Dashboard → Site configuration
 *                             → Build & deploy → Build hooks → Add build hook
 */

import type { Handler, HandlerEvent } from '@netlify/functions'

export const handler: Handler = async (event: HandlerEvent) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    }
  }

  const hookUrl = (process.env.NETLIFY_BUILD_HOOK_URL ?? '').replace(/['"]/g, '').trim()

  if (!hookUrl) {
    console.error('[deploy] NETLIFY_BUILD_HOOK_URL is not set')
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ success: false, error: 'NETLIFY_BUILD_HOOK_URL is not configured.' }),
    }
  }

  try {
    console.log('[deploy] Triggering build hook...')
    const resp = await fetch(hookUrl, { method: 'POST' })

    if (!resp.ok) {
      const text = await resp.text()
      console.error(`[deploy] Hook returned ${resp.status}:`, text)
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ success: false, error: `Hook returned ${resp.status}: ${text}` }),
      }
    }

    console.log('[deploy] Build triggered successfully')
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ success: true, message: 'Deployment triggered successfully.' }),
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[deploy] Unhandled error:', msg)
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ success: false, error: msg }),
    }
  }
}
