'use client'

import { Badge } from '@/components/ui/Badge'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Brain, SlidersHorizontal, Shield, Sigma, Layers, Cpu, Hash, GitMerge, Activity } from 'lucide-react'
import { useExperimentTelemetry } from '@/lib/experimentTelemetry'
import { PerAttackBarChart } from '@/components/charts'

const DETECTION_LAYERS = [
  {
    label: 'Layer 1 - Deviation Scoring',
    icon: SlidersHorizontal,
    color: 'text-cyan-400',
    formula: 's_i = sqrt( Sigma_j w_j * ((x_j - b_j) / theta_j)^2 )',
    desc: 'Paper Eq. (9). Statistical drift from baseline normalised by per-metric thresholds. Adaptive theta is sigma-floored (k=3.5/4.0/5.0 per profile) and the baseline auto-corrects for slow drift via EWMA (alpha=0.30).',
  },
  {
    label: 'Layer 2 - LSTM Dual-Branch',
    icon: Cpu,
    color: 'text-purple-400',
    formula: 'p_fused = w_g*p_grid + w_n*p_net + agreement_bonus',
    desc: 'Two PyTorch LSTMs in parallel: Branch-1 on physical metrics (V, I, f, P), Branch-2 on cyber metrics (latency, loss, integrity, freq). Decision-level fusion with agreement bonus.',
  },
  {
    label: 'Layer 3 - Cryptographic Integrity',
    icon: Hash,
    color: 'text-amber-400',
    formula: 'CRC32(payload) + H_entropy(window)',
    desc: 'CRC32 checksums + hash entropy + cross-field correlation. Catches stealthy FDI/MITM attacks crafted to evade statistical scoring.',
  },
  {
    label: 'Layer 4 - 2-of-3 Voting Ensemble',
    icon: GitMerge,
    color: 'text-emerald-400',
    formula: 'flag = (1[s>theta_dev] + 1[p>theta_lstm] + 1[integrity_low]) >= 2',
    desc: 'Unified detector flags an agent when any 2 of the 3 modalities agree, balancing recall against false alarm rate.',
  },
  {
    label: 'Layer 5 - Tier-A FP Suppression',
    icon: Shield,
    color: 'text-rose-400',
    formula: 'suppress if score_ratio<3.5 AND no_signature AND p_lstm<0.6 AND p_net<0.55',
    desc: 'Final-stage gate that demotes flags whose deviation is marginal AND whose corroborating evidence is weak (no signature firing, both ML branches uncertain). Preserves 100% recall; drops FPR by 1.6x. Augmented by step/ramp/oscillation temporal signatures (Gemini #3).',
  },
]

const ATTACK_ORDER = ['FDI', 'DOS', 'MITM', 'CHAIN', 'FAULT']

const PROFILE_DESCRIPTIONS: Record<string, string> = {
  ROBUST: 'Security-first - heavier penalty on missed attacks, accepts higher audit cost.',
  BALANCED: 'Mid-point trade-off between detection coverage and operational cost.',
  COST: 'Cost-first - minimise audit spend, accepts higher false-negative risk.',
}

function formatPValue(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return 'n/a'
  if (p < 0.001) return 'p < 0.001'
  if (p < 0.01) return `p = ${p.toFixed(4)}`
  return `p = ${p.toFixed(3)}`
}

function formatTestName(test: string): string {
  if (!test) return 'unknown'
  return test
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export default function ExperimentMethodologyPage() {
  const { summary } = useExperimentTelemetry(8000)
  const threshold = Number(summary?.scoreThreshold ?? 0.5)
  const profile = String(summary?.optimizationProfile ?? 'ROBUST').toUpperCase()
  const ablation = String(summary?.ablationMode ?? 'HYBRID').toUpperCase()
  const accuracy = Number(summary?.detectionAccuracy ?? 0)
  const f1 = Number(summary?.f1 ?? 0)
  const fpr = Number(summary?.fpr ?? 0)
  const tpr = Number(summary?.tpr ?? 0)

  const perAttack = summary?.perAttackMetrics ?? {}
  const perAttackRows = ATTACK_ORDER
    .filter(name => perAttack[name])
    .map(name => ({
      name,
      tpr: Number(perAttack[name]?.tpr ?? 0),
      fnr: Number(perAttack[name]?.fnr ?? 0),
      fpr: Number(perAttack[name]?.fpr ?? 0),
      accuracy: Number(perAttack[name]?.accuracy ?? 0),
      support: Number(perAttack[name]?.support ?? 0),
      predicted: Number(perAttack[name]?.predictedSupport ?? 0),
    }))

  const statTests = summary?.statisticalTests ?? {}
  const convergence = summary?.convergence
  const attackTyping = summary?.attackTyping

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Methodology - Detection Architecture</h1>
        <p className="text-sm text-slate-400 mt-1">
          Five-layer hybrid detection pipeline plus RL+Gradient audit scheduling. Ablation: <span className="text-cyber-blue font-mono">{ablation}</span>, profile: <span className="text-cyber-blue font-mono">{profile}</span>.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Risk Threshold" value={threshold.toFixed(2)} color="amber" icon={<SlidersHorizontal size={14} />} />
        <KPIStatCard label="Accuracy" value={`${(accuracy * 100).toFixed(1)}%`} color="green" icon={<Brain size={14} />} />
        <KPIStatCard label="F1 / TPR" value={`${(f1 * 100).toFixed(1)}% / ${(tpr * 100).toFixed(1)}%`} color="teal" icon={<Sigma size={14} />} />
        <KPIStatCard label="FPR" value={`${(fpr * 100).toFixed(2)}%`} color="red" icon={<Shield size={14} />} />
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyber-blue" />
            Five-Layer Detection Pipeline
          </h3>
          <Badge variant="info">Hybrid Ensemble</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {DETECTION_LAYERS.map(layer => {
            const Icon = layer.icon
            return (
              <div key={layer.label} className="glass-card p-3 border-slate-700/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className={`w-4 h-4 ${layer.color}`} />
                  <span className="text-xs font-semibold text-slate-200">{layer.label}</span>
                </div>
                <div className="font-mono text-[11px] text-cyber-blue mb-1.5 break-all">{layer.formula}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{layer.desc}</div>
              </div>
            )
          })}
        </div>
      </div>

      {perAttackRows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass-card p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200">Per-Attack-Type Detection (TPR / FNR / FPR)</h3>
              <Badge variant="info">vs Base Paper aggregate-only</Badge>
            </div>
            <div className="h-64"><PerAttackBarChart data={perAttackRows} /></div>
          </div>
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Attack Typing</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Typing Accuracy</span>
                <span className="font-mono text-slate-200">{((attackTyping?.typingAccuracy ?? 0) * 100).toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Macro TPR</span>
                <span className="font-mono text-slate-200">{((attackTyping?.macroTpr ?? 0) * 100).toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Macro FPR</span>
                <span className="font-mono text-slate-200">{((attackTyping?.macroFpr ?? 0) * 100).toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Positive Support</span>
                <span className="font-mono text-slate-200">{attackTyping?.positiveSupport ?? 0}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700/40 text-[11px] text-slate-500 leading-relaxed">
              Attack family classifier (DOS / MITM / NETWORK) operates on Branch-2 cyber metrics and UNSW-NB15 priors. The base paper does not classify attack family, only flags anomalous/not.
            </div>
          </div>
        </div>
      )}

      {perAttackRows.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Per-Attack Confusion Detail</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/50">
                {['Attack Type', 'TPR', 'FNR', 'FPR', 'Accuracy', 'Truth', 'Predicted'].map(h => (
                  <th key={h} className="text-left py-2 pr-6 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perAttackRows.map(row => (
                <tr key={row.name} className="data-table-row border-b border-slate-800/40">
                  <td className="py-2 pr-6 font-mono text-cyber-blue">{row.name}</td>
                  <td className="py-2 pr-6 font-mono text-emerald-400">{(row.tpr * 100).toFixed(1)}%</td>
                  <td className="py-2 pr-6 font-mono text-red-400">{(row.fnr * 100).toFixed(1)}%</td>
                  <td className="py-2 pr-6 font-mono text-amber-400">{(row.fpr * 100).toFixed(2)}%</td>
                  <td className="py-2 pr-6 font-mono text-slate-300">{(row.accuracy * 100).toFixed(1)}%</td>
                  <td className="py-2 pr-6 font-mono text-slate-500">{row.support}</td>
                  <td className="py-2 pr-6 font-mono text-slate-500">{row.predicted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200">Statistical Significance</h3>
            <Badge variant="healthy">Paired tests vs fixed baseline</Badge>
          </div>
          {Object.keys(statTests).length === 0 ? (
            <div className="text-xs text-slate-500">No paired-test results available for this run.</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(statTests).map(([key, val]) => {
                const sig = Boolean(val.significant)
                const pStr = formatPValue(val.pValue)
                return (
                  <div key={key} className="glass-card p-3 border-slate-700/40">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{formatTestName(val.test)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-cyber-blue">{pStr}</span>
                        {sig ? (
                          <Badge variant="healthy">significant</Badge>
                        ) : (
                          <Badge variant="info">not significant</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-slate-700/40 text-[11px] text-slate-500 leading-relaxed">
            Paired t-test (Welch fallback to Wilcoxon) on per-timestep series. The base paper reports mean differences without significance testing.
          </div>
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Audit Scheduler Convergence
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-[11px] text-slate-500">RL (Q-learning) iterations</div>
              <div className="font-mono text-xl text-cyber-blue">{convergence?.rlIterations ?? 0}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{convergence?.rlConverged ? 'converged' : 'in progress'}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Gradient iterations</div>
              <div className="font-mono text-xl text-cyber-blue">{convergence?.gradientIterations ?? 0}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{convergence?.gradientConverged ? 'converged' : 'in progress'}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">RL epsilon final</div>
              <div className="font-mono text-xl text-cyber-blue">{(convergence?.rlEpsilonFinal ?? 0).toFixed(3)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">exploration decayed</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Mode</div>
              <div className="font-mono text-xl text-cyber-blue">{ablation}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">scheduler ablation</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700/40 text-[11px] text-slate-500 leading-relaxed">
            Hybrid scheduler runs Q-learning for directional decisions (INC/HOLD/DEC) refined by gradient descent for magnitude. Cluster budget allocated proportionally by aggregate cluster risk.
          </div>
          <div className="mt-2 text-[11px] text-slate-500 leading-relaxed">
            <span className="text-amber-400 font-semibold">vs paper:</span> base paper reports 12 RL iterations to converge. Our higher iteration count reflects a larger state space (we encode 9 physical+cyber metrics + LSTM probability + cluster label + cyber-attack-family prior, vs paper's 6 metrics). Larger state space requires more samples for Q-table coverage. Per-step inference latency stays sub-50 ms.
          </div>
        </div>
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Optimization Profile - {profile}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['ROBUST', 'BALANCED', 'COST'] as const).map(p => (
            <div key={p} className={`glass-card p-3 ${p === profile ? 'border-cyber-blue/60' : 'border-slate-700/40'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold ${p === profile ? 'text-cyber-blue' : 'text-slate-300'}`}>{p}</span>
                {p === profile && <Badge variant="healthy">active</Badge>}
              </div>
              <div className="text-[11px] text-slate-500 leading-relaxed">{PROFILE_DESCRIPTIONS[p]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Design Notes</h3>
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">Latest-run telemetry</Badge>
          <Badge variant="healthy">Explainable (XAI)</Badge>
          <Badge variant="auditing">Audit-aware feedback</Badge>
          <Badge variant="high">5-layer hybrid detection</Badge>
          <Badge variant="info">RL + Gradient + Cluster Budget</Badge>
          <Badge variant="info">UNSW-NB15 priors</Badge>
          <Badge variant="info">Audit Protection Window</Badge>
        </div>
      </div>
    </div>
  )
}
