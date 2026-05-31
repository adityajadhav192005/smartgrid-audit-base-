import { NextRequest, NextResponse } from 'next/server'
import { proxyFetch } from '@/lib/proxyClient'

export async function GET(_: NextRequest, context: { params: { runId: string } }) {
  const runId = context.params.runId
  const { status, data } = await proxyFetch({
    path: `/v1/runs/${encodeURIComponent(runId)}`,
    timeoutMs: 5000,
  })
  return NextResponse.json(data, { status })
}
