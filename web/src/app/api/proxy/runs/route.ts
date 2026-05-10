import { NextRequest, NextResponse } from 'next/server'

const FASTAPI = process.env.SMARTGRID_API_URL ?? 'https://smartgrid-public-api-1001036509634.us-central1.run.app'
const SETTINGS_API = process.env.SMARTGRID_SETTINGS_API_URL
const API_KEY = process.env.SMARTGRID_API_KEY ?? 'smartgrid-dev-key'
const LOCAL_API = 'http://127.0.0.1:8000'
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function candidateApis(): string[] {
  const options = [LOCAL_API, FASTAPI, SETTINGS_API]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map(value => value.replace(/\/+$/, ''))

  return Array.from(new Set(options))
}

export async function GET(req: NextRequest) {
  const apis = candidateApis()
  if (apis.length === 0) {
    return NextResponse.json({ runs: [], error: 'SMARTGRID_API_URL is not configured' }, { status: 500, headers: NO_STORE_HEADERS })
  }

  const limit = req.nextUrl.searchParams.get('limit') ?? '10'
  try {
    let lastError = ''
    for (const api of apis) {
      try {
        const r = await fetch(`${api}/v1/runs?limit=${encodeURIComponent(limit)}`, {
          headers: { 'x-api-key': API_KEY },
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

    return NextResponse.json({ runs: [], error: lastError || 'No run backend responded' }, { status: 503, headers: NO_STORE_HEADERS })
  } catch (e) {
    return NextResponse.json({ runs: [], error: String(e) }, { status: 503, headers: NO_STORE_HEADERS })
  }
}

export async function POST(req: NextRequest) {
  const apis = candidateApis()
  if (apis.length === 0) {
    return NextResponse.json({ status: 'error', detail: 'SMARTGRID_API_URL is not configured' }, { status: 500, headers: NO_STORE_HEADERS })
  }

  try {
    const body = await req.json()
    let lastError = ''
    for (const api of apis) {
      try {
        const r = await fetch(`${api}/v1/runs/start`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': API_KEY,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
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

    return NextResponse.json({ status: 'error', detail: lastError || 'No run backend responded' }, { status: 503, headers: NO_STORE_HEADERS })
  } catch (e) {
    return NextResponse.json({ status: 'error', detail: String(e) }, { status: 503, headers: NO_STORE_HEADERS })
  }
}
