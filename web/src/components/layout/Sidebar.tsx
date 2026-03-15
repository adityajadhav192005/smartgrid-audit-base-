'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Activity, Shield, Zap, BarChart3, Brain,
  FlaskConical, History, Settings, Database, Code2, Plug2,
  FileBarChart2, AlertTriangle, ChevronRight, Cpu, MonitorPlay, Link2
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navGroups = [
  {
    label: 'Operations',
    items: [
      { href: '/', label: 'Executive Overview', icon: LayoutDashboard },
      { href: '/live',        label: 'Live Monitoring',    icon: Activity    },
      { href: '/scada-live',  label: 'SCADA Live Grid',    icon: MonitorPlay },
      { href: '/audits',      label: 'Audit Intelligence', icon: Shield      },
      { href: '/attacks', label: 'Attack Analysis', icon: Zap },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { href: '/anomalies', label: 'Anomaly & Risk', icon: BarChart3 },
      { href: '/xai', label: 'Explainability (XAI)', icon: Brain },
      { href: '/response', label: 'Response & Mitigation', icon: AlertTriangle },
    ],
  },
  {
    label: 'Research',
    items: [
      { href: '/runs', label: 'Run Configuration', icon: FlaskConical },
      { href: '/history', label: 'Run History', icon: History },
      { href: '/datasets', label: 'Datasets', icon: Database },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/api-studio',  label: 'API Studio',        icon: Code2        },
      { href: '/integrations', label: 'Integrations',        icon: Plug2        },
      { href: '/blockchain',   label: 'Blockchain Ledger',  icon: Link2        },
      { href: '/reports',      label: 'Reports & Export',   icon: FileBarChart2},
      { href: '/settings',     label: 'Settings',           icon: Settings     },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-grid-800 border-r border-white/5 overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white leading-tight">SmartGrid AI</div>
            <div className="text-[10px] text-slate-500 leading-tight">Control Center v2.0</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="section-header px-3">{group.label}</p>
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
          <div className="text-[10px] text-slate-600 mt-0.5">API: deployment-configured</div>
      </div>
    </aside>
  )
}
