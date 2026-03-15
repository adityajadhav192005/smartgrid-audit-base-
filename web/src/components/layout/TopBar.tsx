'use client'
import { Bell, Search, RefreshCw, Play, Clock, Cpu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabaseClient'

export function TopBar() {
  const router = useRouter()
  const [time, setTime] = useState('')
  const [uptime, setUptime] = useState(0)

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

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  return (
    <div className="h-12 flex items-center px-4 gap-4 bg-grid-800 border-b border-white/5 flex-shrink-0">
      {/* Search */}
      <div className="flex items-center gap-2 flex-1 max-w-sm">
        <Search className="w-3.5 h-3.5 text-slate-500" />
        <input
          placeholder="Search agents, audits, attacks..."
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
        <span className="flex items-center gap-1.5 text-slate-400">
          <Cpu className="w-3 h-3" />
          RL Policy Active
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
          onClick={onSignOut}
          className="px-2.5 py-1.5 rounded text-xs bg-white/5 border border-white/10 text-slate-300 hover:text-cyan-300 hover:border-cyan-400/30 transition-colors"
        >
          Sign Out
        </button>
        <button
          title="Refresh data"
          className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          title="Notifications"
          className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-colors relative"
        >
          <Bell className="w-3.5 h-3.5" />
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-400 rounded-full" />
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/20 transition-colors">
          <Play className="w-3 h-3" />
          Launch Run
        </button>
      </div>
    </div>
  )
}
