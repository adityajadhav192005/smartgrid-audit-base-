'use client'
import { Bell, Search, RefreshCw, Play, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboard } from '@/lib/dashboardContext'

const SEARCH_ROUTES: Array<{ label: string; href: string }> = [
  { label: 'Experiment Operations Overview', href: '/experiment/overview' },
  { label: 'Experiment Risk Analytics', href: '/experiment/risk' },
  { label: 'Experiment Threat Events', href: '/experiment/threats' },
  { label: 'Experiment Audit Trail', href: '/experiment/audits' },
  { label: 'Experiment Response Workflow', href: '/experiment/response' },
  { label: 'Experiment Decision Explainability', href: '/experiment/xai' },
  { label: 'Experiment Asset Topology View', href: '/experiment/assets' },
  { label: 'Experiment Algorithm Config', href: '/experiment/methodology' },
  { label: 'Experiment Incident Timeline', href: '/experiment/timeline' },
  { label: 'Experiment System Health', href: '/experiment/system' },
  { label: 'Experiment Monitor', href: '/experiment/monitor' },
  { label: 'Experiment Control', href: '/experiment/control' },
  { label: 'Experiment History', href: '/experiment/history' },
  { label: 'Rapid SCADA Operations Overview', href: '/rapid-scada/overview' },
  { label: 'Rapid SCADA Risk Analytics', href: '/rapid-scada/risk' },
  { label: 'Rapid SCADA Monitor', href: '/rapid-scada/monitor' },
  { label: 'Rapid SCADA Threat Events', href: '/rapid-scada/threats' },
  { label: 'Rapid SCADA Audit Trail', href: '/rapid-scada/audits' },
  { label: 'Rapid SCADA Response Workflow', href: '/rapid-scada/response' },
  { label: 'Rapid SCADA Decision Explainability', href: '/rapid-scada/xai' },
  { label: 'Rapid SCADA Asset Topology View', href: '/rapid-scada/assets' },
  { label: 'Rapid SCADA Algorithm Config', href: '/rapid-scada/methodology' },
  { label: 'Rapid SCADA Incident Timeline', href: '/rapid-scada/timeline' },
  { label: 'Rapid SCADA System Health', href: '/rapid-scada/system' },
  { label: 'Rapid SCADA Grid', href: '/rapid-scada/grid' },
  { label: 'SCADA Connectivity', href: '/rapid-scada/connectivity' },
  { label: 'Platform Center', href: '/advanced' },
]

export function TopBar() {
  const router = useRouter()
  const [time, setTime] = useState('')
  const [uptime, setUptime] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const {
    searchQuery,
    setSearchQuery,
    triggerRefresh,
    notifications,
    unreadCount,
    markAllNotificationsRead,
    clearNotifications,
  } = useDashboard()

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB', { hour12: false }))
    tick()
    const interval = setInterval(() => { tick(); setUptime(u => u + 1) }, 1000)
    return () => clearInterval(interval)
  }, [])

  function handleSearchSubmit(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const normalized = searchQuery.trim().toLowerCase()
    if (!normalized) return
    const matched = SEARCH_ROUTES.find(r => r.label.toLowerCase().includes(normalized))
    if (matched) {
      router.push(matched.href)
      setSearchQuery('')
    }
  }

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  return (
    <div className="h-11 flex items-center px-4 gap-4 bg-slate-950 border-b border-slate-800 flex-shrink-0 relative">
      {/* Search */}
      <div className="flex items-center gap-2 flex-1 max-w-sm">
        <Search className="w-3.5 h-3.5 text-slate-500" />
        <input
          placeholder="Search agents, audits, attacks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchSubmit}
          className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none flex-1"
        />
      </div>

      <div className="flex-1" />

      {/* Status chips */}
      <div className="hidden lg:flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          System online
        </span>
        <span>·</span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          {formatUptime(uptime)}
        </span>
        <span>·</span>
        <span className="font-mono">{time}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          title="Refresh data"
          onClick={triggerRefresh}
          className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          title="Notifications"
          onClick={() => {
            setShowNotifications(v => !v)
            markAllNotificationsRead()
          }}
          className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors relative"
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-rose-500 rounded-full" />}
        </button>
        <button
          onClick={() => router.push('/experiment/control')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-700 text-slate-300 text-xs hover:border-slate-500 hover:text-slate-100 transition-colors"
        >
          <Play className="w-3 h-3" />
          Launch run
        </button>
      </div>

      {showNotifications && (
        <div className="absolute right-4 top-12 z-50 w-80 max-h-80 overflow-auto glass-card border border-slate-700/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">Notifications</span>
            <button onClick={clearNotifications} className="text-[10px] text-slate-500 hover:text-slate-200">Clear</button>
          </div>
          <div className="space-y-2">
            {notifications.length === 0 && (
              <div className="text-xs text-slate-500 py-2">No notifications yet.</div>
            )}
            {notifications.map(n => (
              <div key={n.id} className="rounded border border-slate-700/40 bg-grid-900/60 p-2">
                <div className="text-xs text-slate-200 font-semibold">{n.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{n.message}</div>
                <div className="text-[10px] text-slate-600 mt-1">{new Date(n.ts).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
