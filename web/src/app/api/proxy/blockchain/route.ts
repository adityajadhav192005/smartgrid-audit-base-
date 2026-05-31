import { NextRequest, NextResponse } from 'next/server'
import { proxyFetch } from '@/lib/proxyClient'

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get('limit') ?? '50'
  const { status, data } = await proxyFetch({
    path: `/v1/blockchain/events?limit=${encodeURIComponent(limit)}`,
    timeoutMs: 5000,
  })
  return NextResponse.json(data, { status })
}
