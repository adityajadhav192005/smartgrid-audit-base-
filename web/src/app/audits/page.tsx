'use client'
import { useState } from 'react'
import { auditRecords } from '@/lib/mockData'
import { Badge, SeverityBadge } from '@/components/ui/Badge'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AuditsPage() {
  const [selected, setSelected] = useState(auditRecords[0])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Audit Intelligence</h1>
        <p className="text-sm text-slate-400 mt-1">Full audit record — triggers, evidence, and descriptions</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Total Audits"   value={218}   color="blue"   icon={<Shield size={14} />} />
        <KPIStatCard label="Active"         value={1}     color="teal"   icon={<Clock size={14} />} />
        <KPIStatCard label="Threats Found"  value={15}    color="red"    icon={<AlertTriangle size={14} />} />
        <KPIStatCard label="Resolved"       value={202}   color="green"  icon={<CheckCircle size={14} />} />
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Audit list */}
        <div className="lg:col-span-2 glass-card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50 text-sm font-semibold text-slate-200">Recent Audits</div>
          <div className="divide-y divide-slate-800/60">
            {auditRecords.map(a => (
              <button key={a.id} onClick={() => setSelected(a)}
                className={cn('w-full text-left p-4 hover:bg-slate-800/30 transition-colors',
                  selected.id === a.id && 'bg-cyber-blue/5 border-l-2 border-l-cyber-blue'
                )}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-cyber-blue">{a.id}</span>
                  <Badge variant={a.severity.toLowerCase() as any}>{a.severity}</Badge>
                </div>
                <div className="text-xs text-slate-300 mb-1">{a.agentId} — {a.agentType}</div>
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
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-cyber-blue text-lg font-bold">{selected.id}</span>
                <Badge variant={selected.severity.toLowerCase() as any}>{selected.severity}</Badge>
                <Badge variant={selected.status === 'Active' ? 'auditing' : 'low'} pulse={selected.status === 'Active'}>{selected.status}</Badge>
              </div>
              <div className="text-sm text-slate-400">Agent: <span className="text-slate-200 font-medium">{selected.agentId}</span> ({selected.agentType})</div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>Started: {selected.startTime}</div>
              {selected.endTime && <div>Ended: {selected.endTime}</div>}
            </div>
          </div>

          {/* Score grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card p-3 border-cyber-red/20">
              <div className="text-xs text-slate-500 mb-1">Anomaly Score</div>
              <div className="text-xl font-bold font-mono text-cyber-red">{selected.anomalyScore.toFixed(3)}</div>
            </div>
            <div className="glass-card p-3 border-cyber-amber/20">
              <div className="text-xs text-slate-500 mb-1">Risk Score</div>
              <div className="text-xl font-bold font-mono text-cyber-amber">{selected.riskScore.toFixed(2)}</div>
            </div>
            <div className="glass-card p-3 border-slate-700/40">
              <div className="text-xs text-slate-500 mb-1">Confidence</div>
              <div className="text-xl font-bold font-mono text-cyber-green">{(selected.confidence * 100).toFixed(0)}%</div>
            </div>
          </div>

          {/* Trigger condition */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Trigger Condition</div>
            <code className="block text-xs text-cyber-teal bg-grid-900/60 rounded-lg px-3 py-2 border border-cyber-teal/10">{selected.triggerCondition}</code>
          </div>

          {/* Suspected attack */}
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs text-slate-500 mb-1">Suspected Attack</div>
              <Badge variant="critical">{selected.suspectedAttack}</Badge>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Criticality Weight</div>
              <span className="text-cyber-amber font-mono font-bold">{selected.criticalityWeight.toFixed(1)}</span>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Linked Evidence</div>
              <div className="flex gap-1">
                {selected.linkedEvidence.map(e => (
                  <Badge key={e} variant="info">{e}</Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Full description */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">AI-Generated Audit Summary</div>
            <p className="text-sm text-slate-300 leading-relaxed bg-grid-900/40 border border-slate-700/30 rounded-lg p-3">{selected.description}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
