'use client'
import { useState } from 'react'
import { liveAgents } from '@/lib/mockData'
import { StateBadge } from '@/components/ui/Badge'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Activity, Filter, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const TYPES = ['All', 'Generator', 'Substation', 'PMU', 'Breaker']
const STATES = ['All', 'Healthy', 'Anomalous', 'Under Audit', 'Attacked', 'Suspect']

export default function LivePage() {
  const [typeFilter, setTypeFilter]   = useState('All')
  const [stateFilter, setStateFilter] = useState('All')
  const [sortBy, setSortBy]           = useState<'riskScore' | 'anomalyScore'>('riskScore')

  const filtered = liveAgents
    .filter(a => typeFilter  === 'All' || a.type  === typeFilter)
    .filter(a => stateFilter === 'All' || a.state === stateFilter)
    .sort((a, b) => b[sortBy] - a[sortBy])

  const healthy  = liveAgents.filter(a => a.state === 'Healthy').length
  const flagged  = liveAgents.filter(a => a.state === 'Anomalous' || a.state === 'Attacked').length
  const auditing = liveAgents.filter(a => a.state === 'Under Audit').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-header">Live Agent Monitoring</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time state, anomaly scores, and risk for all agents</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-cyber-blue/30 text-cyber-blue hover:bg-cyber-blue/10 transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Total Agents" value={liveAgents.length}  color="blue"  icon={<Activity size={14} />} />
        <KPIStatCard label="Healthy"      value={healthy}            color="green"  />
        <KPIStatCard label="Flagged"      value={flagged}            color="red"    />
        <KPIStatCard label="Under Audit"  value={auditing}           color="teal"   />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-slate-500" />
        <span className="text-xs text-slate-500">Type:</span>
        {TYPES.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={cn('px-3 py-1 rounded-full text-xs border transition-colors',
              typeFilter === t
                ? 'bg-cyber-blue/20 border-cyber-blue/60 text-cyber-blue'
                : 'border-slate-700/50 text-slate-500 hover:text-slate-300'
            )}>
            {t}
          </button>
        ))}
        <span className="text-xs text-slate-500 ml-4">State:</span>
        {STATES.map(s => (
          <button key={s} onClick={() => setStateFilter(s)}
            className={cn('px-3 py-1 rounded-full text-xs border transition-colors',
              stateFilter === s
                ? 'bg-cyber-blue/20 border-cyber-blue/60 text-cyber-blue'
                : 'border-slate-700/50 text-slate-500 hover:text-slate-300'
            )}>
            {s}
          </button>
        ))}
        <span className="text-xs text-slate-500 ml-4">Sort:</span>
        {(['riskScore', 'anomalyScore'] as const).map(k => (
          <button key={k} onClick={() => setSortBy(k)}
            className={cn('px-3 py-1 rounded-full text-xs border transition-colors',
              sortBy === k
                ? 'bg-cyber-amber/20 border-cyber-amber/60 text-cyber-amber'
                : 'border-slate-700/50 text-slate-500 hover:text-slate-300'
            )}>
            {k === 'riskScore' ? 'Risk' : 'Anomaly'}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">{filtered.length} agents</span>
      </div>

      {/* Agent table */}
      <div className="glass-card overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/60 text-slate-500">
              {['ID', 'Type', 'State', 'Anomaly Score', 'Risk', 'Phys. Health', 'Cyber Health', 'Criticality', 'Last Attack', 'Audit Triggered'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} className="data-table-row border-b border-slate-800/40">
                <td className="px-4 py-2.5 font-mono text-cyber-blue font-medium">{a.id}</td>
                <td className="px-4 py-2.5 text-slate-300">{a.type}</td>
                <td className="px-4 py-2.5"><StateBadge state={a.state} /></td>
                <td className="px-4 py-2.5 font-mono">
                  <span className={a.anomalyScore > 1.0 ? 'text-cyber-red font-bold' : a.anomalyScore > 0.7 ? 'text-cyber-amber' : 'text-slate-300'}>
                    {a.anomalyScore.toFixed(3)}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-slate-700/60">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${a.riskScore * 100}%`, background: a.riskScore > 0.8 ? '#ff3860' : a.riskScore > 0.5 ? '#ffb700' : '#10b981' }} />
                    </div>
                    <span className="text-slate-400">{a.riskScore.toFixed(2)}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className={a.physicalHealth > 0.8 ? 'text-emerald-400' : a.physicalHealth > 0.6 ? 'text-amber-400' : 'text-red-400'}>
                    {(a.physicalHealth * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={a.cyberHealth > 0.8 ? 'text-emerald-400' : a.cyberHealth > 0.6 ? 'text-amber-400' : 'text-red-400'}>
                    {(a.cyberHealth * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-400">{a.criticalityWeight.toFixed(1)}</td>
                <td className="px-4 py-2.5 text-slate-500">{a.lastAttack}</td>
                <td className="px-4 py-2.5">
                  {a.auditTriggered
                    ? <span className="text-xs text-cyber-teal font-medium">Yes</span>
                    : <span className="text-xs text-slate-600">No</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">No agents match current filters</div>
        )}
      </div>
    </div>
  )
}
