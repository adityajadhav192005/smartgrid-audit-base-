'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { useLiveTelemetry } from '@/lib/liveTelemetry'

type AuditRecord = {
  id: string
  agentId: string
  severity: string
  status: 'Active' | 'Completed'
  triggerReason: string
  anomalyScore: number
  riskScore: number
  description: string
  startTime: string
}

function toAuditRecord(event: { id: string; ts: string; type: string; msg: string; severity: string }, index: number): AuditRecord {
  const severity = event.severity ? `${event.severity.charAt(0).toUpperCase()}${event.severity.slice(1)}` : 'Info'
  const score = Number(event.msg.match(/score\s+([0-9.]+)/i)?.[1] ?? 0)
  return {
    id: `SCADA-AUD-${String(index + 1).padStart(3, '0')}`,
    agentId: event.msg.split(' - ')[0]?.trim() || 'agent',
    severity,
    status: severity === 'Critical' || severity === 'High' ? 'Active' : 'Completed',
    triggerReason: event.type,
    anomalyScore: score,
    riskScore: score,
    description: event.msg,
    startTime: event.ts,
  }
}

export default function RapidScadaAuditsPage() {
  const { events, statusCounts } = useLiveTelemetry(3000)
  const records = events.filter(event => event.type.includes('AUDIT') || event.type.includes('ANOM') || event.type.includes('ATTACK')).map((event, index) => toAuditRecord(event, index))
  const [selected, setSelected] = useState<AuditRecord | null>(null)
  const selectedRecord = selected ?? records[0] ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Rapid SCADA Audit Trail</h1>
        <p className="text-sm text-slate-400 mt-1">Live SCADA audit decisions, evidence flow, and anomaly-triggered response records</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Total Audits" value={records.length} color="blue" icon={<Shield size={14} />} />
        <KPIStatCard label="Active" value={Number(statusCounts.underAudit ?? 0)} color="teal" icon={<Clock size={14} />} />
        <KPIStatCard label="Threats Found" value={Number(statusCounts.anomalous ?? 0) + Number(statusCounts.attacked ?? 0)} color="red" icon={<AlertTriangle size={14} />} />
        <KPIStatCard label="Resolved" value={events.filter(event => event.msg.toUpperCase().includes('MAINTAIN')).length} color="green" icon={<CheckCircle size={14} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 glass-card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50 text-sm font-semibold text-slate-200">Recent SCADA Audits</div>
          <div className="divide-y divide-slate-800/60">
            {records.map(record => (
              <button key={record.id} onClick={() => setSelected(record)} className={`w-full text-left p-4 hover:bg-slate-800/30 transition-colors ${selectedRecord?.id === record.id ? 'bg-cyber-blue/5 border-l-2 border-l-cyber-blue' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-cyber-blue">{record.id}</span>
                  <Badge variant={record.severity.toLowerCase() as any}>{record.severity}</Badge>
                </div>
                <div className="text-xs text-slate-300 mb-1">{record.agentId}</div>
                <div className="text-xs text-slate-500">{record.triggerReason}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 glass-card p-5 space-y-4">
          {!selectedRecord ? (
            <div className="text-sm text-slate-400">No live SCADA audit records yet.</div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-cyber-blue text-lg font-bold">{selectedRecord.id}</span>
                    <Badge variant={selectedRecord.severity.toLowerCase() as any}>{selectedRecord.severity}</Badge>
                    <Badge variant={selectedRecord.status === 'Active' ? 'auditing' : 'low'}>{selectedRecord.status}</Badge>
                  </div>
                  <div className="text-sm text-slate-400">Agent: <span className="text-slate-200 font-medium">{selectedRecord.agentId}</span></div>
                </div>
                <div className="text-right text-xs text-slate-500">Started: {selectedRecord.startTime}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-card p-3 border-cyber-red/20">
                  <div className="text-xs text-slate-500 mb-1">Anomaly Score</div>
                  <div className="text-xl font-bold font-mono text-cyber-red">{selectedRecord.anomalyScore.toFixed(3)}</div>
                </div>
                <div className="glass-card p-3 border-cyber-amber/20">
                  <div className="text-xs text-slate-500 mb-1">Risk Score</div>
                  <div className="text-xl font-bold font-mono text-cyber-amber">{selectedRecord.riskScore.toFixed(2)}</div>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Audit Summary</div>
                <p className="text-sm text-slate-300 leading-relaxed bg-grid-900/40 border border-slate-700/30 rounded-lg p-3">{selectedRecord.description}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
