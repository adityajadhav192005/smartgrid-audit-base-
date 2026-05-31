import { NextRequest, NextResponse } from 'next/server'
import { proxyFetch } from '@/lib/proxyClient'

export async function GET(req: NextRequest, context: { params: { runId: string } }) {
  const runId = context.params.runId
  const tail = req.nextUrl.searchParams.get('tail') ?? '80'
  const { status, data } = await proxyFetch({
    path: `/v1/runs/${encodeURIComponent(runId)}/logs?tail=${encodeURIComponent(tail)}`,
    timeoutMs: 8000,
  })
  return NextResponse.json(data, { status })
}
