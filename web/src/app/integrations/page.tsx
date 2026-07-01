'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { useDashboard } from '@/lib/dashboardContext'
import { useLatestRun } from '@/lib/latestRun'
import { cn } from '@/lib/utils'
import { Activity, CheckCircle2, Clock, ExternalLink, MonitorPlay, Wifi, WifiOff } from 'lucide-react'

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

export default function IntegrationsPage() {
  const { setScadaConnected, refreshTick } = useDashboard()
  const { latestRun } = useLatestRun(12000)
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
        const connected = Boolean(gridPayload?.rapid_scada?.connection?.connected)

        if (active) {
          setGridStatus(gridPayload)
          setApiHealthy(healthResponse.ok && healthPayload?.status === 'ok')
          setScadaConnected(connected)
          setLastCheck(new Date().toLocaleTimeString())
        }
      } catch {
        if (active) {
          setGridStatus(null)
          setApiHealthy(false)
          setScadaConnected(false)
          setLastCheck(new Date().toLocaleTimeString())
        }
      }
    }

    void refresh()
    const intervalId = setInterval(() => {
      void refresh()
    }, 5000)

    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [refreshTick, setScadaConnected])

  const scadaConnection = gridStatus?.rapid_scada?.connection
  const scadaConnected = Boolean(scadaConnection?.connected)
  const liveTags = gridStatus?.rapid_scada?.live_tags ?? {}

  const experimentCards = useMemo(() => ([
    { label: 'Backend API', value: apiHealthy ? 'ONLINE' : 'OFFLINE', ok: apiHealthy },
    { label: 'Latest Run', value: latestRun?.runId ?? 'n/a', ok: Boolean(latestRun?.runId) },
    { label: 'Run Status', value: latestRun?.status ?? 'unknown', ok: latestRun?.status === 'completed' || latestRun?.status === 'running' || latestRun?.status === 'live' },
    { label: 'Agents', value: String(latestRun?.totalAgents ?? 0), ok: (latestRun?.totalAgents ?? 0) > 0 },
  ]), [apiHealthy, latestRun])

  const scadaCards = useMemo(() => ([
    { label: 'Rapid SCADA', value: scadaConnected ? 'CONNECTED' : 'DISCONNECTED', ok: scadaConnected },
    { label: 'Endpoint', value: scadaConnection?.source_url ?? 'n/a', ok: Boolean(scadaConnection?.source_url) },
    { label: 'Poll Interval', value: `${scadaConnection?.poll_sec ?? 0}s`, ok: Boolean(scadaConnection?.poll_sec) },
    { label: 'Bridge Failures', value: String(scadaConnection?.consecutive_failures ?? 0), ok: (scadaConnection?.consecutive_failures ?? 0) === 0 },
  ]), [scadaConnected, scadaConnection])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">SCADA Connectivity</h1>
        <p className="text-sm text-slate-500 mt-1">Clear split between experiment execution status and live Rapid SCADA telemetry state</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Activity size={14} className={apiHealthy ? 'text-emerald-600' : 'text-red-400'} />
                <span className="font-semibold text-slate-800">Experiment Running</span>
                <Badge variant="info" className="text-[10px]">Backend</Badge>
              </div>
              <div className="text-xs text-slate-500 mt-1">Run engine, API health, and latest experiment state</div>
            </div>
            <span className={cn('text-xs font-semibold', apiHealthy ? 'text-emerald-600' : 'text-red-400')}>
              {apiHealthy ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {experimentCards.map(card => (
              <div key={card.label} className="glass-card p-3 border-slate-200">
                <div className="text-slate-500 mb-1">{card.label}</div>
                <div className={cn('font-mono text-sm break-all', card.ok ? 'text-slate-800' : 'text-red-300')}>{card.value}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1 flex-wrap">
            <Link href="/runs" className="flex items-center gap-1.5 text-xs bg-cyan-900/20 hover:bg-cyan-900/35 border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded transition-colors font-medium">
              <Activity size={11} />
              Open Experiment Control
              <ExternalLink size={9} className="opacity-60" />
            </Link>
            <Link href="/history" className="flex items-center gap-1.5 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded transition-colors">
              <Clock size={11} />
              View Experiment History
            </Link>
          </div>
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
            {scadaCards.map(card => (
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
                {Object.entries(liveTags).slice(0, 8).map(([key, value]) => (
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
            <Link href="/scada-live" className="flex items-center gap-1.5 text-xs bg-cyan-900/20 hover:bg-cyan-900/35 border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded transition-colors font-medium">
              <MonitorPlay size={11} />
              Open Rapid SCADA Grid
              <ExternalLink size={9} className="opacity-60" />
            </Link>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 text-xs text-slate-500">
        <span className="text-slate-500">Last backend check:</span> {lastCheck}
        {scadaConnection?.last_success_utc && (
          <span className="ml-4">
            <span className="text-slate-500">Last SCADA success:</span> {scadaConnection.last_success_utc}
          </span>
        )}
        {scadaConnection?.last_error && (
          <span className="ml-4 text-red-300">
            <span className="text-slate-500">Last error:</span> {scadaConnection.last_error}
          </span>
        )}
      </div>
    </div>
  )
}
