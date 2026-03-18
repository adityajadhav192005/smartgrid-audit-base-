'use client'
import { cn } from '@/lib/utils'

interface KPIStatCardProps {
  label: string
  value: string | number
  help?: string
  sub?: string
  trend?: 'up' | 'down' | 'flat'
  trendValue?: string
  color?: 'blue' | 'green' | 'amber' | 'red' | 'teal' | 'purple'
  icon?: React.ReactNode
  className?: string
}

const styleMap = {
  blue:   { border: 'border-cyber-blue/30',   text: 'text-cyber-blue',   glow: 'group-hover:shadow-[0_0_20px_rgba(0,212,255,0.15)]' },
  green:  { border: 'border-cyber-green/30',  text: 'text-cyber-green',  glow: 'group-hover:shadow-[0_0_20px_rgba(57,255,20,0.15)]'  },
  amber:  { border: 'border-cyber-amber/30',  text: 'text-cyber-amber',  glow: 'group-hover:shadow-[0_0_20px_rgba(255,183,0,0.15)]'  },
  red:    { border: 'border-cyber-red/30',    text: 'text-cyber-red',    glow: 'group-hover:shadow-[0_0_20px_rgba(255,56,96,0.15)]'   },
  teal:   { border: 'border-cyber-teal/30',   text: 'text-cyber-teal',   glow: 'group-hover:shadow-[0_0_20px_rgba(0,245,212,0.15)]'  },
  purple: { border: 'border-purple-500/30',   text: 'text-purple-400',   glow: 'group-hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]' },
}

const DEFAULT_HELP: Record<string, string> = {
  'Detection Accuracy': 'Share of correctly classified events over all evaluated events.',
  'Risk Mitigation': 'Relative reduction in risk after applying adaptive audits and response.',
  'Cost Efficiency': 'Cost reduction achieved compared to baseline audit strategy.',
  'Precision / Recall': 'Precision = correctness of positive detections; Recall = coverage of true incidents.',
  'Active Anomalies': 'Current count of agents/events flagged as abnormal.',
  'Audit Coverage': 'Portion of priority/high-risk agents that received audits.',
  'Cross-Layer Stab.': 'Combined physical + cyber stability consistency index.',
  'Avg Anomaly Score': 'Average normalized anomaly score across monitored agents.',
}

export function KPIStatCard({ label, value, help, sub, trend, trendValue, color = 'blue', icon, className }: KPIStatCardProps) {
  const s = styleMap[color]
  return (
    <div className={cn(
      'group glass-card p-4 flex flex-col gap-1 transition-all duration-200',
      s.border, s.glow, className
    )} title={help ?? DEFAULT_HELP[label] ?? label}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</span>
        {icon && <span className={cn('opacity-60 group-hover:opacity-100', s.text)}>{icon}</span>}
      </div>
      <div className={cn('text-2xl font-bold font-mono', s.text)}>{value}</div>
      <div className="flex items-center gap-2">
        {sub && <span className="text-xs text-slate-500">{sub}</span>}
        {trend && trendValue && (
          <span className={cn('text-xs font-medium',
            trend === 'up' ? 'text-cyber-green' : trend === 'down' ? 'text-cyber-red' : 'text-slate-500'
          )}>
            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '─'} {trendValue}
          </span>
        )}
      </div>
    </div>
  )
}
