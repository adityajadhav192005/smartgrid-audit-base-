'use client'

import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Activity, Database, Shield, Gauge } from 'lucide-react'
import { formatPct } from '@/lib/utils'
import { useExperimentTelemetry } from '@/lib/experimentTelemetry'

export default function ExperimentSystemPage() {
  const { summary, health, statusCounts, events } = useExperimentTelemetry(8000)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Experiment System Health / Pipeline Health</h1>
        <p className="text-sm text-slate-500 mt-1">Latest-run backend health, experiment metrics, and pipeline quality indicators</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Run Status" value={String(summary?.status ?? 'unknown').toUpperCase()} color="blue" icon={<Activity size={14} />} />
        <KPIStatCard label="Cross-Layer Stability" value={formatPct(Number(health.crossLayerStability ?? 0), 2)} color="green" icon={<Shield size={14} />} />
        <KPIStatCard label="Attack Resistance" value={formatPct(Number(health.attackResistance ?? 0), 1)} color="teal" icon={<Gauge size={14} />} />
        <KPIStatCard label="Event Volume" value={events.length} color="amber" icon={<Database size={14} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Pipeline Indicators</h3>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Run ID', value: summary?.runId ?? 'n/a' },
              { label: 'Detection Accuracy', value: formatPct(Number(summary?.detectionAccuracy ?? 0), 2) },
              { label: 'Risk Mitigation', value: formatPct(Number(summary?.riskMitigation ?? 0), 1) },
              { label: 'Audit Coverage', value: formatPct(Number(summary?.auditCoverage ?? 0), 1) },
            ].map(item => (
              <div key={item.label} className="flex justify-between border-b border-slate-200/40 pb-2">
                <span className="text-slate-500">{item.label}</span>
                <span className="font-mono text-slate-700">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Current State Counts</h3>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Healthy', value: Number(statusCounts.healthy ?? 0) },
              { label: 'Anomalous', value: Number(statusCounts.anomalous ?? 0) },
              { label: 'Suspect', value: Number(statusCounts.suspect ?? 0) },
              { label: 'Under Audit', value: Number(statusCounts.underAudit ?? 0) },
              { label: 'Attacked', value: Number(statusCounts.attacked ?? 0) },
            ].map(item => (
              <div key={item.label} className="flex justify-between border-b border-slate-200/40 pb-2">
                <span className="text-slate-500">{item.label}</span>
                <span className="font-mono text-slate-700">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
