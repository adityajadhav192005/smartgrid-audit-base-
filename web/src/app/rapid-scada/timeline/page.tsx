'use client'

import { Badge } from '@/components/ui/Badge'
import { Clock, ListTree } from 'lucide-react'
import { useLiveTelemetry } from '@/lib/liveTelemetry'

export default function RapidScadaTimelinePage() {
  const { events, gridStatus } = useLiveTelemetry(3000)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Rapid SCADA Incident Timeline</h1>
        <p className="text-sm text-slate-500 mt-1">Live SCADA event sequence from deviation detection through audit and decision updates</p>
      </div>

      <div className="glass-card p-3 border-cyber-blue/20 text-xs text-slate-700">
        Feed <span className="font-mono text-cyber-blue">{gridStatus?.live_verification?.run_id ?? 'SCADA-LIVE'}</span> · {events.length} timeline events
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <ListTree size={14} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-800">Timeline</h3>
        </div>
        <div className="space-y-3">
          {events.map((event, index) => (
            <div key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[10px] font-bold text-cyan-300">
                  {index + 1}
                </div>
                {index < events.length - 1 && <div className="w-px flex-1 bg-slate-700/60 mt-1" />}
              </div>
              <div className="glass-card p-3 border-slate-200 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={event.severity === 'critical' ? 'critical' : event.severity === 'high' ? 'high' : event.severity === 'medium' ? 'medium' : 'info'}>
                      {event.type}
                    </Badge>
                    <span className="text-xs text-slate-500">{event.ts}</span>
                  </div>
                  <Clock size={12} className="text-slate-600" />
                </div>
                <p className="text-sm text-slate-700 mt-2">{event.msg}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
