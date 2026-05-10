import { NextResponse } from 'next/server'

const DEFAULT_PUBLIC_API = 'https://smartgrid-public-api-1001036509634.us-central1.run.app'
const LOCAL_API = 'http://127.0.0.1:8000'
const FASTAPI = process.env.SMARTGRID_API_URL ?? DEFAULT_PUBLIC_API
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function candidateApis(): string[] {
  const options = [LOCAL_API, FASTAPI]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map(value => value.replace(/\/+$/, ''))

  return Array.from(new Set(options))
}

export async function GET() {
  const apis = candidateApis()
  if (apis.length === 0) {
    return NextResponse.json({ status: 'error', detail: 'SMARTGRID_API_URL is not configured' }, { status: 500, headers: NO_STORE_HEADERS })
  }

  try {
    let lastError = ''
    for (const api of apis) {
      try {
        const r = await fetch(`${api}/grid/status`, {
          signal: AbortSignal.timeout(5000),
          cache: 'no-store',
        })
        const data = await r.json().catch(() => ({}))
        if (r.status === 404) {
          lastError = data?.detail ?? `Not found on ${api}`
          continue
        }
        return NextResponse.json(data, { status: r.status, headers: NO_STORE_HEADERS })
      } catch (error) {
        lastError = String(error)
      }
    }

    return NextResponse.json({ status: 'error', detail: lastError || 'No grid backend responded' }, { status: 503, headers: NO_STORE_HEADERS })
  } catch (e) {
    return NextResponse.json({ status: 'error', detail: String(e) }, { status: 503, headers: NO_STORE_HEADERS })
  }
}
