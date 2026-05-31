'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Badge } from '@/components/ui/Badge'
import { formatPct } from '@/lib/utils'
import { Play, Settings2, Clock } from 'lucide-react'
import { ViewModeBanner } from '@/components/ui/ViewModeBanner'
import { useDashboard } from '@/lib/dashboardContext'
import { SettingsConfigurationPanel } from '@/components/settings/SettingsConfigurationPanel'
import { normalizeLatestRun } from '@/lib/latestRun'

const RUNS_FORM_DRAFT_KEY = 'sg_runs_form_draft_v1'

const configPresets = [
  { id: 'paper',    label: 'Paper-Matched (N=100, 24h cycle)' },
  { id: 'default',  label: 'Default (N=100, 1h cycle)'        },
  { id: 'large',    label: 'Large Grid (N=500)'               },
  { id: 'fdi_only', label: 'FDI Only'                         },
  { id: 'chain',    label: 'Coordinated Chain'                },
]

export default function RunsPage() {
  const { viewMode, scadaConnected, searchQuery, refreshTick, addNotification } = useDashboard()
  const [n, setN] = useState('100')
  const [cycleHours, setCycleHours] = useState('24')
  const [attacks, setAttacks] = useState<string[]>(['FDI', 'DoS', 'Coordinated'])
  const [episodes, setEpisodes] = useState('200')
  const [preset, setPreset] = useState('paper')
  const [fdiRate, setFdiRate] = useState('10')
  const [dosRate, setDosRate] = useState('5')
  const [chainRate, setChainRate] = useState('20')
  const [lambdaAudit, setLambdaAudit] = useState('0.2')
  const [lambdaAttack, setLambdaAttack] = useState('5.0')
  const [optimizationProfile, setOptimizationProfile] = useState<'ROBUST' | 'BALANCED' | 'COST'>('ROBUST')
  const [ablationMode, setAblationMode] = useState<'HYBRID' | 'RL_ONLY' | 'GRADIENT_ONLY'>('HYBRID')
  const [hasLocalDraft, setHasLocalDraft] = useState(false)

  const [isLaunching, setIsLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [liveRun, setLiveRun] = useState<any | null>(null)
  const [liveRuns, setLiveRuns] = useState<any[]>([])
  const [logLines, setLogLines] = useState<string[]>([])
  const [lastNotifiedRun, setLastNotifiedRun] = useState<string | null>(null)
  const lastRunSignatureRef = useRef<string | null>(null)

  const scadaBlocked = viewMode === 'scada' && !scadaConnected

  const clampPercent = (value: string, fallback: number) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(0, Math.min(100, parsed))
  }

  const toggle = (a: string) => setAttacks(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])

  const statusLabel = useMemo(() => {
    if (!liveRun) return 'Idle'
    return String(liveRun.status ?? 'unknown').toUpperCase()
  }, [liveRun])

  const normalizedLiveRun = useMemo(() => {
    if (!liveRun) return null
    return normalizeLatestRun({ run: liveRun })
  }, [liveRun])

  const fmtNum = (value: unknown, digits = 3) => {
    const nVal = Number(value)
    if (!Number.isFinite(nVal)) return '-'
    return nVal.toFixed(digits)
  }

  const fmtRuntime = (value: unknown, digits = 2) => {
    const nVal = Number(value)
    if (!Number.isFinite(nVal) || nVal <= 0) return '-'
    return nVal.toFixed(digits)
  }

  const fmtPercentOrDash = (value: unknown, digits = 1) => {
    const nVal = Number(value)
    if (!Number.isFinite(nVal)) return '-'
    return formatPct(nVal, digits)
  }

  const normalizeStatus = (value: unknown) => String(value ?? 'unknown').toLowerCase()

  const applyPreset = useCallback((presetId: string) => {
    setPreset(presetId)
    if (presetId === 'paper') {
      // Paper-matched: Table 5 from base paper. 24h operational cycle, N=100,
      // ROBUST profile, HYBRID scheduler, FDI=10% / DoS=5% / chain=20%.
      // Reproduces our published 99.76% accuracy / 0.24% FPR / 54.77% cost eff.
      setN('100')
      setCycleHours('24')
      setAttacks(['FDI', 'DoS', 'Coordinated'])
      setFdiRate('10')
      setDosRate('5')
      setChainRate('20')
      setEpisodes('200')
      setLambdaAudit('0.2')
      setLambdaAttack('5.0')
      setOptimizationProfile('ROBUST')
      setAblationMode('HYBRID')
      return
    }
    if (presetId === 'default') {
      setN('100')
      setCycleHours('1')
      setAttacks(['FDI', 'DoS'])
      setFdiRate('10')
      setDosRate('5')
      setChainRate('20')
      setEpisodes('200')
      return
    }
    if (presetId === 'large') {
      setN('500')
      setAttacks(['FDI', 'DoS', 'Coordinated'])
      setFdiRate('10')
      setDosRate('5')
      setChainRate('20')
      setEpisodes('250')
      return
    }
    if (presetId === 'fdi_only') {
      setN('100')
      setAttacks(['FDI'])
      setFdiRate('12')
      setDosRate('0')
      setChainRate('0')
      setEpisodes('200')
      return
    }
    if (presetId === 'chain') {
      setN('200')
      setAttacks(['Coordinated', 'MITM'])
      setFdiRate('5')
      setDosRate('5')
      setChainRate('30')
      setEpisodes('220')
    }
  }, [])

  const refreshRuns = useCallback(async () => {
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
  }, [searchQuery, activeRunId])

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
      const safeEpisodes = Math.max(10, Math.min(2000, Number(episodes) || 200))
      const safeFdiRate = clampPercent(fdiRate, 10) / 100
      const safeDosRate = clampPercent(dosRate, 5) / 100
      const safeChainRate = clampPercent(chainRate, 20) / 100
      const safeLambdaAudit = Math.max(0, Number(lambdaAudit) || 0.2)
      const safeLambdaAttack = Math.max(0, Number(lambdaAttack) || 5.0)
      const selectedAttacks = attacks.length ? attacks : ['FDI', 'DoS']

      if (!selectedAttacks.length) {
        throw new Error('Select at least one attack scenario')
      }

      const response = await fetch('/api/proxy/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          num_agents: safeN,
          cycle_hours: safeHours,
          episodes: safeEpisodes,
          ablation_mode: ablationMode,
          optimization_profile: optimizationProfile,
          attack_profile: selectedAttacks.join(','),
          attack_rates: {
            fdi_rate: safeFdiRate,
            dos_rate: safeDosRate,
            chain_rate: safeChainRate,
          },
          fdi_rate: safeFdiRate,
          dos_rate: safeDosRate,
          chain_rate: safeChainRate,
          lambda_audit: safeLambdaAudit,
          lambda_attack: safeLambdaAttack,
          notes: `preset=${preset}; mode=${ablationMode}; profile=${optimizationProfile}; attacks=${selectedAttacks.join(',')}; episodes=${safeEpisodes}; fdi=${safeFdiRate}; dos=${safeDosRate}; chain=${safeChainRate}`,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.detail ?? payload?.error ?? 'Failed to launch run')
      }
      const runId = payload?.run_id as string
      setActiveRunId(runId)

      await fetch('/api/settings/runtime', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          num_agents: safeN,
          episodes: safeEpisodes,
          fdi_rate: safeFdiRate,
          dos_rate: safeDosRate,
          chain_rate: safeChainRate,
          lambda_audit: safeLambdaAudit,
          reward_missed_attack_penalty: safeLambdaAttack,
        }),
      }).catch(() => {
        console.warn('Failed to persist runtime settings after launch')
      })

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
  }, [refreshRuns, refreshTick])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(RUNS_FORM_DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as Record<string, unknown>

      if (typeof draft.n === 'string') setN(draft.n)
      if (typeof draft.cycleHours === 'string') setCycleHours(draft.cycleHours)
      if (Array.isArray(draft.attacks)) setAttacks(draft.attacks.filter(a => typeof a === 'string') as string[])
      if (typeof draft.episodes === 'string') setEpisodes(draft.episodes)
      if (typeof draft.preset === 'string') setPreset(draft.preset)
      if (typeof draft.fdiRate === 'string') setFdiRate(draft.fdiRate)
      if (typeof draft.dosRate === 'string') setDosRate(draft.dosRate)
      if (typeof draft.chainRate === 'string') setChainRate(draft.chainRate)
      if (typeof draft.lambdaAudit === 'string') setLambdaAudit(draft.lambdaAudit)
      if (typeof draft.lambdaAttack === 'string') setLambdaAttack(draft.lambdaAttack)
      setHasLocalDraft(true)
    } catch {
      console.warn('Failed to load run form draft from localStorage')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const nextDraft = {
      n,
      cycleHours,
      attacks,
      episodes,
      preset,
      fdiRate,
      dosRate,
      chainRate,
      lambdaAudit,
      lambdaAttack,
    }
    localStorage.setItem(RUNS_FORM_DRAFT_KEY, JSON.stringify(nextDraft))
  }, [n, cycleHours, attacks, episodes, preset, fdiRate, dosRate, chainRate, lambdaAudit, lambdaAttack])

  useEffect(() => {
    async function loadRuntimeDefaults() {
      if (hasLocalDraft) return
      try {
        const response = await fetch('/api/settings/runtime', { cache: 'no-store' })
        if (!response.ok) return
        const payload = await response.json()
        const values = payload?.values ?? payload?.runtime_values ?? {}
        const runtimeEnv = payload?.runtime_env ?? {}

        const nVal = Number(values.num_agents)
        if (Number.isFinite(nVal) && nVal > 0) setN(String(Math.max(1, Math.min(500, Math.floor(nVal)))) )

        const epVal = Number(values.episodes)
        if (Number.isFinite(epVal) && epVal > 0) setEpisodes(String(Math.max(10, Math.min(2000, Math.floor(epVal)))))

        const toPercent = (raw: unknown, fallback: number) => {
          const nRaw = Number(raw)
          if (!Number.isFinite(nRaw)) return fallback
          return Math.max(0, Math.min(100, nRaw <= 1 ? nRaw * 100 : nRaw))
        }

        setFdiRate(String(toPercent(values.fdi_rate ?? runtimeEnv.SMARTGRID_FDI_RATE, 10)))
        setDosRate(String(toPercent(values.dos_rate ?? runtimeEnv.SMARTGRID_DOS_RATE, 5)))
        setChainRate(String(toPercent(values.chain_rate ?? runtimeEnv.SMARTGRID_CHAIN_RATE, 20)))
        if (values.lambda_audit != null) setLambdaAudit(String(values.lambda_audit))
        if (values.reward_missed_attack_penalty != null) setLambdaAttack(String(values.reward_missed_attack_penalty))
      } catch {
        console.warn('Failed to load persisted runtime defaults for run configuration')
      }
    }

    void loadRuntimeDefaults()
  }, [hasLocalDraft])

  useEffect(() => {
    if (!activeRunId) return
    void refreshActiveRun(activeRunId)
    const interval = setInterval(() => {
      void refreshActiveRun(activeRunId)
      void refreshRuns()
    }, 5000)
    return () => clearInterval(interval)
  }, [activeRunId, refreshTick, refreshRuns])

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
        <h1 className="section-header">Experiment Control</h1>
        <p className="text-sm text-slate-500 mt-1">Configure, launch, and observe experiment execution</p>
      </div>

      <ViewModeBanner section="Experiment Control" />

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
            <Settings2 size={14} className="text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-800">Experiment Parameters</h3>
          </div>

          {/* Presets */}
          <div>
            <label className="text-xs text-slate-500 mb-2 block font-medium uppercase tracking-wider">Quick Presets</label>
            <div className="flex flex-wrap gap-2">
              {configPresets.map(p => (
                <button key={p.id} onClick={() => applyPreset(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${preset === p.id ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-300' : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}>
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
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
            {/* Training episodes */}
            <div>
              <label className="text-xs text-slate-500 block mb-1.5 font-medium">Training Episodes</label>
              <input type="number" value={episodes} onChange={e => setEpisodes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400" />
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
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400"
            />
          </div>

          {/* Attack types */}
          <div>
            <label className="text-xs text-slate-500 mb-2 block font-medium uppercase tracking-wider">Attack Scenarios</label>
            <div className="flex flex-wrap gap-2">
              {['FDI', 'DoS', 'Jamming', 'Coordinated', 'MITM', 'Replay'].map(a => (
                <button key={a} onClick={() => toggle(a)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${attacks.includes(a) ? 'bg-red-500/10 border-red-500/60 text-red-700 font-medium' : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1.5 font-medium">FDI (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={fdiRate}
                onChange={e => setFdiRate(String(clampPercent(e.target.value, 10)))}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1.5 font-medium">DoS (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={dosRate}
                onChange={e => setDosRate(String(clampPercent(e.target.value, 5)))}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1.5 font-medium">Chain (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={chainRate}
                onChange={e => setChainRate(String(clampPercent(e.target.value, 20)))}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400"
              />
            </div>
          </div>

          {/* Reward weights */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">λ_audit (cost penalty)</label>
              <input type="number" value={lambdaAudit} step="0.05" onChange={e => setLambdaAudit(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">λ_attack (security penalty)</label>
              <input type="number" value={lambdaAttack} step="0.5" onChange={e => setLambdaAttack(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400" />
            </div>
          </div>

          {/* Optimization profile selector */}
          <div>
            <label className="text-xs text-slate-500 mb-2 block font-medium uppercase tracking-wider">Optimization Profile</label>
            <div className="grid grid-cols-3 gap-2">
              {(['ROBUST', 'BALANCED', 'COST'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setOptimizationProfile(p)}
                  className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                    optimizationProfile === p
                      ? 'bg-cyber-blue/10 border-cyber-blue/60 text-cyber-blue'
                      : 'border-slate-200 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <div className="font-semibold">{p}</div>
                  <div className="text-[10px] mt-0.5 leading-tight">
                    {p === 'ROBUST' && 'security-first'}
                    {p === 'BALANCED' && 'mid trade-off'}
                    {p === 'COST' && 'cost-first'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Ablation mode selector */}
          <div>
            <label className="text-xs text-slate-500 mb-2 block font-medium uppercase tracking-wider">Scheduler Ablation</label>
            <div className="grid grid-cols-3 gap-2">
              {(['HYBRID', 'RL_ONLY', 'GRADIENT_ONLY'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAblationMode(m)}
                  className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                    ablationMode === m
                      ? 'bg-purple-500/10 border-purple-500/60 text-purple-800'
                      : 'border-slate-200 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <div className="font-semibold">{m.replace('_', ' ')}</div>
                  <div className="text-[10px] mt-0.5 leading-tight">
                    {m === 'HYBRID' && 'RL + Gradient'}
                    {m === 'RL_ONLY' && 'Q-learning only'}
                    {m === 'GRADIENT_ONLY' && 'gradient only'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-3 border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500">Live Run Status</span>
              <Badge variant={statusLabel === 'RUNNING' || statusLabel === 'QUEUED' ? 'auditing' : statusLabel === 'COMPLETED' ? 'healthy' : 'low'}>
                {statusLabel}
              </Badge>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <div>Run ID: <span className="text-slate-800 font-mono">{liveRun?.run_id ?? '-'}</span></div>
              <div>Started: <span className="text-slate-700">{liveRun?.started_at ?? '-'}</span></div>
              <div>Finished: <span className="text-slate-700">{liveRun?.finished_at ?? '-'}</span></div>
              {liveRun?.summary && (
                <div className="pt-1 text-slate-700">
                  Cost Eff: {formatPct(liveRun.summary.cost_efficiency ?? 0)} · Risk Mit: {formatPct(liveRun.summary.risk_mitigation ?? 0)} · F1: {(liveRun.summary.f1 ?? 0).toFixed(3)}
                </div>
              )}
              {liveRun?.error && <div className="text-cyber-red">Error: {liveRun.error}</div>}
            </div>
          </div>

          {liveRun?.summary && (
            <div className="glass-card p-3 border-slate-200">
              <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">Experiment Results Summary</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-700">
                  <tbody>
                    {/* Removed duplicate 'Number of Agents (N)' row as requested */}
                    <tr className="border-b border-slate-200">
                      <td className="py-1 text-slate-500">Attack Rate Reduction</td>
                      <td className="py-1 text-right">{formatPct(liveRun.summary.attack_rate_reduction ?? liveRun.summary.risk_mitigation ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 text-slate-500">Cost Efficiency</td>
                      <td className="py-1 text-right">{formatPct(liveRun.summary.cost_efficiency ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 text-slate-500">Risk Mitigation</td>
                      <td className="py-1 text-right">{formatPct(liveRun.summary.risk_mitigation ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 text-slate-500">Accuracy</td>
                      <td className="py-1 text-right">{formatPct(liveRun.summary.detection_accuracy ?? liveRun.summary.accuracy ?? 0)}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 text-slate-500">Precision / Recall / F1</td>
                      <td className="py-1 text-right">{fmtNum(liveRun.summary.precision)} / {fmtNum(liveRun.summary.recall)} / {fmtNum(liveRun.summary.f1)}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 text-slate-500">TPR / TNR / FPR / FNR</td>
                      <td className="py-1 text-right">{fmtNum(liveRun.summary.tpr)} / {fmtNum(liveRun.summary.tnr)} / {fmtNum(liveRun.summary.fpr)} / {fmtNum(liveRun.summary.fnr)}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 text-slate-500">Coverage / Cross-layer Stability</td>
                      <td className="py-1 text-right">{formatPct(normalizedLiveRun?.auditCoverage ?? liveRun.summary.audit_coverage ?? liveRun.summary.coverage_cycle_dynamic ?? 0)} / {fmtNum(normalizedLiveRun?.crossLayerStability ?? liveRun.summary.cross_layer_stability)}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 text-slate-500">Runtime (s) / Iterations</td>
                      <td className="py-1 text-right">{fmtRuntime(normalizedLiveRun?.runtimeSeconds ?? liveRun.summary.runtime_seconds ?? liveRun.summary.execution_seconds ?? liveRun.summary.total_runtime_sec, 2)} / {(normalizedLiveRun?.convergenceIterations ?? liveRun.summary.convergence_iterations ?? liveRun.summary.convergence_steps ?? liveRun.summary.iterations ?? 0) || '-'}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-500">Audits / Attacks (detected/resolved)</td>
                      <td className="py-1 text-right">{normalizedLiveRun?.auditsTriggered ?? liveRun.summary.audits_triggered ?? '-'} / {normalizedLiveRun?.attacksDetected ?? liveRun.summary.attacks_detected ?? '-'} / {normalizedLiveRun?.attacksResolved ?? liveRun.summary.attacks_resolved ?? '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {(normalizedLiveRun?.runtimeSeconds ?? 0) <= 0 && (
                <p className="mt-2 text-[10px] text-slate-500">Some metrics are schema-dependent and are shown as &apos;-&apos; when not emitted by this run.</p>
              )}
            </div>
          )}

          {/* Launch button */}
          <button
            onClick={launchRun}
            disabled={isLaunching}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-200 text-slate-900 font-bold text-sm hover:bg-slate-300 transition-colors disabled:opacity-70"
          >
            <Play size={14} /> {isLaunching ? 'Launching…' : 'Launch Experiment'}
          </button>
          {launchError && <p className="text-xs text-cyber-red">{launchError}</p>}

          {logLines.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-52 overflow-auto">
              <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">Live Run Log (tail)</p>
              <pre className="text-[10px] text-slate-700 whitespace-pre-wrap">{logLines.join('\n')}</pre>
            </div>
          )}
        </div>

        {/* Recent runs */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800">Recent Runs</h3>
          </div>
          <div className="space-y-2">
            {(liveRuns.length > 0 ? liveRuns.slice(0, 4) : []).map((r: any) => (
              <div key={r.run_id ?? r.id} className="glass-card p-2.5 border-slate-200 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-slate-700 text-[10px]">{r.run_id ?? r.id}</span>
                  <Badge variant={(normalizeStatus(r.status) === 'running' || normalizeStatus(r.status) === 'queued') ? 'auditing' : (normalizeStatus(r.status) === 'completed' ? 'healthy' : 'low')} pulse={normalizeStatus(r.status) === 'running'}>{r.status}</Badge>
                </div>
                <div className="text-slate-500">N={r.params?.num_agents ?? r.agents ?? '-'} — {r.params?.ablation_mode ?? r.attacks ?? '-'}</div>
                <div className="flex gap-3 mt-1 text-slate-500">
                  <span>Cost: {fmtPercentOrDash(r.summary?.cost_efficiency ?? r.costEfficiency)}</span>
                  <span>Risk: {fmtPercentOrDash(r.summary?.risk_mitigation ?? r.riskMitigation)}</span>
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
