'use client'
import { cn } from '@/lib/utils'

interface BadgeProps {
  variant?: 'default' | 'critical' | 'high' | 'medium' | 'low' | 'info' | 'healthy' | 'anomalous' | 'auditing' | 'suspect'
  children: React.ReactNode
  className?: string
  pulse?: boolean
}

const variants: Record<string, string> = {
  default:   'bg-slate-700/60 text-slate-700 border-slate-200',
  critical:  'bg-red-950/60   text-red-400   border-red-700/50',
  high:      'bg-orange-950/60 text-orange-400 border-orange-700/50',
  medium:    'bg-amber-950/60 text-amber-600  border-amber-700/50',
  low:       'bg-green-950/60 text-green-400  border-green-700/50',
  info:      'bg-blue-950/60  text-blue-400   border-blue-700/50',
  healthy:   'bg-emerald-950/60 text-emerald-600 border-emerald-700/50',
  anomalous: 'bg-orange-950/60  text-orange-300 border-orange-700/50',
  auditing:  'bg-cyan-950/60  text-cyan-400   border-cyan-700/50',
  suspect:   'bg-yellow-950/60 text-yellow-400 border-yellow-700/50',
}

export function Badge({ variant = 'default', children, className, pulse = false }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border',
      variants[variant],
      className
    )}>
      {pulse && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full animate-pulse',
          variant === 'critical' ? 'bg-red-400' :
          variant === 'high'     ? 'bg-orange-400' :
          variant === 'healthy'  ? 'bg-emerald-400' :
          variant === 'auditing' ? 'bg-cyan-400' : 'bg-current'
        )} />
      )}
      {children}
    </span>
  )
}

// Severity badge shorthand
export function SeverityBadge({ severity }: { severity: string }) {
  const v = severity.toLowerCase() as BadgeProps['variant']
  return <Badge variant={v}>{severity}</Badge>
}

// Agent state badge
export function StateBadge({ state }: { state: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    'Healthy': 'healthy',
    'Anomalous': 'anomalous',
    'Under Audit': 'auditing',
    'Attacked': 'critical',
    'Suspect': 'suspect',
    'Isolated': 'info',
  }
  return <Badge variant={map[state] ?? 'default'} pulse={state === 'Under Audit' || state === 'Attacked'}>{state}</Badge>
}
