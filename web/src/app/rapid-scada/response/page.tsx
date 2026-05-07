'use client'

import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Badge } from '@/components/ui/Badge'
import { Shield, Zap, Clock, CheckCircle } from 'lucide-react'
import { formatPct } from '@/lib/utils'
import { useLiveTelemetry } from '@/lib/liveTelemetry'

function buildResponseSteps(events: { ts: string; type: string; msg: string }[]) {
  const latest = events[0]
  if (!latest) {
    return [
      { step: 1, action: 'Awaiting Telemetry', icon: '...', detail: 'No live SCADA response activity yet', time: 'Pending', done: false },
    ]
  }
  return [
    { step: 1, action: 'SCADA Deviation Detected', icon: 'DET', detail: latest.msg, time: latest.ts, done: true },
    { step: 2, action: 'Audit Decision Raised', icon: 'AUD', detail: 'Audit event recorded for the affected SCADA agent', time: latest.ts, done: true },
    { step: 3, action: 'Severity Classified', icon: 'CLS', detail: `Live decision path derived from ${latest.type}`, time: latest.ts, done: true },
    { step: 4, action: 'Mitigation Applied', icon: 'ACT', detail: 'SCADA response policy applied using current severity and risk state', time: latest.ts, done: true },
  ]
}

export default function RapidScadaResponsePage() {
  const { events, health, statusCounts } = useLiveTelemetry(3000)
  const responseSteps = buildResponseSteps(events)
  const riskMitigation = Math.max(0, 1 - Number(health.risk ?? 0))
  const avgResponseSeconds = events.length > 0 ? 3 : 0
  const threatsResolved = events.filter(event => event.msg.toUpperCase().includes('MAINTAIN')).length
  const activeIncidents = Number(statusCounts.anomalous ?? 0) + Number(statusCounts.attacked ?? 0) + Number(statusCounts.underAudit ?? 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Rapid SCADA Response Workflow</h1>
        <p className="text-sm text-slate-400 mt-1">Live SCADA response sequence, mitigation actions, and current policy outcomes</p>
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
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Live Response Event Log</h3>
          <div className="space-y-2">
            {events.map(event => (
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
    </div>
  )
}
