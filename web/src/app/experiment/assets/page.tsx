'use client'

import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Badge } from '@/components/ui/Badge'
import { Boxes, Activity, Shield, Zap } from 'lucide-react'
import { useExperimentTelemetry } from '@/lib/experimentTelemetry'

const GROUPS = [
  { type: 'Generator', label: 'Generators', prefix: 'GEN', range: '01-20' },
  { type: 'Substation', label: 'Substations', prefix: 'SUB', range: '21-50' },
  { type: 'PMU', label: 'PMUs', prefix: 'PMU', range: '51-75' },
  { type: 'Breaker', label: 'Breakers', prefix: 'BRK', range: '76-100' },
]

export default function ExperimentAssetsPage() {
  const { liveAgents, topAgents, summary } = useExperimentTelemetry(8000)
  const totalAgents = Number(summary?.totalAgents ?? liveAgents.length)

  const counts = GROUPS.map(group => ({
    ...group,
    count: liveAgents.filter(agent => agent.type === group.type).length,
    healthy: liveAgents.filter(agent => agent.type === group.type && agent.state === 'Healthy').length,
    flagged: liveAgents.filter(agent => agent.type === group.type && agent.state !== 'Healthy').length,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Experiment Asset / Topology View</h1>
        <p className="text-sm text-slate-500 mt-1">Latest-run asset layout, type distribution, and highest-risk experiment agents</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Total Assets" value={totalAgents} color="blue" icon={<Boxes size={14} />} />
        <KPIStatCard label="Generators" value={counts[0].count} color="amber" icon={<Zap size={14} />} />
        <KPIStatCard label="Substations" value={counts[1].count} color="purple" icon={<Shield size={14} />} />
        <KPIStatCard label="PMUs + Breakers" value={counts[2].count + counts[3].count} color="teal" icon={<Activity size={14} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Topology Groups</h3>
          <div className="space-y-3">
            {counts.map(group => (
              <div key={group.type} className="glass-card p-3 border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{group.label}</div>
                    <div className="text-xs text-slate-500">{group.prefix} {group.range}</div>
                  </div>
                  <Badge variant="info">{group.count}</Badge>
                </div>
                <div className="mt-2 text-xs text-slate-500 flex gap-4">
                  <span>Healthy {group.healthy}</span>
                  <span>Flagged {group.flagged}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Highest-Risk Experiment Assets</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                {['Asset', 'Type', 'State', 'Anomaly', 'Risk'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topAgents.map(agent => {
                const row = liveAgents.find(item => item.id === agent.id)
                return (
                  <tr key={agent.id} className="data-table-row border-b border-slate-200/40">
                    <td className="py-2 pr-4 font-mono text-cyber-blue">{agent.id}</td>
                    <td className="py-2 pr-4 text-slate-700">{agent.type}</td>
                    <td className="py-2 pr-4 text-slate-500">{row?.state ?? 'Healthy'}</td>
                    <td className="py-2 pr-4 font-mono text-cyber-red">{agent.anomalyScore.toFixed(3)}</td>
                    <td className="py-2 text-slate-700">{agent.riskScore.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
