'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { ViewModeBanner } from '@/components/ui/ViewModeBanner'
import { useDashboard } from '@/lib/dashboardContext'
import { Code2, FileBarChart2, Database, Plug2, ArrowUpRight } from 'lucide-react'

const TOOLS = [
  {
    href: '/api-studio',
    title: 'API Studio',
    description: 'Inspect and test backend endpoints from one place.',
    icon: Code2,
    tag: 'Developer',
  },
  {
    href: '/reports',
    title: 'Reports & Export',
    description: 'Generate and download run artifacts and reports.',
    icon: FileBarChart2,
    tag: 'Artifacts',
  },
  {
    href: '/datasets',
    title: 'Datasets',
    description: 'View benchmark and experimental dataset sources.',
    icon: Database,
    tag: 'Data',
  },
  {
    href: '/integrations',
    title: 'Integrations',
    description: 'Manage SCADA bridges and external connectors.',
    icon: Plug2,
    tag: 'Connectivity',
  },
]

export default function AdvancedPage() {
  const { viewMode, scadaConnected } = useDashboard()
  const scadaBlocked = viewMode === 'scada' && !scadaConnected

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Platform Center</h1>
        <p className="text-sm text-slate-500 mt-1">Secondary platform utilities for verification, reporting, APIs, and integrations</p>
      </div>

      <ViewModeBanner section="Platform Center" />

      {scadaBlocked && (
        <div className="glass-card p-5 border border-amber-500/30 text-amber-200 text-sm">
          Rapid SCADA view is selected, but SCADA is disconnected. Connect SCADA Live to enable this mode.
        </div>
      )}

      {!scadaBlocked && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {TOOLS.map((tool) => {
            const Icon = tool.icon
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="glass-card p-5 hover:border-cyan-500/30 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <Icon size={16} className="text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{tool.title}</div>
                      <div className="text-xs text-slate-500 mt-1">{tool.description}</div>
                    </div>
                  </div>
                  <ArrowUpRight size={14} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
                <div className="mt-3">
                  <Badge variant="info" className="text-[10px]">{tool.tag}</Badge>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
