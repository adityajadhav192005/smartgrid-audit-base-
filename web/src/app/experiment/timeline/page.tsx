'use client'

import { Badge } from '@/components/ui/Badge'
import { Clock, ListTree } from 'lucide-react'
import { useExperimentTelemetry } from '@/lib/experimentTelemetry'

export default function ExperimentTimelinePage() {
  const { events, summary } = useExperimentTelemetry(8000)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Experiment Incident Timeline</h1>
        <p className="text-sm text-slate-500 mt-1">Latest-run event sequence from detection through audit and response actions</p>
      </div>

      <div className="glass-card p-3 border-cyber-blue/20 text-xs text-slate-700">
        Run <span className="font-mono text-cyber-blue">{summary?.runId ?? 'n/a'}</span> · status {summary?.status ?? 'unknown'} · {events.length} timeline events
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
