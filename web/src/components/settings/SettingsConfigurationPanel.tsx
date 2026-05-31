'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Save, RefreshCw } from 'lucide-react'

type Param = { key: string; label: string; value: string | number; type: 'number' | 'text'; desc: string; min?: number; max?: number; step?: number }

const TABS = ['Model Parameters', 'Reward Weights', 'Detection Thresholds', 'Operational Risks & Delays', 'API Config', 'Algorithms & Visualization'] as const
type Tab = typeof TABS[number]

const REQUIRED_KEYS = ['num_agents', 'episodes', 'fdi_rate', 'dos_rate', 'chain_rate'] as const

const PARAMS: Record<Tab, Param[]> = {
  'Model Parameters': [
    // { key: 'num_agents', label: 'Number of Agents (N)', value: 100, type: 'number', min: 1, max: 5000, step: 1, desc: 'Maps to SMARTGRID_NUM_AGENTS for run defaults.' },
    { key: 'seeds', label: 'Seeds (comma-separated)', value: '42,43,44', type: 'text', desc: 'Maps to SMARTGRID_SEEDS for multi-seed reproducible runs.' },
    { key: 'learning_rate',    label: 'Learning Rate (α)', value: 0.01, type: 'number', min: 0.0001, max: 1, step: 0.001, desc: 'Step size for gradient-based audit frequency updates.' },
    { key: 'epsilon',          label: 'Epsilon (ε-greedy)',  value: 0.1, type: 'number', min: 0.0, max: 1, step: 0.01, desc: 'Exploration rate for ε-greedy action selection.' },
    { key: 'replay_buffer',    label: 'Replay Buffer Size',  value: 2000,type: 'number', min: 500, max: 50000, step: 100, desc: 'Experience replay buffer capacity. Min 2000 recommended for rare-event coverage.' },
    { key: 'episodes',         label: 'Training Episodes',   value: 200, type: 'number', min: 10, max: 2000, step: 10, desc: 'Number of RL training episodes per run.' },
    { key: 'max_audit_freq',   label: 'Max Audit Frequency', value: 5,   type: 'number', min: 1, max: 20, step: 1, desc: 'Maximum audits per cycle per agent (paper default: 5).' },
    { key: 'audit_budget_ratio', label: 'Audit Budget Ratio', value: 0.07, type: 'number', min: 0.01, max: 0.5, step: 0.01, desc: 'Maps to SMARTGRID_AUDIT_BUDGET_RATIO; controls dynamic audit spend share.' },
    { key: 'risk_threshold', label: 'Risk Threshold', value: 0.5, type: 'number', min: 0.05, max: 1.0, step: 0.05, desc: 'Maps to SMARTGRID_RISK_THRESHOLD; above this value audits are prioritized.' },
    { key: 'f_min', label: 'Min Audit Frequency (f_min)', value: 1, type: 'number', min: 1, max: 10, step: 1, desc: 'Regulatory minimum audits per cycle.' },
    { key: 'f_max', label: 'Max Audit Frequency Override (f_max)', value: 5, type: 'number', min: 1, max: 20, step: 1, desc: 'Maps to SMARTGRID_F_MAX override for scheduler cap.' },
    { key: 'max_audits_cycle', label: 'Max Audits Per Cycle', value: 100, type: 'number', min: 10, max: 10000, step: 10, desc: 'Maps to SMARTGRID_MAX_AUDITS_PER_CYCLE.' },
  ],
  'Reward Weights': [
    { key: 'lambda_audit',  label: 'λ_audit (cost penalty)',    value: 0.2, type: 'number', min: 0, max: 5, step: 0.05, desc: 'Weight applied to audit cost in reward function. Lower = more spending allowed.' },
    { key: 'lambda_attack', label: 'λ_attack (missed-attack)',  value: 5.0, type: 'number', min: 0, max: 20, step: 0.1, desc: 'Penalty for missed attacks. Higher = more security-focused policy.' },
    { key: 'detect_bonus',  label: 'Detection Bonus',           value: 5.0, type: 'number', min: 0, max: 20, step: 0.1, desc: 'Reward bonus for catching high-risk threats.' },
    { key: 'stability_w',   label: 'Stability Term Weight',     value: 0.10,type: 'number', min: 0, max: 1,  step: 0.01, desc: 'Light pressure to keep baseline deviation low.' },
  ],
  'Detection Thresholds': [
    { key: 'alpha_high',   label: 'α_high (rapid adapt)',  value: 0.8,  type: 'number', min: 0.5, max: 0.99, step: 0.01, desc: 'Smoothing factor during anomalies — fast baseline update.' },
    { key: 'alpha_low',    label: 'α_low (stable)',        value: 0.05, type: 'number', min: 0.001, max: 0.3, step: 0.001, desc: 'Smoothing factor during stable conditions — anchors to history.' },
    { key: 'beta',         label: 'β (threshold adjust)',  value: 0.3,  type: 'number', min: 0.01, max: 1.0, step: 0.01, desc: 'Controls rate of threshold change relative to deviation.' },
    { key: 'k_scale',      label: 'k (threshold scale)',   value: 4.0,  type: 'number', min: 1.0, max: 10.0, step: 0.1, desc: 'Multiplier for σ in Th_ij = k × σ_ij.' },
    { key: 'anomaly_th',   label: 'Anomaly Score Cutoff',  value: 3.0,  type: 'number', min: 0.1, max: 5.0, step: 0.1, desc: 'Agent flagged anomalous when S_i(t) ≥ this value.' },
    { key: 'prob_threshold', label: 'Anomaly Probability Threshold', value: 0.97, type: 'number', min: 0.5, max: 1.0, step: 0.001, desc: 'Maps to SMARTGRID_ANOMALY_PROB_THRESHOLD.' },
    { key: 'hybrid_w_dev', label: 'Hybrid Weight (Deviation)', value: 0.55, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Maps to SMARTGRID_HYBRID_W_DEV.' },
    { key: 'hybrid_w_prob', label: 'Hybrid Weight (Probability)', value: 0.45, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Maps to SMARTGRID_HYBRID_W_PROB.' },
    { key: 'sigma_window', label: 'Sigma Calibration Window', value: 24, type: 'number', min: 4, max: 500, step: 1, desc: 'Maps to SMARTGRID_THRESHOLD_WINDOW for rolling sigma estimation.' },
  ],
  'Operational Risks & Delays': [
    { key: 'audit_success_prob', label: 'Audit Success Probability', value: 0.95, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Maps to SMARTGRID_AUDIT_SUCCESS_PROB. Missing-audit probability = 1 - value.' },
    { key: 'missing_audit_prob', label: 'Probability of Missing Audit', value: 0.05, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Derived display control (1 - audit success probability).' },
    { key: 'mitigation_delay', label: 'Mitigation Delay (steps)', value: 1, type: 'number', min: 0, max: 50, step: 1, desc: 'Maps to SMARTGRID_MITIGATION_DELAY before action takes effect.' },
    { key: 'fdi_rate', label: 'FDI Attack Rate', value: 0.10, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Maps to SMARTGRID_FDI_RATE.' },
    { key: 'dos_rate', label: 'DoS Attack Rate', value: 0.05, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Maps to SMARTGRID_DOS_RATE.' },
    { key: 'chain_rate', label: 'Coordinated Chain Attack Rate', value: 0.20, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Maps to SMARTGRID_CHAIN_RATE.' },
    { key: 'fault_rate', label: 'Physical Fault Rate', value: 0.20, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Maps to SMARTGRID_FAULT_RATE.' },
    { key: 'reward_missed_attack_penalty', label: 'Missed Attack Penalty (FN)', value: 10.0, type: 'number', min: 0.0, max: 30.0, step: 0.1, desc: 'Maps to SMARTGRID_RW_ATTACK in reward function.' },
    { key: 'constraint_log_level', label: 'Constraint Log Level', value: 'WARNING', type: 'text', desc: 'Maps to SMARTGRID_CONSTRAINT_LOG_LEVEL (DEBUG/INFO/WARNING/ERROR).' },
  ],
  'API Config': [
    { key: 'api_host', label: 'FastAPI Host', value: 'deployment-configured', type: 'text', desc: 'Backend API host or public URL label.' },
    { key: 'api_port', label: 'FastAPI Port', value: 8000,       type: 'number', min: 1024, max: 65535, step: 1, desc: 'Backend API port.' },
    { key: 'scada_host', label: 'SCADA Host', value: 'deployment-configured', type: 'text', desc: 'Rapid SCADA Web API host.' },
    { key: 'scada_port', label: 'SCADA Port', value: 10109,      type: 'number', min: 1024, max: 65535, step: 1, desc: 'Rapid SCADA local web host port.' },
    { key: 'scada_poll', label: 'Poll Interval (s)', value: 2,   type: 'number', min: 1, max: 60, step: 1, desc: 'Rapid SCADA bridge polling interval in seconds.' },
    { key: 'scada_demo_phase', label: 'Live Demo Phase', value: 'Independent', type: 'text', desc: 'Maps to SMARTGRID_SCADA_DEMO_ANOMALY_PHASE. Use Independent for realistic per-agent behavior.' },
    { key: 'scada_rate_preset', label: 'Live Anomaly Rate Preset', value: 'Realistic', type: 'text', desc: 'Maps to SMARTGRID_SCADA_INDEPENDENT_RATE_PRESET. Valid values: Realistic, Balanced, Demo.' },
    { key: 'scada_anomaly_cycle_seconds', label: 'Anomaly Cycle Seconds', value: 150, type: 'number', min: 20, max: 3600, step: 10, desc: 'Maps to SMARTGRID_SCADA_ANOMALY_CYCLE_SECONDS.' },
    { key: 'scada_anomaly_intensity', label: 'Anomaly Intensity', value: 1.0, type: 'number', min: 0.1, max: 3.0, step: 0.1, desc: 'Maps to SMARTGRID_SCADA_ANOMALY_INTENSITY.' },
  ],
  'Algorithms & Visualization': [
    { key: 'detector_algo', label: 'Anomaly Detector Algorithm', value: 'LSTM', type: 'text', desc: 'Primary detector currently used in pipeline (LSTM).' },
    { key: 'scheduler_algo', label: 'Audit Scheduler Algorithm', value: 'Q-Learning RL + Gradient', type: 'text', desc: 'Hybrid scheduler used for dynamic audits.' },
    { key: 'lstm_window', label: 'LSTM Window', value: 24, type: 'number', min: 4, max: 200, step: 1, desc: 'Maps to SMARTGRID_LSTM_WINDOW.' },
    { key: 'lstm_hidden_size', label: 'LSTM Hidden Size', value: 64, type: 'number', min: 8, max: 512, step: 8, desc: 'Model hidden dimensions.' },
    { key: 'lstm_num_layers', label: 'LSTM Layers', value: 2, type: 'number', min: 1, max: 8, step: 1, desc: 'Number of stacked LSTM layers.' },
    { key: 'lstm_dropout', label: 'LSTM Dropout', value: 0.2, type: 'number', min: 0.0, max: 0.9, step: 0.05, desc: 'Dropout used during LSTM training.' },
    { key: 'rl_alpha', label: 'RL Alpha (learning rate)', value: 0.4, type: 'number', min: 0.01, max: 1.0, step: 0.01, desc: 'Maps to SMARTGRID_RL_ALPHA.' },
    { key: 'rl_gamma', label: 'RL Gamma (discount)', value: 0.95, type: 'number', min: 0.1, max: 1.0, step: 0.01, desc: 'Maps to SMARTGRID_RL_GAMMA.' },
    { key: 'rl_epsilon_start', label: 'RL Epsilon Start', value: 1.0, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Maps to SMARTGRID_RL_EPSILON_START.' },
    { key: 'rl_epsilon_min', label: 'RL Epsilon Min', value: 0.05, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Maps to SMARTGRID_RL_EPSILON_MIN.' },
    { key: 'rl_epsilon_decay', label: 'RL Epsilon Decay', value: 0.995, type: 'number', min: 0.8, max: 1.0, step: 0.001, desc: 'Maps to SMARTGRID_RL_EPSILON_DECAY.' },
    { key: 'show_latency_charts', label: 'Show Delay/Latency Visuals', value: 'enabled', type: 'text', desc: 'Visual references include transmission and end-to-end delay metrics.' },
  ],
}

/* Peak-output parameter preset — tuned for DR ≈ 99.76 %, FPR ≈ 0.24 % */
const PEAK_DEFAULTS: Record<string, string | number> = {
  seeds: '42,43,44',
  learning_rate: 0.01,
  epsilon: 0.1,
  replay_buffer: 2000,
  episodes: 200,
  max_audit_freq: 5,
  audit_budget_ratio: 0.07,
  risk_threshold: 0.5,
  f_min: 1,
  f_max: 5,
  max_audits_cycle: 100,
  lambda_audit: 0.2,
  lambda_attack: 5.0,
  detect_bonus: 5.0,
  stability_w: 0.10,
  alpha_high: 0.8,
  alpha_low: 0.05,
  beta: 0.3,
  k_scale: 4.0,
  anomaly_th: 3.0,
  prob_threshold: 0.97,
  hybrid_w_dev: 0.55,
  hybrid_w_prob: 0.45,
  sigma_window: 24,
  audit_success_prob: 0.95,
  missing_audit_prob: 0.05,
  mitigation_delay: 1,
  fdi_rate: 0.10,
  dos_rate: 0.05,
  chain_rate: 0.20,
  fault_rate: 0.20,
  reward_missed_attack_penalty: 10.0,
  constraint_log_level: 'WARNING',
  api_host: 'deployment-configured',
  api_port: 8000,
  scada_host: 'deployment-configured',
  scada_port: 10109,
  scada_poll: 2,
  scada_demo_phase: 'Independent',
  scada_rate_preset: 'Realistic',
  scada_anomaly_cycle_seconds: 150,
  scada_anomaly_intensity: 1.0,
  detector_algo: 'LSTM',
  scheduler_algo: 'Q-Learning RL + Gradient',
  lstm_window: 24,
  lstm_hidden_size: 64,
  lstm_num_layers: 2,
  lstm_dropout: 0.2,
  rl_alpha: 0.4,
  rl_gamma: 0.95,
  rl_epsilon_start: 1.0,
  rl_epsilon_min: 0.05,
  rl_epsilon_decay: 0.995,
  show_latency_charts: 'enabled',
}

export function SettingsConfigurationPanel() {
  const [tab, setTab] = useState<Tab>('Model Parameters')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [persistedVals, setPersistedVals] = useState<Record<string, string | number> | null>(null)
  const [vals, setVals] = useState<Record<string, string | number>>(
    Object.fromEntries(Object.values(PARAMS).flat().map(p => [p.key, p.value]))
  )

  useEffect(() => {
    async function loadPersistedSettings() {
      try {
        const res = await fetch('/api/settings/runtime', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const values = data?.values ?? {}
        const runtimeEnv = data?.runtime_env ?? {}
        const overrides = data?.runtime_overrides ?? data?.overrides ?? {}

        const nextVals: Record<string, string | number> = {}
        const assign = (key: string, value: unknown) => {
          if (value === undefined || value === null) return
          nextVals[key] = value as string | number
        }

        assign('audit_budget_ratio', overrides?.audit?.audit_budget_ratio)
        assign('risk_threshold', overrides?.audit?.risk_threshold)
        assign('f_min', overrides?.audit?.f_min)
        assign('f_max', overrides?.audit?.f_max)
        assign('max_audits_cycle', overrides?.audit?.max_audits_per_cycle)

        assign('k_scale', overrides?.thresholds?.k_sigma)
        assign('anomaly_th', overrides?.thresholds?.score_threshold)
        assign('prob_threshold', overrides?.thresholds?.prob_threshold)
        assign('hybrid_w_dev', values?.hybrid_w_dev ?? runtimeEnv?.SMARTGRID_HYBRID_W_DEV)
        assign('hybrid_w_prob', values?.hybrid_w_prob ?? runtimeEnv?.SMARTGRID_HYBRID_W_PROB)
        assign('sigma_window', overrides?.thresholds?.sigma_window)

        assign('learning_rate', overrides?.gradient?.lr)
        assign('rl_gamma', overrides?.rl?.gamma)

        assign('lstm_window', overrides?.anomaly_model?.lstm?.window)
        assign('lstm_hidden_size', overrides?.anomaly_model?.lstm?.hidden_size)
        assign('lstm_num_layers', overrides?.anomaly_model?.lstm?.num_layers)
        assign('lstm_dropout', overrides?.anomaly_model?.lstm?.dropout)

        assign('episodes', values?.episodes)
        assign('num_agents', values?.num_agents ?? runtimeEnv?.SMARTGRID_NUM_AGENTS)
        assign('seeds', values?.seeds ?? runtimeEnv?.SMARTGRID_SEEDS)
        assign('fdi_rate', values?.fdi_rate ?? runtimeEnv?.SMARTGRID_FDI_RATE)
        assign('dos_rate', values?.dos_rate ?? runtimeEnv?.SMARTGRID_DOS_RATE)
        assign('chain_rate', values?.chain_rate ?? runtimeEnv?.SMARTGRID_CHAIN_RATE)
        assign('fault_rate', values?.fault_rate ?? runtimeEnv?.SMARTGRID_FAULT_RATE)
        assign('api_port', values?.api_port ?? runtimeEnv?.SMARTGRID_API_PORT)
        assign('scada_poll', values?.scada_poll ?? runtimeEnv?.SMARTGRID_SCADA_POLL_SEC)
        assign('scada_demo_phase', values?.scada_demo_phase ?? runtimeEnv?.SMARTGRID_SCADA_DEMO_ANOMALY_PHASE)
        assign('scada_rate_preset', values?.scada_rate_preset ?? runtimeEnv?.SMARTGRID_SCADA_INDEPENDENT_RATE_PRESET)
        assign('scada_anomaly_cycle_seconds', values?.scada_anomaly_cycle_seconds ?? runtimeEnv?.SMARTGRID_SCADA_ANOMALY_CYCLE_SECONDS)
        assign('scada_anomaly_intensity', values?.scada_anomaly_intensity ?? runtimeEnv?.SMARTGRID_SCADA_ANOMALY_INTENSITY)

        if (Object.keys(nextVals).length > 0) {
          setVals(prev => ({ ...prev, ...nextVals }))
          setPersistedVals(prev => ({ ...(prev ?? {}), ...nextVals }))
        }
      } catch {
      }
    }

    loadPersistedSettings()
  }, [])

  async function handleSave() {
    setValidationError(null)
    for (const key of REQUIRED_KEYS) {
      const value = vals[key]
      if (value === undefined || value === null || value === '') {
        setValidationError(`Missing required parameter: ${key}`)
        return
      }
    }

    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const response = await fetch('/api/settings/runtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vals),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.detail ?? `Save failed (${response.status})`)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (error) {
      setSaveError(String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div id="settings-configuration" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Settings & Configuration</h2>
          <p className="text-xs text-slate-500 mt-1">These settings drive experiment runs. Rapid SCADA live scoring uses a separate fixed SCADA profile.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVals({ ...PEAK_DEFAULTS })}
            title="Load peak-output defaults (DR ≈ 99.76%, FPR ≈ 0.24%)"
            className="flex items-center gap-1.5 text-xs bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded transition-colors font-semibold"
          >
            <RefreshCw size={11} /> Load Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 text-xs border px-4 py-1.5 rounded font-semibold transition-colors ${saved ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' : 'bg-slate-200/10 border-slate-400/40 text-slate-800 hover:bg-slate-200/20'} disabled:opacity-60`}
          >
            <Save size={11} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="glass-card border border-red-500/30 p-3 text-xs text-red-300">
          Persist failed: {saveError}
        </div>
      )}

      {validationError && (
        <div className="glass-card border border-amber-500/30 p-3 text-xs text-amber-700">
          {validationError}
        </div>
      )}

      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700">Operations:</span>
          <Link href="/integrations" className="text-slate-700 hover:underline">Integrations</Link>
          <span className="text-slate-600">•</span>
          <Link href="/scada-live" className="text-slate-700 hover:underline">SCADA Live</Link>
          <span className="text-slate-600">•</span>
          <Link href="/api-studio" className="text-slate-700 hover:underline">API Studio</Link>
          <span className="text-slate-600">•</span>
          <Link href="/reports" className="text-slate-700 hover:underline">Reports</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-0">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold rounded-t transition-colors ${tab === t ? 'bg-slate-200/10 text-slate-800 border-b-2 border-slate-300' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="glass-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PARAMS[tab].map(p => (
            <div key={p.key} className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">{p.label}</label>
              <input
                type={p.type}
                value={vals[p.key]}
                min={p.min}
                max={p.max}
                step={p.step}
                onChange={e => {
                  let nextValue: string | number = p.type === 'number' ? parseFloat(e.target.value) : e.target.value
                  if (p.type === 'number' && typeof nextValue === 'number' && !Number.isNaN(nextValue)) {
                    if (typeof p.min === 'number') nextValue = Math.max(p.min, nextValue)
                    if (typeof p.max === 'number') nextValue = Math.min(p.max, nextValue)
                  }
                  setVals(prev => {
                    if (p.key === 'audit_success_prob' && typeof nextValue === 'number' && !Number.isNaN(nextValue)) {
                      return {
                        ...prev,
                        audit_success_prob: nextValue,
                        missing_audit_prob: Math.max(0, Math.min(1, Number((1 - nextValue).toFixed(4)))),
                      }
                    }
                    if (p.key === 'missing_audit_prob' && typeof nextValue === 'number' && !Number.isNaN(nextValue)) {
                      return {
                        ...prev,
                        missing_audit_prob: nextValue,
                        audit_success_prob: Math.max(0, Math.min(1, Number((1 - nextValue).toFixed(4)))),
                      }
                    }
                    return { ...prev, [p.key]: nextValue }
                  })
                }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm px-3 py-2 rounded focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 font-mono"
              />
              <p className="text-xs text-slate-500">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
