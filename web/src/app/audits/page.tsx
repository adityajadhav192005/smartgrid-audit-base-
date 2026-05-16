'use client'
import { useState } from 'react'
import { Badge, SeverityBadge } from '@/components/ui/Badge'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ViewModeBanner } from '@/components/ui/ViewModeBanner'
import { useDashboard } from '@/lib/dashboardContext'
import { useExperimentTelemetry } from '@/lib/experimentTelemetry'

type LiveAuditRecord = {
  id: string
  agentId: string
  agentType: string
  severity: string
  status: 'Active' | 'Completed'
  triggerReason: string
  triggerCondition: string
  anomalyScore: number
  riskScore: number
  criticalityWeight: number
  suspectedAttack: string
  confidence: number
  startTime: string
  endTime: string | null
  description: string
  linkedEvidence: string[]
}

function toAuditRecord(event: {
  id: string
  ts: string
  type: string
  msg: string
  severity: string
}, index: number): LiveAuditRecord {
  const severity = event.severity ? `${event.severity.charAt(0).toUpperCase()}${event.severity.slice(1)}` : 'Info'
  const riskFromMessage = Number((event.msg.match(/score\s+([0-9.]+)/i)?.[1] ?? '0'))
  const riskScore = Number.isFinite(riskFromMessage) ? riskFromMessage : 0
  const anomalyScore = Math.max(0, riskScore)

  return {
    id: `AUD-${String(index + 1).padStart(3, '0')}`,
    agentId: event.msg.split('·')[0]?.trim() || 'agent',
    agentType: event.msg.toLowerCase().includes('gen') ? 'Generator' : event.msg.toLowerCase().includes('sub') ? 'Substation' : event.msg.toLowerCase().includes('pmu') ? 'PMU' : 'Agent',
    severity,
    status: severity === 'Critical' || severity === 'High' ? 'Active' : 'Completed',
    triggerReason: event.type,
    triggerCondition: event.msg,
    anomalyScore,
    riskScore,
    criticalityWeight: severity === 'Critical' ? 1.0 : severity === 'High' ? 0.7 : 0.5,
    suspectedAttack: event.type,
    confidence: Math.max(0.5, Math.min(0.99, 0.6 + riskScore * 0.3)),
    startTime: event.ts,
    endTime: severity === 'Critical' || severity === 'High' ? null : event.ts,
    description: event.msg,
    linkedEvidence: [event.id],
  }
}

export default function AuditsPage() {
  const { searchQuery } = useDashboard()
  const { events, summary, statusCounts } = useExperimentTelemetry(8000)

  const liveAuditRecords: LiveAuditRecord[] = events.map((event, index) => toAuditRecord(event, index))

  const [selected, setSelected] = useState<LiveAuditRecord | null>(liveAuditRecords[0] ?? null)

  const visibleAudits = liveAuditRecords.filter(a => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return `${a.id} ${a.agentId} ${a.agentType} ${a.severity} ${a.status} ${a.suspectedAttack}`.toLowerCase().includes(q)
  })

  const selectedAudit = selected ?? visibleAudits[0] ?? null

  const totalAudits = liveAuditRecords.length
  const activeIncidents = Number(statusCounts.underAudit ?? 0)
  const threatsFound = Number(statusCounts.attacked ?? 0) + Number(statusCounts.anomalous ?? 0)
  const resolved = Math.max(0, Math.round(Number(summary?.riskMitigation ?? 0) * totalAudits))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Audit Trail</h1>
        <p className="text-sm text-slate-500 mt-1">Full audit record — triggers, evidence, and descriptions</p>
      </div>

      <ViewModeBanner section="Audit Trail" mode="experiment" />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Total Audits"   value={totalAudits}      color="blue"   icon={<Shield size={14} />} />
        <KPIStatCard label="Active"         value={activeIncidents}  color="teal"   icon={<Clock size={14} />} />
        <KPIStatCard label="Threats Found"  value={threatsFound}     color="red"    icon={<AlertTriangle size={14} />} />
        <KPIStatCard label="Resolved"       value={resolved}         color="green"  icon={<CheckCircle size={14} />} />
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Audit list */}
        <div className="lg:col-span-2 glass-card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-800">Recent Audits</div>
          <div className="divide-y divide-slate-800/60">
            {visibleAudits.map(a => (
              <button key={a.id} onClick={() => setSelected(a)}
                className={cn('w-full text-left p-4 hover:bg-slate-100 transition-colors',
                  selectedAudit?.id === a.id && 'bg-cyber-blue/5 border-l-2 border-l-cyber-blue'
                )}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-cyber-blue">{a.id}</span>
                  <Badge variant={a.severity.toLowerCase() as any}>{a.severity}</Badge>
                </div>
                <div className="text-xs text-slate-700 mb-1">{a.agentId} — {a.agentType}</div>
                <div className="text-xs text-slate-500 line-clamp-2">{a.triggerReason}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant={a.status === 'Active' ? 'auditing' : 'low'}>{a.status}</Badge>
                  <span className="text-xs text-slate-600">{a.startTime}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3 glass-card p-5 space-y-4">
          {!selectedAudit && (
            <div className="text-sm text-slate-500">No live audit records yet. Waiting for SCADA/bridge telemetry...</div>
          )}
          {selectedAudit && (
          <>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-cyber-blue text-lg font-bold">{selectedAudit.id}</span>
                <Badge variant={selectedAudit.severity.toLowerCase() as any}>{selectedAudit.severity}</Badge>
                <Badge variant={selectedAudit.status === 'Active' ? 'auditing' : 'low'} pulse={selectedAudit.status === 'Active'}>{selectedAudit.status}</Badge>
              </div>
              <div className="text-sm text-slate-500">Agent: <span className="text-slate-800 font-medium">{selectedAudit.agentId}</span> ({selectedAudit.agentType})</div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>Started: {selectedAudit.startTime}</div>
              {selectedAudit.endTime && <div>Ended: {selectedAudit.endTime}</div>}
            </div>
          </div>

          {/* Score grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card p-3 border-cyber-red/20">
              <div className="text-xs text-slate-500 mb-1">Anomaly Score</div>
              <div className="text-xl font-bold font-mono text-cyber-red">{selectedAudit.anomalyScore.toFixed(3)}</div>
            </div>
            <div className="glass-card p-3 border-cyber-amber/20">
              <div className="text-xs text-slate-500 mb-1">Risk Score</div>
              <div className="text-xl font-bold font-mono text-cyber-amber">{selectedAudit.riskScore.toFixed(2)}</div>
            </div>
            <div className="glass-card p-3 border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Confidence</div>
              <div className="text-xl font-bold font-mono text-cyber-green">{(selectedAudit.confidence * 100).toFixed(0)}%</div>
            </div>
          </div>

          {/* Trigger condition */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Trigger Condition</div>
            <code className="block text-xs text-cyber-teal bg-slate-50 rounded-lg px-3 py-2 border border-cyber-teal/10">{selectedAudit.triggerCondition}</code>
          </div>

          {/* Suspected attack */}
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs text-slate-500 mb-1">Suspected Attack</div>
              <Badge variant="critical">{selectedAudit.suspectedAttack}</Badge>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Criticality Weight</div>
              <span className="text-cyber-amber font-mono font-bold">{selectedAudit.criticalityWeight.toFixed(1)}</span>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Linked Evidence</div>
              <div className="flex gap-1">
                {selectedAudit.linkedEvidence.map(e => (
                  <Badge key={e} variant="info">{e}</Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Full description */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">AI-Generated Audit Summary</div>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3">{selectedAudit.description}</p>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
