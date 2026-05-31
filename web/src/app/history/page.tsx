'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { ViewModeBanner } from '@/components/ui/ViewModeBanner'
import { useDashboard } from '@/lib/dashboardContext'
import { normalizeLatestRun, type LatestRunSnapshot } from '@/lib/latestRun'
import { formatPct } from '@/lib/utils'
import { BarChart2, TrendingUp, Database, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const GRID_COLOR = '#e5e7eb'
const LABEL_STYLE = { fill: '#94a3b8', fontSize: 11 }
const TIP_STYLE = { backgroundColor: '#0a1628', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }

export default function HistoryPage() {
  const { viewMode, scadaConnected, refreshTick } = useDashboard()
  const [runs, setRuns] = useState<LatestRunSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const scadaBlocked = viewMode === 'scada' && !scadaConnected

  useEffect(() => {
    let active = true

    const loadRuns = async () => {
      try {
        const response = await fetch('/api/proxy/runs?limit=12', { cache: 'no-store' })
        const payload = await response.json().catch(() => ({}))
        const rawRuns = Array.isArray(payload?.runs) ? payload.runs : []
        const normalized = rawRuns
          .map((run: unknown) => normalizeLatestRun({ run }))
          .filter((run: LatestRunSnapshot | null): run is LatestRunSnapshot => Boolean(run))

        if (active) {
          setRuns(normalized)
        }
      } catch {
        if (active) {
          setRuns([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadRuns()
    const intervalId = setInterval(() => {
      void loadRuns()
    }, 10000)

    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [refreshTick])

  const bestCost = useMemo(() => runs.length > 0 ? Math.max(...runs.map(run => run.costEfficiency)) : 0, [runs])
  const bestRiskMitigation = useMemo(() => runs.length > 0 ? Math.max(...runs.map(run => run.riskMitigation)) : 0, [runs])
  const avgRuntimeSeconds = useMemo(() => {
    const nonZero = runs.map(run => run.runtimeSeconds).filter(value => value > 0)
    if (nonZero.length === 0) return 0
    return nonZero.reduce((sum, value) => sum + value, 0) / nonZero.length
  }, [runs])

  const chartData = useMemo(() => runs.slice(0, 8).reverse().map(run => ({
    id: String(run.runId ?? 'LIVE').replace('RUN-', '').replace('SUMMARY-', ''),
    costEff: +(run.costEfficiency * 100).toFixed(1),
    riskMit: +(run.riskMitigation * 100).toFixed(1),
    accuracy: +(run.detectionAccuracy * 100).toFixed(1),
  })), [runs])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Experiment History</h1>
        <p className="text-sm text-slate-500 mt-1">Recent experiment runs, backend-reported metrics, and comparison trends</p>
      </div>

      <ViewModeBanner section="Experiment History" />

      {scadaBlocked && (
        <div className="glass-card p-5 border border-amber-500/30 text-amber-200 text-sm">
          Rapid SCADA view is selected, but SCADA is disconnected. Connect SCADA Live to enable this mode.
        </div>
      )}

      {!scadaBlocked && (
      <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Total Runs" value={runs.length} color="blue" icon={<Database size={14} />} />
        <KPIStatCard label="Best Cost Eff." value={formatPct(bestCost)} color="green" icon={<TrendingUp size={14} />} />
        <KPIStatCard label="Best Risk Mit." value={formatPct(bestRiskMitigation)} color="teal" icon={<BarChart2 size={14} />} />
        <KPIStatCard label="Avg Runtime" value={avgRuntimeSeconds > 0 ? `${avgRuntimeSeconds.toFixed(1)}s` : '-'} color="amber" icon={<Clock size={14} />} />
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Run Comparison</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="id" tick={LABEL_STYLE} tickLine={false} />
              <YAxis tick={LABEL_STYLE} tickLine={false} axisLine={false} domain={[0, 110]} unit="%" />
              <Tooltip contentStyle={TIP_STYLE} formatter={(v: number) => [`${v}%`]} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              <Bar dataKey="costEff" name="Cost Efficiency" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar dataKey="riskMit" name="Risk Mitigation" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar dataKey="accuracy" name="Detection Accuracy" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              {['Run ID', 'Status', 'Agents', 'Detected', 'Resolved', 'Audits', 'Cost Eff.', 'Risk Mit.', 'Accuracy', 'Runtime', 'Iterations'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map(run => (
              <tr key={`${run.runId ?? 'live'}-${run.status}-${run.totalAgents}`} className="data-table-row border-b border-slate-200/40">
                <td className="px-4 py-2.5 font-mono text-cyber-blue">{run.runId ?? 'n/a'}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={run.status === 'completed' ? 'healthy' : run.status === 'running' ? 'auditing' : 'low'} pulse={run.status === 'running'}>
                    {run.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-slate-700 font-mono">{run.totalAgents}</td>
                <td className="px-4 py-2.5 text-slate-500">{run.attacksDetected}</td>
                <td className="px-4 py-2.5 text-slate-500">{run.attacksResolved}</td>
                <td className="px-4 py-2.5 text-slate-500">{run.auditsTriggered}</td>
                <td className="px-4 py-2.5 text-slate-700">{formatPct(run.costEfficiency)}</td>
                <td className="px-4 py-2.5 text-slate-700">{formatPct(run.riskMitigation)}</td>
                <td className="px-4 py-2.5 text-slate-700">{formatPct(run.detectionAccuracy)}</td>
                <td className="px-4 py-2.5 text-slate-500">{run.runtimeSeconds > 0 ? `${run.runtimeSeconds.toFixed(1)}s` : '-'}</td>
                <td className="px-4 py-2.5 text-slate-500">{run.convergenceIterations > 0 ? run.convergenceIterations : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && runs.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">No experiment runs are available from the backend yet.</div>
        )}
      </div>
      </>
      )}
    </div>
  )
}
