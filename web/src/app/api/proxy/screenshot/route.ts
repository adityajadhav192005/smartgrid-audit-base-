import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.SMARTGRID_API_KEY ?? 'smartgrid-dev-key'
const LOCAL_API = process.env.SMARTGRID_LOCAL_API ?? 'http://127.0.0.1:8000'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const r = await fetch(`${LOCAL_API}/v1/screenshot/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 503 })
  }
}
