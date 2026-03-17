import { NextRequest, NextResponse } from 'next/server'

const FASTAPI = process.env.SMARTGRID_API_URL ?? 'https://smartgrid-public-api-1001036509634.us-central1.run.app'
const API_KEY = process.env.SMARTGRID_API_KEY ?? 'smartgrid-dev-key'

export async function GET(_: NextRequest, context: { params: { runId: string } }) {
  if (!FASTAPI) {
    return NextResponse.json({ run: null, error: 'SMARTGRID_API_URL is not configured' }, { status: 500 })
  }

  const runId = context.params.runId
  try {
    const r = await fetch(`${FASTAPI}/v1/runs/${encodeURIComponent(runId)}`, {
      headers: { 'x-api-key': API_KEY },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch (e) {
    return NextResponse.json({ run: null, error: String(e) }, { status: 503 })
  }
}
