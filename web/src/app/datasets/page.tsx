'use client'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { Badge } from '@/components/ui/Badge'
import { Database } from 'lucide-react'

const datasets = [
  { id: 'UCI-GRID',  name: 'UCI Grid Stability',       source: 'archive.ics.uci.edu',             rows: 60000, features: 14, split: '80/20', active: true,  description: 'Electrical grid stability simulated data with 4-machine 2-state star topology. Used for baseline anomaly benchmarking.' },
  { id: 'NREL',      name: 'NREL Load & Demand',        source: 'data.nrel.gov',                   rows: 87600, features: 8,  split: '80/20', active: false, description: 'Hourly load demand and renewable generation data for realistic grid disturbance profiles.' },
  { id: 'IEEE-PES',  name: 'IEEE PES Test Cases',       source: 'labs.ece.uw.edu/pstca',            rows: 12400, features: 20, split: '75/25', active: false, description: 'Real-world contingency cases from the IEEE Power Systems Test Case Archive for fault analysis.' },
  { id: 'SYNTHETIC', name: 'Synthetic FDI+DoS Dataset', source: 'Generated — MATLAB Simulink',      rows: 50000, features: 16, split: '80/20', active: false, description: 'Custom synthetic dataset with injected FDI, DoS, and MITM attack signatures. Used for RL training stress tests.' },
]

export default function DatasetsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Dataset Management</h1>
        <p className="text-sm text-slate-400 mt-1">Real-world and synthetic data sources for training and evaluation</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Datasets"         value={datasets.length}    color="blue"   icon={<Database size={14} />} />
        <KPIStatCard label="Active"           value={1}                  color="green"  />
        <KPIStatCard label="Total Samples"    value="210k+"              color="teal"   />
        <KPIStatCard label="Avg Features"     value="14.5"               color="amber"  />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {datasets.map(ds => (
          <div key={ds.id} className={`glass-card p-4 space-y-3 border transition-colors ${ds.active ? 'border-cyber-green/30' : 'border-slate-700/30'}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-slate-200">{ds.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{ds.source}</div>
              </div>
              {ds.active && <Badge variant="healthy" pulse>Active</Badge>}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{ds.description}</p>
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span>Rows: <span className="text-slate-300">{ds.rows.toLocaleString()}</span></span>
              <span>Features: <span className="text-slate-300">{ds.features}</span></span>
              <span>Split: <span className="text-slate-300">{ds.split}</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
