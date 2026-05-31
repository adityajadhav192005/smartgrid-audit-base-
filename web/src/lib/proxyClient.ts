/**
 * Shared client for /api/proxy/* route handlers.
 *
 * Centralises the backend URL discovery, x-api-key header, no-store cache
 * headers, and 404/error fallback loop. Every proxy route should go through
 * proxyFetch() so we change auth / timeouts / headers in one place.
 */

const DEFAULT_PUBLIC_API = 'https://smartgrid-public-api-1001036509634.us-central1.run.app'
const DEFAULT_LOCAL_API = 'http://127.0.0.1:8000'
const DEFAULT_API_KEY = 'smartgrid-dev-key'

export const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

export function getApiKey(): string {
  return process.env.SMARTGRID_API_KEY ?? DEFAULT_API_KEY
}

/**
 * Ordered list of backend base URLs the proxy will try.
 *
 * Order: local FastAPI first (when running the dev stack), then the configured
 * SMARTGRID_API_URL, then SMARTGRID_SETTINGS_API_URL (if set), then the public
 * Cloud Run fallback. Duplicates and empty values are removed.
 */
export function candidateApis(): string[] {
  const LOCAL_API = process.env.SMARTGRID_LOCAL_API ?? DEFAULT_LOCAL_API
  const FASTAPI = process.env.SMARTGRID_API_URL ?? DEFAULT_PUBLIC_API
  const SETTINGS_API = process.env.SMARTGRID_SETTINGS_API_URL

  return Array.from(
    new Set(
      [LOCAL_API, FASTAPI, SETTINGS_API, DEFAULT_PUBLIC_API]
        .filter((value): value is string => Boolean(value && value.trim()))
        .map(value => value.replace(/\/+$/, '')),
    ),
  )
}

export interface ProxyFetchOptions {
  /** Backend path, e.g. '/v1/runs/start'. Must start with a slash. */
  path: string | ((api: string) => string)
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  timeoutMs?: number
  /** Extra headers merged on top of the default x-api-key. */
  extraHeaders?: Record<string, string>
  /** Skip the x-api-key header (for public endpoints like /health, /grid/status). */
  omitAuth?: boolean
}

export interface ProxyFetchResult {
  status: number
  data: any
  backend: string
}

/**
 * Try each candidate backend in order. Returns the first non-404 response.
 *
 * Why 404-fallback: in dev we hit 127.0.0.1:8000 first, which may not have
 * every endpoint mounted; we fall back to the Cloud Run URL for those.
 */
export async function proxyFetch(opts: ProxyFetchOptions): Promise<ProxyFetchResult> {
  const apis = candidateApis()
  if (apis.length === 0) {
    return { status: 500, data: { error: 'No backend API configured' }, backend: '' }
  }

  const method = opts.method ?? 'GET'
  const timeoutMs = opts.timeoutMs ?? 8000
  const apiKey = getApiKey()

  let lastError = ''
  let lastBackend = ''
  for (const api of apis) {
    const path = typeof opts.path === 'function' ? opts.path(api) : opts.path
    const url = `${api}${path}`
    lastBackend = api
    try {
      const init: RequestInit = {
        method,
        headers: {
          ...(opts.omitAuth ? {} : { 'x-api-key': apiKey }),
          ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(opts.extraHeaders ?? {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      }
      if (opts.body !== undefined) {
        init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
      }
      const r = await fetch(url, init)
      const data = await r.json().catch(() => ({}))
      if (r.status === 404) {
        lastError = data?.detail ?? `Not found on ${api}`
        continue
      }
      return { status: r.status, data, backend: api }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  return {
    status: 503,
    data: { error: lastError || 'No backend responded' },
    backend: lastBackend,
  }
}
