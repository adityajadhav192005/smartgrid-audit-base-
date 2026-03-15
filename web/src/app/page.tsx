'use client'

import {
  AgentStatusDonut,
  AnomalyTrendChart,
  AttackBarChart,
  AttackTypePie,
  GaugeChart,
} from '@/components/charts'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Badge, StateBadge } from '@/components/ui/Badge'
import {
  agentStatusDistribution,
  anomalyTrend,
  attackTypeDistribution,
  kpiData,
  recentEvents,
  topRiskyAgents,
} from '@/lib/mockData'
import { formatCurrency, formatPct } from '@/lib/utils'
import {
  Activity,
  AlertTriangle,
  Brain,
  DollarSign,
  Radar,
  Shield,
  Zap,
} from 'lucide-react'

export default function RootPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="section-header">Executive Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            Unified smart grid security posture across anomaly detection, audits, attacks, and response layers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="healthy" pulse>{kpiData.modelHealth}</Badge>
          <Badge variant="info">XAI {kpiData.xaiStatus}</Badge>
          <Badge variant="auditing">Run {kpiData.currentRunId}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KPIStatCard label="Total Agents" value={kpiData.totalAgents} color="blue" icon={<Activity size={14} />} />
        <KPIStatCard label="Detection Accuracy" value={formatPct(kpiData.detectionAccuracy, 2)} color="green" icon={<Radar size={14} />} />
        <KPIStatCard label="Risk Mitigation" value={formatPct(kpiData.riskMitigation, 1)} color="teal" icon={<Shield size={14} />} />
        <KPIStatCard label="Cost Efficiency" value={formatPct(kpiData.costEfficiency, 1)} color="amber" icon={<DollarSign size={14} />} />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KPIStatCard label="Active Anomalies" value={kpiData.currentAnomalies} color="red" icon={<AlertTriangle size={14} />} />
        <KPIStatCard label="Attacks Detected" value={kpiData.attacksDetected} color="red" icon={<Zap size={14} />} />
        <KPIStatCard label="Audit Coverage" value={formatPct(kpiData.auditCoverage, 1)} color="purple" icon={<Shield size={14} />} />
        <KPIStatCard label="Precision / Recall" value={`${kpiData.precision.toFixed(2)} / ${kpiData.recall.toFixed(2)}`} color="blue" icon={<Brain size={14} />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="glass-card p-4 xl:col-span-2">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Anomaly and Risk Trend</h3>
          <div className="h-64"><AnomalyTrendChart data={anomalyTrend} /></div>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Attack and Audit Volume</h3>
          <div className="h-64"><AttackBarChart data={anomalyTrend} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Attack Types</h3>
          <div className="h-64"><AttackTypePie data={attackTypeDistribution} /></div>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Agent Status Distribution</h3>
          <div className="h-64"><AgentStatusDonut data={agentStatusDistribution} /></div>
        </div>
        <div className="glass-card p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2 text-sm font-semibold text-slate-200">Core Health Gauges</div>
          <GaugeChart value={kpiData.crossLayerStability} label="Cross-Layer Stability" color="#00d4ff" />
          <GaugeChart value={1 - kpiData.attackRate} label="Attack Resistance" color="#10b981" />
          <GaugeChart value={kpiData.auditCoverage} label="Audit Coverage" color="#ffb700" />
          <GaugeChart value={kpiData.detectionAccuracy} label="Detection Accuracy" color="#a855f7" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="glass-card p-4 xl:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200">Top Risky Agents</h3>
            <span className="text-xs text-slate-500">Operational Cost: {formatCurrency(kpiData.operationalCost)}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/50">
                {['Agent', 'Type', 'Anomaly', 'Risk', 'Attack', 'Audits'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topRiskyAgents.map(agent => (
                <tr key={agent.id} className="data-table-row border-b border-slate-800/40">
                  <td className="py-2 pr-4 font-mono text-cyber-blue">{agent.id}</td>
                  <td className="py-2 pr-4 text-slate-300">{agent.type}</td>
                  <td className="py-2 pr-4 font-mono text-cyber-red">{agent.anomalyScore.toFixed(3)}</td>
                  <td className="py-2 pr-4 text-slate-300">{agent.riskScore.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-slate-500">{agent.attack}</td>
                  <td className="py-2 text-slate-400">{agent.auditCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="glass-card p-4 xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200">Recent Events</h3>
            <Badge variant="info">{recentEvents.length} items</Badge>
          </div>
          <div className="space-y-2 max-h-[22rem] overflow-auto pr-1">
            {recentEvents.map(event => (
              <div key={event.id} className="rounded-lg border border-slate-700/40 bg-grid-900/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        event.severity === 'critical' ? 'critical' :
                        event.severity === 'high' ? 'high' :
                        event.severity === 'medium' ? 'medium' : 'info'
                      }
                    >
                      {event.type}
                    </Badge>
                    <span className="text-xs text-slate-500">{event.ts}</span>
                  </div>
                  <StateBadge state={event.type === 'AUDIT' ? 'Under Audit' : event.type === 'ATTACK' ? 'Attacked' : event.type === 'ANOMALY' ? 'Anomalous' : 'Healthy'} />
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">{event.msg}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
