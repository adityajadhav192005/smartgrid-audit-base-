import { NextRequest, NextResponse } from 'next/server'

const FASTAPI = process.env.SMARTGRID_API_URL ?? 'https://smartgrid-public-api-1001036509634.us-central1.run.app'
const API_KEY = process.env.SMARTGRID_API_KEY ?? 'smartgrid-dev-key'

export async function GET(req: NextRequest) {
  if (!FASTAPI) {
    return NextResponse.json({ runs: [], error: 'SMARTGRID_API_URL is not configured' }, { status: 500 })
  }

  const limit = req.nextUrl.searchParams.get('limit') ?? '10'
  try {
    const r = await fetch(`${FASTAPI}/v1/runs?limit=${encodeURIComponent(limit)}`, {
      headers: { 'x-api-key': API_KEY },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch (e) {
    return NextResponse.json({ runs: [], error: String(e) }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  if (!FASTAPI) {
    return NextResponse.json({ status: 'error', detail: 'SMARTGRID_API_URL is not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const r = await fetch(`${FASTAPI}/v1/runs/start`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch (e) {
    return NextResponse.json({ status: 'error', detail: String(e) }, { status: 503 })
  }
}
