import { NextRequest, NextResponse } from 'next/server'
import { proxyFetch } from '@/lib/proxyClient'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { status, data } = await proxyFetch({
    path: '/v1/screenshot/save',
    method: 'POST',
    body,
    timeoutMs: 30000,
  })
  return NextResponse.json(data, { status })
}
