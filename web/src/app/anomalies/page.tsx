'use client'
import { anomalyTrend, radarData, topRiskyAgents } from '@/lib/mockData'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { AnomalyTrendChart, AgentRadarChart, SystemHealthAreaChart } from '@/components/charts'
import { Activity, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react'
import { formatPct } from '@/lib/utils'
import { ViewModeBanner } from '@/components/ui/ViewModeBanner'
import { useDashboard } from '@/lib/dashboardContext'
import { useLatestRun } from '@/lib/latestRun'

export default function AnomaliesPage() {
  const { viewMode, scadaConnected } = useDashboard()
  const { latestRun } = useLatestRun(12000)
  const scadaBlocked = viewMode === 'scada' && !scadaConnected

  const activeAnomalies = latestRun?.activeIncidents ?? 9
  const avgAnomaly = latestRun?.f1 ? (latestRun.f1 + latestRun.precision + latestRun.recall) / 3 : 0.72
  const crossLayerStability = latestRun?.crossLayerStability ?? 0.871
  const baselineDrift = latestRun?.f1 ? Math.max(0.001, 1 - latestRun.f1) / 100 : 0.0082

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Anomaly &amp; Risk Analytics</h1>
        <p className="text-sm text-slate-400 mt-1">Deviation trends, risk scores, and cross-layer stability</p>
      </div>

      <ViewModeBanner section="Anomaly & Risk" />

      {scadaBlocked && (
        <div className="glass-card p-5 border border-amber-500/30 text-amber-200 text-sm">
          Rapid SCADA view is selected, but SCADA is disconnected. Connect SCADA Live to enable this mode.
        </div>
      )}

      {!scadaBlocked && (
      <>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Active Anomalies"    value={activeAnomalies}                         color="red"    icon={<AlertTriangle size={14} />} />
        <KPIStatCard label="Avg Anomaly Score"   value={avgAnomaly.toFixed(3)}                   color="amber"  icon={<Activity size={14} />} />
        <KPIStatCard label="Cross-Layer Stab."   value={formatPct(crossLayerStability, 1)}       color="blue"   icon={<TrendingDown size={14} />} />
        <KPIStatCard label="Baseline Drift"      value={baselineDrift.toFixed(4)}                color="teal"   icon={<TrendingUp size={14} />} sub="Q-delta" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Anomaly Score Trend — 24h</h3>
          <div className="h-48"><AnomalyTrendChart data={anomalyTrend} /></div>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Audit &amp; Attack Event Volume</h3>
          <div className="h-48"><SystemHealthAreaChart data={anomalyTrend} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Layer Health Radar</h3>
          <div className="h-52"><AgentRadarChart data={radarData} /></div>
        </div>
        <div className="glass-card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Top Anomalous Agents — Deviation Detail</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/50">
                {['Agent', 'Type', 'Anomaly Score', 'Risk Score', 'Attack Type', '# Audits'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topRiskyAgents.map(a => (
                <tr key={a.id} className="data-table-row border-b border-slate-800/40">
                  <td className="py-1.5 pr-4 font-mono text-cyber-blue">{a.id}</td>
                  <td className="py-1.5 pr-4 text-slate-400">{a.type}</td>
                  <td className="py-1.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-slate-700/60">
                        <div className="h-full rounded-full" style={{ width: `${Math.min((a.anomalyScore / 1.8) * 100, 100)}%`, background: a.anomalyScore > 1.2 ? '#ff3860' : a.anomalyScore > 1.0 ? '#ffb700' : '#00d4ff' }} />
                      </div>
                      <span className="font-mono text-slate-300">{a.anomalyScore.toFixed(3)}</span>
                    </div>
                  </td>
                  <td className="py-1.5 pr-4 font-mono text-slate-400">{a.riskScore.toFixed(2)}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{a.attack !== '-' ? a.attack : '—'}</td>
                  <td className="py-1.5 text-slate-400">{a.auditCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adaptive baseline recap */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Adaptive Baseline & Threshold Parameters</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          {[
            { param: 'α_high (anomaly)',     value: '0.7', desc: 'Rapid baseline adaptation during anomaly' },
            { param: 'α_low (stable)',        value: '0.01', desc: 'Slow drift for stable conditions'       },
            { param: 'β adjustment factor',   value: '0.12', desc: 'Threshold adjustment rate'              },
            { param: 'Threshold scale k',     value: '2.0',  desc: 'σ multiplier for Th_ij'                },
          ].map(p => (
            <div key={p.param} className="glass-card p-3 border-slate-700/30">
              <div className="font-mono text-cyber-teal text-base font-bold">{p.value}</div>
              <div className="text-slate-300 mt-1 font-medium">{p.param}</div>
              <div className="text-slate-500 mt-0.5">{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  )
}
