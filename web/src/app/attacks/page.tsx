'use client'
import { useState } from 'react'
import { attackEvents, anomalyTrend } from '@/lib/mockData'
import { Badge, SeverityBadge } from '@/components/ui/Badge'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { AttackBarChart, AttackTypePie } from '@/components/charts'
import { attackTypeDistribution } from '@/lib/mockData'
import { AlertTriangle, Zap, Shield, Activity } from 'lucide-react'

export default function AttacksPage() {
  const [selected, setSelected] = useState(attackEvents[0])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Attack Analysis</h1>
        <p className="text-sm text-slate-400 mt-1">Confirmed and suspected attack events — detection, taxonomy, and impact</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Attacks Detected"  value={5}   color="red"    icon={<Zap size={14} />} />
        <KPIStatCard label="Confirmed"          value={3}   color="red"    />
        <KPIStatCard label="Mitigated"          value={2}   color="green"  icon={<Shield size={14} />} />
        <KPIStatCard label="Agents Impacted"    value={7}   color="amber"  icon={<AlertTriangle size={14} />} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Attack Events Timeline — 24h</h3>
          <div className="h-44"><AttackBarChart data={anomalyTrend} /></div>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Attack Type Distribution</h3>
          <div className="h-44"><AttackTypePie data={attackTypeDistribution} /></div>
        </div>
      </div>

      {/* Attack list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 glass-card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50 text-sm font-semibold text-slate-200">Attack Events</div>
          <div className="divide-y divide-slate-800/60">
            {attackEvents.map(atk => (
              <button key={atk.id} onClick={() => setSelected(atk)}
                className={`w-full text-left p-4 hover:bg-slate-800/30 transition-colors ${selected.id === atk.id ? 'bg-cyber-red/5 border-l-2 border-l-cyber-red' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-cyber-red">{atk.id}</span>
                  <Badge variant={atk.severity.toLowerCase() as any}>{atk.severity}</Badge>
                </div>
                <div className="text-xs text-slate-300 mb-1">{atk.type}</div>
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
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-cyber-red text-lg font-bold">{selected.id}</span>
                <Badge variant={selected.severity.toLowerCase() as any}>{selected.severity}</Badge>
                <Badge variant={selected.status === 'Confirmed' ? 'critical' : 'low'}>{selected.status}</Badge>
              </div>
              <div className="text-base font-semibold text-slate-200">{selected.type}</div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>Started: {selected.startTime}</div>
              <div>Duration: {selected.duration}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-3 border-cyber-red/20">
              <div className="text-xs text-slate-500 mb-1">Affected Layer</div>
              <div className="text-sm font-semibold text-slate-200">{selected.affectedLayer}</div>
            </div>
            <div className="glass-card p-3 border-cyber-green/20">
              <div className="text-xs text-slate-500 mb-1">Detection Confidence</div>
              <div className="text-sm font-bold font-mono text-cyber-green">{(selected.confidence * 100).toFixed(0)}%</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Target Agents</div>
            <div className="flex flex-wrap gap-2">
              {selected.targetAgents.map(a => (
                <span key={a} className="font-mono text-xs px-2 py-1 rounded-lg bg-cyber-red/10 border border-cyber-red/20 text-cyber-red">{a}</span>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Impact Assessment</div>
            <p className="text-sm text-slate-300 leading-relaxed bg-grid-900/40 border border-slate-700/30 rounded-lg p-3">{selected.impact}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Linked Anomalies</div>
              <div className="flex flex-wrap gap-1">{selected.anomalies.map(x => <Badge key={x} variant="high">{x}</Badge>)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Linked Audits</div>
              <div className="flex flex-wrap gap-1">{selected.audits.map(x => <Badge key={x} variant="info">{x}</Badge>)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
