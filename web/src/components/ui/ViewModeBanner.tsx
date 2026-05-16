'use client'

import { MonitorPlay, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'

type ViewModeBannerProps = {
  section: string
  mode?: 'experiment' | 'scada'
  className?: string
}

export function ViewModeBanner({ section, mode = 'experiment', className }: ViewModeBannerProps) {
  const modeLabel = mode === 'scada' ? 'Rapid SCADA Live' : 'Experiment Latest Run'
  const modeHelp = mode === 'scada'
    ? 'This module follows live Rapid SCADA telemetry and updates continuously.'
    : 'This module is mapped to the latest experiment run and does not switch into SCADA mode.'

  return (
    <div className={cn('glass-card p-3 border border-slate-200 flex items-center justify-between gap-3', className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm">
          {mode === 'scada' ? <MonitorPlay size={14} className="text-cyber-teal" /> : <Radio size={14} className="text-cyber-blue" />}
          <span className="text-slate-800 font-semibold">{section} - {modeLabel}</span>
        </div>
        <p className="text-xs text-slate-500">{modeHelp}</p>
      </div>
    </div>
  )
}
