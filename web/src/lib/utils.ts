import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number, decimals = 1) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(decimals)}k`
  return n.toFixed(decimals)
}

export function formatPct(n: number, decimals = 1) {
  return `${(n * 100).toFixed(decimals)}%`
}

export function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function severityColor(severity: string) {
  switch (severity?.toLowerCase()) {
    case 'critical': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'high':     return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
    case 'medium':   return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    case 'low':      return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
    default:         return 'text-slate-400 bg-slate-400/10 border-slate-400/20'
  }
}

export function statusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'anomalous':
    case 'attacked':
    case 'critical':   return 'text-red-400'
    case 'suspect':
    case 'warning':    return 'text-amber-400'
    case 'healthy':
    case 'normal':
    case 'mitigated':  return 'text-emerald-400'
    case 'auditing':
    case 'pending':    return 'text-cyan-400'
    default:           return 'text-slate-400'
  }
}
