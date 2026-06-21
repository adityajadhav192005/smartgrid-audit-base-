'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Wifi, WifiOff, Activity, AlertTriangle, Zap, Radio,
  Gauge, ArrowUpDown, ShieldAlert, Cpu, Flame, RotateCcw,
  Square, Play,
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
  Offline: 'bg-slate-50 border-slate-200',
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

  // Attack scenario state
  const [showAttackPanel, setShowAttackPanel] = useState(false)
  const [scenarios, setScenarios] = useState<any[]>([])
  const [scenarioStatus, setScenarioStatus] = useState<any>(null)
  const [scenarioLoading, setScenarioLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!showAttackPanel) return
    fetch('/api/proxy/scada/attack-scenario/list')
      .then(r => r.ok ? r.json() : fetch('http://127.0.0.1:8000/v1/scada/attack-scenario/list', { headers: { 'X-API-Key': 'smartgrid-dev-key' } }).then(r2 => r2.json()))
      .then(d => setScenarios(d?.scenarios ?? []))
      .catch(() => {})
  }, [showAttackPanel])

  useEffect(() => {
    if (!showAttackPanel) return
    const poll = () => {
      fetch('/api/proxy/scada/attack-scenario/status')
        .then(r => r.ok ? r.json() : fetch('http://127.0.0.1:8000/v1/scada/attack-scenario/status', { headers: { 'X-API-Key': 'smartgrid-dev-key' } }).then(r2 => r2.json()))
        .then(d => setScenarioStatus(d))
        .catch(() => {})
    }
    poll()
    const iv = setInterval(poll, 2000)
    return () => clearInterval(iv)
  }, [showAttackPanel])

  const startScenario = useCallback(async (scenarioId: string) => {
    setScenarioLoading(scenarioId)
    try {
      const res = await fetch('/api/proxy/scada/attack-scenario/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenarioId }),
      })
      if (!res.ok) {
        await fetch('http://127.0.0.1:8000/v1/scada/attack-scenario/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': 'smartgrid-dev-key' },
          body: JSON.stringify({ scenario_id: scenarioId }),
        })
      }
    } catch {} finally { setScenarioLoading(null) }
  }, [])

  const stopScenario = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/scada/attack-scenario/stop', { method: 'POST' })
      if (!res.ok) {
        await fetch('http://127.0.0.1:8000/v1/scada/attack-scenario/stop', {
          method: 'POST', headers: { 'X-API-Key': 'smartgrid-dev-key' },
        })
      }
    } catch {}
  }, [])

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
            isConnected ? 'bg-emerald-50 border-emerald-300 text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-500',
          )}>
            {isConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
      </div>

      {connError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/25 border border-amber-500/25 text-amber-700 text-xs flex-shrink-0">
          <AlertTriangle size={11} /> {connError}
        </div>
      )}

      {error && (
        <div className="glass-card p-3 border-red-500/20 text-xs text-red-300 flex items-center justify-between">
          <span>Live mapping warning</span>
          <span className="font-mono">{error}</span>
        </div>
      )}

      <div className="glass-card p-3 border-cyan-500/20 text-xs text-slate-700 flex items-center justify-between">
        <span>
          Fresh snapshot only: <span className="font-mono text-cyan-300">{freshestUpdate || 'n/a'}</span>
        </span>
        <span className="text-slate-500">
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
              <ch.Icon size={10} className={isConnected ? (ch.ok ? 'text-emerald-600' : 'text-red-400') : 'text-slate-600'} />
            </div>
            <div className={cn('text-base font-bold font-mono leading-tight', isConnected ? (ch.ok ? 'text-slate-900' : 'text-red-300') : 'text-slate-600')}>
              {ch.value}
            </div>
            {ch.unit && <div className="text-[10px] text-slate-600">{ch.unit}</div>}
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        <div className="glass-card p-3 flex flex-col gap-2 flex-1 min-w-0 min-h-0">
          <div className="flex items-center justify-between flex-shrink-0">
            <span className="text-xs font-semibold text-slate-700">10 x 10 Agent Grid</span>
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
              <Activity size={12} className={isConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-500'} />
              <span className="text-xs font-semibold text-slate-700">System Status</span>
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
                  <span className={cn('font-mono font-semibold', row.ok ? 'text-emerald-600' : 'text-red-400')}>{row.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-3 flex-shrink-0">
            <div className="text-xs font-semibold text-slate-700 mb-2">Active SCADA Algorithm</div>
            <div className="space-y-1.5 text-[11px] text-slate-500">
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

          {/* Red Team Scenarios */}
          <div className="glass-card p-3 flex-shrink-0 border-red-500/20">
            <button
              onClick={() => setShowAttackPanel(!showAttackPanel)}
              className="flex items-center gap-2 w-full text-left"
            >
              <ShieldAlert size={12} className="text-red-400" />
              <span className="text-xs font-semibold text-slate-700">Red Team Scenarios</span>
              {scenarioStatus?.running && <span className="ml-1 text-[9px] text-red-400 font-mono animate-pulse">ACTIVE</span>}
              <span className="ml-auto text-[9px] text-slate-500">{showAttackPanel ? '▲' : '▼'}</span>
            </button>

            {showAttackPanel && (
              <div className="mt-3 space-y-2">
                {scenarioStatus?.running ? (
                  <div className="space-y-2">
                    <div className="rounded-lg px-3 py-2 bg-red-50 border border-red-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-red-700">{scenarioStatus.scenario_name}</span>
                        <span className="text-[9px] font-mono text-red-500">Phase {scenarioStatus.phase}/{scenarioStatus.total_phases}</span>
                      </div>
                      <div className="w-full bg-red-100 rounded-full h-1.5 mb-1.5">
                        <div
                          className="bg-red-500 h-1.5 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min(100, (scenarioStatus.elapsed_sec / Math.max(1, scenarioStatus.total_duration_sec)) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-red-600 font-mono">
                        <span>{scenarioStatus.phase_agents} agents under attack</span>
                        <span>{Math.round(scenarioStatus.elapsed_sec)}s / {scenarioStatus.total_duration_sec}s</span>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                        <span>Injections: <span className="font-mono text-red-600">{scenarioStatus.injections}</span></span>
                        <span>Detected: <span className="font-mono text-emerald-600">{scenarioStatus.detections}</span></span>
                      </div>
                    </div>

                    {(scenarioStatus.log ?? []).length > 0 && (
                      <div className="max-h-20 overflow-y-auto rounded border border-slate-200 bg-slate-50">
                        {(scenarioStatus.log as any[]).slice(-6).map((entry: any, i: number) => (
                          <div key={i} className="flex gap-2 px-2 py-0.5 text-[9px] font-mono border-b border-slate-100 last:border-0">
                            <span className="text-slate-400 w-8 shrink-0">{entry.time}s</span>
                            <span className={cn(
                              entry.event === 'detected' ? 'text-emerald-600' :
                              entry.event === 'phase_start' ? 'text-amber-600' :
                              entry.event === 'completed' ? 'text-blue-600' : 'text-slate-500'
                            )}>
                              {entry.event === 'phase_start' && `Phase ${entry.phase}: ${entry.agents} agents @ ${entry.severity}`}
                              {entry.event === 'detected' && `Audit caught ${entry.detected}/${entry.total} (sev ${entry.severity})`}
                              {entry.event === 'completed' && 'Scenario complete'}
                              {entry.event === 'stopped' && 'Stopped by operator'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={stopScenario}
                      className="w-full py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Square size={10} /> Stop Scenario
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {scenarios.map(sc => (
                      <div key={sc.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 hover:border-red-300 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-800">{sc.name}</span>
                              <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-red-100 text-red-600 border border-red-200">{sc.attack_type}</span>
                            </div>
                            <p className="text-[9px] text-slate-500 mt-0.5 leading-relaxed">{sc.description}</p>
                            <div className="flex gap-3 mt-1 text-[8px] text-slate-400 font-mono">
                              <span>{sc.phases} phases</span>
                              <span>{sc.duration_sec}s</span>
                              <span>up to {sc.max_agents} agents</span>
                            </div>
                          </div>
                          <button
                            onClick={() => startScenario(sc.id)}
                            disabled={!!scenarioLoading || !isConnected}
                            className={cn(
                              'shrink-0 px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all',
                              scenarioLoading === sc.id
                                ? 'bg-slate-200 text-slate-400 cursor-wait'
                                : 'bg-red-500 hover:bg-red-600 text-white shadow-sm'
                            )}
                          >
                            {scenarioLoading === sc.id ? (
                              <RotateCcw size={10} className="animate-spin" />
                            ) : (
                              <Play size={10} />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                    {scenarios.length === 0 && (
                      <div className="text-[10px] text-slate-400 text-center py-2">Loading scenarios...</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="glass-card p-3 flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
              <AlertTriangle size={12} className="text-amber-600" />
              <span className="text-xs font-semibold text-slate-700">Live Events</span>
              {isConnected && <span className="ml-auto text-[9px] text-emerald-600 font-mono animate-pulse">fresh</span>}
            </div>
            <div className="overflow-y-auto flex-1 space-y-1 pr-0.5">
              {liveEvents.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-6">
                  {isConnected ? 'Monitoring current snapshot' : 'Waiting for SCADA connection'}
                </p>
              ) : liveEvents.map(event => (
                <div key={event.id} className="rounded px-2 py-1.5 text-[10px] border space-y-0.5 bg-slate-50 border-slate-200">
                  <div className="flex justify-between">
                    <span className="font-bold font-mono text-slate-800">{event.type}</span>
                    <span className="text-slate-500 font-mono">{event.ts}</span>
                  </div>
                  <div className="text-slate-500">{event.msg}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
