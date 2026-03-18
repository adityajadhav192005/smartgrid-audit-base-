'use client'
import { Bell, Search, RefreshCw, Play, Clock, ToggleLeft, ToggleRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { useDashboard } from '@/lib/dashboardContext'

const SEARCH_ROUTES: Array<{ label: string; href: string }> = [
  { label: 'Executive Overview', href: '/' },
  { label: 'Live Monitoring', href: '/live' },
  { label: 'SCADA Live Grid', href: '/scada-live' },
  { label: 'Audit Intelligence', href: '/audits' },
  { label: 'Attack Analysis', href: '/attacks' },
  { label: 'Anomaly & Risk', href: '/anomalies' },
  { label: 'Explainability (XAI)', href: '/xai' },
  { label: 'Response & Mitigation', href: '/response' },
  { label: 'Run Configuration', href: '/runs' },
  { label: 'Run History', href: '/history' },
  { label: 'Advanced Tools', href: '/advanced' },
]

export function TopBar() {
  const router = useRouter()
  const [time, setTime] = useState('')
  const [uptime, setUptime] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const {
    viewMode,
    setViewMode,
    scadaConnected,
    searchQuery,
    setSearchQuery,
    triggerRefresh,
    notifications,
    unreadCount,
    markAllNotificationsRead,
    clearNotifications,
  } = useDashboard()

  const onSignOut = async () => {
    try {
      const supabase = getSupabaseClient()
      await supabase.auth.signOut()
    } finally {
      router.push('/login')
    }
  }

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
    <div className="h-12 flex items-center px-4 gap-4 bg-grid-800 border-b border-white/5 flex-shrink-0 relative">
      {/* Search */}
      <div className="flex items-center gap-2 flex-1 max-w-sm">
        <Search className="w-3.5 h-3.5 text-slate-500" />
        <input
          placeholder="Search agents, audits, attacks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchSubmit}
          className="bg-transparent text-xs text-slate-400 placeholder:text-slate-600 outline-none flex-1"
        />
      </div>

      <div className="flex-1" />

      {/* Status chips */}
      <div className="hidden lg:flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          System Online
        </span>
        <span className="text-slate-600">|</span>
        <span className="flex items-center gap-1.5 text-cyan-400">
          <Clock className="w-3 h-3" />
          UPTIME: {formatUptime(uptime)}
        </span>
        <span className="text-slate-600">|</span>
        <span className="font-mono text-slate-400">{time}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          title={scadaConnected ? 'Switch to Rapid SCADA view' : 'Connect SCADA Live first'}
          disabled={!scadaConnected}
          onClick={() => setViewMode(viewMode === 'experiment' ? 'scada' : 'experiment')}
          className="px-2.5 py-1.5 rounded text-xs bg-white/5 border border-white/10 text-slate-300 hover:text-cyan-300 hover:border-cyan-400/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="inline-flex items-center gap-1">
            {viewMode === 'experiment' ? <ToggleLeft className="w-3 h-3" /> : <ToggleRight className="w-3 h-3" />}
            {viewMode === 'experiment' ? 'Experiment' : 'SCADA'}
          </span>
        </button>
        <button
          onClick={onSignOut}
          className="px-2.5 py-1.5 rounded text-xs bg-white/5 border border-white/10 text-slate-300 hover:text-cyan-300 hover:border-cyan-400/30 transition-colors"
        >
          Sign Out
        </button>
        <button
          title="Refresh data"
          onClick={triggerRefresh}
          className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          title="Notifications"
          onClick={() => {
            setShowNotifications(v => !v)
            markAllNotificationsRead()
          }}
          className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-colors relative"
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-400 rounded-full" />}
        </button>
        <button
          onClick={() => router.push('/runs')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/20 transition-colors"
        >
          <Play className="w-3 h-3" />
          Launch Run
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
