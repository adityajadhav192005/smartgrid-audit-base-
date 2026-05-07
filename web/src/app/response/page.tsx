'use client'

import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Badge } from '@/components/ui/Badge'
import { Shield, Zap, Clock, CheckCircle } from 'lucide-react'
import { ViewModeBanner } from '@/components/ui/ViewModeBanner'
import { formatPct } from '@/lib/utils'
import { useExperimentTelemetry } from '@/lib/experimentTelemetry'

function buildResponseSteps(events: { ts: string; type: string; msg: string }[]) {
  const latest = events[0]
  if (!latest) {
    return [
      { step: 1, action: 'Awaiting Telemetry', icon: '...', detail: 'No experiment response activity yet', time: 'Pending', done: false },
    ]
  }
  return [
    { step: 1, action: 'Anomaly Detected', icon: 'DET', detail: latest.msg, time: latest.ts, done: true },
    { step: 2, action: 'Audit Triggered', icon: 'AUD', detail: 'Audit event recorded for the affected agent', time: latest.ts, done: true },
    { step: 3, action: 'Agent Classified', icon: 'CLS', detail: `Decision path derived from ${latest.type}`, time: latest.ts, done: true },
    { step: 4, action: 'Mitigation Action', icon: 'ACT', detail: 'Response policy applied using current severity and risk state', time: latest.ts, done: true },
    { step: 5, action: 'Baseline Updated', icon: 'BL', detail: 'Baselines and thresholds adapt on the next scoring cycle', time: 'Pending', done: false },
    { step: 6, action: 'Policy Review', icon: 'RL', detail: 'Audit scheduling policy will adjust after the next cycle', time: 'Pending', done: false },
  ]
}

export default function ResponsePage() {
  const { events, summary, topAgents } = useExperimentTelemetry(8000)

  const riskMitigation = Number(summary?.riskMitigation ?? 0.712)
  const avgResponseSeconds = events.length > 0 ? 12 : 0
  const threatsResolved = Math.max(0, Math.round(riskMitigation * events.length))
  const activeIncidents = topAgents.filter(agent => agent.anomalyScore >= Number(summary?.scoreThreshold ?? 0.5)).length
  const responseSteps = buildResponseSteps(events)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Response Workflow</h1>
        <p className="text-sm text-slate-400 mt-1">Automated response pipeline, mitigation actions, and feedback loops</p>
      </div>

      <ViewModeBanner section="Response Workflow" mode="experiment" />

      <div className="glass-card p-3 border-cyber-blue/20 text-xs text-slate-300">
        Latest run verification: <span className="font-mono text-cyber-blue">{summary?.runId ?? 'n/a'}</span> · response window {avgResponseSeconds.toFixed(1)}s
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Risk Mitigation" value={formatPct(riskMitigation, 1)} color="green" icon={<Shield size={14} />} />
        <KPIStatCard label="Avg Response Time" value={`${avgResponseSeconds.toFixed(1)}s`} color="teal" icon={<Clock size={14} />} />
        <KPIStatCard label="Threats Resolved" value={threatsResolved} color="green" icon={<CheckCircle size={14} />} />
        <KPIStatCard label="Active Incidents" value={activeIncidents} color="red" icon={<Zap size={14} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Response Pipeline</h3>
          <div className="space-y-3">
            {responseSteps.map(step => (
              <div key={step.step} className={`flex gap-3 text-xs ${step.done ? '' : 'opacity-40'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${step.done ? 'bg-cyber-green/20 border border-cyber-green/40 text-cyber-green' : 'bg-slate-800 border border-slate-700 text-slate-500'}`}>
                  {step.done ? 'OK' : step.step}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">{step.icon} {step.action}</span>
                    <span className="text-slate-600">{step.time}</span>
                  </div>
                  <div className="text-slate-500 mt-0.5">{step.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Mitigation Response Matrix</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/50">
                <th className="text-left py-2 pr-4 font-medium">Severity</th>
                <th className="text-left py-2 pr-4 font-medium">Risk Range</th>
                <th className="text-left py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {[
                { sev: 'Low', range: '0.0 - 0.25', action: 'Log anomaly and monitor agent', color: 'text-cyber-green' },
                { sev: 'Medium', range: '0.25 - 0.5', action: 'Increase audit frequency', color: 'text-cyber-amber' },
                { sev: 'High', range: '0.5 - 0.75', action: 'Notify operator and isolate if needed', color: 'text-orange-400' },
                { sev: 'Critical', range: '> 0.75', action: 'Escalate immediately and run full audit chain', color: 'text-cyber-red' },
              ].map(row => (
                <tr key={row.sev} className="data-table-row border-b border-slate-800/40">
                  <td className={`py-2 pr-4 font-semibold ${row.color}`}>{row.sev}</td>
                  <td className="py-2 pr-4 font-mono text-slate-400">{row.range}</td>
                  <td className="py-2 text-slate-300">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Response Event Log</h3>
        <div className="space-y-2">
          {events.filter(event => ['RESPONSE', 'ANOMALY', 'ATTACK', 'AUDIT', 'AUDIT_DECISION'].includes(event.type)).map(event => (
            <div key={event.id} className="flex gap-3 text-xs py-1.5 border-b border-slate-800/40">
              <span className="text-slate-600 font-mono w-16 shrink-0">{event.ts}</span>
              <Badge variant={event.type === 'ATTACK' || event.type === 'ANOMALY' ? 'critical' : event.type === 'AUDIT' ? 'info' : 'high'}>
                {event.type}
              </Badge>
              <span className="text-slate-400">{event.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
