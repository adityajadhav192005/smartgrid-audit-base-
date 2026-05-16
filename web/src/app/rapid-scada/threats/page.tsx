'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { AttackBarChart, AttackTypePie } from '@/components/charts'
import { AlertTriangle, Zap, Shield, Activity } from 'lucide-react'
import { useLiveTelemetry } from '@/lib/liveTelemetry'

type AttackRecord = {
  id: string
  type: string
  startTime: string
  targetAgent: string
  severity: string
  status: string
  impact: string
}

function toAttackRecord(event: { id: string; ts: string; type: string; msg: string; severity: string }, index: number): AttackRecord {
  const severity = event.severity ? `${event.severity.charAt(0).toUpperCase()}${event.severity.slice(1)}` : 'Info'
  return {
    id: `SCADA-ATK-${String(index + 1).padStart(3, '0')}`,
    type: event.type,
    startTime: event.ts,
    targetAgent: event.msg.split(' - ')[0]?.trim() || 'agent',
    severity,
    status: severity === 'Critical' || severity === 'High' ? 'Confirmed' : 'Observed',
    impact: event.msg,
  }
}

export default function RapidScadaThreatsPage() {
  const { events, trend, attackTypeDistribution } = useLiveTelemetry(3000)
  const attackEvents = events.map((event, index) => toAttackRecord(event, index))
  const [selected, setSelected] = useState<AttackRecord | null>(null)
  const selectedAttack = selected ?? attackEvents[0] ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Rapid SCADA Threat Events</h1>
        <p className="text-sm text-slate-500 mt-1">Live SCADA-backed events, anomalies, and audit-triggered attack observations</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Identified" value={attackEvents.length} color="red" icon={<AlertTriangle size={14} />} />
        <KPIStatCard label="Audits Triggered" value={events.filter(event => event.type.includes('AUDIT')).length} color="blue" icon={<Activity size={14} />} />
        <KPIStatCard label="Detected" value={events.filter(event => event.type.includes('ATTACK') || event.type.includes('ANOM')).length} color="amber" icon={<Zap size={14} />} />
        <KPIStatCard label="Resolved" value={events.filter(event => event.msg.toUpperCase().includes('MAINTAIN')).length} color="green" icon={<Shield size={14} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Live Event Timeline</h3>
          <div className="h-44"><AttackBarChart data={trend} /></div>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Event Type Distribution</h3>
          <div className="h-44"><AttackTypePie data={attackTypeDistribution.length ? attackTypeDistribution : [{ name: 'EVENT', value: 1, color: '#00d4ff' }]} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 glass-card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-800">Live SCADA Events</div>
          <div className="divide-y divide-slate-800/60">
            {attackEvents.map(record => (
              <button key={record.id} onClick={() => setSelected(record)} className={`w-full text-left p-4 hover:bg-slate-100 transition-colors ${selectedAttack?.id === record.id ? 'bg-cyber-red/5 border-l-2 border-l-cyber-red' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-cyber-red">{record.id}</span>
                  <Badge variant={record.severity.toLowerCase() as any}>{record.severity}</Badge>
                </div>
                <div className="text-xs text-slate-700 mb-1">{record.type}</div>
                <div className="text-xs text-slate-500">{record.targetAgent}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 glass-card p-5 space-y-4">
          {!selectedAttack ? (
            <div className="text-sm text-slate-500">No live SCADA threat events yet.</div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-cyber-red text-lg font-bold">{selectedAttack.id}</span>
                    <Badge variant={selectedAttack.severity.toLowerCase() as any}>{selectedAttack.severity}</Badge>
                    <Badge variant={selectedAttack.status === 'Confirmed' ? 'critical' : 'low'}>{selectedAttack.status}</Badge>
                  </div>
                  <div className="text-base font-semibold text-slate-800">{selectedAttack.type}</div>
                </div>
                <div className="text-right text-xs text-slate-500">Started: {selectedAttack.startTime}</div>
              </div>
              <div className="glass-card p-3 border-cyber-red/20">
                <div className="text-xs text-slate-500 mb-1">Target Agent</div>
                <div className="text-sm font-semibold text-slate-800">{selectedAttack.targetAgent}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Impact Assessment</div>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3">{selectedAttack.impact}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
