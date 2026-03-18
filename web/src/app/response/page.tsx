'use client'
import { recentEvents } from '@/lib/mockData'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Badge } from '@/components/ui/Badge'
import { Shield, Zap, Clock, CheckCircle } from 'lucide-react'
import { ViewModeBanner } from '@/components/ui/ViewModeBanner'
import { useDashboard } from '@/lib/dashboardContext'
import { useLatestRun } from '@/lib/latestRun'
import { formatPct } from '@/lib/utils'

const responseSteps = [
  { step: 1, action: 'Anomaly Detected', icon: '🔍', detail: 'S(GEN-04) = 1.42 > threshold 1.0', time: '14:20:00', done: true  },
  { step: 2, action: 'Audit Triggered',  icon: '📋', detail: 'AUD-218 created — high priority, w=1.0', time: '14:21:55', done: true  },
  { step: 3, action: 'Agent Classified', icon: '🏷️', detail: 'Severity = Critical, attack = FDI', time: '14:22:01', done: true  },
  { step: 4, action: 'Mitigation Action', icon: '🛡️', detail: 'Operator notified; isolation prepared', time: '14:22:11', done: true  },
  { step: 5, action: 'Baseline Updated', icon: '📐', detail: 'α_high=0.7 applied; Th refined', time: '14:22:15', done: false },
  { step: 6, action: 'RL Policy Update', icon: '🤖', detail: 'Q-value update; next audit schedule adapted', time: 'Pending', done: false },
]

export default function ResponsePage() {
  const { viewMode, scadaConnected } = useDashboard()
  const { latestRun } = useLatestRun(12000)
  const scadaBlocked = viewMode === 'scada' && !scadaConnected

  const riskMitigation = latestRun?.riskMitigation ?? 0.712
  const avgResponseSeconds = latestRun?.avgResponseSeconds || 12
  const threatsResolved = latestRun?.attacksResolved ?? 14
  const activeIncidents = latestRun?.activeIncidents ?? 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Response &amp; Mitigation</h1>
        <p className="text-sm text-slate-400 mt-1">Automated response pipeline, mitigation actions, and feedback loops</p>
      </div>

      <ViewModeBanner section="Response & Mitigation" />

      {scadaBlocked && (
        <div className="glass-card p-5 border border-amber-500/30 text-amber-200 text-sm">
          Rapid SCADA view is selected, but SCADA is disconnected. Connect SCADA Live to enable this mode.
        </div>
      )}

      {!scadaBlocked && (
      <>

      {latestRun && (
        <div className="glass-card p-3 border-cyber-blue/20 text-xs text-slate-300">
          Latest run verification: <span className="font-mono text-cyber-blue">{latestRun.runId ?? 'n/a'}</span> · response window {avgResponseSeconds.toFixed(1)}s
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Risk Mitigation"  value={formatPct(riskMitigation, 1)} color="green"  icon={<Shield size={14} />} />
        <KPIStatCard label="Avg Response Time" value={`${avgResponseSeconds.toFixed(1)}s`} color="teal"   icon={<Clock size={14} />}  />
        <KPIStatCard label="Threats Resolved" value={threatsResolved} color="green"  icon={<CheckCircle size={14} />} />
        <KPIStatCard label="Active Incidents"  value={activeIncidents} color="red"    icon={<Zap size={14} />}    />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Response pipeline */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Response Pipeline — GEN-04 Incident</h3>
          <div className="space-y-3">
            {responseSteps.map((s, i) => (
              <div key={s.step} className={`flex gap-3 text-xs ${s.done ? '' : 'opacity-40'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold
                  ${s.done ? 'bg-cyber-green/20 border border-cyber-green/40 text-cyber-green' : 'bg-slate-800 border border-slate-700 text-slate-500'}`}>
                  {s.done ? '✓' : s.step}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">{s.icon} {s.action}</span>
                    <span className="text-slate-600">{s.time}</span>
                  </div>
                  <div className="text-slate-500 mt-0.5">{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Severity response matrix */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Mitigation Response Matrix</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/50">
                <th className="text-left py-2 pr-4 font-medium">Severity</th>
                <th className="text-left py-2 pr-4 font-medium">Se_i Range</th>
                <th className="text-left py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {[
                { sev: 'Low',      range: '0.0 — 0.25', action: 'Log anomaly; monitor agent',           color: 'text-cyber-green' },
                { sev: 'Medium',   range: '0.25 — 0.5', action: 'Increase audit frequency',             color: 'text-cyber-amber' },
                { sev: 'High',     range: '0.5 — 0.75', action: 'Isolate agent; notify operator',       color: 'text-orange-400'  },
                { sev: 'Critical', range: '> 0.75',     action: 'Emergency shutdown; full audit chain', color: 'text-cyber-red'   },
              ].map(r => (
                <tr key={r.sev} className="data-table-row border-b border-slate-800/40">
                  <td className={`py-2 pr-4 font-semibold ${r.color}`}>{r.sev}</td>
                  <td className="py-2 pr-4 font-mono text-slate-400">{r.range}</td>
                  <td className="py-2 text-slate-300">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mt-3">Se_i = w_impact × Impact_Factor + w_likelihood × Likelihood_i</p>
        </div>
      </div>

      {/* Recent response log */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Response Event Log</h3>
        <div className="space-y-2">
          {recentEvents.filter(e => ['RESPONSE','ANOMALY','ATTACK','AUDIT'].includes(e.type)).map(ev => (
            <div key={ev.id} className="flex gap-3 text-xs py-1.5 border-b border-slate-800/40">
              <span className="text-slate-600 font-mono w-16 shrink-0">{ev.ts}</span>
              <Badge variant={ev.type === 'ATTACK' || ev.type === 'ANOMALY' ? 'critical' : ev.type === 'AUDIT' ? 'info' : 'high'}>
                {ev.type}
              </Badge>
              <span className="text-slate-400">{ev.msg}</span>
            </div>
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  )
}
