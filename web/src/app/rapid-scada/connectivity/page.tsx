'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { CheckCircle2, Clock, ExternalLink, MonitorPlay, Wifi, WifiOff } from 'lucide-react'
import Link from 'next/link'

type GridStatusPayload = {
  rapid_scada?: {
    connection?: {
      connected?: boolean
      last_error?: string | null
      last_success_utc?: string | null
      consecutive_failures?: number
      poll_sec?: number
      source_url?: string
    }
    live_tags?: Record<string, number>
  }
}

export default function RapidScadaConnectivityPage() {
  const [gridStatus, setGridStatus] = useState<GridStatusPayload | null>(null)
  const [apiHealthy, setApiHealthy] = useState(false)
  const [lastCheck, setLastCheck] = useState<string>('n/a')

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const [gridResponse, healthResponse] = await Promise.all([
          fetch('/api/proxy/grid/status', { cache: 'no-store' }),
          fetch('/api/proxy/health', { cache: 'no-store' }),
        ])
        const gridPayload = await gridResponse.json().catch(() => ({}))
        const healthPayload = await healthResponse.json().catch(() => ({}))
        if (active) {
          setGridStatus(gridPayload)
          setApiHealthy(healthResponse.ok && healthPayload?.status === 'ok')
          setLastCheck(new Date().toLocaleTimeString())
        }
      } catch {
        if (active) {
          setGridStatus(null)
          setApiHealthy(false)
          setLastCheck(new Date().toLocaleTimeString())
        }
      }
    }
    void refresh()
    const intervalId = setInterval(() => void refresh(), 5000)
    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [])

  const scadaConnection = gridStatus?.rapid_scada?.connection
  const scadaConnected = Boolean(scadaConnection?.connected)
  const liveTags = gridStatus?.rapid_scada?.live_tags ?? {}
  const cards = useMemo(() => ([
    { label: 'Rapid SCADA', value: scadaConnected ? 'CONNECTED' : 'DISCONNECTED', ok: scadaConnected },
    { label: 'Backend API', value: apiHealthy ? 'ONLINE' : 'OFFLINE', ok: apiHealthy },
    { label: 'Endpoint', value: scadaConnection?.source_url ?? 'n/a', ok: Boolean(scadaConnection?.source_url) },
    { label: 'Poll Interval', value: `${scadaConnection?.poll_sec ?? 0}s`, ok: Boolean(scadaConnection?.poll_sec) },
    { label: 'Bridge Failures', value: String(scadaConnection?.consecutive_failures ?? 0), ok: (scadaConnection?.consecutive_failures ?? 0) === 0 },
  ]), [apiHealthy, scadaConnected, scadaConnection])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Rapid SCADA Connectivity</h1>
        <p className="text-sm text-slate-500 mt-1">Dedicated live SCADA connection health, bridge status, and current tag availability</p>
      </div>

      <div className="glass-card p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              {scadaConnected ? <Wifi size={14} className="text-emerald-600" /> : <WifiOff size={14} className="text-red-400" />}
              <span className="font-semibold text-slate-800">Rapid SCADA Live</span>
              <Badge variant="info" className="text-[10px]">Telemetry</Badge>
            </div>
            <div className="text-xs text-slate-500 mt-1">Live SCADA bridge, polling state, and current tag availability</div>
          </div>
          <span className={cn('text-xs font-semibold', scadaConnected ? 'text-emerald-600' : 'text-red-400')}>
            {scadaConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          {cards.map(card => (
            <div key={card.label} className="glass-card p-3 border-slate-200">
              <div className="text-slate-500 mb-1">{card.label}</div>
              <div className={cn('font-mono text-sm break-all', card.ok ? 'text-slate-800' : 'text-red-300')}>{card.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded overflow-hidden border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-3 py-1.5 text-slate-500 font-medium">Live Tag</th>
                <th className="text-right px-3 py-1.5 text-slate-500 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(liveTags).slice(0, 10).map(([key, value]) => (
                <tr key={key} className="data-table-row">
                  <td className="px-3 py-1.5 font-mono text-cyber-blue/80">{key}</td>
                  <td className="px-3 py-1.5 text-right text-slate-700">{Number(value).toFixed(3)}</td>
                </tr>
              ))}
              {Object.keys(liveTags).length === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-center text-slate-500">No live SCADA tags are available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2 pt-1 flex-wrap">
          <Link href="/rapid-scada/grid" className="flex items-center gap-1.5 text-xs bg-cyan-900/20 hover:bg-cyan-900/35 border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded transition-colors font-medium">
            <MonitorPlay size={11} />
            Open Rapid SCADA Grid
            <ExternalLink size={9} className="opacity-60" />
          </Link>
        </div>
      </div>

      <div className="glass-card p-4 text-xs text-slate-500 space-y-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span><span className="text-slate-500">Last backend check:</span> {lastCheck}</span>
          {scadaConnection?.last_success_utc && (
            <span><span className="text-slate-500">Last SCADA poll:</span> {scadaConnection.last_success_utc}</span>
          )}
          <span><span className="text-slate-500">Live tags received:</span> {Object.keys(liveTags).length}</span>
          {scadaConnection?.last_error && (
            <span className="text-red-300"><span className="text-slate-500">Last error:</span> {scadaConnection.last_error}</span>
          )}
        </div>
        <div className="border-t border-slate-200 pt-2 text-[11px] text-slate-500">
          <span className="font-medium text-slate-500">Data sources — </span>
          <span className="text-emerald-600">Physical</span>: voltage, current, load, frequency, breaker status read live from Rapid SCADA channels.{' '}
          <span className="text-amber-600">Cyber</span>: latency, packet_loss, integrity, comm_freq are synthetic baseline values
          (no IDS/SIEM integration; in production these would come from Snort/Suricata or a network monitoring agent).
        </div>
      </div>
    </div>
  )
}
