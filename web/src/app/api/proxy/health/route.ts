import { NextResponse } from 'next/server'
import { proxyFetch } from '@/lib/proxyClient'

export async function GET() {
  const { status, data } = await proxyFetch({
    path: '/health',
    timeoutMs: 3000,
    omitAuth: true,
  })
  return NextResponse.json(data, { status })
}
