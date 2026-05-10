"use client"

import { useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Wifi, WifiOff, Activity, AlertTriangle, Zap, Radio,
  Gauge, ArrowUpDown, ShieldAlert, Cpu,
} from 'lucide-react'
import { useDashboard } from '@/lib/dashboardContext'
import { useLiveTelemetry } from '@/lib/liveTelemetry'

type AgentType = 'Generator' | 'Substation' | 'PMU' | 'Breaker'
type AgentState = 'Healthy' | 'Anomalous' | 'Attacked' | 'Under Audit' | 'Suspect' | 'Offline'

const STATE_BG: Record<AgentState, string> = {
  Healthy: 'bg-emerald-950/40 border-emerald-600/20',
  Suspect: 'bg-amber-950/50 border-amber-500/30',
  Anomalous: 'bg-orange-950/50 border-orange-500/35',
  'Under Audit': 'bg-cyan-950/50 border-cyan-500/35',
  Attacked: 'bg-red-950/60 border-red-500/50',
  Offline: 'bg-slate-900/30 border-slate-700/20',
}

const STATE_PULSE: Record<AgentState, string> = {
  Healthy: '',
  Suspect: 'animate-pulse',
  Anomalous: 'animate-pulse',
  'Under Audit': 'animate-pulse',
  Attacked: 'animate-pulse',
  Offline: '',
}

const TYPE_COLOR: Record<AgentType, string> = {
  Generator: 'text-yellow-400',
  Substation: 'text-violet-400',
  PMU: 'text-cyan-400',
  Breaker: 'text-orange-400',
}

const SOURCE_RING = {
  live: 'ring-1 ring-emerald-500/40',
  mixed: 'ring-1 ring-amber-500/35',
  fallback: 'ring-1 ring-slate-600/25',
} as const

export default function ScadaLivePage() {
  const { setScadaConnected } = useDashboard()
  const { gridStatus, liveAgents, events, agentSnapshots, error } = useLiveTelemetry(2000)

  useEffect(() => {
    setScadaConnected(Boolean(gridStatus?.rapid_scada?.connection?.connected))
    return () => setScadaConnected(false)
  }, [gridStatus, setScadaConnected])

  const isConnected = Boolean(gridStatus?.rapid_scada?.connection?.connected)
  const connError = isConnected ? null : (gridStatus?.rapid_scada?.connection?.last_error ?? null)
  const liveTags = gridStatus?.rapid_scada?.live_tags ?? {}
  const experimentStatus = gridStatus?.rapid_scada?.experiment_pipeline
  const scadaConfig = gridStatus?.rapid_scada?.config
  const liveDataAgeSec = Number(gridStatus?.rapid_scada?.connection?.data_age_sec ?? NaN)
  const freshestUpdate = String(gridStatus?.rapid_scada?.connection?.last_agent_update_utc ?? '').slice(11, 19)

  const channels = useMemo(() => {
    const voltage = Number(liveTags.voltage)
    const frequency = Number(liveTags.frequency)
    const current = Number(liveTags.current)
    const power = Number(liveTags.substation_load ?? liveTags.power)
    const latency = Number(liveTags.latency ?? liveTags.response_time)
    const breaker = Number(liveTags.breaker_status)
    return {
      voltage: Number.isFinite(voltage) ? voltage : 0,
      frequency: Number.isFinite(frequency) ? frequency : 0,
      current: Number.isFinite(current) ? current : 0,
      breakerStatus: Number.isFinite(breaker) ? breaker : 0,
      substationLoad: Number.isFinite(power) ? power : 0,
      commLatency: Number.isFinite(latency) ? latency : 0,
    }
  }, [liveTags])

  const chOk = {
    voltage: channels.voltage >= 220 && channels.voltage <= 240,
    frequency: channels.frequency >= 49.5 && channels.frequency <= 50.5,
    current: channels.current <= 120,
    breaker: channels.breakerStatus === 1,
    load: channels.substationLoad <= 500,
    latency: channels.commLatency <= 150,
  }

  const liveEvents = events.slice(0, 12)
  const scadaAgents = liveAgents.slice(0, 100)
  const scadaStatusCounts = useMemo(() => ({
    healthy: scadaAgents.filter(agent => agent.state === 'Healthy').length,
    anomalous: scadaAgents.filter(agent => agent.state === 'Anomalous').length,
    suspect: scadaAgents.filter(agent => agent.state === 'Suspect').length,
    underAudit: scadaAgents.filter(agent => agent.state === 'Under Audit').length,
    attacked: scadaAgents.filter(agent => agent.state === 'Attacked').length,
  }), [scadaAgents])
  const sourceCounts = useMemo(() => ({
    live: scadaAgents.filter(agent => agent.source === 'live').length,
    mixed: scadaAgents.filter(agent => agent.source === 'mixed').length,
    fallback: scadaAgents.filter(agent => agent.source === 'fallback').length,
  }), [scadaAgents])
  const currentDecision = useMemo(() => {
    const top = agentSnapshots.find(agent => agent.auditCount > 0 || agent.anomalyScore >= (agent.scoreThreshold ?? 3))
    return (top?.attack ?? 'MAINTAIN').replaceAll('_', ' ')
  }, [agentSnapshots])

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white tracking-widest uppercase flex items-center gap-2">
            <Cpu size={18} className="text-cyan-400" />
            Grid With The Agents
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            Rapid SCADA -&gt; SmartGrid AI live feed
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border',
            isConnected ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/40 border-slate-600/20 text-slate-500',
          )}>
            {isConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
      </div>

      {connError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/25 border border-amber-500/25 text-amber-300 text-xs flex-shrink-0">
          <AlertTriangle size={11} /> {connError}
        </div>
      )}

      {error && (
        <div className="glass-card p-3 border-red-500/20 text-xs text-red-300 flex items-center justify-between">
          <span>Live mapping warning</span>
          <span className="font-mono">{error}</span>
        </div>
      )}

      <div className="glass-card p-3 border-cyan-500/20 text-xs text-slate-300 flex items-center justify-between">
        <span>
          Fresh snapshot only: <span className="font-mono text-cyan-300">{freshestUpdate || 'n/a'}</span>
        </span>
        <span className="text-slate-400">
          source live {sourceCounts.live} · mixed {sourceCounts.mixed} · fallback {sourceCounts.fallback}
        </span>
      </div>

      <div className="grid grid-cols-6 gap-2 flex-shrink-0">
        {[
          { label: 'Voltage', value: isConnected ? `${channels.voltage.toFixed(1)}` : '-', unit: 'V', Icon: Zap, ok: chOk.voltage },
          { label: 'Frequency', value: isConnected ? `${channels.frequency.toFixed(3)}` : '-', unit: 'Hz', Icon: Activity, ok: chOk.frequency },
          { label: 'Current', value: isConnected ? `${channels.current.toFixed(1)}` : '-', unit: 'A', Icon: ArrowUpDown, ok: chOk.current },
          { label: 'Breaker', value: isConnected ? (channels.breakerStatus ? 'CLOSED' : 'OPEN') : '-', unit: '', Icon: ShieldAlert, ok: chOk.breaker },
          { label: 'Sub. Load', value: isConnected ? `${channels.substationLoad.toFixed(0)}` : '-', unit: 'kW', Icon: Gauge, ok: chOk.load },
          { label: 'Latency', value: isConnected ? `${channels.commLatency.toFixed(1)}` : '-', unit: 'ms', Icon: Radio, ok: chOk.latency },
        ].map(ch => (
          <div key={ch.label} className={cn('glass-card p-3 space-y-1', !isConnected && 'opacity-40')}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{ch.label}</span>
              <ch.Icon size={10} className={isConnected ? (ch.ok ? 'text-emerald-400' : 'text-red-400') : 'text-slate-600'} />
            </div>
            <div className={cn('text-base font-bold font-mono leading-tight', isConnected ? (ch.ok ? 'text-slate-100' : 'text-red-300') : 'text-slate-600')}>
              {ch.value}
            </div>
            {ch.unit && <div className="text-[10px] text-slate-600">{ch.unit}</div>}
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        <div className="glass-card p-3 flex flex-col gap-2 flex-1 min-w-0 min-h-0">
          <div className="flex items-center justify-between flex-shrink-0">
            <span className="text-xs font-semibold text-slate-300">10 x 10 Agent Grid</span>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />Healthy: {scadaStatusCounts.healthy}</span>
              <span><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block mr-1" />Flagged: {scadaStatusCounts.anomalous + scadaStatusCounts.suspect + scadaStatusCounts.underAudit}</span>
              <span><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block mr-1" />Attacked: {scadaStatusCounts.attacked}</span>
            </div>
          </div>

          <div className="flex gap-4 text-[10px] text-slate-500 flex-wrap flex-shrink-0">
            <span><span className="text-yellow-400 font-bold">G</span>01-20 Generator</span>
            <span><span className="text-violet-400 font-bold">S</span>21-50 Substation</span>
            <span><span className="text-cyan-400 font-bold">P</span>51-75 PMU</span>
            <span><span className="text-orange-400 font-bold">B</span>76-100 Breaker</span>
            <span><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1" />Live {sourceCounts.live}</span>
            <span><span className="w-2 h-2 rounded-full bg-amber-500 inline-block mr-1" />Mixed {sourceCounts.mixed}</span>
            <span><span className="w-2 h-2 rounded-full bg-slate-500 inline-block mr-1" />Fallback {sourceCounts.fallback}</span>
          </div>

          <div className="grid grid-cols-10 gap-0.5 flex-1">
            {scadaAgents.map(agent => (
              <div
                key={agent.id}
                title={`${agent.id} | Score: ${agent.anomalyScore.toFixed(3)} | ${agent.state}`}
                className={cn(
                  'rounded border flex flex-col items-center justify-center cursor-default transition-colors duration-700',
                  STATE_BG[agent.state],
                  STATE_PULSE[agent.state],
                  SOURCE_RING[agent.source],
                  !isConnected && 'opacity-25',
                )}
              >
                <span className={cn('text-[10px] font-bold font-mono leading-tight', TYPE_COLOR[agent.type as AgentType])}>
                  {agent.id.replace('GEN-', 'G').replace('SUB-', 'S').replace('PMU-', 'P').replace('BRK-', 'B')}
                </span>
                <span className="text-[8px] text-slate-500 font-mono leading-tight">
                  {agent.anomalyScore.toFixed(2)}
                </span>
                <span className="text-[7px] uppercase tracking-wide text-slate-500 leading-tight">
                  {agent.source}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-72 flex-shrink-0 flex flex-col gap-3 min-h-0">
          <div className="glass-card p-3 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={12} className={isConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'} />
              <span className="text-xs font-semibold text-slate-300">System Status</span>
            </div>
            <div className="space-y-1.5 text-xs">
              {[
                { k: 'Connection', v: isConnected ? 'LIVE' : 'DISCONNECTED', ok: isConnected },
                { k: 'Healthy', v: `${scadaStatusCounts.healthy} / 100`, ok: scadaStatusCounts.healthy >= 90 },
                { k: 'Anomalous', v: String(scadaStatusCounts.anomalous), ok: true },
                { k: 'Suspect', v: String(scadaStatusCounts.suspect), ok: true },
                { k: 'Under Audit', v: String(scadaStatusCounts.underAudit), ok: true },
                { k: 'Attacked', v: String(scadaStatusCounts.attacked), ok: scadaStatusCounts.attacked === 0 },
                { k: 'Decision', v: currentDecision, ok: !currentDecision.includes('CRITICAL') },
                { k: 'Freshness', v: freshestUpdate || 'n/a', ok: !Number.isFinite(liveDataAgeSec) || liveDataAgeSec <= 15 },
              ].map(row => (
                <div key={row.k} className="flex justify-between">
                  <span className="text-slate-500">{row.k}</span>
                  <span className={cn('font-mono font-semibold', row.ok ? 'text-emerald-400' : 'text-red-400')}>{row.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-3 flex-shrink-0">
            <div className="text-xs font-semibold text-slate-300 mb-2">Active SCADA Algorithm</div>
            <div className="space-y-1.5 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Audit threshold</span>
                <span className="font-mono text-cyan-300">{Number(scadaConfig?.score_threshold ?? 3).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Generator baseline</span>
                <span className="font-mono">I={Number(scadaConfig?.profiles?.generator?.phys_defaults?.current ?? 15).toFixed(1)}A</span>
              </div>
              <div className="flex justify-between">
                <span>Substation baseline</span>
                <span className="font-mono">P={Number(scadaConfig?.profiles?.substation?.phys_defaults?.power ?? 180).toFixed(0)}kW</span>
              </div>
              <div className="flex justify-between">
                <span>Cyber baseline</span>
                <span className="font-mono">lat={Number(scadaConfig?.profiles?.generator?.cyber_defaults?.latency ?? 3).toFixed(1)}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Pipeline step</span>
                <span className="font-mono">{Number(experimentStatus?.step_count ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>LSTM live</span>
                <span className="font-mono">{Boolean(experimentStatus?.lstm_enabled) ? 'ON' : 'OFF'}</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-3 flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
              <AlertTriangle size={12} className="text-amber-400" />
              <span className="text-xs font-semibold text-slate-300">Live Events</span>
              {isConnected && <span className="ml-auto text-[9px] text-emerald-400 font-mono animate-pulse">fresh</span>}
            </div>
            <div className="overflow-y-auto flex-1 space-y-1 pr-0.5">
              {liveEvents.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-6">
                  {isConnected ? 'Monitoring current snapshot' : 'Waiting for SCADA connection'}
                </p>
              ) : liveEvents.map(event => (
                <div key={event.id} className="rounded px-2 py-1.5 text-[10px] border space-y-0.5 bg-slate-900/20 border-slate-700/20">
                  <div className="flex justify-between">
                    <span className="font-bold font-mono text-slate-200">{event.type}</span>
                    <span className="text-slate-500 font-mono">{event.ts}</span>
                  </div>
                  <div className="text-slate-400">{event.msg}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
