'use client'

import { ViewModeBanner } from '@/components/ui/ViewModeBanner'
import { useDashboard } from '@/lib/dashboardContext'
import { Server, Cpu, Shield, BarChart3 } from 'lucide-react'

const PLATFORM_INFO = [
  { label: 'Backend', value: 'FastAPI on port 8000', icon: Server },
  { label: 'Frontend', value: 'Next.js 14 on port 3000', icon: Cpu },
  { label: 'Detection', value: '3-Modality + Multi-Layer', icon: Shield },
  { label: 'Scheduler', value: 'Hybrid Q-Learning + Gradient', icon: BarChart3 },
]

export default function AdvancedPage() {
  const { viewMode, scadaConnected } = useDashboard()
  const scadaBlocked = viewMode === 'scada' && !scadaConnected

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Platform Center</h1>
        <p className="text-sm text-slate-400 mt-1">System overview and platform information</p>
      </div>

      <ViewModeBanner section="Platform Center" />

      {scadaBlocked && (
        <div className="glass-card p-5 border border-amber-500/30 text-amber-200 text-sm">
          Rapid SCADA view is selected, but SCADA is disconnected. Connect SCADA Live to enable this mode.
        </div>
      )}

      {!scadaBlocked && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PLATFORM_INFO.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className="glass-card p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Icon size={16} className="text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{item.label}</div>
                    <div className="text-sm font-semibold text-slate-200">{item.value}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
