import { NextResponse } from 'next/server'
import { proxyFetch } from '@/lib/proxyClient'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { status, data } = await proxyFetch({
    path: '/v1/scada/attack-scenario/status',
    timeoutMs: 3000,
  })
  return NextResponse.json(data, { status })
}
