'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Wifi, WifiOff, Activity, AlertTriangle, Zap, Radio,
  RefreshCw, MonitorStop, Play, Gauge, ArrowUpDown, ShieldAlert,
  CheckCircle2, Cpu, ExternalLink,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type AgentType  = 'Generator' | 'Substation' | 'PMU' | 'Breaker'
type AgentState = 'Healthy' | 'Anomalous' | 'Attacked' | 'Under Audit' | 'Suspect' | 'Offline'

interface Agent {
  id:           string
  shortId:      string
  type:         AgentType
  state:        AgentState
  anomalyScore: number
  riskScore:    number
  row:          number
  col:          number
}

interface AnomalyEvent {
  id:        number
  time:      string
  agentId:   string
  agentType: string
  score:     number
  state:     AgentState
  decision:  string
}

interface GridSnapshot {
  agents: Agent[]
  events: AnomalyEvent[]
  tick:   number
}

interface Channels {
  voltage:         number
  frequency:       number
  current:         number
  breakerStatus:   number
  substationLoad:  number
  commLatency:     number
}

// ─── Agent grid initialiser ──────────────────────────────────────────────────

function buildGrid(): Agent[] {
  const out: Agent[] = []
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const idx    = row * 10 + col
      let type: AgentType
      let prefix: string
      if      (idx < 20) { type = 'Generator';  prefix = 'G' }
      else if (idx < 50) { type = 'Substation'; prefix = 'S' }
      else if (idx < 75) { type = 'PMU';        prefix = 'P' }
      else               { type = 'Breaker';    prefix = 'B' }
      const num = String(idx + 1).padStart(2, '0')
      out.push({
        id: `${type.slice(0, 3).toUpperCase()}-${num}`,
        shortId: `${prefix}${num}`,
        type,
        state: 'Healthy',
        anomalyScore: Math.random() * 0.25,
        riskScore:    Math.random() * 0.15,
        row,
        col,
      })
    }
  }
  return out
}

// ─── Simulation step  ────────────────────────────────────────────────────────

function simulateStep(snapshot: GridSnapshot): GridSnapshot {
  const now    = new Date().toTimeString().slice(0, 8)
  const newEvs: AnomalyEvent[] = []

  const agents = snapshot.agents.map(a => {
    let score = a.anomalyScore + (Math.random() - 0.495) * 0.07
    score     = Math.max(0, Math.min(2.5, score))

    let state = a.state
    if (Math.random() < 0.03) {
      const pool: AgentState[] = ['Healthy', 'Healthy', 'Healthy', 'Suspect', 'Anomalous', 'Under Audit']
      state = pool[Math.floor(Math.random() * pool.length)]
      if (state !== 'Healthy') score = Math.max(score, 0.75 + Math.random() * 0.9)
    } else if (Math.random() < 0.04 && state !== 'Healthy') {
      state = 'Healthy'
      score = Math.max(0, score - 0.4)
    }

    if (score > 1.6)      state = 'Attacked'
    else if (score > 1.0 && state === 'Healthy') state = 'Anomalous'

    if (state !== 'Healthy' && score > 0.75 && Math.random() < 0.12) {
      newEvs.push({
        id:        snapshot.tick * 100 + newEvs.length,
        time:      now,
        agentId:   a.id,
        agentType: a.type,
        score:     +score.toFixed(3),
        state,
        decision:  score > 1.0 ? 'INCREASE_AUDIT' : 'MONITOR',
      })
    }

    return { ...a, state, anomalyScore: +score.toFixed(3), riskScore: +(score * 0.7 + Math.random() * 0.08).toFixed(3) }
  })

  return {
    agents,
    events: [...newEvs, ...snapshot.events].slice(0, 30),
    tick:   snapshot.tick + 1,
  }
}

// ─── Style maps ──────────────────────────────────────────────────────────────

const STATE_BG: Record<AgentState, string> = {
  Healthy:      'bg-emerald-950/40 border-emerald-600/20',
  Suspect:      'bg-amber-950/50 border-amber-500/30',
  Anomalous:    'bg-orange-950/50 border-orange-500/35',
  'Under Audit':'bg-cyan-950/50 border-cyan-500/35',
  Attacked:     'bg-red-950/60 border-red-500/50',
  Offline:      'bg-slate-900/30 border-slate-700/20',
}
const STATE_PULSE: Record<AgentState, string> = {
  Healthy: '', Suspect: 'animate-pulse', Anomalous: 'animate-pulse',
  'Under Audit': 'animate-pulse', Attacked: 'animate-pulse', Offline: '',
}
const TYPE_COLOR: Record<AgentType, string> = {
  Generator:  'text-yellow-400',
  Substation: 'text-violet-400',
  PMU:        'text-cyan-400',
  Breaker:    'text-orange-400',
}
const EVENT_BG: Record<AgentState, string> = {
  Attacked:     'bg-red-950/40 border-red-500/25',
  Anomalous:    'bg-orange-950/30 border-orange-500/25',
  Suspect:      'bg-amber-950/30 border-amber-500/20',
  'Under Audit':'bg-cyan-950/25 border-cyan-500/20',
  Healthy:      'bg-slate-900/20 border-slate-700/20',
  Offline:      'bg-slate-900/20 border-slate-700/20',
}
const EVENT_STATE_COLOR: Record<AgentState, string> = {
  Attacked: 'text-red-400', Anomalous: 'text-orange-400', Suspect: 'text-amber-400',
  'Under Audit': 'text-cyan-400', Healthy: 'text-emerald-400', Offline: 'text-slate-400',
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ScadaLivePage() {
  const [grid, setGrid] = useState<GridSnapshot>({ agents: buildGrid(), events: [], tick: 0 })
  const [channels, setChannels] = useState<Channels>({
    voltage: 230.2, frequency: 50.010, current: 82.4,
    breakerStatus: 1, substationLoad: 312, commLatency: 8.2,
  })
  const [isConnected,  setIsConnected]  = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connError,    setConnError]    = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const tick = useCallback(() => {
    setGrid(prev => simulateStep(prev))
    setChannels({
      voltage:        +(229.5 + Math.random() * 2).toFixed(2),
      frequency:      +(49.94 + Math.random() * 0.12).toFixed(3),
      current:        +(79  + Math.random() * 7).toFixed(1),
      breakerStatus:  Math.random() > 0.02 ? 1 : 0,
      substationLoad: +(295 + Math.random() * 40),
      commLatency:    +(4 + Math.random() * 10).toFixed(1),
    })
  }, [])

  const startPolling = useCallback(() => {
    tick()
    intervalRef.current = setInterval(tick, 2000)
  }, [tick])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const connect = useCallback(async () => {
    setIsConnecting(true)
    setConnError(null)
    try {
      const r = await fetch('/api/proxy/health', { signal: AbortSignal.timeout(3500), cache: 'no-store' })
      if (!r.ok) throw new Error('non-ok')
      setConnError(null)
    } catch {
      setConnError('FastAPI offline — running in local demo mode')
    }
    setIsConnected(true)
    startPolling()
    setIsConnecting(false)
  }, [startPolling])

  const disconnect = useCallback(() => {
    setIsConnected(false)
    setConnError(null)
    stopPolling()
  }, [stopPolling])

  // Auto-connect on mount
  useEffect(() => {
    connect()
    return () => stopPolling()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─ Derived counts ──────────────────────────────────────────────────────────
  const agents   = grid.agents
  const healthy  = agents.filter(a => a.state === 'Healthy').length
  const flagged  = agents.filter(a => ['Anomalous','Suspect','Under Audit'].includes(a.state)).length
  const attacked = agents.filter(a => a.state === 'Attacked').length

  const chOk = {
    voltage:   channels.voltage >= 220 && channels.voltage <= 240,
    frequency: channels.frequency >= 49.5 && channels.frequency <= 50.5,
    current:   channels.current <= 120,
    breaker:   channels.breakerStatus === 1,
    load:      channels.substationLoad <= 500,
    latency:   channels.commLatency <= 150,
  }

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white tracking-widest uppercase flex items-center gap-2">
            <Cpu size={18} className="text-cyan-400" />
            Grid With The Agents
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            Rapid SCADA → SmartGrid AI live feed
            {grid.tick > 0 && <span className="ml-2 text-slate-600">· tick #{grid.tick}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection badge */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border',
            isConnected
              ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400'
              : 'bg-slate-800/40 border-slate-600/20 text-slate-500'
          )}>
            {isConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </div>

          {isConnected ? (
            <button onClick={disconnect}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-red-900/30 border border-red-500/40 text-red-400 hover:bg-red-900/50 transition-all">
              <MonitorStop size={12} /> Stop Feed
            </button>
          ) : (
            <button onClick={connect} disabled={isConnecting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-900/30 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/50 transition-all disabled:opacity-50">
              {isConnecting
                ? <><RefreshCw size={12} className="animate-spin" /> Connecting…</>
                : <><Play size={12} /> Connect</>}
            </button>
          )}
        </div>
      </div>

      {/* ── Warning banner ─────────────────────────────────────── */}
      {connError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/25 border border-amber-500/25 text-amber-300 text-xs flex-shrink-0">
          <AlertTriangle size={11} /> {connError}
        </div>
      )}

      {/* ── Channel metrics strip ──────────────────────────────── */}
      <div className="grid grid-cols-6 gap-2 flex-shrink-0">
        {[
          { label: 'Voltage',   value: isConnected ? `${channels.voltage.toFixed(1)}` : '—',  unit: 'V',    Icon: Zap,         ok: chOk.voltage  },
          { label: 'Frequency', value: isConnected ? `${channels.frequency.toFixed(3)}` : '—', unit: 'Hz',   Icon: Activity,    ok: chOk.frequency},
          { label: 'Current',   value: isConnected ? `${channels.current.toFixed(1)}` : '—',  unit: 'A',    Icon: ArrowUpDown, ok: chOk.current  },
          { label: 'Breaker',   value: isConnected ? (channels.breakerStatus ? 'CLOSED' : 'OPEN') : '—', unit: '', Icon: ShieldAlert, ok: chOk.breaker },
          { label: 'Sub. Load', value: isConnected ? `${channels.substationLoad.toFixed(0)}` : '—', unit: 'kW', Icon: Gauge, ok: chOk.load },
          { label: 'Latency',   value: isConnected ? `${channels.commLatency.toFixed(1)}` : '—', unit: 'ms',  Icon: Radio,       ok: chOk.latency  },
        ].map(ch => (
          <div key={ch.label} className={cn('glass-card p-3 space-y-1', !isConnected && 'opacity-40')}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{ch.label}</span>
              <ch.Icon size={10} className={isConnected ? (ch.ok ? 'text-emerald-400' : 'text-red-400') : 'text-slate-600'} />
            </div>
            <div className={cn('text-base font-bold font-mono leading-tight',
              isConnected ? (ch.ok ? 'text-slate-100' : 'text-red-300') : 'text-slate-600')}>
              {ch.value}
            </div>
            {ch.unit && <div className="text-[10px] text-slate-600">{ch.unit}</div>}
          </div>
        ))}
      </div>

      {/* ── Main grid + events panel ───────────────────────────── */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* Agent Grid */}
        <div className="glass-card p-3 flex flex-col gap-2 flex-1 min-w-0 min-h-0">
          {/* Grid header */}
          <div className="flex items-center justify-between flex-shrink-0">
            <span className="text-xs font-semibold text-slate-300">10 × 10 Agent Grid</span>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1"/>Healthy: {healthy}</span>
              <span><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block mr-1"/>Flagged: {flagged}</span>
              <span><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block mr-1"/>Attacked: {attacked}</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-[10px] text-slate-500 flex-wrap flex-shrink-0">
            <span><span className="text-yellow-400 font-bold">G</span>01–20 Generator</span>
            <span><span className="text-violet-400 font-bold">S</span>21–50 Substation</span>
            <span><span className="text-cyan-400 font-bold">P</span>51–75 PMU</span>
            <span><span className="text-orange-400 font-bold">B</span>76–100 Breaker</span>
          </div>

          {/* 10×10 cells */}
          <div className="grid grid-cols-10 gap-0.5 flex-1">
            {agents.map(a => (
              <div
                key={a.id}
                title={`${a.id} | Score: ${a.anomalyScore} | ${a.state}`}
                className={cn(
                  'rounded border flex flex-col items-center justify-center cursor-default transition-colors duration-700',
                  STATE_BG[a.state],
                  STATE_PULSE[a.state],
                  !isConnected && 'opacity-25',
                )}>
                <span className={cn('text-[10px] font-bold font-mono leading-tight', TYPE_COLOR[a.type])}>
                  {a.shortId}
                </span>
                <span className="text-[8px] text-slate-500 font-mono leading-tight">
                  {a.anomalyScore.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3 min-h-0">

          {/* System status card */}
          <div className="glass-card p-3 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={12} className={isConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'} />
              <span className="text-xs font-semibold text-slate-300">System Status</span>
            </div>
            <div className="space-y-1.5 text-xs">
              {[
                { k: 'Connection',   v: isConnected ? 'LIVE' : 'DISCONNECTED', ok: isConnected },
                { k: 'Healthy',      v: `${healthy} / 100`,    ok: healthy >= 90 },
                { k: 'Anomalous',    v: String(agents.filter(a => a.state === 'Anomalous').length), ok: true },
                { k: 'Suspect',      v: String(agents.filter(a => a.state === 'Suspect').length),   ok: true },
                { k: 'Under Audit',  v: String(agents.filter(a => a.state === 'Under Audit').length), ok: true },
                { k: 'Attacked',     v: String(attacked),         ok: attacked === 0 },
                { k: 'RL Decision',  v: flagged + attacked > 6 ? 'INCREASE AUDIT' : 'MAINTAIN', ok: flagged + attacked <= 6 },
              ].map(row => (
                <div key={row.k} className="flex justify-between">
                  <span className="text-slate-500">{row.k}</span>
                  <span className={cn('font-mono font-semibold', row.ok ? 'text-emerald-400' : 'text-red-400')}>
                    {row.v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Live anomaly events */}
          <div className="glass-card p-3 flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
              <AlertTriangle size={12} className="text-amber-400" />
              <span className="text-xs font-semibold text-slate-300">Anomaly Events</span>
              {isConnected && (
                <span className="ml-auto text-[9px] text-emerald-400 font-mono animate-pulse">● live</span>
              )}
            </div>
            <div className="overflow-y-auto flex-1 space-y-1 pr-0.5">
              {grid.events.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-6">
                  {isConnected ? 'Monitoring… no anomalies yet' : 'Connect to start detection'}
                </p>
              ) : grid.events.map(ev => (
                <div key={ev.id} className={cn('rounded px-2 py-1.5 text-[10px] border space-y-0.5', EVENT_BG[ev.state])}>
                  <div className="flex justify-between">
                    <span className="font-bold font-mono text-slate-200">{ev.agentId}</span>
                    <span className="text-slate-500 font-mono">{ev.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={cn('font-semibold', EVENT_STATE_COLOR[ev.state])}>{ev.state}</span>
                    <span className="font-mono text-slate-400">S={ev.score}</span>
                  </div>
                  <div className="text-slate-500">{ev.decision}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
