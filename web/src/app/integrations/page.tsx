'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, XCircle, Clock, RefreshCw, Wifi, WifiOff,
  MonitorPlay, Link2, Zap, ExternalLink,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────

type ConnState = 'checking' | 'connected' | 'error'

const integrations = [
  {
    id: 'rapidscada',
    name: 'Rapid SCADA',
    type: 'OT / SCADA',
    status: 'connected',
    host: 'Configured SCADA endpoint',
    lastPoll: '2 s ago',
    pollInterval: '2 s',
    description:
      'PowerShell bridge pull_rapidscada_to_api.ps1 polls Web API module, normalises channel values, POSTs to /v1/scada/ingest/tags. Cookie-session auth, dual response-shape parser.',
    channels: [
      { id: 'CH101', name: 'Generator Voltage',  unit: 'V',    range: '220–240' },
      { id: 'CH102', name: 'Grid Frequency',      unit: 'Hz',   range: '49.5–50.5' },
      { id: 'CH103', name: 'Line Current A',      unit: 'A',    range: '0–120' },
      { id: 'CH104', name: 'Breaker Status',      unit: 'bool', range: '0/1' },
      { id: 'CH105', name: 'Substation Load',     unit: 'kW',   range: '0–500' },
      { id: 'CH106', name: 'Comm Latency',        unit: 'ms',   range: '0–150' },
    ],
  },
  {
    id: 'grafana',
    name: 'Grafana',
    type: 'Observability',
    status: 'configured',
    host: 'Configured Grafana endpoint',
    lastPoll: 'N/A',
    pollInterval: 'Pull (Prometheus)',
    description:
      'Grafana datasource connected to /metrics endpoint via Prometheus scrape at 15 s interval. Dashboards for cost, risk, and accuracy KPIs.',
    channels: [],
  },
  {
    id: 'newrelic',
    name: 'New Relic',
    type: 'APM / Telemetry',
    status: 'inactive',
    host: 'insights-collector.newrelic.com',
    lastPoll: 'N/A',
    pollInterval: '60 s',
    description:
      'New Relic bridge exports anomaly scores, audit frequency, and RL reward via Events API. Requires NEW_RELIC_LICENSE_KEY env var.',
    channels: [],
  },
  {
    id: 'jade',
    name: 'JADE Agent Framework',
    type: 'Multi-Agent Platform',
    status: 'connected',
    host: 'Configured JADE endpoint',
    lastPoll: '1.2 s ago',
    pollInterval: 'Event-driven',
    description:
      'JADE platform hosts decentralised audit agents. Python JADE bridge forwards anomaly events via RMI-over-HTTP relay for policy updates.',
    channels: [],
  },
]

const STATUS_COLOR: Record<string, string> = {
  connected:  'text-emerald-400',
  configured: 'text-amber-400',
  inactive:   'text-slate-500',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  connected:  <CheckCircle2 size={14} className="text-emerald-400" />,
  configured: <Clock        size={14} className="text-amber-400"   />,
  inactive:   <XCircle      size={14} className="text-slate-500"   />,
}

// ─────────────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [scadaConn, setScadaConn] = useState<ConnState>('checking')
  const [lastCheck, setLastCheck] = useState<string>('—')

  const testScada = useCallback(async () => {
    setScadaConn('checking')
    try {
      const r = await fetch('/api/proxy/health', {
        signal: AbortSignal.timeout(3500),
        cache: 'no-store',
      })
      setScadaConn(r.ok ? 'connected' : 'error')
    } catch {
      setScadaConn('error')
    }
    setLastCheck(new Date().toLocaleTimeString())
  }, [])

  // Auto-connect on mount
  useEffect(() => { testScada() }, [testScada])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">External Integrations</h1>
        <p className="text-sm text-slate-400 mt-1">
          SCADA bridges, observability platforms, and agent frameworks connected to the AI audit pipeline
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {integrations.map(intg => {
          const isScada = intg.id === 'rapidscada'
          return (
            <div key={intg.id} className={cn(
              'glass-card p-5 space-y-4',
              isScada && scadaConn === 'connected' && 'border-emerald-500/20',
              isScada && scadaConn === 'checking'  && 'border-amber-500/15',
            )}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {STATUS_ICON[intg.status]}
                    <span className="font-semibold text-slate-200">{intg.name}</span>
                    <Badge variant="info" className="text-[10px]">{intg.type}</Badge>
                    {/* Live SCADA API badge */}
                    {isScada && (
                      <span className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded border font-semibold flex items-center gap-1',
                        scadaConn === 'connected' ? 'bg-emerald-900/25 border-emerald-500/30 text-emerald-400' :
                        scadaConn === 'checking'  ? 'bg-amber-900/20 border-amber-500/25 text-amber-400' :
                                                    'bg-red-900/20 border-red-500/25 text-red-400'
                      )}>
                        {scadaConn === 'connected' ? <><span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse inline-block"/>API LIVE</> :
                         scadaConn === 'checking'  ? <><RefreshCw size={8} className="animate-spin"/>Checking…</> :
                                                     <><WifiOff size={8}/>API OFFLINE</>}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">{intg.host}</div>
                </div>
                <div className={`text-xs font-semibold capitalize ${STATUS_COLOR[intg.status]}`}>
                  {intg.status}
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">{intg.description}</p>

              <div className="flex flex-wrap gap-4 text-xs text-slate-500 border-t border-slate-700/40 pt-3">
                <span>Last poll: <span className="text-slate-300">{intg.lastPoll}</span></span>
                <span>Interval: <span className="text-slate-300">{intg.pollInterval}</span></span>
                {isScada && (
                  <span>Last API check: <span className="text-slate-300">{lastCheck}</span></span>
                )}
              </div>

              {/* Channel table (SCADA only) */}
              {intg.channels.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Channel Mapping</div>
                  <div className="rounded overflow-hidden border border-slate-700/40">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-grid-900/60">
                          <th className="text-left px-3 py-1.5 text-slate-500 font-medium">ID</th>
                          <th className="text-left px-3 py-1.5 text-slate-500 font-medium">Channel</th>
                          <th className="text-right px-3 py-1.5 text-slate-500 font-medium">Unit</th>
                          <th className="text-right px-3 py-1.5 text-slate-500 font-medium">Range</th>
                        </tr>
                      </thead>
                      <tbody>
                        {intg.channels.map(ch => (
                          <tr key={ch.id} className="data-table-row">
                            <td className="px-3 py-1.5 font-mono text-cyber-blue/80">{ch.id}</td>
                            <td className="px-3 py-1.5 text-slate-300">{ch.name}</td>
                            <td className="px-3 py-1.5 text-right text-slate-400">{ch.unit}</td>
                            <td className="px-3 py-1.5 text-right text-slate-400">{ch.range}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1 flex-wrap">
                {isScada ? (
                  <>
                    <button
                      onClick={testScada}
                      disabled={scadaConn === 'checking'}
                      className="flex items-center gap-1.5 text-xs bg-grid-900 hover:bg-slate-700/40 border border-slate-700/50 text-slate-300 px-3 py-1.5 rounded transition-colors disabled:opacity-50">
                      <RefreshCw size={11} className={scadaConn === 'checking' ? 'animate-spin' : ''} />
                      {scadaConn === 'checking' ? 'Connecting…' : 'Re-test API'}
                    </button>
                    <Link
                      href="/scada-live"
                      className="flex items-center gap-1.5 text-xs bg-cyan-900/20 hover:bg-cyan-900/35 border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded transition-colors font-medium">
                      <MonitorPlay size={11} />
                      Open Live Grid
                      <ExternalLink size={9} className="opacity-60" />
                    </Link>
                    <Link
                      href="/blockchain"
                      className="flex items-center gap-1.5 text-xs bg-grid-900 hover:bg-slate-700/40 border border-slate-700/50 text-slate-400 px-3 py-1.5 rounded transition-colors">
                      <Link2 size={11} />
                      Blockchain Ledger
                    </Link>
                  </>
                ) : (
                  <button className="flex items-center gap-1.5 text-xs bg-grid-900 hover:bg-slate-700/40 border border-slate-700/50 text-slate-300 px-3 py-1.5 rounded transition-colors">
                    <RefreshCw size={11} /> Test Connection
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
