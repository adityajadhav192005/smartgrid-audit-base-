'use client'

import { MonitorPlay, Radio, ToggleLeft, ToggleRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboard } from '@/lib/dashboardContext'

type ViewModeBannerProps = {
  section: string
  className?: string
}

export function ViewModeBanner({ section, className }: ViewModeBannerProps) {
  const { viewMode, setViewMode, scadaConnected } = useDashboard()

  const modeLabel = viewMode === 'scada' ? 'Rapid SCADA View' : 'Experiment View'
  const modeHelp = viewMode === 'scada'
    ? 'Showing SCADA-oriented live operational view.'
    : 'Showing experiment-run analytics and simulation outputs.'

  return (
    <div className={cn('glass-card p-3 border border-slate-700/40 flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm">
          {viewMode === 'scada' ? <MonitorPlay size={14} className="text-cyber-teal" /> : <Radio size={14} className="text-cyber-blue" />}
          <span className="text-slate-200 font-semibold">{section} · {modeLabel}</span>
        </div>
        <p className="text-xs text-slate-500">{modeHelp}</p>
        {!scadaConnected && (
          <p className="text-xs text-amber-400">SCADA mode is disabled until SCADA Live connection is active.</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode('experiment')}
          className={cn(
            'px-3 py-1.5 text-xs rounded border transition-colors',
            viewMode === 'experiment'
              ? 'bg-cyber-blue/20 border-cyber-blue/50 text-cyber-blue'
              : 'border-slate-700/60 text-slate-400 hover:text-slate-200'
          )}
        >
          <span className="inline-flex items-center gap-1"><ToggleLeft size={12} /> Experiment</span>
        </button>
        <button
          onClick={() => setViewMode('scada')}
          disabled={!scadaConnected}
          className={cn(
            'px-3 py-1.5 text-xs rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
            viewMode === 'scada'
              ? 'bg-cyber-teal/20 border-cyber-teal/50 text-cyber-teal'
              : 'border-slate-700/60 text-slate-400 hover:text-slate-200'
          )}
          title={scadaConnected ? 'Switch to Rapid SCADA mode' : 'Connect SCADA Live first'}
        >
          <span className="inline-flex items-center gap-1"><ToggleRight size={12} /> Rapid SCADA</span>
        </button>
      </div>
    </div>
  )
}
