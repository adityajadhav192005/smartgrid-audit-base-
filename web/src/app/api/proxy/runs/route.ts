import { NextRequest, NextResponse } from 'next/server'
import { NO_STORE_HEADERS, proxyFetch } from '@/lib/proxyClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get('limit') ?? '10'
  const { status, data } = await proxyFetch({
    path: `/v1/runs?limit=${encodeURIComponent(limit)}`,
    timeoutMs: 5000,
  })
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { status, data } = await proxyFetch({
    path: '/v1/runs/start',
    method: 'POST',
    body,
    timeoutMs: 10000,
  })
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS })
}
