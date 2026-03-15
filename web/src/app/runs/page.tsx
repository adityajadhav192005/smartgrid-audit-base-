'use client'
import { useState } from 'react'
import { runHistory } from '@/lib/mockData'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Badge } from '@/components/ui/Badge'
import { formatPct } from '@/lib/utils'
import { Play, Settings2, Clock } from 'lucide-react'

const configPresets = [
  { id: 'default',  label: 'Default (N=100, FDI+DoS)' },
  { id: 'large',    label: 'Large Grid (N=500)'        },
  { id: 'fdi_only', label: 'FDI Only'                  },
  { id: 'chain',    label: 'Coordinated Chain'         },
]

export default function RunsPage() {
  const [n, setN]             = useState('100')
  const [attacks, setAttacks] = useState<string[]>(['FDI', 'DoS'])
  const [episodes, setEpisodes] = useState('200')
  const [preset, setPreset]   = useState('default')

  const toggle = (a: string) => setAttacks(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Run Configuration</h1>
        <p className="text-sm text-slate-400 mt-1">Configure and launch simulation experiments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Config card */}
        <div className="glass-card p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Settings2 size={14} className="text-cyber-blue" />
            <h3 className="text-sm font-semibold text-slate-200">Experiment Parameters</h3>
          </div>

          {/* Presets */}
          <div>
            <label className="text-xs text-slate-500 mb-2 block font-medium uppercase tracking-wider">Quick Presets</label>
            <div className="flex flex-wrap gap-2">
              {configPresets.map(p => (
                <button key={p.id} onClick={() => setPreset(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${preset === p.id ? 'bg-cyber-teal/20 border-cyber-teal/50 text-cyber-teal' : 'border-slate-700/50 text-slate-500 hover:text-slate-300'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* N agents */}
            <div>
              <label className="text-xs text-slate-500 block mb-1.5 font-medium">Number of Agents (N)</label>
              <select value={n} onChange={e => setN(e.target.value)}
                className="w-full bg-grid-900 border border-slate-700/60 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyber-blue/50">
                {['100', '200', '500'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            {/* Training episodes */}
            <div>
              <label className="text-xs text-slate-500 block mb-1.5 font-medium">Training Episodes</label>
              <input type="number" value={episodes} onChange={e => setEpisodes(e.target.value)}
                className="w-full bg-grid-900 border border-slate-700/60 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyber-blue/50" />
            </div>
          </div>

          {/* Attack types */}
          <div>
            <label className="text-xs text-slate-500 mb-2 block font-medium uppercase tracking-wider">Attack Scenarios</label>
            <div className="flex flex-wrap gap-2">
              {['FDI', 'DoS', 'Jamming', 'Coordinated', 'MITM', 'Replay'].map(a => (
                <button key={a} onClick={() => toggle(a)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${attacks.includes(a) ? 'bg-cyber-red/20 border-cyber-red/50 text-cyber-red' : 'border-slate-700/50 text-slate-500 hover:text-slate-300'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Reward weights */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">λ_audit (cost penalty)</label>
              <input type="number" defaultValue="0.2" step="0.05"
                className="w-full bg-grid-900 border border-slate-700/60 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyber-blue/50" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">λ_attack (security penalty)</label>
              <input type="number" defaultValue="5.0" step="0.5"
                className="w-full bg-grid-900 border border-slate-700/60 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyber-blue/50" />
            </div>
          </div>

          {/* Launch button */}
          <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyber-blue text-grid-900 font-bold text-sm hover:bg-cyber-blue/90 transition-colors">
            <Play size={14} /> Launch Experiment
          </button>
        </div>

        {/* Recent runs */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-200">Recent Runs</h3>
          </div>
          <div className="space-y-2">
            {runHistory.slice(0, 4).map(r => (
              <div key={r.id} className="glass-card p-2.5 border-slate-700/30 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-cyber-blue text-[10px]">{r.id}</span>
                  <Badge variant={r.status === 'Running' ? 'auditing' : 'low'} pulse={r.status === 'Running'}>{r.status}</Badge>
                </div>
                <div className="text-slate-400">N={r.agents} — {r.attacks}</div>
                <div className="flex gap-3 mt-1 text-slate-500">
                  <span>Cost: {formatPct(r.costEfficiency)}</span>
                  <span>Risk: {formatPct(r.riskMitigation)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
