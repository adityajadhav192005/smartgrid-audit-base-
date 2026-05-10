'use client'

import { Badge } from '@/components/ui/Badge'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Brain, SlidersHorizontal, Shield, Sigma } from 'lucide-react'
import { useLiveTelemetry } from '@/lib/liveTelemetry'

export default function RapidScadaMethodologyPage() {
  const { gridStatus } = useLiveTelemetry(3000)
  const config = gridStatus?.rapid_scada?.config
  const threshold = Number(config?.score_threshold ?? 3)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Rapid SCADA Algorithm Config / Methodology</h1>
        <p className="text-sm text-slate-400 mt-1">Live SCADA scoring profile, per-type baselines, and audit trigger rules</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Audit Threshold" value={threshold.toFixed(2)} color="amber" icon={<SlidersHorizontal size={14} />} />
        <KPIStatCard label="Gen Current" value={Number(config?.profiles?.generator?.phys_defaults?.current ?? 15).toFixed(1)} color="blue" icon={<Brain size={14} />} />
        <KPIStatCard label="Substation Power" value={Number(config?.profiles?.substation?.phys_defaults?.power ?? 180).toFixed(0)} color="teal" icon={<Sigma size={14} />} />
        <KPIStatCard label="PMU Latency" value={Number(config?.profiles?.pmu?.cyber_defaults?.latency ?? 2).toFixed(1)} color="green" icon={<Shield size={14} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Method Summary</h3>
          <div className="text-sm text-slate-300 leading-relaxed">
            The Rapid SCADA path uses a live cyber-physical deviation model with fixed SCADA profiles. Each asset type has dedicated physical
            and cyber baselines, and audit escalation is triggered when the live deviation score exceeds the SCADA threshold.
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            <div><span className="text-slate-500">Telemetry source:</span> live Rapid SCADA + bridge normalization</div>
            <div><span className="text-slate-500">Profiles:</span> generator, substation, PMU, breaker</div>
            <div><span className="text-slate-500">Fallback handling:</span> live / mixed / fallback provenance</div>
            <div><span className="text-slate-500">Decision path:</span> score, severity, audit action</div>
          </div>
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Core Rules</h3>
          <div className="space-y-3 text-xs">
            {[
              { label: 'Detection rule', value: 'SCADA score = weighted physical + cyber deviation' },
              { label: 'Audit trigger', value: `score > ${threshold.toFixed(2)}` },
              { label: 'Source labels', value: 'live / mixed / fallback-filled' },
              { label: 'Asset-specific profiles', value: 'GEN, SUB, PMU, BRK each use separate defaults' },
            ].map(item => (
              <div key={item.label} className="glass-card p-3 border-slate-700/30">
                <div className="text-slate-500">{item.label}</div>
                <div className="text-slate-200 mt-1">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Design Notes</h3>
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">Live SCADA only</Badge>
          <Badge variant="healthy">Explainable</Badge>
          <Badge variant="auditing">Per-type profiles</Badge>
          <Badge variant="high">Cyber-physical</Badge>
        </div>
      </div>
    </div>
  )
}
