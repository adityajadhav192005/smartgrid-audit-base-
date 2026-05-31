'use client'

import { useEffect, useMemo, useState } from 'react'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { AnomalyTrendChart, AgentRadarChart, SystemHealthAreaChart, AttackFamilyChart } from '@/components/charts'
import { Activity, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react'
import { formatPct } from '@/lib/utils'
import { ViewModeBanner } from '@/components/ui/ViewModeBanner'
import { useExperimentTelemetry } from '@/lib/experimentTelemetry'

export default function AnomaliesPage() {
  const { summary, trend, topAgents, health, agentSnapshots } = useExperimentTelemetry(8000)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const scoreThreshold = Number(summary?.scoreThreshold ?? 0.5)

  const activeAnomalies = topAgents.filter(agent => agent.anomalyScore >= scoreThreshold).length
  const avgAnomaly = topAgents.length > 0
    ? topAgents.reduce((acc, agent) => acc + agent.anomalyScore, 0) / topAgents.length
    : (((summary?.precision ?? 0) + (summary?.recall ?? 0) + (summary?.detectionAccuracy ?? 0)) / 3 || 0.72)
  const crossLayerStability = Number(summary?.crossLayerStability ?? health.crossLayerStability ?? 0)
  const baselineDrift = summary?.detectionAccuracy ? Math.max(0.001, 1 - Number(summary.detectionAccuracy)) / 100 : 0.0082

  useEffect(() => {
    if (!selectedAgentId && topAgents[0]?.id) {
      setSelectedAgentId(topAgents[0].id)
    }
  }, [selectedAgentId, topAgents])

  const selectedAgent = useMemo(
    () => agentSnapshots.find(agent => agent.id === selectedAgentId) ?? topAgents[0] ?? null,
    [agentSnapshots, selectedAgentId, topAgents],
  )

  const topPhysicalFeatures = Array.isArray(selectedAgent?.xai?.physical?.top_features) ? selectedAgent?.xai?.physical?.top_features ?? [] : []
  const topCyberFeatures = Array.isArray(selectedAgent?.xai?.cyber?.top_features) ? selectedAgent?.xai?.cyber?.top_features ?? [] : []
  const selectedRisk = Number(selectedAgent?.riskScore ?? 0)
  const selectedAnomaly = Number(selectedAgent?.anomalyScore ?? 0)
  const radarData = [
    { metric: 'Detection', score: Math.round(Math.min(100, Number(summary?.detectionAccuracy ?? 0) * 100)) },
    { metric: 'Precision', score: Math.round(Math.min(100, Number(summary?.precision ?? 0) * 100)) },
    { metric: 'Recall', score: Math.round(Math.min(100, Number(summary?.recall ?? 0) * 100)) },
    { metric: 'Coverage', score: Math.round(Math.min(100, Number(summary?.auditCoverage ?? 0) * 100)) },
    { metric: 'Risk Ctrl', score: Math.round(Math.max(0, Math.min(100, Number(summary?.riskMitigation ?? 0) * 100))) },
    { metric: 'Selected', score: Math.round(Math.max(0, 100 - Math.min(100, selectedRisk * 10 + selectedAnomaly * 5))) },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Risk Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Latest-run deviation trends, risk scores, and cross-layer stability</p>
      </div>

      <ViewModeBanner section="Risk Analytics" mode="experiment" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Active Anomalies" value={activeAnomalies} color="red" icon={<AlertTriangle size={14} />} />
        <KPIStatCard label="Avg Anomaly Score" value={avgAnomaly.toFixed(3)} color="amber" icon={<Activity size={14} />} />
        <KPIStatCard label="Cross-Layer Stab." value={formatPct(crossLayerStability, 1)} color="blue" icon={<TrendingDown size={14} />} />
        <KPIStatCard label="Baseline Drift" value={baselineDrift.toFixed(4)} color="teal" icon={<TrendingUp size={14} />} sub="Q-delta" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Anomaly Score Trend</h3>
          <div className="h-48"><AnomalyTrendChart data={trend} /></div>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Audit and Attack Event Volume</h3>
          <div className="h-48"><SystemHealthAreaChart data={trend} /></div>
        </div>
      </div>

      {/* Attack family distribution: ground truth vs detected */}
      {Array.isArray(summary?.attackFamilyDistribution) && summary.attackFamilyDistribution.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Attack Family Distribution</h3>
            <span className="text-[11px] text-slate-500">FDI / DOS / MITM / CHAIN / FAULT - truth vs detected</span>
          </div>
          <div className="h-56">
            <AttackFamilyChart
              data={summary.attackFamilyDistribution.map(f => ({
                name: f.name,
                support: f.support,
                detected: f.detected,
              }))}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Experiment Health Radar</h3>
          <div className="h-52"><AgentRadarChart data={radarData} /></div>
        </div>
        <div className="glass-card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Top Anomalous Agents</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                {['Agent', 'Type', 'Anomaly Score', 'Risk Score', 'Source', '# Audits'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topAgents.map(agent => (
                <tr
                  key={agent.id}
                  className="data-table-row border-b border-slate-200/40 cursor-pointer"
                  onClick={() => setSelectedAgentId(agent.id)}
                >
                  <td className="py-1.5 pr-4 font-mono text-cyber-blue">{agent.id}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{agent.type}</td>
                  <td className="py-1.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-slate-700/60">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min((agent.anomalyScore / Math.max(scoreThreshold, 0.1)) * 100, 100)}%`,
                            background: agent.anomalyScore > scoreThreshold ? '#ef4444' : agent.anomalyScore > scoreThreshold * 0.7 ? '#f59e0b' : '#3b82f6',
                          }}
                        />
                      </div>
                      <span className="font-mono text-slate-700">{agent.anomalyScore.toFixed(3)}</span>
                    </div>
                  </td>
                  <td className="py-1.5 pr-4 font-mono text-slate-500">{agent.riskScore.toFixed(2)}</td>
                  <td className="py-1.5 pr-4 text-slate-500 uppercase">{agent.source ?? 'experiment'}</td>
                  <td className="py-1.5 text-slate-500">{agent.auditCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Selected Agent Feature Contribution</h3>
          {!selectedAgent ? (
            <p className="text-sm text-slate-500">No experiment explanation available.</p>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-cyber-blue">{selectedAgent.id}</span>
                <span className="text-slate-500">source {selectedAgent.source ?? 'experiment'} · severity {selectedAgent.severity ?? 'LOW'}</span>
              </div>
              <div>
                <div className="text-slate-700 font-medium mb-2">Physical Top Features</div>
                <div className="space-y-2">
                  {topPhysicalFeatures.length === 0 ? <div className="text-slate-500">No physical XAI available.</div> : topPhysicalFeatures.map((row: Record<string, unknown>, index: number) => (
                    <div key={`phys-${index}`} className="flex justify-between border-b border-slate-200/40 pb-1">
                      <span className="text-slate-700">{String(row.feature ?? 'feature')}</span>
                      <span className="font-mono text-slate-500">{Number(row.relative_contribution ?? 0).toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-slate-700 font-medium mb-2">Cyber Top Features</div>
                <div className="space-y-2">
                  {topCyberFeatures.length === 0 ? <div className="text-slate-500">No cyber XAI available.</div> : topCyberFeatures.map((row: Record<string, unknown>, index: number) => (
                    <div key={`cyber-${index}`} className="flex justify-between border-b border-slate-200/40 pb-1">
                      <span className="text-slate-700">{String(row.feature ?? 'feature')}</span>
                      <span className="font-mono text-slate-500">{Number(row.relative_contribution ?? 0).toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Active Experiment Detection Configuration</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            {[
              { param: 'Audit threshold', value: scoreThreshold.toFixed(2), desc: 'Latest-run risk boundary for audit escalation' },
              { param: 'Detection accuracy', value: `${Math.round(Number(summary?.detectionAccuracy ?? 0) * 100)}%`, desc: 'Detector accuracy from the latest run' },
              { param: 'Audit coverage', value: `${Math.round(Number(summary?.auditCoverage ?? 0) * 100)}%`, desc: 'Coverage achieved in the latest run' },
              { param: 'Risk mitigation', value: `${Math.round(Number(summary?.riskMitigation ?? 0) * 100)}%`, desc: 'Risk reduction from the latest experiment run' },
            ].map(item => (
              <div key={item.param} className="glass-card p-3 border-slate-200">
                <div className="font-mono text-cyber-teal text-base font-bold">{item.value}</div>
                <div className="text-slate-700 mt-1 font-medium">{item.param}</div>
                <div className="text-slate-500 mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
