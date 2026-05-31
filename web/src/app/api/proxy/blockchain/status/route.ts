import { NextResponse } from 'next/server'
import { proxyFetch } from '@/lib/proxyClient'

export async function GET() {
  const { status, data } = await proxyFetch({
    path: '/v1/blockchain/status',
    timeoutMs: 4000,
  })
  if (status >= 500) {
    return NextResponse.json(
      { total_events: 0, chain_ok: false, backend: 'offline', latest_hash: '' },
      { status: 503 },
    )
  }
  return NextResponse.json(data, { status })
}
