'use client'

import { useMemo, useState, useEffect } from 'react'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { AnomalyTrendChart, AgentRadarChart, SystemHealthAreaChart } from '@/components/charts'
import { Activity, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react'
import { formatPct } from '@/lib/utils'
import { useExperimentTelemetry } from '@/lib/experimentTelemetry'

export default function ExperimentRiskPage() {
  const { trend, topAgents, health, summary, agentSnapshots } = useExperimentTelemetry(8000)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const scoreThreshold = Number(summary?.scoreThreshold ?? 0.5)

  const activeAnomalies = topAgents.filter(a => a.anomalyScore >= scoreThreshold).length
  const avgAnomaly = topAgents.length > 0
    ? topAgents.reduce((acc, a) => acc + a.anomalyScore, 0) / topAgents.length
    : Number(health.anomaly ?? 0)
  const crossLayerStability = Number(health.crossLayerStability ?? 0)
  const baselineDrift = Math.max(0.001, 1 - Math.max(0, Math.min(1, crossLayerStability))) / 100

  useEffect(() => {
    if (!selectedAgentId && topAgents[0]?.id) setSelectedAgentId(topAgents[0].id)
  }, [selectedAgentId, topAgents])

  const selectedAgent = useMemo(
    () => agentSnapshots.find(a => a.id === selectedAgentId) ?? topAgents[0] ?? null,
    [agentSnapshots, selectedAgentId, topAgents],
  )

  const topPhysicalFeatures = Array.isArray(selectedAgent?.xai?.physical?.top_features) ? selectedAgent.xai.physical.top_features : []
  const topCyberFeatures = Array.isArray(selectedAgent?.xai?.cyber?.top_features) ? selectedAgent.xai.cyber.top_features : []
  const selectedRisk = Number(selectedAgent?.riskScore ?? 0)
  const selectedAnomaly = Number(selectedAgent?.anomalyScore ?? 0)
  const radarData = [
    { metric: 'Risk', score: Math.round(Math.min(100, selectedRisk * 100)) },
    { metric: 'Anomaly', score: Math.round(Math.min(100, selectedAnomaly * 20)) },
    { metric: 'Stability', score: Math.round(Math.min(100, crossLayerStability * 100)) },
    { metric: 'Attack Res.', score: Math.round(Math.min(100, Number(health.attackResistance ?? 0) * 100)) },
    { metric: 'Threshold', score: Math.round(Math.min(100, scoreThreshold * 20)) },
    { metric: 'Selected', score: Math.round(Math.max(0, 100 - Math.min(100, selectedRisk * 10 + selectedAnomaly * 5))) },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Experiment Risk Analytics</h1>
        <p className="text-sm text-slate-400 mt-1">Deviation trends, risk scores, and feature-level explanation from experiment telemetry</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Active Anomalies" value={activeAnomalies} color="red" icon={<AlertTriangle size={14} />} />
        <KPIStatCard label="Avg Anomaly Score" value={avgAnomaly.toFixed(3)} color="amber" icon={<Activity size={14} />} />
        <KPIStatCard label="Cross-Layer Stab." value={formatPct(crossLayerStability, 1)} color="blue" icon={<TrendingDown size={14} />} />
        <KPIStatCard label="Baseline Drift" value={baselineDrift.toFixed(4)} color="teal" icon={<TrendingUp size={14} />} sub="Q-delta" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Anomaly Score Trend</h3>
          <div className="h-48"><AnomalyTrendChart data={trend} /></div>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Audit and Attack Event Volume</h3>
          <div className="h-48"><SystemHealthAreaChart data={trend} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Risk Radar</h3>
          <div className="h-52"><AgentRadarChart data={radarData} /></div>
        </div>
        <div className="glass-card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Top Anomalous Agents</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/50">
                {['Agent', 'Type', 'Anomaly Score', 'Risk Score', 'Source', '# Audits'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topAgents.map(agent => (
                <tr key={agent.id} className="data-table-row border-b border-slate-800/40 cursor-pointer" onClick={() => setSelectedAgentId(agent.id)}>
                  <td className="py-1.5 pr-4 font-mono text-cyber-blue">{agent.id}</td>
                  <td className="py-1.5 pr-4 text-slate-400">{agent.type}</td>
                  <td className="py-1.5 pr-4 font-mono text-slate-300">{agent.anomalyScore.toFixed(3)}</td>
                  <td className="py-1.5 pr-4 font-mono text-slate-400">{agent.riskScore.toFixed(2)}</td>
                  <td className="py-1.5 pr-4 text-slate-500 uppercase">{agent.source ?? 'experiment'}</td>
                  <td className="py-1.5 text-slate-400">{agent.auditCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Selected Agent Feature Contribution</h3>
          {!selectedAgent ? (
            <p className="text-sm text-slate-500">Run an experiment to see feature attribution.</p>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-cyber-blue">{selectedAgent.id}</span>
                <span className="text-slate-400">source {selectedAgent.source ?? 'experiment'} · severity {selectedAgent.severity ?? 'LOW'}</span>
              </div>
              <div>
                <div className="text-slate-300 font-medium mb-2">Physical Top Features</div>
                <div className="space-y-2">
                  {topPhysicalFeatures.length === 0 ? <div className="text-slate-500">No physical XAI available.</div> : topPhysicalFeatures.map((row: Record<string, unknown>, i: number) => (
                    <div key={`phys-${i}`} className="flex justify-between border-b border-slate-800/40 pb-1">
                      <span className="text-slate-300">{String(row.feature ?? 'feature')}</span>
                      <span className="font-mono text-slate-400">{Number(row.relative_contribution ?? 0).toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-slate-300 font-medium mb-2">Cyber Top Features</div>
                <div className="space-y-2">
                  {topCyberFeatures.length === 0 ? <div className="text-slate-500">No cyber XAI available.</div> : topCyberFeatures.map((row: Record<string, unknown>, i: number) => (
                    <div key={`cyber-${i}`} className="flex justify-between border-b border-slate-800/40 pb-1">
                      <span className="text-slate-300">{String(row.feature ?? 'feature')}</span>
                      <span className="font-mono text-slate-400">{Number(row.relative_contribution ?? 0).toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Experiment Detection Configuration</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            {[
              { param: 'Score Threshold', value: scoreThreshold.toFixed(2), desc: 'Deviation score boundary for anomaly flagging' },
              { param: 'Detection Accuracy', value: formatPct(Number(summary?.detectionAccuracy ?? 0), 2), desc: 'Overall detection accuracy this run' },
              { param: 'Risk Mitigation', value: formatPct(Number(summary?.riskMitigation ?? 0), 2), desc: 'Risk reduction from dynamic scheduling' },
              { param: 'Cost Efficiency', value: formatPct(Number(summary?.costEfficiency ?? 0), 2), desc: 'Audit cost optimization metric' },
            ].map(item => (
              <div key={item.param} className="glass-card p-3 border-slate-700/30">
                <div className="font-mono text-cyber-teal text-base font-bold">{item.value}</div>
                <div className="text-slate-300 mt-1 font-medium">{item.param}</div>
                <div className="text-slate-500 mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
