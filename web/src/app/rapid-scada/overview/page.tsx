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
import { formatPct } from '@/lib/utils'
import { Activity, AlertTriangle, Brain, Radar, Shield, Zap } from 'lucide-react'
import { useLiveTelemetry } from '@/lib/liveTelemetry'
import { useLatestRun } from '@/lib/latestRun'

export default function RapidScadaOverviewPage() {
  const { gridStatus, trend, events, topAgents, health, statusCounts } = useLiveTelemetry(3000)
  const { latestRun } = useLatestRun(12000)
  const connected = Boolean(gridStatus?.rapid_scada?.connection?.connected)
  const run = latestRun
  const threshold = Number(gridStatus?.rapid_scada?.config?.score_threshold ?? 3)
  const activeIncidents = topAgents.filter(agent => agent.anomalyScore >= threshold).length

  const attackTypeDistribution = [
    { name: 'Critical', value: events.filter(event => event.severity === 'critical').length, color: '#ff3860' },
    { name: 'High', value: events.filter(event => event.severity === 'high').length, color: '#ffb700' },
    { name: 'Medium', value: events.filter(event => event.severity === 'medium').length, color: '#bd00ff' },
    { name: 'Low/Info', value: events.filter(event => !['critical', 'high', 'medium'].includes(event.severity)).length, color: '#00d4ff' },
  ]

  const agentStatusDistribution = [
    { name: 'Healthy', value: Number(statusCounts.healthy ?? 0), color: '#10b981' },
    { name: 'Anomalous', value: Number(statusCounts.anomalous ?? 0), color: '#f59e0b' },
    { name: 'Under Audit', value: Number(statusCounts.underAudit ?? 0), color: '#00d4ff' },
    { name: 'Attacked', value: Number(statusCounts.attacked ?? 0), color: '#ef4444' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="section-header">Rapid SCADA Operations Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Live SCADA posture across telemetry, anomaly state, audit pressure, and event flow</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={connected ? 'healthy' : 'critical'} pulse={connected}>{connected ? 'LIVE' : 'OFFLINE'}</Badge>
          <Badge variant="info">SCADA</Badge>
          <Badge variant="auditing">{run?.runId ?? 'LIVE-FEED'}</Badge>
        </div>
      </div>

      <div className="glass-card p-3 border-cyber-blue/20 text-xs text-slate-700">
        Latest experiment: <span className="font-mono text-cyber-blue">{run?.runId ?? 'n/a'}</span> · status {run?.status ?? 'unknown'} · detected {run?.attacksDetected ?? activeIncidents}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KPIStatCard label="SCADA Connection" value={connected ? 'LIVE' : 'OFFLINE'} color={connected ? 'green' : 'red'} icon={<Activity size={14} />} />
        <KPIStatCard label="Cross-Layer Stability" value={formatPct(Number(health.crossLayerStability ?? 0), 2)} color="blue" icon={<Radar size={14} />} />
        <KPIStatCard label="Attack Resistance" value={formatPct(Number(health.attackResistance ?? 0), 1)} color="teal" icon={<Shield size={14} />} />
        <KPIStatCard label="Audit Threshold" value={threshold.toFixed(2)} color="amber" icon={<Brain size={14} />} />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KPIStatCard label="Active Anomalies" value={activeIncidents} color="red" icon={<AlertTriangle size={14} />} />
        <KPIStatCard label="Attacked Agents" value={Number(statusCounts.attacked ?? 0)} color="red" icon={<Zap size={14} />} />
        <KPIStatCard label="Under Audit" value={Number(statusCounts.underAudit ?? 0)} color="purple" icon={<Shield size={14} />} />
        <KPIStatCard label="Recent Events" value={events.length} color="blue" icon={<Brain size={14} />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="glass-card p-4 xl:col-span-2">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Live Anomaly and Risk Trend</h3>
          <div className="h-64"><AnomalyTrendChart data={trend} /></div>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Attack and Audit Volume</h3>
          <div className="h-64"><AttackBarChart data={trend} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Event Types</h3>
          <div className="h-64"><AttackTypePie data={attackTypeDistribution} /></div>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Agent Status Distribution</h3>
          <div className="h-64"><AgentStatusDonut data={agentStatusDistribution} /></div>
        </div>
        <div className="glass-card p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2 text-sm font-semibold text-slate-800">Live Health Gauges</div>
          <GaugeChart value={Number(health.crossLayerStability ?? 0)} label="Cross-Layer Stability" color="#00d4ff" />
          <GaugeChart value={Number(health.attackResistance ?? 0)} label="Attack Resistance" color="#10b981" />
          <GaugeChart value={Math.min(1, activeIncidents / 10)} label="Anomaly Pressure" color="#ffb700" />
          <GaugeChart value={Math.min(1, Number(statusCounts.attacked ?? 0) / 10)} label="Attack Load" color="#ef4444" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="glass-card p-4 xl:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Top Live Risk Agents</h3>
            <span className="text-xs text-slate-500">{topAgents.length} tracked</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                {['Agent', 'Type', 'Anomaly', 'Risk', 'Source', 'Audits'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topAgents.map(agent => (
                <tr key={agent.id} className="data-table-row border-b border-slate-200/40">
                  <td className="py-2 pr-4 font-mono text-cyber-blue">{agent.id}</td>
                  <td className="py-2 pr-4 text-slate-700">{agent.type}</td>
                  <td className="py-2 pr-4 font-mono text-cyber-red">{agent.anomalyScore.toFixed(3)}</td>
                  <td className="py-2 pr-4 text-slate-700">{agent.riskScore.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-slate-500 uppercase">{agent.source ?? 'live'}</td>
                  <td className="py-2 text-slate-500">{agent.auditCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="glass-card p-4 xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Recent Live Events</h3>
            <Badge variant="info">{events.length} items</Badge>
          </div>
          <div className="space-y-2 max-h-[22rem] overflow-auto pr-1">
            {events.map(event => (
              <div key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={event.severity === 'critical' ? 'critical' : event.severity === 'high' ? 'high' : event.severity === 'medium' ? 'medium' : 'info'}>
                      {event.type}
                    </Badge>
                    <span className="text-xs text-slate-500">{event.ts}</span>
                  </div>
                  <StateBadge state={event.type === 'AUDIT_DECISION' ? 'Under Audit' : event.type === 'LIVE_SCORE' ? 'Anomalous' : 'Healthy'} />
                </div>
                <p className="text-xs text-slate-700 mt-2 leading-relaxed">{event.msg}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
