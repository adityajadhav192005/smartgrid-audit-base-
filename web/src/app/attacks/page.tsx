'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { AttackBarChart, AttackTypePie } from '@/components/charts'
import { AlertTriangle, Zap, Shield, Activity } from 'lucide-react'
import { ViewModeBanner } from '@/components/ui/ViewModeBanner'
import { useExperimentTelemetry } from '@/lib/experimentTelemetry'
import { useDashboard } from '@/lib/dashboardContext'

type AttackRecord = {
  id: string
  type: string
  startTime: string
  duration: string
  targetAgents: string[]
  affectedLayer: string
  severity: string
  detectionTime: string
  status: string
  anomalies: string[]
  audits: string[]
  impact: string
  confidence: number
}

function toAttackRecord(event: { id: string; ts: string; type: string; msg: string; severity: string }, index: number): AttackRecord {
  const severity = event.severity ? `${event.severity.charAt(0).toUpperCase()}${event.severity.slice(1)}` : 'Info'
  const targetAgent = event.msg.split('Â·')[0]?.trim() || 'agent'
  return {
    id: `ATK-${String(index + 1).padStart(3, '0')}`,
    type: event.type,
    startTime: event.ts,
    duration: 'live',
    targetAgents: [targetAgent],
    affectedLayer: event.type.includes('AUDIT') ? 'Cyber' : 'Physical + Cyber',
    severity,
    detectionTime: event.ts,
    status: severity === 'Critical' || severity === 'High' ? 'Confirmed' : 'Observed',
    anomalies: [event.id],
    audits: event.type.includes('AUDIT') ? [event.id] : [],
    impact: event.msg,
    confidence: severity === 'Critical' ? 0.95 : severity === 'High' ? 0.85 : 0.7,
  }
}

export default function AttacksPage() {
  const { searchQuery } = useDashboard()
  const { events, trend, attackTypeDistribution, summary } = useExperimentTelemetry(8000)
  const attackEvents = events.map((event, index) => toAttackRecord(event, index))
  const [selected, setSelected] = useState<AttackRecord | null>(null)

  const visibleAttacks = attackEvents.filter(atk => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return `${atk.id} ${atk.type} ${atk.status} ${atk.affectedLayer} ${atk.targetAgents.join(' ')}`.toLowerCase().includes(q)
  })

  const fallbackPriority = {
    critical: attackEvents.filter(a => a.severity.toLowerCase() === 'critical').length,
    high: attackEvents.filter(a => a.severity.toLowerCase() === 'high').length,
    medium: attackEvents.filter(a => a.severity.toLowerCase() === 'medium').length,
    low: attackEvents.filter(a => a.severity.toLowerCase() === 'low').length,
  }

  const attacksIdentified = attackEvents.length
  const auditsTriggered = attackEvents.reduce((acc, item) => acc + item.audits.length, 0)
  const attacksDetected = attackEvents.length
  const attacksResolved = Math.max(0, Math.round((Number(summary?.riskMitigation ?? 0)) * attackEvents.length))
  const priority = fallbackPriority
  const attackPieData = attackTypeDistribution.length
    ? attackTypeDistribution.map((item, index) => ({
        ...item,
        color: ['#ff3860', '#ffb700', '#bd00ff', '#00d4ff', '#10b981'][index % 5],
      }))
    : [{ name: 'EVENT', value: 1, color: '#00d4ff' }]

  const selectedAttack = selected ?? visibleAttacks[0] ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Threat Events</h1>
        <p className="text-sm text-slate-500 mt-1">Confirmed and suspected attack events — detection, taxonomy, and impact</p>
      </div>

      <ViewModeBanner section="Threat Events" mode="experiment" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Identified"        value={attacksIdentified} color="red"   icon={<AlertTriangle size={14} />} />
        <KPIStatCard label="Audits Triggered"  value={auditsTriggered}   color="blue"  icon={<Activity size={14} />} />
        <KPIStatCard label="Detected"          value={attacksDetected}   color="amber" icon={<Zap size={14} />} />
        <KPIStatCard label="Resolved"          value={attacksResolved}   color="green" icon={<Shield size={14} />} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Priority Critical" value={priority.critical} color="red" />
        <KPIStatCard label="Priority High"     value={priority.high}     color="amber" />
        <KPIStatCard label="Priority Medium"   value={priority.medium}   color="blue" />
        <KPIStatCard label="Priority Low"      value={priority.low}      color="green" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Attack Events Timeline — 24h</h3>
          <div className="h-44"><AttackBarChart data={trend} /></div>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Attack Type Distribution</h3>
          <div className="h-44"><AttackTypePie data={attackPieData} /></div>
        </div>
      </div>

      {/* Attack list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 glass-card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-800">Attack Events</div>
          <div className="divide-y divide-slate-800/60">
            {visibleAttacks.map(atk => (
              <button key={atk.id} onClick={() => setSelected(atk)}
                className={`w-full text-left p-4 hover:bg-slate-100 transition-colors ${selectedAttack?.id === atk.id ? 'bg-cyber-red/5 border-l-2 border-l-cyber-red' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-cyber-red">{atk.id}</span>
                  <Badge variant={atk.severity.toLowerCase() as any}>{atk.severity}</Badge>
                </div>
                <div className="text-xs text-slate-700 mb-1">{atk.type}</div>
                <div className="text-xs text-slate-500">{atk.targetAgents.join(', ')} — {atk.affectedLayer}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge variant={atk.status === 'Confirmed' ? 'critical' : 'low'}>{atk.status}</Badge>
                  <span className="text-xs text-slate-600">{atk.startTime}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 glass-card p-5 space-y-4">
          {!selectedAttack && (
            <div className="text-sm text-slate-500">No live attack events yet. Waiting for blockchain-backed telemetry...</div>
          )}
          {selectedAttack && (
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
            <div className="text-right text-xs text-slate-500">
              <div>Started: {selectedAttack.startTime}</div>
              <div>Duration: {selectedAttack.duration}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-3 border-cyber-red/20">
              <div className="text-xs text-slate-500 mb-1">Affected Layer</div>
              <div className="text-sm font-semibold text-slate-800">{selectedAttack.affectedLayer}</div>
            </div>
            <div className="glass-card p-3 border-cyber-green/20">
              <div className="text-xs text-slate-500 mb-1">Detection Confidence</div>
              <div className="text-sm font-bold font-mono text-cyber-green">{(selectedAttack.confidence * 100).toFixed(0)}%</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Target Agents</div>
            <div className="flex flex-wrap gap-2">
              {selectedAttack.targetAgents.map(a => (
                <span key={a} className="font-mono text-xs px-2 py-1 rounded-lg bg-cyber-red/10 border border-cyber-red/20 text-cyber-red">{a}</span>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Impact Assessment</div>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3">{selectedAttack.impact}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Linked Anomalies</div>
              <div className="flex flex-wrap gap-1">{selectedAttack.anomalies.map(x => <Badge key={x} variant="high">{x}</Badge>)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Linked Audits</div>
              <div className="flex flex-wrap gap-1">{selectedAttack.audits.map(x => <Badge key={x} variant="info">{x}</Badge>)}</div>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
