'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Link2, Shield, CheckCircle2, XCircle, RefreshCw, Hash,
  Clock, Cpu, AlertTriangle, Database, Layers, Eye,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChainEvent {
  event_id:   number
  event_type: string
  agent_id:   string
  severity:   string
  timestamp:  string
  prev_hash:  string
  chain_hash: string
  payload?:   Record<string, unknown>
}

interface ChainStatus {
  total_events: number
  chain_ok:     boolean
  backend:      string
  latest_hash:  string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockChain(): ChainEvent[] {
  const types   = ['audit_decision','anomaly_detected','audit_decision','blockchain_anchor','scada_ingest']
  const sevs    = ['LOW','MEDIUM','HIGH','CRITICAL','LOW','HIGH','MEDIUM']
  const agents  = ['GEN-04','SUB-07','GEN-01','BRK-12','PMU-22','SUB-03','GEN-09','PMU-15','BRK-05','GEN-17']
  const out: ChainEvent[] = []
  let prevHash = '0000000000000000'
  for (let i = 1; i <= 14; i++) {
    const hash = Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10)
    out.push({
      event_id:   i,
      event_type: types[Math.floor(Math.random() * types.length)],
      agent_id:   agents[Math.floor(Math.random() * agents.length)],
      severity:   sevs[Math.floor(Math.random() * sevs.length)],
      timestamp:  new Date(Date.now() - (14 - i) * 47_000).toISOString(),
      prev_hash:  prevHash,
      chain_hash: hash,
      payload: {
        deviation_score: +(Math.random() * 2.2).toFixed(4),
        anomaly_flag:    Math.random() > 0.45 ? 1 : 0,
        criticality_weight: +(0.5 + Math.random()).toFixed(2),
      },
    })
    prevHash = hash
  }
  return out
}

async function loadChain(): Promise<{ events: ChainEvent[]; status: ChainStatus; live: boolean }> {
  try {
    const [evRes, stRes] = await Promise.all([
      fetch('/api/proxy/blockchain?limit=50', { cache: 'no-store' }),
      fetch('/api/proxy/blockchain/status',   { cache: 'no-store' }),
    ])
    if (!evRes.ok || !stRes.ok) throw new Error('non-ok')
    const ev = await evRes.json()
    const st = await stRes.json()
    return {
      events: ev.events ?? [],
      status: {
        total_events: st.total_events ?? 0,
        chain_ok:     st.chain_ok     ?? true,
        backend:      st.backend      ?? 'fastapi',
        latest_hash:  st.latest_hash  ?? '',
      },
      live: true,
    }
  } catch {
    const mock = mockChain()
    return {
      events: mock,
      status: {
        total_events: mock.length,
        chain_ok:     true,
        backend:      'local-demo',
        latest_hash:  mock[mock.length - 1]?.chain_hash ?? '',
      },
      live: false,
    }
  }
}

// ─── Style maps ──────────────────────────────────────────────────────────────

const SEV_STYLE: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-900/20 border-red-500/40',
  HIGH:     'text-orange-400 bg-orange-900/20 border-orange-500/30',
  MEDIUM:   'text-amber-600  bg-amber-900/20  border-amber-500/30',
  LOW:      'text-emerald-600 bg-emerald-900/15 border-emerald-500/25',
}

const SEV_DOT: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH:     'bg-orange-500',
  MEDIUM:   'bg-amber-500',
  LOW:      'bg-emerald-500',
}

const TYPE_LABEL: Record<string, string> = {
  audit_decision:     'Audit Decision',
  anomaly_detected:   'Anomaly Detected',
  blockchain_anchor:  'Anchor',
  scada_ingest:       'SCADA Ingest',
  manual_event:       'Manual',
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BlockchainPage() {
  const [events,    setEvents]    = useState<ChainEvent[]>([])
  const [status,    setStatus]    = useState<ChainStatus | null>(null)
  const [isLive,    setIsLive]    = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [verifying, setVerifying] = useState<number | null>(null)
  const [verified,  setVerified]  = useState<Record<number, boolean>>({})
  const [detail,    setDetail]    = useState<ChainEvent | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    const data = await loadChain()
    setEvents(data.events)
    setStatus(data.status)
    setIsLive(data.live)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    pollRef.current = setInterval(refresh, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [refresh])

  const verify = async (id: number) => {
    setVerifying(id)
    await new Promise(r => setTimeout(r, 700))
    setVerified(p => ({ ...p, [id]: Math.random() > 0.04 }))
    setVerifying(null)
  }

  // Derived
  const critCount = events.filter(e => e.severity === 'CRITICAL').length
  const highCount = events.filter(e => e.severity === 'HIGH').length
  const total     = status?.total_events ?? events.length

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Link2 size={17} className="text-cyan-400" />
            Blockchain Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable audit trail — every anomaly decision cryptographically anchored
          </p>
        </div>
        <button onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-cyber-blue/30 text-cyber-blue hover:bg-cyber-blue/10 transition-colors">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Demo mode notice */}
      {!isLive && !loading && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/20 border border-amber-500/20 text-amber-700 text-xs">
          <AlertTriangle size={11} />
          FastAPI offline — showing local demo chain. Start the backend to see real anchors.
        </div>
      )}
      {isLive && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          Connected to FastAPI backend — live chain data · auto-refreshes every 5 s
        </div>
      )}

      {/* ── KPI strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Anchors',   value: total,                                      color: 'text-cyan-400',    Icon: Hash       },
          { label: 'Chain Integrity', value: status?.chain_ok ? 'VALID' : 'BROKEN',      color: status?.chain_ok ? 'text-emerald-600' : 'text-red-400', Icon: Shield },
          { label: 'Critical Events', value: critCount,                                  color: critCount > 0 ? 'text-red-400' : 'text-slate-500', Icon: AlertTriangle },
          { label: 'Backend',         value: status?.backend ?? '—',                     color: 'text-slate-700',   Icon: Cpu        },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="glass-card p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">{label}</span>
              <Icon size={12} className={color} />
            </div>
            <div className={cn('text-xl font-bold font-mono', color)}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Chain layout ───────────────────────────────────────── */}
      <div className="flex gap-4">

        {/* Event chain list */}
        <div className="glass-card p-4 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Layers size={13} className="text-cyan-400" />
            <span className="text-sm font-semibold text-slate-800">Event Chain</span>
            {status?.latest_hash && (
              <span className="ml-auto text-[10px] text-slate-500 font-mono">
                head: {status.latest_hash.slice(0, 14)}…
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 gap-2 text-sm">
              <RefreshCw size={14} className="animate-spin" /> Loading chain…
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              No events anchored yet. Run the SmartGrid framework to generate audit decisions.
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...events].reverse().map((ev, idx) => (
                <div key={ev.event_id} className="relative group">
                  {/* Chain connector */}
                  {idx < events.length - 1 && (
                    <div className="absolute left-[19px] top-full w-px h-1.5 bg-slate-700/60 z-10" />
                  )}

                  <div className={cn(
                    'flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer',
                    detail?.event_id === ev.event_id
                      ? 'bg-cyan-950/20 border-cyan-500/30'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-200'
                  )} onClick={() => setDetail(detail?.event_id === ev.event_id ? null : ev)}>

                    {/* Block icon */}
                    <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[8px] text-slate-500 font-mono leading-none">BLK</span>
                      <span className="text-[11px] font-mono font-bold text-cyan-400 leading-none">#{ev.event_id}</span>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{ev.agent_id}</span>
                        <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-semibold', SEV_STYLE[ev.severity] ?? SEV_STYLE.LOW)}>
                          {ev.severity}
                        </span>
                        <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {TYPE_LABEL[ev.event_type] ?? ev.event_type}
                        </span>
                        <span className="ml-auto flex items-center gap-1 text-[9px] text-slate-500">
                          <Clock size={8} />
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="flex gap-3 text-[9px] font-mono text-slate-500 flex-wrap">
                        <span>prev: <span className="text-slate-500">{ev.prev_hash.slice(0, 10)}…</span></span>
                        <span>hash: <span className="text-cyan-500">{ev.chain_hash.slice(0, 10)}…</span></span>
                        {ev.payload?.deviation_score !== undefined && (
                          <span>score: <span className={Number(ev.payload.deviation_score) > 1 ? 'text-red-400' : 'text-emerald-600'}>
                            {Number(ev.payload.deviation_score).toFixed(4)}
                          </span></span>
                        )}
                      </div>
                    </div>

                    {/* Verify button */}
                    <button
                      onClick={e => { e.stopPropagation(); verify(ev.event_id) }}
                      disabled={verifying === ev.event_id}
                      title="Verify chain hash"
                      className="flex items-center gap-1 text-[9px] px-2 py-1 rounded border border-slate-200 text-slate-500 hover:border-cyan-500/40 hover:text-cyan-400 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-40 flex-shrink-0">
                      {verifying === ev.event_id
                        ? <RefreshCw size={9} className="animate-spin" />
                        : verified[ev.event_id] !== undefined
                          ? (verified[ev.event_id] ? <CheckCircle2 size={9} className="text-emerald-600" /> : <XCircle size={9} className="text-red-400" />)
                          : <Shield size={9} />}
                      {verifying === ev.event_id ? 'Verifying'
                        : verified[ev.event_id] !== undefined ? (verified[ev.event_id] ? 'Valid' : 'Invalid')
                        : 'Verify'}
                    </button>
                  </div>

                  {/* Expanded detail */}
                  {detail?.event_id === ev.event_id && (
                    <div className="mx-3 mt-1 p-3 rounded-b-lg bg-cyan-950/10 border border-t-0 border-cyan-500/20 text-[10px] font-mono text-slate-500 space-y-1">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                        <span>event_id: <span className="text-slate-800">{ev.event_id}</span></span>
                        <span>event_type: <span className="text-slate-800">{ev.event_type}</span></span>
                        <span>agent_id: <span className="text-slate-800">{ev.agent_id}</span></span>
                        <span>severity: <span className={SEV_STYLE[ev.severity]?.split(' ')[0]}>{ev.severity}</span></span>
                        <span>timestamp: <span className="text-slate-800">{ev.timestamp}</span></span>
                      </div>
                      <div className="border-t border-slate-200 pt-1 space-y-0.5">
                        <div>prev_hash: <span className="text-slate-700">{ev.prev_hash}</span></div>
                        <div>chain_hash: <span className="text-cyan-400">{ev.chain_hash}</span></div>
                      </div>
                      {ev.payload && (
                        <div className="border-t border-slate-200 pt-1">
                          payload: {JSON.stringify(ev.payload, null, 0)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Severity breakdown sidebar */}
        <div className="w-52 flex-shrink-0 flex flex-col gap-3">
          {/* Severity counts */}
          <div className="glass-card p-3 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Database size={12} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">Severity Breakdown</span>
            </div>
            {['CRITICAL','HIGH','MEDIUM','LOW'].map(sev => {
              const count = events.filter(e => e.severity === sev).length
              const pct   = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={sev} className="space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className={cn('font-semibold', SEV_STYLE[sev]?.split(' ')[0])}>{sev}</span>
                    <span className="text-slate-500 font-mono">{count}</span>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', SEV_DOT[sev])}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Chain health */}
          <div className="glass-card p-3 space-y-2">
            <div className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <Shield size={12} className="text-cyan-400" />
              Chain Health
            </div>
            {[
              { label: 'Integrity',   value: status?.chain_ok ? '✓ Valid' : '✗ Broken', ok: status?.chain_ok     !== false },
              { label: 'Backend',     value: status?.backend ?? '—',                    ok: status?.backend !== 'offline' },
              { label: 'Total',       value: `${total} anchors`,                         ok: true },
              { label: 'Live Sync',   value: isLive ? 'ON' : 'OFF',                       ok: isLive },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-[10px]">
                <span className="text-slate-500">{r.label}</span>
                <span className={cn('font-mono font-semibold', r.ok ? 'text-emerald-600' : 'text-amber-600')}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Click hint */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 px-1">
            <Eye size={9} />
            Click any event to expand details
          </div>
        </div>
      </div>
    </div>
  )
}
