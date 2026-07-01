'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Save, RefreshCw } from 'lucide-react'

type Param = { key: string; label: string; value: string | number; type: 'number' | 'text'; desc: string; min?: number; max?: number; step?: number }

const SECTIONS = ['Experiment Setup', 'Detection Tuning'] as const
type Section = typeof SECTIONS[number]

const REQUIRED_KEYS = ['episodes', 'fdi_rate', 'dos_rate', 'mitm_rate', 'chain_rate'] as const

const PARAMS: Record<Section, Param[]> = {
  'Experiment Setup': [
    { key: 'seeds', label: 'Seeds (comma-separated)', value: '42,43,44', type: 'text', desc: 'Reproducible random seeds for multi-run experiments.' },
    { key: 'episodes', label: 'Training Episodes', value: 200, type: 'number', min: 10, max: 2000, step: 10, desc: 'Number of RL training episodes per run.' },
    { key: 'fdi_rate', label: 'FDI Attack Rate', value: 0.10, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Probability of False Data Injection attacks per timestep.' },
    { key: 'dos_rate', label: 'DoS Attack Rate', value: 0.05, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Probability of Denial of Service attacks per timestep.' },
    { key: 'mitm_rate', label: 'MITM Attack Rate', value: 0.03, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Probability of Man-in-the-Middle attacks per timestep.' },
    { key: 'chain_rate', label: 'Chain Attack Rate', value: 0.20, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Probability of coordinated multi-agent attacks.' },
    { key: 'fault_rate', label: 'Physical Fault Rate', value: 0.20, type: 'number', min: 0.0, max: 1.0, step: 0.01, desc: 'Probability of physical faults (voltage sag, overcurrent, frequency deviation).' },
    { key: 'audit_protection_window', label: 'Audit Protection Window', value: 0, type: 'number', min: 0, max: 288, step: 1, desc: 'Timesteps an agent is protected after audit. Set to 0 for evaluation mode (no protection, all attacks visible for detection metrics).' },
  ],
  'Detection Tuning': [
    { key: 'anomaly_th', label: 'Anomaly Score Threshold', value: 0.25, type: 'number', min: 0.05, max: 5.0, step: 0.05, desc: 'Agent flagged anomalous when deviation score exceeds this value.' },
    { key: 'prob_threshold', label: 'Anomaly Probability Threshold', value: 0.43, type: 'number', min: 0.1, max: 1.0, step: 0.01, desc: 'LSTM probability cutoff for anomaly detection.' },
    { key: 'risk_threshold', label: 'Risk Threshold', value: 0.5, type: 'number', min: 0.05, max: 1.0, step: 0.05, desc: 'Risk score above which agents are prioritized for audit.' },
    { key: 'audit_budget_ratio', label: 'Audit Budget Ratio', value: 0.07, type: 'number', min: 0.01, max: 0.5, step: 0.01, desc: 'Fraction of total budget allocated to dynamic audits.' },
  ],
}

const DEFAULTS: Record<string, string | number> = {
  seeds: '42,43,44',
  episodes: 200,
  fdi_rate: 0.10,
  dos_rate: 0.05,
  mitm_rate: 0.03,
  chain_rate: 0.20,
  fault_rate: 0.20,
  audit_protection_window: 0,
  anomaly_th: 0.25,
  prob_threshold: 0.43,
  risk_threshold: 0.5,
  audit_budget_ratio: 0.07,
}

export function SettingsConfigurationPanel() {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
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

        assign('seeds', values?.seeds ?? runtimeEnv?.SMARTGRID_SEEDS)
        assign('episodes', values?.episodes)
        assign('fdi_rate', values?.fdi_rate ?? runtimeEnv?.SMARTGRID_FDI_RATE)
        assign('dos_rate', values?.dos_rate ?? runtimeEnv?.SMARTGRID_DOS_RATE)
        assign('mitm_rate', values?.mitm_rate ?? runtimeEnv?.SMARTGRID_MITM_RATE)
        assign('chain_rate', values?.chain_rate ?? runtimeEnv?.SMARTGRID_CHAIN_RATE)
        assign('fault_rate', values?.fault_rate ?? runtimeEnv?.SMARTGRID_FAULT_RATE)
        assign('audit_protection_window', values?.audit_protection_window ?? runtimeEnv?.SMARTGRID_AUDIT_PROTECTION_WINDOW)
        assign('anomaly_th', overrides?.thresholds?.score_threshold ?? values?.anomaly_th)
        assign('prob_threshold', overrides?.thresholds?.prob_threshold ?? values?.prob_threshold)
        assign('risk_threshold', overrides?.audit?.risk_threshold ?? values?.risk_threshold)
        assign('audit_budget_ratio', overrides?.audit?.audit_budget_ratio ?? values?.audit_budget_ratio)

        if (Object.keys(nextVals).length > 0) {
          setVals(prev => ({ ...prev, ...nextVals }))
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
          <p className="text-xs text-slate-500 mt-1">Core parameters for experiment runs. All other settings use tuned defaults.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVals({ ...DEFAULTS })}
            title="Reset to tuned defaults"
            className="flex items-center gap-1.5 text-xs bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded transition-colors font-semibold"
          >
            <RefreshCw size={11} /> Reset Defaults
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
          <span className="text-slate-600">&#x2022;</span>
          <Link href="/scada-live" className="text-slate-700 hover:underline">SCADA Live</Link>
          <span className="text-slate-600">&#x2022;</span>
          <Link href="/api-studio" className="text-slate-700 hover:underline">API Studio</Link>
          <span className="text-slate-600">&#x2022;</span>
          <Link href="/reports" className="text-slate-700 hover:underline">Reports</Link>
        </div>
      </div>

      {SECTIONS.map(section => (
        <div key={section} className="glass-card p-6">
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-4">{section}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PARAMS[section].map(p => (
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
                    setVals(prev => ({ ...prev, [p.key]: nextValue }))
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm px-3 py-2 rounded focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300 font-mono"
                />
                <p className="text-xs text-slate-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
