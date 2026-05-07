'use client'

import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Badge } from '@/components/ui/Badge'
import { Boxes, Activity, Shield, Zap } from 'lucide-react'
import { useLiveTelemetry } from '@/lib/liveTelemetry'

const GROUPS = [
  { type: 'Generator', label: 'Generators', prefix: 'GEN', range: '01-20' },
  { type: 'Substation', label: 'Substations', prefix: 'SUB', range: '21-50' },
  { type: 'PMU', label: 'PMUs', prefix: 'PMU', range: '51-75' },
  { type: 'Breaker', label: 'Breakers', prefix: 'BRK', range: '76-100' },
]

export default function RapidScadaAssetsPage() {
  const { liveAgents, topAgents } = useLiveTelemetry(3000)

  const counts = GROUPS.map(group => ({
    ...group,
    count: liveAgents.filter(agent => agent.type === group.type).length,
    live: liveAgents.filter(agent => agent.type === group.type && agent.source === 'live').length,
    mixed: liveAgents.filter(agent => agent.type === group.type && agent.source === 'mixed').length,
    fallback: liveAgents.filter(agent => agent.type === group.type && agent.source === 'fallback').length,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Rapid SCADA Asset / Topology View</h1>
        <p className="text-sm text-slate-400 mt-1">Live SCADA asset layout, source provenance, and highest-risk live agents</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Total Assets" value={liveAgents.length} color="blue" icon={<Boxes size={14} />} />
        <KPIStatCard label="Live Assets" value={liveAgents.filter(agent => agent.source === 'live').length} color="green" icon={<Activity size={14} />} />
        <KPIStatCard label="Mixed Assets" value={liveAgents.filter(agent => agent.source === 'mixed').length} color="amber" icon={<Shield size={14} />} />
        <KPIStatCard label="Fallback-Filled" value={liveAgents.filter(agent => agent.source === 'fallback').length} color="red" icon={<Zap size={14} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Topology Groups</h3>
          <div className="space-y-3">
            {counts.map(group => (
              <div key={group.type} className="glass-card p-3 border-slate-700/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{group.label}</div>
                    <div className="text-xs text-slate-500">{group.prefix} {group.range}</div>
                  </div>
                  <Badge variant="info">{group.count}</Badge>
                </div>
                <div className="mt-2 text-xs text-slate-400 flex gap-4">
                  <span>Live {group.live}</span>
                  <span>Mixed {group.mixed}</span>
                  <span>Fallback {group.fallback}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Highest-Risk Live Assets</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/50">
                {['Asset', 'Type', 'Source', 'Anomaly', 'Risk'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topAgents.map(agent => (
                <tr key={agent.id} className="data-table-row border-b border-slate-800/40">
                  <td className="py-2 pr-4 font-mono text-cyber-blue">{agent.id}</td>
                  <td className="py-2 pr-4 text-slate-300">{agent.type}</td>
                  <td className="py-2 pr-4 text-slate-400 uppercase">{agent.source ?? 'live'}</td>
                  <td className="py-2 pr-4 font-mono text-cyber-red">{agent.anomalyScore.toFixed(3)}</td>
                  <td className="py-2 text-slate-300">{agent.riskScore.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
