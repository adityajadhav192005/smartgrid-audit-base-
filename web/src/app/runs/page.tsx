'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Badge } from '@/components/ui/Badge'
import { formatPct } from '@/lib/utils'
import { Play, Settings2, Clock } from 'lucide-react'
import { ViewModeBanner } from '@/components/ui/ViewModeBanner'
import { useDashboard } from '@/lib/dashboardContext'
import { SettingsConfigurationPanel } from '@/components/settings/SettingsConfigurationPanel'

const configPresets = [
  { id: 'default',  label: 'Default (N=100, FDI+DoS)' },
  { id: 'large',    label: 'Large Grid (N=500)'        },
  { id: 'fdi_only', label: 'FDI Only'                  },
  { id: 'chain',    label: 'Coordinated Chain'         },
]

export default function RunsPage() {
  const { viewMode, scadaConnected, searchQuery, refreshTick, addNotification } = useDashboard()
  const [n, setN] = useState('100')
  const [cycleHours, setCycleHours] = useState('1')
  const [attacks, setAttacks] = useState<string[]>(['FDI', 'DoS'])
  const [episodes, setEpisodes] = useState('200')
  const [preset, setPreset] = useState('default')

  const [isLaunching, setIsLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [liveRun, setLiveRun] = useState<any | null>(null)
  const [liveRuns, setLiveRuns] = useState<any[]>([])
  const [logLines, setLogLines] = useState<string[]>([])
  const [lastNotifiedRun, setLastNotifiedRun] = useState<string | null>(null)
  const lastRunSignatureRef = useRef<string | null>(null)

  const scadaBlocked = viewMode === 'scada' && !scadaConnected

  const toggle = (a: string) => setAttacks(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])

  const statusLabel = useMemo(() => {
    if (!liveRun) return 'Idle'
    return String(liveRun.status ?? 'unknown').toUpperCase()
  }, [liveRun])

  async function refreshRuns() {
    const response = await fetch('/api/proxy/runs?limit=8', { cache: 'no-store' })
    const payload = await response.json()
    const runs = Array.isArray(payload?.runs) ? payload.runs : []
    const q = searchQuery.trim().toLowerCase()
    const filtered = q
      ? runs.filter((r: any) => `${r.run_id} ${r.status} ${r.params?.ablation_mode ?? ''}`.toLowerCase().includes(q))
      : runs
    setLiveRuns(filtered)
    if (runs[0] && !activeRunId) {
      setActiveRunId(runs[0].run_id)
    }
  }

  async function refreshActiveRun(runId: string) {
    const runRes = await fetch(`/api/proxy/runs/${encodeURIComponent(runId)}`, { cache: 'no-store' })
    const runPayload = await runRes.json()
    const nextRun = runPayload?.run ?? null
    setLiveRun(nextRun)

    if (typeof window !== 'undefined' && nextRun?.run_id) {
      const sig = `${nextRun.run_id}|${nextRun.status ?? 'unknown'}|${nextRun.finished_at ?? ''}|${nextRun.updated_at ?? ''}`
      if (lastRunSignatureRef.current !== sig) {
        lastRunSignatureRef.current = sig
        window.dispatchEvent(new Event('sg:run-updated'))
      }
    }

    const logsRes = await fetch(`/api/proxy/runs/${encodeURIComponent(runId)}/logs?tail=40`, { cache: 'no-store' })
    const logsPayload = await logsRes.json()
    setLogLines(Array.isArray(logsPayload?.lines) ? logsPayload.lines : [])
  }

  async function launchRun() {
    setIsLaunching(true)
    setLaunchError(null)
    try {
      const safeN = Math.max(1, Math.min(500, Number(n) || 100))
      const safeHours = Math.max(1, Math.min(24, Number(cycleHours) || 1))
      const response = await fetch('/api/proxy/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          num_agents: safeN,
          cycle_hours: safeHours,
          ablation_mode: 'HYBRID',
          attack_profile: attacks.length ? attacks.join(',') : 'mixed',
          notes: `preset=${preset}; attacks=${attacks.join(',')}; episodes=${episodes}`,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.detail ?? payload?.error ?? 'Failed to launch run')
      }
      const runId = payload?.run_id as string
      setActiveRunId(runId)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('sg:run-updated'))
      }
      await refreshRuns()
      await refreshActiveRun(runId)
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : 'Failed to launch run')
    } finally {
      setIsLaunching(false)
    }
  }

  useEffect(() => {
    void refreshRuns()
  }, [searchQuery, refreshTick])

  useEffect(() => {
    if (!activeRunId) return
    void refreshActiveRun(activeRunId)
    const interval = setInterval(() => {
      void refreshActiveRun(activeRunId)
      void refreshRuns()
    }, 5000)
    return () => clearInterval(interval)
  }, [activeRunId, refreshTick])

  useEffect(() => {
    if (!liveRun?.run_id || !liveRun?.status) return
    const status = String(liveRun.status).toLowerCase()
    if ((status === 'completed' || status === 'failed') && lastNotifiedRun !== liveRun.run_id) {
      addNotification({
        title: status === 'completed' ? 'Run completed' : 'Run failed',
        message: `${liveRun.run_id} ${status}${liveRun?.summary ? ` · Cost ${formatPct(liveRun.summary.cost_efficiency ?? 0)}` : ''}`,
        level: status === 'completed' ? 'success' : 'error',
      })
      setLastNotifiedRun(liveRun.run_id)
    }
  }, [liveRun, lastNotifiedRun, addNotification])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Run Configuration</h1>
        <p className="text-sm text-slate-400 mt-1">Configure and launch simulation experiments</p>
      </div>

      <ViewModeBanner section="Run Configuration" />

      {scadaBlocked && (
        <div className="glass-card p-5 border border-amber-500/30 text-amber-200 text-sm">
          Rapid SCADA view is selected, but SCADA is disconnected. Connect SCADA Live to enable this mode.
        </div>
      )}

      {!scadaBlocked && (
      <>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Config card */}
        <div className="glass-card p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Settings2 size={14} className="text-cyber-blue" />
            <h3 className="text-sm font-semibold text-slate-200">Experiment Parameters</h3>
          </div>

          {/* Presets */}
          <div>
            <label className="text-xs text-slate-500 mb-2 block font-medium uppercase tracking-wider">Quick Presets</label>
            <div className="flex flex-wrap gap-2">
              {configPresets.map(p => (
                <button key={p.id} onClick={() => setPreset(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${preset === p.id ? 'bg-cyber-teal/20 border-cyber-teal/50 text-cyber-teal' : 'border-slate-700/50 text-slate-500 hover:text-slate-300'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* N agents */}
            <div>
              <label className="text-xs text-slate-500 block mb-1.5 font-medium">Number of Agents (N) · 1 to 500</label>
              <input
                type="number"
                value={n}
                min={1}
                max={500}
                onChange={e => setN(String(Math.max(1, Math.min(500, Number(e.target.value) || 1))))}
                className="w-full bg-grid-900 border border-slate-700/60 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyber-blue/50"
              />
            </div>
            {/* Training episodes */}
            <div>
              <label className="text-xs text-slate-500 block mb-1.5 font-medium">Training Episodes</label>
              <input type="number" value={episodes} onChange={e => setEpisodes(e.target.value)}
                className="w-full bg-grid-900 border border-slate-700/60 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyber-blue/50" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1.5 font-medium">Cycle Hours</label>
            <input
              type="number"
              min={1}
              max={24}
              value={cycleHours}
              onChange={e => setCycleHours(String(Math.max(1, Math.min(24, Number(e.target.value) || 1))))}
              className="w-full bg-grid-900 border border-slate-700/60 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyber-blue/50"
            />
          </div>

          {/* Attack types */}
          <div>
            <label className="text-xs text-slate-500 mb-2 block font-medium uppercase tracking-wider">Attack Scenarios</label>
            <div className="flex flex-wrap gap-2">
              {['FDI', 'DoS', 'Jamming', 'Coordinated', 'MITM', 'Replay'].map(a => (
                <button key={a} onClick={() => toggle(a)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${attacks.includes(a) ? 'bg-cyber-red/20 border-cyber-red/50 text-cyber-red' : 'border-slate-700/50 text-slate-500 hover:text-slate-300'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Reward weights */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">λ_audit (cost penalty)</label>
              <input type="number" defaultValue="0.2" step="0.05"
                className="w-full bg-grid-900 border border-slate-700/60 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyber-blue/50" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">λ_attack (security penalty)</label>
              <input type="number" defaultValue="5.0" step="0.5"
                className="w-full bg-grid-900 border border-slate-700/60 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyber-blue/50" />
            </div>
          </div>

          <div className="glass-card p-3 border-slate-700/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Live Run Status</span>
              <Badge variant={statusLabel === 'RUNNING' || statusLabel === 'QUEUED' ? 'auditing' : statusLabel === 'COMPLETED' ? 'healthy' : 'low'}>
                {statusLabel}
              </Badge>
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <div>Run ID: <span className="text-cyber-blue font-mono">{liveRun?.run_id ?? '-'}</span></div>
              <div>Started: <span className="text-slate-300">{liveRun?.started_at ?? '-'}</span></div>
              <div>Finished: <span className="text-slate-300">{liveRun?.finished_at ?? '-'}</span></div>
              {liveRun?.summary && (
                <div className="pt-1 text-slate-300">
                  Cost Eff: {formatPct(liveRun.summary.cost_efficiency ?? 0)} · Risk Mit: {formatPct(liveRun.summary.risk_mitigation ?? 0)} · F1: {(liveRun.summary.f1 ?? 0).toFixed(3)}
                </div>
              )}
              {liveRun?.error && <div className="text-cyber-red">Error: {liveRun.error}</div>}
            </div>
          </div>

          {/* Launch button */}
          <button
            onClick={launchRun}
            disabled={isLaunching}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyber-blue text-grid-900 font-bold text-sm hover:bg-cyber-blue/90 transition-colors disabled:opacity-70"
          >
            <Play size={14} /> {isLaunching ? 'Launching…' : 'Launch Experiment'}
          </button>
          {launchError && <p className="text-xs text-cyber-red">{launchError}</p>}

          {logLines.length > 0 && (
            <div className="bg-grid-900 border border-slate-700/40 rounded-lg p-3 max-h-52 overflow-auto">
              <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">Live Run Log (tail)</p>
              <pre className="text-[10px] text-slate-300 whitespace-pre-wrap">{logLines.join('\n')}</pre>
            </div>
          )}
        </div>

        {/* Recent runs */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-200">Recent Runs</h3>
          </div>
          <div className="space-y-2">
            {(liveRuns.length > 0 ? liveRuns.slice(0, 4) : []).map((r: any) => (
              <div key={r.run_id ?? r.id} className="glass-card p-2.5 border-slate-700/30 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-cyber-blue text-[10px]">{r.run_id ?? r.id}</span>
                  <Badge variant={(r.status === 'running' || r.status === 'queued' || r.status === 'Running') ? 'auditing' : (r.status === 'completed' ? 'healthy' : 'low')} pulse={r.status === 'running' || r.status === 'Running'}>{r.status}</Badge>
                </div>
                <div className="text-slate-400">N={r.params?.num_agents ?? r.agents ?? '-'} — {r.params?.ablation_mode ?? r.attacks ?? '-'}</div>
                <div className="flex gap-3 mt-1 text-slate-500">
                  <span>Cost: {formatPct(r.summary?.cost_efficiency ?? r.costEfficiency ?? 0)}</span>
                  <span>Risk: {formatPct(r.summary?.risk_mitigation ?? r.riskMitigation ?? 0)}</span>
                </div>
              </div>
            ))}
            {liveRuns.length === 0 && (
              <div className="text-xs text-slate-500">No live runs found yet. Launch an experiment to begin.</div>
            )}
          </div>
        </div>
      </div>

      <SettingsConfigurationPanel />
      </>
      )}
    </div>
  )
}
