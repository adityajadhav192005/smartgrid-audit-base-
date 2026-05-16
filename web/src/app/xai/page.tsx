'use client'

import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Badge } from '@/components/ui/Badge'
import { FeatureImportanceChart } from '@/components/charts'
import { Cpu, BarChart2, CheckCircle, Zap } from 'lucide-react'
import { ViewModeBanner } from '@/components/ui/ViewModeBanner'
import { useExperimentTelemetry } from '@/lib/experimentTelemetry'

function toFeatureRows(agent: any) {
  const rows = [
    ...((agent?.xai?.physical?.top_features ?? []) as Array<Record<string, unknown>>),
    ...((agent?.xai?.cyber?.top_features ?? []) as Array<Record<string, unknown>>),
  ]
  return rows
    .map(row => ({
      feature: String(row.feature ?? 'feature'),
      importance: Number(row.relative_contribution ?? 0),
      direction: Number(row.z ?? 0) >= 0 ? 'positive' : 'negative',
      value: Number(row.observed ?? 0),
      nominal: Number(row.baseline ?? 0),
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 8)
}

export default function XAIPage() {
  const { topAgents, health, summary } = useExperimentTelemetry(8000)

  const selectedAgent = topAgents[0]
  const topFeatures = toFeatureRows(selectedAgent)
  const topAgent = String(selectedAgent?.id ?? 'agent')
  const anomalyScore = Number(selectedAgent?.anomalyScore ?? health.anomaly ?? 0)
  const xaiConfidence = Math.max(0.5, Math.min(0.99, Number(summary?.detectionAccuracy ?? 0.9)))
  const xai = {
    agentId: topAgent,
    anomalyScore,
    topFeatures,
    narrative: `Latest-run explainability generated from experiment telemetry for ${topAgent}. High-impact deviations indicate which features drove the most recent experiment risk estimate.`,
    confidence: xaiConfidence,
    modelVersion: 'Experiment-latest-run',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Decision Explainability</h1>
        <p className="text-sm text-slate-500 mt-1">Feature attribution and decision rationale from the latest experiment run</p>
      </div>

      <ViewModeBanner section="Decision Explainability" mode="experiment" />

      <div className="glass-card p-3 border-cyber-blue/20 text-xs text-slate-700">
        Latest run verification: <span className="font-mono text-cyber-blue">{summary?.runId ?? 'n/a'}</span> · detection {Math.round(xaiConfidence * 100)}%
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Model Version" value="Experiment-v1" color="blue" icon={<Cpu size={14} />} />
        <KPIStatCard label="Explanations" value={topAgents.length} color="teal" icon={<BarChart2 size={14} />} />
        <KPIStatCard label="Top Agent" value={xai.agentId} color="red" icon={<Zap size={14} />} />
        <KPIStatCard label="XAI Confidence" value={`${(xai.confidence * 100).toFixed(0)}%`} color="green" icon={<CheckCircle size={14} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Feature Importance - {xai.agentId}</h3>
            <Badge variant="info">{xai.modelVersion}</Badge>
          </div>
          <div className="h-56"><FeatureImportanceChart data={xai.topFeatures} /></div>
        </div>

        <div className="glass-card p-4 flex flex-col gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">AI Narrative</div>
            <p className="text-sm text-slate-700 leading-relaxed">{xai.narrative}</p>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Anomaly Score</div>
            <div className="text-3xl font-bold font-mono text-cyber-red">{xai.anomalyScore.toFixed(3)}</div>
            <div className="text-xs text-slate-500 mt-0.5">Score exceeds latest-run threshold for anomaly and audit escalation.</div>
          </div>
        </div>
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Feature Attribution Detail</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-slate-200">
              {['Feature', 'Importance', 'Direction', 'Observed Value', 'Nominal'].map(h => (
                <th key={h} className="text-left py-2 pr-6 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {xai.topFeatures.map(feature => (
              <tr key={feature.feature} className="data-table-row border-b border-slate-200/40">
                <td className="py-2 pr-6 font-mono text-cyber-blue">{feature.feature}</td>
                <td className="py-2 pr-6">{(feature.importance * 100).toFixed(1)}%</td>
                <td className="py-2 pr-6"><Badge variant={feature.direction === 'positive' ? 'critical' : 'info'}>{feature.direction}</Badge></td>
                <td className="py-2 pr-6 font-mono text-slate-700">{feature.value.toFixed(3)}</td>
                <td className="py-2 pr-6 font-mono text-slate-500">{feature.nominal.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
