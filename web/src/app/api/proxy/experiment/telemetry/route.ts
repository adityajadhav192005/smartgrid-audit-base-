import { NextResponse } from 'next/server'

const FASTAPI = process.env.SMARTGRID_API_URL ?? 'https://smartgrid-public-api-1001036509634.us-central1.run.app'
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
  const options = [LOCAL_API, FASTAPI]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map(value => value.replace(/\/+$/, ''))
  return Array.from(new Set(options))
}

export async function GET() {
  const apis = candidateApis()
  let lastError = ''
  for (const api of apis) {
    try {
      const r = await fetch(`${api}/experiment/telemetry`, {
        headers: { 'x-api-key': API_KEY },
        signal: AbortSignal.timeout(30000),
        cache: 'no-store',
      })
      if (!r.ok) { lastError = `HTTP ${r.status} from ${api}`; continue }
      const data = await r.json().catch(() => ({}))
      return NextResponse.json(data, { status: 200, headers: NO_STORE_HEADERS })
    } catch (error) {
      lastError = String(error)
    }
  }
  return NextResponse.json({ error: lastError || 'No backend responded' }, { status: 503, headers: NO_STORE_HEADERS })
}
