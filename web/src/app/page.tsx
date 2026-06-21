'use client'

import {
  AnomalyTrendChart,
  AttackBarChart,
} from '@/components/charts'
import { Badge } from '@/components/ui/Badge'
import { formatPct } from '@/lib/utils'
import { useExperimentTelemetry } from '@/lib/experimentTelemetry'

/**
 * Operations Overview — restrained, research-dashboard layout.
 *
 * Design principles:
 *   - Single neutral background, no radial glow / grid pattern.
 *   - One accent colour (steel blue). No neon. No gradient cards.
 *   - Numbers in tables, not decorative cards.
 *   - Text hierarchy carries weight; icons and badges used sparingly.
 */
export default function RootPage() {
  const { trend, events, topAgents, summary, statusCounts } = useExperimentTelemetry(8000)

  const totalAgents = Number(summary?.totalAgents ?? 0)
  const detectionAccuracy = Number(summary?.detectionAccuracy ?? 0)
  const riskMitigation = Number(summary?.riskMitigation ?? 0)
  const costEfficiency = Number(summary?.costEfficiency ?? 0)
  const auditCoverage = Number(summary?.auditCoverage ?? 0)
  const precision = Number(summary?.precision ?? 0)
  const recall = Number(summary?.recall ?? 0)
  const fpr = Number(summary?.fpr ?? 0)
  const f1 = Number(summary?.f1 ?? 0)
  const crossLayer = Number(summary?.crossLayerStability ?? 0)
  const attackRateReduction = Number(summary?.attackRateReduction ?? 0)
  const threshold = Number(summary?.scoreThreshold ?? 0.5)
  const activeIncidents = Math.max(0, topAgents.filter(agent => agent.anomalyScore >= threshold).length)
  const attacksDetected = Number(statusCounts.attacked ?? activeIncidents)
  const runId = summary?.runId ?? '—'
  const runStatus = String(summary?.status ?? 'unknown').toLowerCase()
  const optimizationProfile = String(summary?.optimizationProfile ?? 'ROBUST')
  const ablationMode = String(summary?.ablationMode ?? 'HYBRID')

  // Headline metrics: ours vs paper, plus delta.
  const headline = [
    { label: 'Detection Accuracy', ours: detectionAccuracy, paper: 0.984, fmt: (v: number) => formatPct(v, 2), better: 'higher' as const },
    { label: 'False Positive Rate', ours: fpr, paper: 0.032, fmt: (v: number) => formatPct(v, 2), better: 'lower' as const },
    { label: 'Risk Mitigation', ours: riskMitigation, paper: 0.879, fmt: (v: number) => formatPct(v, 2), better: 'higher' as const },
    { label: 'Cost Efficiency', ours: costEfficiency, paper: 0.425, fmt: (v: number) => formatPct(v, 2), better: 'higher' as const },
    { label: 'Audit Coverage', ours: auditCoverage, paper: 0.938, fmt: (v: number) => formatPct(v, 2), better: 'higher' as const },
  ]

  const verdict = (ours: number, paper: number, better: 'higher' | 'lower') => {
    if (paper === 0) return ''
    const wins = better === 'higher' ? ours > paper : ours < paper
    const delta = better === 'higher' ? ours - paper : paper - ours
    return wins ? `+${(delta * 100).toFixed(2)} pp` : `${(delta * 100).toFixed(2)} pp`
  }

  return (
    <div className="space-y-6">
      {/* ─── Page header ───────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Operations Overview</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            LSTM-based anomaly detection with RL-optimised audit scheduling across {totalAgents || '—'} agents.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Run</span>
          <span className="font-mono text-slate-700">{runId}</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-700">{ablationMode}</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-700">{optimizationProfile}</span>
          <span className="text-slate-500">·</span>
          <Badge variant={runStatus === 'completed' ? 'healthy' : 'info'}>{runStatus}</Badge>
        </div>
      </header>

      {/* ─── Headline comparison vs base paper ─────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-900">Headline Metrics — Ours vs. Base Paper (24h cycle, N={totalAgents || '—'})</h2>
          <span className="text-[11px] text-slate-500">paper: ACM Trans. Cyber-Phys. Syst. 2025, Priyadarsini et al.</span>
        </div>
        <div className="border border-slate-200 rounded-md overflow-hidden">
          <table className="report-table">
            <thead className="bg-slate-50">
              <tr>
                <th className="pl-4">Metric</th>
                <th>Our system</th>
                <th>Base paper</th>
                <th>Delta</th>
                <th className="pr-4">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {headline.map(row => {
                const wins = row.better === 'higher' ? row.ours > row.paper : row.ours < row.paper
                return (
                  <tr key={row.label}>
                    <td className="pl-4 text-slate-700">{row.label}</td>
                    <td className="font-mono text-slate-900">{row.fmt(row.ours)}</td>
                    <td className="font-mono text-slate-500">{row.fmt(row.paper)}</td>
                    <td className={`font-mono ${wins ? 'text-emerald-600' : 'text-rose-400'}`}>{verdict(row.ours, row.paper, row.better)}</td>
                    <td className="pr-4">
                      {wins
                        ? <span className="text-emerald-600">improvement</span>
                        : <span className="text-rose-400">below paper</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Secondary metrics in a single line ────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-px bg-slate-100 border border-slate-200 rounded-md overflow-hidden">
        {[
          { label: 'Total agents', value: totalAgents.toString() },
          { label: 'False positives', value: Number(summary?.fp ?? 0).toString() },
          { label: 'Attacked agents', value: attacksDetected.toString() },
          { label: 'Precision / Recall', value: `${precision.toFixed(3)} / ${recall.toFixed(3)}` },
          { label: 'F1 score', value: f1.toFixed(3) },
          { label: 'Attack rate ↓', value: formatPct(attackRateReduction, 1) },
          { label: 'CLSI', value: formatPct(crossLayer, 2) },
          { label: 'Cost efficiency', value: formatPct(costEfficiency, 1) },
        ].map(item => (
          <div key={item.label} className="bg-white px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">{item.label}</div>
            <div className="font-mono text-sm text-slate-900 mt-0.5">{item.value}</div>
          </div>
        ))}
      </section>

      {/* ─── Budget & coverage summary ─────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-100 border border-slate-200 rounded-md overflow-hidden">
        <div className="bg-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Cross-Layer Stability Index</div>
          <div className="font-mono text-base text-slate-900 mt-1">{formatPct(crossLayer, 2)}</div>
          <div className="text-[10px] text-slate-500 mt-1">physical–cyber agreement across timesteps</div>
        </div>
        <div className="bg-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Risk Mitigation</div>
          <div className="font-mono text-base text-slate-900 mt-1">{formatPct(riskMitigation, 2)}</div>
          <div className="text-[10px] text-slate-500 mt-1">fraction of risk neutralised by audit actions</div>
        </div>
        <div className="bg-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Audit Coverage</div>
          <div className="font-mono text-base text-slate-900 mt-1">{formatPct(auditCoverage, 2)}</div>
          <div className="text-[10px] text-slate-500 mt-1">fraction of agents audited per cycle</div>
        </div>
      </section>

      {/* ─── Trend charts side by side ─────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-slate-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-slate-800 mb-3">Anomaly &amp; Risk Trend</h3>
          <div className="h-56"><AnomalyTrendChart data={trend} /></div>
        </div>
        <div className="border border-slate-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-slate-800 mb-3">Attack &amp; Audit Volume</h3>
          <div className="h-56"><AttackBarChart data={trend} /></div>
        </div>
      </section>

      {/* ─── Top agents + recent events ────────────────────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="border border-slate-200 rounded-md xl:col-span-3 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-medium text-slate-800">Top risky agents</h3>
            <span className="text-[11px] text-slate-500">{topAgents.length} of {totalAgents}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                {['Agent', 'Type', 'Anomaly', 'Risk', 'Attack', 'Audits'].map(h => (
                  <th key={h} className="text-left py-2 px-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topAgents.length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-500 py-6 text-xs">No agent telemetry available.</td></tr>
              )}
              {topAgents.map(agent => (
                <tr key={agent.id} className="border-t border-slate-200 hover:bg-slate-100 transition-colors">
                  <td className="py-2 px-4 font-mono text-slate-800">{agent.id}</td>
                  <td className="py-2 px-4 text-slate-500">{agent.type}</td>
                  <td className="py-2 px-4 font-mono text-slate-800">{agent.anomalyScore.toFixed(3)}</td>
                  <td className="py-2 px-4 font-mono text-slate-700">{agent.riskScore.toFixed(2)}</td>
                  <td className="py-2 px-4 text-slate-500">{agent.attack}</td>
                  <td className="py-2 px-4 text-slate-500">{agent.auditCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-slate-200 rounded-md xl:col-span-2 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-medium text-slate-800">Recent events</h3>
            <span className="text-[11px] text-slate-500">{events.length} items</span>
          </div>
          <div className="divide-y divide-slate-200 max-h-[22rem] overflow-auto">
            {events.length === 0 && (
              <div className="text-center text-slate-500 py-6 text-xs">No events yet.</div>
            )}
            {events.map(event => (
              <div key={event.id} className="px-4 py-2.5 hover:bg-slate-100 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-slate-700">{event.type}</span>
                  <span className="text-[11px] text-slate-500">{event.ts}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 leading-snug">{event.msg}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
