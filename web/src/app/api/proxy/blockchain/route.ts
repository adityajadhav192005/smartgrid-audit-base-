import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_PUBLIC_API = 'https://smartgrid-public-api-1001036509634.us-central1.run.app'
const LOCAL_API = process.env.SMARTGRID_LOCAL_API ?? 'http://127.0.0.1:8000'
const FASTAPI = process.env.SMARTGRID_API_URL ?? DEFAULT_PUBLIC_API
const API_KEY = process.env.SMARTGRID_API_KEY ?? 'smartgrid-dev-key'

function candidateApis(): string[] {
  const options = [LOCAL_API, FASTAPI]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map(value => value.replace(/\/+$/, ''))

  return Array.from(new Set(options))
}

export async function GET(req: NextRequest) {
  const apis = candidateApis()
  if (apis.length === 0) {
    return NextResponse.json(
      { events: [], error: 'SMARTGRID_API_URL is not configured' },
      { status: 500 }
    )
  }
  const limit = req.nextUrl.searchParams.get('limit') ?? '50'
  try {
    let lastError = ''
    for (const api of apis) {
      try {
        const r = await fetch(`${api}/v1/blockchain/events?limit=${limit}`, {
          headers: { 'x-api-key': API_KEY },
          signal: AbortSignal.timeout(5000),
          cache: 'no-store',
        })
        const data = await r.json().catch(() => ({}))
        if (r.status === 404) {
          lastError = data?.detail ?? `Not found on ${api}`
          continue
        }
        return NextResponse.json(data, { status: r.status })
      } catch (error) {
        lastError = String(error)
      }
    }
    return NextResponse.json({ events: [], error: lastError || 'No blockchain backend responded' }, { status: 503 })
  } catch (e) {
    return NextResponse.json({ events: [], error: String(e) }, { status: 503 })
  }
}
