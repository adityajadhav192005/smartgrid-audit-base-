import { NextRequest, NextResponse } from 'next/server'

const FASTAPI = process.env.SMARTGRID_API_URL
const API_KEY = process.env.SMARTGRID_API_KEY ?? 'smartgrid-dev-key'

export async function GET(req: NextRequest, context: { params: { runId: string } }) {
  if (!FASTAPI) {
    return NextResponse.json({ lines: [], error: 'SMARTGRID_API_URL is not configured' }, { status: 500 })
  }

  const runId = context.params.runId
  const tail = req.nextUrl.searchParams.get('tail') ?? '80'
  try {
    const r = await fetch(`${FASTAPI}/v1/runs/${encodeURIComponent(runId)}/logs?tail=${encodeURIComponent(tail)}`, {
      headers: { 'x-api-key': API_KEY },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch (e) {
    return NextResponse.json({ lines: [], error: String(e) }, { status: 503 })
  }
}
