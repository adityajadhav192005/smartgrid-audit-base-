import { NextResponse } from 'next/server'

const FASTAPI = process.env.SMARTGRID_API_URL

export async function GET() {
  if (!FASTAPI) {
    return NextResponse.json(
      { status: 'error', detail: 'SMARTGRID_API_URL is not configured' },
      { status: 500 }
    )
  }
  try {
    const r = await fetch(`${FASTAPI}/health`, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch (e) {
    return NextResponse.json({ status: 'error', detail: String(e) }, { status: 503 })
  }
}
