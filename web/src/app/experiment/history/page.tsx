'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { History, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { formatPct } from '@/lib/utils'

type RunSummary = {
  run_id: string
  status: string
  n_agents: number
  detection_accuracy?: number
  risk_mitigation?: number
  cost_efficiency?: number
  fpr?: number
  recall?: number
  f1?: number
  started_at?: string
  completed_at?: string
}

export default function ExperimentHistoryPage() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selected, setSelected] = useState<RunSummary | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/proxy/runs?limit=20', { cache: 'no-store' }).catch(() => null)
    if (!res?.ok) return
    const data = await res.json().catch(() => null)
    if (Array.isArray(data)) setRuns(data)
    else if (data?.runs && Array.isArray(data.runs)) setRuns(data.runs)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const selectedRun = selected ?? runs[0] ?? null
  const completedRuns = runs.filter(r => r.status === 'completed' || r.status === 'done')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Experiment History</h1>
        <p className="text-sm text-slate-400 mt-1">Past experiment runs with metrics summary and status tracking</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Total Runs" value={runs.length} color="blue" icon={<History size={14} />} />
        <KPIStatCard label="Completed" value={completedRuns.length} color="green" icon={<CheckCircle size={14} />} />
        <KPIStatCard label="Best Accuracy" value={formatPct(Math.max(0, ...completedRuns.map(r => r.detection_accuracy ?? 0)), 2)} color="teal" icon={<Clock size={14} />} />
        <KPIStatCard label="Active" value={runs.filter(r => r.status === 'running').length} color="amber" icon={<AlertTriangle size={14} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 glass-card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50 text-sm font-semibold text-slate-200">Run History</div>
          <div className="divide-y divide-slate-800/60">
            {runs.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No experiment runs found. Launch a run to start.</div>
            ) : runs.map(run => (
              <button key={run.run_id} onClick={() => setSelected(run)} className={`w-full text-left p-4 hover:bg-slate-800/30 transition-colors ${selectedRun?.run_id === run.run_id ? 'bg-cyber-blue/5 border-l-2 border-l-cyber-blue' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-cyber-blue">{run.run_id}</span>
                  <Badge variant={run.status === 'completed' || run.status === 'done' ? 'low' : run.status === 'running' ? 'info' : 'high'}>
                    {run.status}
                  </Badge>
                </div>
                <div className="text-xs text-slate-400">N={run.n_agents} agents</div>
                {run.detection_accuracy != null && (
                  <div className="text-xs text-slate-500 mt-0.5">Accuracy: {formatPct(run.detection_accuracy, 2)}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 glass-card p-5 space-y-4">
          {!selectedRun ? (
            <div className="text-sm text-slate-400">Select a run to see details.</div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-cyber-blue text-lg font-bold">{selectedRun.run_id}</span>
                    <Badge variant={selectedRun.status === 'completed' || selectedRun.status === 'done' ? 'low' : 'info'}>
                      {selectedRun.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-400">Agents: <span className="text-slate-200 font-medium">{selectedRun.n_agents}</span></div>
                </div>
                {selectedRun.started_at && (
                  <div className="text-right text-xs text-slate-500">Started: {selectedRun.started_at}</div>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="glass-card p-3 border-cyber-teal/20">
                  <div className="text-xs text-slate-500 mb-1">Detection Accuracy</div>
                  <div className="text-xl font-bold font-mono text-cyber-teal">{formatPct(selectedRun.detection_accuracy ?? 0, 2)}</div>
                </div>
                <div className="glass-card p-3 border-cyber-green/20">
                  <div className="text-xs text-slate-500 mb-1">Risk Mitigation</div>
                  <div className="text-xl font-bold font-mono text-cyber-green">{formatPct(selectedRun.risk_mitigation ?? 0, 2)}</div>
                </div>
                <div className="glass-card p-3 border-cyber-blue/20">
                  <div className="text-xs text-slate-500 mb-1">Cost Efficiency</div>
                  <div className="text-xl font-bold font-mono text-cyber-blue">{formatPct(selectedRun.cost_efficiency ?? 0, 2)}</div>
                </div>
                <div className="glass-card p-3 border-cyber-amber/20">
                  <div className="text-xs text-slate-500 mb-1">FPR</div>
                  <div className="text-xl font-bold font-mono text-cyber-amber">{formatPct(selectedRun.fpr ?? 0, 2)}</div>
                </div>
                <div className="glass-card p-3 border-cyber-red/20">
                  <div className="text-xs text-slate-500 mb-1">Recall</div>
                  <div className="text-xl font-bold font-mono text-cyber-red">{formatPct(selectedRun.recall ?? 0, 2)}</div>
                </div>
                <div className="glass-card p-3 border-slate-600/20">
                  <div className="text-xs text-slate-500 mb-1">F1 Score</div>
                  <div className="text-xl font-bold font-mono text-slate-300">{formatPct(selectedRun.f1 ?? 0, 2)}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
