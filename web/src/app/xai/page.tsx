'use client'
import { xaiExplanations } from '@/lib/mockData'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Badge } from '@/components/ui/Badge'
import { FeatureImportanceChart } from '@/components/charts'
import { Cpu, BarChart2, CheckCircle, Zap } from 'lucide-react'
import { ViewModeBanner } from '@/components/ui/ViewModeBanner'
import { useDashboard } from '@/lib/dashboardContext'
import { useLatestRun } from '@/lib/latestRun'

export default function XAIPage() {
  const { viewMode, scadaConnected } = useDashboard()
  const { latestRun } = useLatestRun(12000)
  const xai = xaiExplanations[0]
  const scadaBlocked = viewMode === 'scada' && !scadaConnected

  const explanationCount = latestRun?.auditsTriggered ?? 218
  const xaiConfidence = latestRun?.detectionAccuracy ?? xai.confidence

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Explainability (XAI)</h1>
        <p className="text-sm text-slate-400 mt-1">SHAP-style feature attribution and model decision audit trail</p>
      </div>

      <ViewModeBanner section="Explainability (XAI)" />

      {scadaBlocked && (
        <div className="glass-card p-5 border border-amber-500/30 text-amber-200 text-sm">
          Rapid SCADA view is selected, but SCADA is disconnected. Connect SCADA Live to enable this mode.
        </div>
      )}

      {!scadaBlocked && (
      <>

      {latestRun && (
        <div className="glass-card p-3 border-cyber-blue/20 text-xs text-slate-300">
          Latest run verification: <span className="font-mono text-cyber-blue">{latestRun.runId ?? 'n/a'}</span> · detection {Math.round(xaiConfidence * 100)}%
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Model Version"      value="LSTM-v2.1"  color="blue"   icon={<Cpu size={14} />}      />
        <KPIStatCard label="Explanations"        value={explanationCount} color="teal"   icon={<BarChart2 size={14} />} />
        <KPIStatCard label="Top Agent"           value={xai.agentId} color="red"  icon={<Zap size={14} />}      />
        <KPIStatCard label="XAI Confidence"      value={`${(xaiConfidence * 100).toFixed(0)}%`} color="green" icon={<CheckCircle size={14} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Feature chart */}
        <div className="glass-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200">Feature Importance — {xai.agentId}</h3>
            <Badge variant="info">{xai.modelVersion}</Badge>
          </div>
          <div className="h-56"><FeatureImportanceChart data={xai.topFeatures} /></div>
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded bg-cyber-red inline-block" /> Positive contribution (pushes above threshold)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded bg-cyber-blue inline-block" /> Negative contribution (normalising)
            </span>
          </div>
        </div>

        {/* Narrative */}
        <div className="glass-card p-4 flex flex-col gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">AI Narrative</div>
            <p className="text-sm text-slate-300 leading-relaxed">{xai.narrative}</p>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Anomaly Score</div>
            <div className="text-3xl font-bold font-mono text-cyber-red">{xai.anomalyScore.toFixed(3)}</div>
            <div className="text-xs text-slate-500 mt-0.5">Score &gt; 1.0 → anomalous (threshold = Th_ij = k·σ)</div>
          </div>
        </div>
      </div>

      {/* Feature table */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Feature Attribution Detail</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-slate-700/50">
              {['Feature', 'Importance', 'Direction', 'Observed Value', 'Nominal', '% Deviation'].map(h => (
                <th key={h} className="text-left py-2 pr-6 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {xai.topFeatures.map(f => {
              const dev = ((f.value - f.nominal) / f.nominal * 100)
              return (
                <tr key={f.feature} className="data-table-row border-b border-slate-800/40">
                  <td className="py-2 pr-6 font-mono text-cyber-blue">{f.feature}</td>
                  <td className="py-2 pr-6">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-slate-700/60">
                        <div className="h-full rounded-full bg-cyber-amber" style={{ width: `${f.importance * 100}%` }} />
                      </div>
                      <span className="text-slate-300">{(f.importance * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="py-2 pr-6">
                    <Badge variant={f.direction === 'positive' ? 'critical' : 'info'}>{f.direction}</Badge>
                  </td>
                  <td className="py-2 pr-6 font-mono text-slate-300">{f.value.toFixed(3)}</td>
                  <td className="py-2 pr-6 font-mono text-slate-500">{f.nominal.toFixed(3)}</td>
                  <td className="py-2 font-mono" style={{ color: dev > 0 ? '#ff3860' : '#00d4ff' }}>
                    {dev > 0 ? '+' : ''}{dev.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  )
}
