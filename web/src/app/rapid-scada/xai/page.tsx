'use client'

import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Badge } from '@/components/ui/Badge'
import { FeatureImportanceChart } from '@/components/charts'
import { Cpu, BarChart2, CheckCircle, Zap } from 'lucide-react'
import { useLiveTelemetry } from '@/lib/liveTelemetry'

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

export default function RapidScadaXaiPage() {
  const { topAgents, health, gridStatus } = useLiveTelemetry(3000)
  const selectedAgent = topAgents[0]
  const topFeatures = toFeatureRows(selectedAgent)
  const topAgent = String(selectedAgent?.id ?? 'agent')
  const anomalyScore = Number(selectedAgent?.anomalyScore ?? health.anomaly ?? 0)
  const scoreThreshold = Number(gridStatus?.rapid_scada?.config?.score_threshold ?? 3)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Rapid SCADA Decision Explainability</h1>
        <p className="text-sm text-slate-500 mt-1">Feature attribution and decision rationale from the live SCADA scoring path</p>
      </div>

      <div className="glass-card p-3 border-cyber-blue/20 text-xs text-slate-700">
        Live algorithm verification: <span className="font-mono text-cyber-blue">{gridStatus?.live_verification?.run_id ?? 'SCADA-LIVE'}</span> · threshold {scoreThreshold.toFixed(2)}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Model Version" value="SCADA-live" color="blue" icon={<Cpu size={14} />} />
        <KPIStatCard label="Explained Agents" value={topAgents.length} color="teal" icon={<BarChart2 size={14} />} />
        <KPIStatCard label="Top Agent" value={topAgent} color="red" icon={<Zap size={14} />} />
        <KPIStatCard label="Threshold" value={scoreThreshold.toFixed(2)} color="green" icon={<CheckCircle size={14} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Feature Importance - {topAgent}</h3>
            <Badge variant="info">SCADA-live</Badge>
          </div>
          <div className="h-56"><FeatureImportanceChart data={topFeatures} /></div>
        </div>

        <div className="glass-card p-4 flex flex-col gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">AI Narrative</div>
            <p className="text-sm text-slate-700 leading-relaxed">Live SCADA explainability highlights the physical and cyber features that most influenced the latest deviation score for {topAgent}.</p>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Anomaly Score</div>
            <div className="text-3xl font-bold font-mono text-cyber-red">{anomalyScore.toFixed(3)}</div>
            <div className="text-xs text-slate-500 mt-0.5">Scores above the SCADA threshold trigger anomaly and audit escalation.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
