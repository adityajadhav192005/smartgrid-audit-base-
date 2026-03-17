import { NextResponse } from 'next/server'

const FASTAPI = process.env.SMARTGRID_API_URL ?? 'https://smartgrid-public-api-1001036509634.us-central1.run.app'
const API_KEY = process.env.SMARTGRID_API_KEY ?? 'smartgrid-dev-key'

export async function GET() {
  if (!FASTAPI) {
    return NextResponse.json(
      { total_events: 0, chain_ok: false, backend: 'misconfigured', latest_hash: '' },
      { status: 500 }
    )
  }
  try {
    const r = await fetch(`${FASTAPI}/v1/blockchain/status`, {
      headers: { 'x-api-key': API_KEY },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch (e) {
    return NextResponse.json(
      { total_events: 0, chain_ok: false, backend: 'offline', latest_hash: '' },
      { status: 503 }
    )
  }
}
