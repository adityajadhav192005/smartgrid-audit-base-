import { NextResponse } from 'next/server'
import { NO_STORE_HEADERS, proxyFetch } from '@/lib/proxyClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const { status, data } = await proxyFetch({
    path: '/v1/runs/latest',
    timeoutMs: 5000,
  })
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS })
}
