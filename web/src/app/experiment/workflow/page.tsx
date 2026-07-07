'use client'

import { Badge } from '@/components/ui/Badge'
import { useExperimentTelemetry } from '@/lib/experimentTelemetry'
import {
  ArrowDown, Play, Database, Radar, Brain, Layers, Shield, BarChart3,
  AlertTriangle, FileText, Server, Monitor, Zap, Activity,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  FALLBACK DATA used when no live run is available                   */
/* ------------------------------------------------------------------ */
const FALLBACK = {
  runId: 'FALLBACK-DEMO',
  nAgents: 100,
  seed: 42,
  attackAgent: { id: '5', type: 'Generator', tier: 'CRITICAL' },
  scada: {
    V: { val: 239.5, base: 240.0, unit: 'V', z: -3.0, flag: false },
    I: { val: 125.3, base: 120.0, unit: 'A', z: 5.3, flag: true },
    P: { val: 29850, base: 29760, unit: 'W', z: 1.8, flag: false },
    T: { val: 65.2, base: 60.0, unit: 'C', z: 2.6, flag: false },
    f: { val: 49.95, base: 50.0, unit: 'Hz', z: -5.0, flag: true },
    Q: { val: 8450, base: 8400, unit: 'VAR', z: 2.0, flag: false },
    Loss: { val: 245, base: 205, unit: 'W', z: 2.67, flag: false },
  },
  network: { rtt: 250, loss: 15, jitter: 45, errors: 8 },
  layerA: 0.42,
  pGrid: 0.87,
  pNetwork: 0.91,
  cScores: { fdi: 0.89, dos: 0.93, mitm: 0.05, fault: 0.12 },
  pFused: 0.99,
  xaiTop: [
    { feat: 'I_out (Current)', pct: 33.8 },
    { feat: 'Frequency', pct: 30.0 },
    { feat: 'V_out (Voltage)', pct: 10.8 },
    { feat: 'P_loss', pct: 8.6 },
    { feat: 'T_coil (Temp)', pct: 8.1 },
  ],
  rlAction: 'AUDIT NOW',
  severity: 'CRITICAL',
  detection: 94.23,
  f1: 82.25,
  precision: 89.95,
  recall: 75.76,
  fpr: 1.81,
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function pct(n: number) { return `${(n * 100).toFixed(1)}%` }
function pctRaw(n: number) { return `${n.toFixed(2)}%` }

function PhaseArrow() {
  return (
    <div className="flex justify-center py-2">
      <ArrowDown className="w-5 h-5 text-cyan-400 animate-bounce" />
    </div>
  )
}

function PhaseHeader({ phase, title, time, icon: Icon }: {
  phase: number; title: string; time?: string; icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4.5 h-4.5 text-cyan-400" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-slate-800 leading-tight">
          Phase {phase}: {title}
        </h3>
        {time && <span className="text-[10px] text-slate-500 font-mono">{time}</span>}
      </div>
    </div>
  )
}

function DataRow({ label, value, highlight, unit, extra }: {
  label: string; value: string | number; highlight?: boolean; unit?: string; extra?: string
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 px-3 rounded text-xs ${highlight ? 'bg-red-50 border border-red-200' : 'bg-slate-50'}`}>
      <span className="text-slate-600 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-mono font-bold ${highlight ? 'text-red-600' : 'text-slate-800'}`}>
          {value}{unit ? ` ${unit}` : ''}
        </span>
        {extra && <span className="text-[10px] text-slate-500">{extra}</span>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */
export default function ExperimentWorkflowPage() {
  const { summary, topAgents } = useExperimentTelemetry(8000)

  const hasRun = !!summary?.runId
  const runId = summary?.runId ?? FALLBACK.runId

  const topAgent = topAgents?.[0]
  const agentId = topAgent?.id ?? FALLBACK.attackAgent.id
  const agentType = topAgent?.type ?? FALLBACK.attackAgent.type
  const agentTier = topAgent?.severity ?? FALLBACK.attackAgent.tier
  const anomalyScore = topAgent?.anomalyScore ?? FALLBACK.pFused
  const attackLabel = topAgent?.attack ?? 'FDI+DoS'

  const detection = Number(summary?.detectionAccuracy ?? FALLBACK.detection / 100)
  const f1Val = Number(summary?.f1 ?? FALLBACK.f1 / 100)
  const precisionVal = Number(summary?.precision ?? FALLBACK.precision / 100)
  const recallVal = Number(summary?.recall ?? FALLBACK.recall / 100)
  const fprVal = Number(summary?.fpr ?? FALLBACK.fpr / 100)
  const nAgents = Number(summary?.totalAgents ?? FALLBACK.nAgents)

  const fb = FALLBACK

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-16">
      {/* Title */}
      <div>
        <h1 className="section-header">Attack-to-Dashboard Workflow</h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete 10-phase detection pipeline traced through a single coordinated attack
        </p>
      </div>

      {/* Run context banner */}
      <div className="glass-card p-3 border-cyan-500/20 flex items-center gap-3 text-xs">
        <Activity className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <div className="flex-1 text-slate-700">
          {hasRun ? (
            <>
              Showing live data from run <span className="font-mono text-cyan-600 font-bold">{runId}</span> with
              highest-risk agent <span className="font-mono text-red-600 font-bold">#{agentId}</span> ({agentType})
            </>
          ) : (
            <>
              No experiment run detected. Displaying <span className="font-mono text-amber-600 font-bold">fallback example</span> with
              coordinated FDI+DoS attack on Agent #5 (Generator).
              Run <code className="bg-slate-100 px-1 rounded">python -m smartgrid_mas.run_all</code> to see live data.
            </>
          )}
        </div>
        <Badge variant={hasRun ? 'healthy' : 'medium'} pulse>{hasRun ? 'LIVE' : 'DEMO'}</Badge>
      </div>

      {/* ============================================================ */}
      {/* PHASE 0: INITIALIZATION                                       */}
      {/* ============================================================ */}
      <div className="glass-card p-5">
        <PhaseHeader phase={0} title="Simulation Initialization" icon={Play} time="t = 0" />
        <div className="grid grid-cols-2 gap-2">
          <DataRow label="Command" value="python -m smartgrid_mas.run_all" />
          <DataRow label="Agents" value={nAgents} />
          <DataRow label="LSTM Window" value="12 steps" extra="60 min lookback" />
          <DataRow label="Hidden Size" value="64" extra="2 layers, dropout 0.2" />
          <DataRow label="k-sigma" value="4.0" />
          <DataRow label="Prob Threshold" value="0.97" />
          <DataRow label="Attack Rates" value="FDI 10%, DoS 5%, MITM 3%" />
          <DataRow label="Chain Rate" value="20%" extra="coordinated pairs" />
          <DataRow label="Fault Rate" value="20%" />
          <DataRow label="Budget Ratio" value="10%" />
        </div>
        <div className="mt-3 bg-slate-50 rounded p-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Agent Pool:</span>{' '}
          20% generators (CRITICAL) + 30% substations (HIGH) + 25% PMUs (MEDIUM) + 25% breakers (LOW)
        </div>
        <div className="mt-2 bg-blue-50 rounded p-3 text-xs text-slate-600">
          <span className="font-semibold text-blue-700">Data Loading:</span>{' '}
          Grid LSTM trained on 7 SCADA features (V, I, P, T, f, Q, Loss).
          Network LSTM trained on 4 engineered aggregates from 20 raw packet fields.
          Focal BCE loss (gamma=2.0, alpha=0.5) with temperature calibration.
        </div>
      </div>

      <PhaseArrow />

      {/* ============================================================ */}
      {/* PHASE 1: ATTACK INJECTION                                     */}
      {/* ============================================================ */}
      <div className="glass-card p-5 border-red-200">
        <PhaseHeader phase={1} title="Attack Injection" icon={Zap} time="t = 45 (225 min into simulation)" />
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="critical" pulse>COORDINATED ATTACK</Badge>
            <span className="text-slate-600">Target: Agent <span className="font-mono font-bold text-red-600">#{agentId}</span> ({agentType}, {agentTier})</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-white rounded p-3 border border-red-100">
              <div className="font-semibold text-red-700 mb-1">Vector 1: False Data Injection</div>
              <div className="text-slate-600">Inject voltage offset: -0.5V on V_out channel</div>
              <div className="text-slate-500 mt-0.5">Subtle deviation (0.2%) to evade detection</div>
            </div>
            <div className="bg-white rounded p-3 border border-red-100">
              <div className="font-semibold text-red-700 mb-1">Vector 2: Denial of Service</div>
              <div className="text-slate-600">Flood communication channel with packets</div>
              <div className="text-slate-500 mt-0.5">RTT spike +150ms, 15% packet loss</div>
            </div>
          </div>
        </div>
      </div>

      <PhaseArrow />

      {/* ============================================================ */}
      {/* PHASE 2: SCADA DATA COLLECTION                                */}
      {/* ============================================================ */}
      <div className="glass-card p-5">
        <PhaseHeader phase={2} title="Real-Time SCADA Data Collection" icon={Database} time="7 physical + 4 network channels" />
        <div className="space-y-1.5">
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-3 mb-1">Physical Channels (7)</div>
          {Object.entries(fb.scada).map(([key, ch]) => (
            <DataRow
              key={key}
              label={key}
              value={ch.val}
              unit={ch.unit}
              highlight={ch.flag}
              extra={`base ${ch.base}, z = ${ch.z > 0 ? '+' : ''}${ch.z.toFixed(1)}`}
            />
          ))}
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-3 mt-3 mb-1">Network Stats (DoS impact)</div>
          <DataRow label="Round-Trip Time" value={fb.network.rtt} unit="ms" highlight extra="normal 100ms" />
          <DataRow label="Packet Loss" value={`${fb.network.loss}%`} highlight extra="normal 0.1%" />
          <DataRow label="Jitter" value={fb.network.jitter} unit="ms" highlight extra="normal 5ms" />
          <DataRow label="Checksum Errors" value={fb.network.errors} highlight extra="normal 0" />
        </div>
      </div>

      <PhaseArrow />

      {/* ============================================================ */}
      {/* PHASE 3A: LAYER A                                             */}
      {/* ============================================================ */}
      <div className="glass-card p-5">
        <PhaseHeader phase={3} title="Layer A - Deviation Scoring" icon={Radar} time="< 1ms, k-sigma test (k = 4.0)" />
        <div className="text-xs text-slate-600 mb-3">
          EMA baseline updated continuously. z-score = (observed - baseline) / sigma.
          Flag channel if |z| &gt; 4.0.
        </div>
        <div className="space-y-1.5">
          {Object.entries(fb.scada).map(([key, ch]) => {
            const absZ = Math.abs(ch.z)
            const exceeded = absZ > 4.0
            return (
              <div key={key} className={`flex items-center gap-2 py-1.5 px-3 rounded text-xs ${exceeded ? 'bg-red-50 border border-red-200' : 'bg-slate-50'}`}>
                <span className="w-12 text-slate-600 font-medium">{key}</span>
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${exceeded ? 'bg-red-500' : absZ > 2.5 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${Math.min(100, (absZ / 6) * 100)}%` }}
                  />
                </div>
                <span className="w-14 font-mono text-right">|z| = {absZ.toFixed(1)}</span>
                <span className="w-7 text-center text-[10px] font-bold">{exceeded ? 'FAIL' : absZ > 2.5 ? 'WARN' : 'OK'}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded p-3 text-xs">
          <span className="font-semibold text-amber-700">Layer A Score:</span>
          <span className="font-mono font-bold text-amber-800 text-sm">{fb.layerA}</span>
          <span className="text-slate-500">2 of 7 channels exceeded (I_out, Frequency)</span>
        </div>
      </div>

      <PhaseArrow />

      {/* ============================================================ */}
      {/* PHASE 3B: LAYER B                                             */}
      {/* ============================================================ */}
      <div className="glass-card p-5">
        <PhaseHeader phase={4} title="Layer B - Dual-Branch LSTM Inference" icon={Brain} time="~5ms per branch, 12-step sliding window" />
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-xs">
            <div className="font-semibold text-purple-700 mb-2">Branch 1: Grid LSTM (Physical)</div>
            <div className="space-y-1 text-slate-600">
              <div>Input: (1, 12, 7) tensor</div>
              <div>Architecture: 2-layer, 64 hidden, dropout 0.2</div>
              <div>Pattern: V drops while I spikes (FDI signature)</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-slate-500">Output:</span>
                <span className="font-mono font-bold text-purple-700 text-base">P_grid = {fb.pGrid}</span>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs">
            <div className="font-semibold text-blue-700 mb-2">Branch 2: Network LSTM (Cyber)</div>
            <div className="space-y-1 text-slate-600">
              <div>Input: (1, 12, 4) tensor</div>
              <div>4 engineered features from 20 raw fields</div>
              <div>Pattern: All 4 degrade together (DoS signature)</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-slate-500">Output:</span>
                <span className="font-mono font-bold text-blue-700 text-base">P_net = {fb.pNetwork}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 bg-slate-50 rounded p-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Network features:</span>{' '}
          log(RTT+SYN_ACK+jitter), log(src_loss+dst_loss+drop), log(|TTL_diff|+state_TTL+|bytes_diff|), log(rate+sload+dload+packets)
        </div>
      </div>

      <PhaseArrow />

      {/* ============================================================ */}
      {/* PHASE 3C: LAYER C                                             */}
      {/* ============================================================ */}
      <div className="glass-card p-5">
        <PhaseHeader phase={5} title="Layer C - Specialized Sub-Detectors" icon={Layers} time="4 rule-based validators" />
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'C-1 CUSUM FDI', score: fb.cScores.fdi, pass: true, desc: 'Cumulative sum drift on voltage. Persistent negative deviation matches FDI injection.' },
            { label: 'C-2 DoS Rules', score: fb.cScores.dos, pass: true, desc: 'RTT > 200ms AND loss > 5%. Multiple network degradation indicators confirm DoS.' },
            { label: 'C-3 MITM Integrity', score: fb.cScores.mitm, pass: false, desc: 'Voltage change -0.25% is far below 35% threshold. MITM ruled out.' },
            { label: 'C-4 Fault Signature', score: fb.cScores.fault, pass: false, desc: 'Temperature spike is reactive cascade, not gradual ramp. Fault pattern mismatch.' },
          ].map(d => (
            <div key={d.label} className={`rounded-lg p-3 text-xs border ${d.pass ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`font-semibold ${d.pass ? 'text-red-700' : 'text-green-700'}`}>{d.label}</span>
                <Badge variant={d.pass ? 'critical' : 'healthy'}>{d.pass ? 'DETECTED' : 'CLEAR'}</Badge>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full">
                  <div
                    className={`h-full rounded-full ${d.pass ? 'bg-red-500' : 'bg-green-400'}`}
                    style={{ width: `${d.score * 100}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] w-8 text-right">{d.score.toFixed(2)}</span>
              </div>
              <div className="text-slate-500 leading-relaxed">{d.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <PhaseArrow />

      {/* ============================================================ */}
      {/* PHASE 3D: FUSION GATE                                         */}
      {/* ============================================================ */}
      <div className="glass-card p-5 border-red-200">
        <PhaseHeader phase={6} title="Fusion Gate - Evidence Aggregation" icon={Shield} time="< 1ms decision-level fusion" />
        <div className="bg-slate-50 rounded-lg p-4 text-xs space-y-2 font-mono">
          <div className="text-slate-600">P_fused = (w_grid x P_grid) + (w_net x P_net) + agreement_bonus</div>
          <div className="text-slate-600">= (0.58 x {fb.pGrid}) + (0.42 x {fb.pNetwork}) + bonus</div>
          <div className="text-slate-600">= {(0.58 * fb.pGrid).toFixed(3)} + {(0.42 * fb.pNetwork).toFixed(3)} + 0.084 + high_support_bonus</div>
        </div>
        <div className="mt-3 bg-red-50 border border-red-300 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-red-700 font-semibold mb-0.5">Final Fused Probability</div>
            <div className="text-2xl font-mono font-black text-red-600">{hasRun ? anomalyScore.toFixed(2) : fb.pFused}</div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>Threshold: 0.97</div>
            <div className="font-bold text-red-600 mt-0.5">EXCEEDS THRESHOLD</div>
            <div className="mt-1">
              <Badge variant="critical" pulse>ATTACK CONFIRMED 99%</Badge>
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Both branches agree (|P_grid - P_net| = 0.04), so agreement bonus applied. High-support bonus added (both &gt; 0.85). FP gate does NOT suppress because strong corroboration from C-1 and C-2.
        </div>
      </div>

      <PhaseArrow />

      {/* ============================================================ */}
      {/* PHASE 7: XAI                                                  */}
      {/* ============================================================ */}
      <div className="glass-card p-5">
        <PhaseHeader phase={7} title="XAI Explanation Generation" icon={BarChart3} time="Feature contribution via normalized squared deviation" />
        <div className="text-xs text-slate-600 mb-3 font-mono bg-slate-50 rounded p-2">
          c_j = ((x_j - b_j) / th_j) squared, relative = c_j / sum(c)
        </div>
        <div className="space-y-2">
          {fb.xaiTop.map((f, i) => (
            <div key={f.feat} className="flex items-center gap-3 text-xs">
              <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[10px] font-bold text-cyan-600">{i + 1}</span>
              <span className="w-32 text-slate-700 font-medium truncate">{f.feat}</span>
              <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                  style={{ width: `${f.pct}%` }}
                />
              </div>
              <span className="w-12 font-mono text-right font-bold text-slate-700">{f.pct}%</span>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-3 text-xs text-slate-600">
          Saved to <span className="font-mono">logs/N{nAgents}/shap_explanations.csv</span> and served via <span className="font-mono">GET /audit/explain/{'{agent_id}'}</span>
        </div>
      </div>

      <PhaseArrow />

      {/* ============================================================ */}
      {/* PHASE 8: Q-LEARNING SCHEDULING                                */}
      {/* ============================================================ */}
      <div className="glass-card p-5">
        <PhaseHeader phase={8} title="Q-Learning Audit Scheduler" icon={Shield} time="State (risk, tier, budget, time) -> Action" />
        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            { action: 'SKIP', q: -0.99, desc: 'High risk + skip = loss', best: false },
            { action: 'SOFT MONITOR', q: 0.45, desc: 'Okay, but attack active now', best: false },
            { action: 'AUDIT NOW', q: 0.92, desc: 'Best! High risk + budget available', best: true },
          ].map(a => (
            <div key={a.action} className={`rounded-lg p-3 border ${a.best ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`font-semibold mb-1 ${a.best ? 'text-emerald-700' : 'text-slate-600'}`}>{a.action}</div>
              <div className="font-mono text-lg font-bold">{a.q > 0 ? '+' : ''}{a.q.toFixed(2)}</div>
              <div className="text-slate-500 mt-0.5">{a.desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-slate-50 rounded p-3 text-xs text-slate-600 space-y-1">
          <div><span className="font-semibold text-slate-700">Q-update:</span> Q(s,a) = Q(s,a) + alpha[r + gamma * max Q(s&apos;,a&apos;) - Q(s,a)]</div>
          <div>alpha = 0.4, gamma = 0.95, epsilon-greedy decay 0.995</div>
          <div>Gradient optimizer (lr=0.01) fine-tunes audit allocation per cycle</div>
        </div>
      </div>

      <PhaseArrow />

      {/* ============================================================ */}
      {/* PHASE 9: RESPONSE & MITIGATION                                */}
      {/* ============================================================ */}
      <div className="glass-card p-5 border-amber-200">
        <PhaseHeader phase={9} title="Response and Mitigation" icon={AlertTriangle} time="Severity scoring + operator action" />
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="critical" pulse>SEVERITY: {agentTier}</Badge>
            <span className="text-slate-600">Agent #{agentId} flagged for immediate physical inspection</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded p-2 border border-amber-100">
              <div className="font-semibold text-amber-700">Impact Factor</div>
              <div className="text-slate-600">Generator = CRITICAL tier weight</div>
            </div>
            <div className="bg-white rounded p-2 border border-amber-100">
              <div className="font-semibold text-amber-700">Likelihood</div>
              <div className="text-slate-600">Recent history: 6/6 anomalous flags</div>
            </div>
          </div>
          <div className="bg-white rounded p-3 border border-amber-100 mt-1">
            <div className="font-semibold text-amber-700 mb-1">Mitigation Actions</div>
            <ol className="list-decimal list-inside text-slate-600 space-y-0.5">
              <li>Isolate affected sensor from network</li>
              <li>Switch to backup voltage monitor</li>
              <li>Rate-limit communication to unit</li>
              <li>Restore normal operation after verification</li>
            </ol>
          </div>
        </div>
      </div>

      <PhaseArrow />

      {/* ============================================================ */}
      {/* PHASE 10: DASHBOARD VISUALIZATION                             */}
      {/* ============================================================ */}
      <div className="glass-card p-5 border-emerald-200">
        <PhaseHeader phase={10} title="Dashboard Visualization" icon={Monitor} time="API serves data -> React renders charts" />
        <div className="space-y-3">
          <div className="bg-slate-50 rounded p-3 text-xs">
            <div className="font-semibold text-slate-700 mb-2">API Data Flow</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { endpoint: 'GET /grid/status', file: 'summary.json', desc: 'KPI cards' },
                { endpoint: 'GET /experiment/telemetry', file: 'dynamic_metrics.csv', desc: 'Trend charts' },
                { endpoint: 'GET /audit/explain/{id}', file: 'shap_explanations.csv', desc: 'XAI page' },
                { endpoint: 'GET /v1/runs/latest', file: 'summary.json', desc: 'Run status' },
              ].map(e => (
                <div key={e.endpoint} className="flex items-center gap-2 bg-white rounded p-2 border border-slate-200">
                  <Server className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                  <div>
                    <div className="font-mono text-[10px] text-cyan-700">{e.endpoint}</div>
                    <div className="text-slate-500 text-[10px]">{e.file} - {e.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live KPI preview */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-emerald-700 mb-2">Live Metrics from This Run</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Accuracy', val: detection > 1 ? pctRaw(detection) : pct(detection), color: 'text-blue-700' },
                { label: 'F1 Score', val: f1Val > 1 ? pctRaw(f1Val) : pct(f1Val), color: 'text-purple-700' },
                { label: 'Precision', val: precisionVal > 1 ? pctRaw(precisionVal) : pct(precisionVal), color: 'text-emerald-700' },
                { label: 'FPR', val: fprVal > 1 ? pctRaw(fprVal) : pct(fprVal), color: 'text-red-600' },
              ].map(m => (
                <div key={m.label} className="bg-white rounded p-2 border border-emerald-100">
                  <div className="text-[10px] text-slate-500 uppercase">{m.label}</div>
                  <div className={`font-mono font-bold text-sm ${m.color}`}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SUMMARY                                                       */}
      {/* ============================================================ */}
      <div className="glass-card p-5 border-cyan-500/30 bg-gradient-to-br from-white to-cyan-50/30">
        <div className="text-sm font-bold text-slate-800 mb-3">Complete Detection Timeline</div>
        <div className="space-y-1.5">
          {[
            { step: '1', label: 'Attack Injection', detail: `FDI (-0.5V) + DoS (15% loss) on Agent #${agentId}`, time: 't = 45' },
            { step: '2', label: 'SCADA Collection', detail: '7 physical + 4 network channels read', time: 'Real-time' },
            { step: '3', label: 'Layer A Deviation', detail: 'I_out = 5.3 sigma, Freq = 5.0 sigma flagged', time: '< 1ms' },
            { step: '4', label: 'Dual-Branch LSTM', detail: `P_grid = ${fb.pGrid}, P_network = ${fb.pNetwork}`, time: '~5ms' },
            { step: '5', label: 'Sub-Detectors', detail: 'FDI confirmed (0.89), DoS confirmed (0.93)', time: '~2ms' },
            { step: '6', label: 'Fusion Gate', detail: `P_fused = ${hasRun ? anomalyScore.toFixed(2) : fb.pFused} exceeds 0.97`, time: '< 1ms' },
            { step: '7', label: 'XAI Explanation', detail: 'Top: I_out (33.8%), Frequency (30.0%)', time: '< 1ms' },
            { step: '8', label: 'Q-Learning', detail: 'Risk=0.99, Budget=abundant, Action=AUDIT NOW', time: '< 1ms' },
            { step: '9', label: 'Mitigation', detail: 'Isolate sensor + backup monitor + rate-limit', time: '< 2 min' },
            { step: '10', label: 'Dashboard', detail: 'Charts render spike at t=45, XAI drill-down', time: 'Continuous' },
          ].map(s => (
            <div key={s.step} className="flex items-center gap-3 py-1.5 px-3 bg-white/80 rounded text-xs border border-slate-100">
              <span className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[10px] font-bold text-cyan-600 flex-shrink-0">{s.step}</span>
              <span className="w-28 font-semibold text-slate-700 flex-shrink-0">{s.label}</span>
              <span className="flex-1 text-slate-600">{s.detail}</span>
              <span className="font-mono text-slate-400 text-[10px] w-16 text-right flex-shrink-0">{s.time}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-center text-xs text-slate-500">
          Total detection time: ~15ms | Full mitigation response: &lt; 2 minutes
        </div>
      </div>
    </div>
  )
}
