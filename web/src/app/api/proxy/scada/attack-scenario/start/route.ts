import { NextResponse } from 'next/server'
import { proxyFetch } from '@/lib/proxyClient'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.json()
  const { status, data } = await proxyFetch({
    path: '/v1/scada/attack-scenario/start',
    method: 'POST',
    body,
    timeoutMs: 5000,
  })
  return NextResponse.json(data, { status })
}
