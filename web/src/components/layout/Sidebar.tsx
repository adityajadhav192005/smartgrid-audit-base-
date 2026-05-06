'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Activity, Shield, Zap, BarChart3, Brain,
  FlaskConical, History, AlertTriangle, ChevronRight,
  Cpu, MonitorPlay, Boxes, Plug2, Eye, SlidersHorizontal, Clock3, HeartPulse,
  Microscope, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboard } from '@/lib/dashboardContext'

const navGroups = [
  {
    label: 'Experiment Running',
    items: [
      { href: '/experiment/overview', label: 'Operations Overview', icon: LayoutDashboard },
      { href: '/experiment/risk', label: 'Risk Analytics', icon: BarChart3 },
      { href: '/experiment/threats', label: 'Threat Events', icon: Zap },
      { href: '/experiment/audits', label: 'Audit Trail', icon: Shield },
      { href: '/experiment/response', label: 'Response Workflow', icon: AlertTriangle },
      { href: '/experiment/xai', label: 'Decision Explainability', icon: Brain },
      { href: '/experiment/assets', label: 'Asset / Topology View', icon: Boxes },
      { href: '/experiment/methodology', label: 'Algorithm Config / Methodology View', icon: SlidersHorizontal },
      { href: '/experiment/timeline', label: 'Incident Timeline', icon: Clock3 },
      { href: '/experiment/system', label: 'System Health / Pipeline Health', icon: HeartPulse },
      { href: '/experiment/monitor', label: 'Experiment Monitor', icon: Activity },
      { href: '/experiment/control', label: 'Experiment Control', icon: FlaskConical },
      { href: '/experiment/history', label: 'Experiment History', icon: History },
    ],
  },
  {
    label: 'Rapid SCADA Live',
    items: [
      { href: '/rapid-scada/overview', label: 'Operations Overview', icon: LayoutDashboard },
      { href: '/rapid-scada/risk', label: 'Risk Analytics', icon: BarChart3 },
      { href: '/rapid-scada/monitor', label: 'Monitor', icon: Eye },
      { href: '/rapid-scada/threats', label: 'Threat Events', icon: Zap },
      { href: '/rapid-scada/audits', label: 'Audit Trail', icon: Shield },
      { href: '/rapid-scada/response', label: 'Response Workflow', icon: AlertTriangle },
      { href: '/rapid-scada/xai', label: 'Decision Explainability', icon: Brain },
      { href: '/rapid-scada/assets', label: 'Asset / Topology View', icon: Boxes },
      { href: '/rapid-scada/methodology', label: 'Algorithm Config / Methodology View', icon: SlidersHorizontal },
      { href: '/rapid-scada/timeline', label: 'Incident Timeline', icon: Clock3 },
      { href: '/rapid-scada/system', label: 'System Health / Pipeline Health', icon: HeartPulse },
      { href: '/rapid-scada/grid', label: 'Rapid SCADA Grid', icon: MonitorPlay },
      { href: '/rapid-scada/connectivity', label: 'SCADA Connectivity', icon: Plug2 },
    ],
  },
  {
    label: 'Research & Validation',
    items: [
      { href: '/report', label: 'Final Report', icon: FileText },
      { href: '/research', label: 'Ablation / Pareto / LSTM', icon: Microscope },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/advanced', label: 'Platform Center', icon: Boxes },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { scadaConnected } = useDashboard()

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-slate-950 border-r border-slate-800 overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded border border-slate-700 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100 leading-tight">SmartGrid MAS</div>
            <div className="text-[10px] text-slate-500 leading-tight">Audit framework dashboard</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="section-eyebrow px-3 mb-1">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/' && pathname.startsWith(href))
                return (
                  <li key={href}>
                    <Link href={href} className={cn('nav-link', active && 'nav-link-active')}>
                      <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 truncate">{label}</span>
                      {active && <ChevronRight className="w-3 h-3 opacity-50" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer status */}
      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Backend: Online
        </div>
        <div className="text-[10px] mt-0.5">
          <span className="text-slate-500">SCADA:</span>{' '}
          <span className={scadaConnected ? 'text-emerald-400' : 'text-amber-400'}>
            {scadaConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </aside>
  )
}
