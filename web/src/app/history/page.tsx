'use client'
import { runHistory } from '@/lib/mockData'
import { Badge } from '@/components/ui/Badge'
import { KPIStatCard } from '@/components/ui/KPIStatCard'
import { formatPct } from '@/lib/utils'
import { BarChart2, TrendingUp, Database, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const GRID_COLOR = 'rgba(255,255,255,0.05)'
const LABEL_STYLE = { fill: '#94a3b8', fontSize: 11 }
const TIP_STYLE = { backgroundColor: '#0a1628', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }

export default function HistoryPage() {
  const compData = runHistory.map(r => ({
    id: r.id.split('-').slice(-2).join('-'),
    costEff: +(r.costEfficiency * 100).toFixed(1),
    riskMit: +(r.riskMitigation * 100).toFixed(1),
    accuracy: 99.5 + Math.random() * 0.5,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Run History &amp; Comparison</h1>
        <p className="text-sm text-slate-400 mt-1">Compare experiment results across agent counts and attack scenarios</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStatCard label="Total Runs"     value={runHistory.length} color="blue"  icon={<Database size={14} />} />
        <KPIStatCard label="Best Cost Eff." value={formatPct(Math.max(...runHistory.map(r => r.costEfficiency)))} color="green" icon={<TrendingUp size={14} />} />
        <KPIStatCard label="Best Risk Mit." value={formatPct(Math.max(...runHistory.map(r => r.riskMitigation)))} color="teal"  icon={<BarChart2 size={14} />} />
        <KPIStatCard label="Avg Duration"   value="8m 32s" color="amber" icon={<Clock size={14} />} />
      </div>

      {/* Comparison chart */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Performance Comparison — All Runs</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="id" tick={LABEL_STYLE} tickLine={false} />
              <YAxis tick={LABEL_STYLE} tickLine={false} axisLine={false} domain={[0, 110]} unit="%" />
              <Tooltip contentStyle={TIP_STYLE} formatter={(v: any) => [`${v}%`]} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              <Bar dataKey="costEff"  name="Cost Efficiency"  fill="#00d4ff" radius={[4,4,0,0]} maxBarSize={30} />
              <Bar dataKey="riskMit"  name="Risk Mitigation"  fill="#ffb700" radius={[4,4,0,0]} maxBarSize={30} />
              <Bar dataKey="accuracy" name="Detection Acc."   fill="#39ff14" radius={[4,4,0,0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Runs table */}
      <div className="glass-card overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/60 text-slate-500">
              {['Run ID', 'Date', 'N', 'Attacks', 'Audits', 'Anomalies', 'Cost Eff.', 'Risk Mit.', 'Stability', 'XAI', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runHistory.map(r => (
              <tr key={r.id} className="data-table-row border-b border-slate-800/40">
                <td className="px-4 py-2.5 font-mono text-cyber-blue">{r.id}</td>
                <td className="px-4 py-2.5 text-slate-400">{r.date}</td>
                <td className="px-4 py-2.5 text-slate-300 font-mono">{r.agents}</td>
                <td className="px-4 py-2.5 text-slate-400">{r.attacks}</td>
                <td className="px-4 py-2.5 text-slate-300">{r.auditCount}</td>
                <td className="px-4 py-2.5 text-slate-400">{r.anomalyCount}</td>
                <td className="px-4 py-2.5">
                  <span className={r.costEfficiency > 0.85 ? 'text-cyber-green font-bold' : 'text-cyber-amber'}>{formatPct(r.costEfficiency)}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={r.riskMitigation > 0.70 ? 'text-cyber-green font-bold' : 'text-cyber-amber'}>{formatPct(r.riskMitigation)}</span>
                </td>
                <td className="px-4 py-2.5 text-slate-400">{formatPct(r.stability)}</td>
                <td className="px-4 py-2.5">{r.xai ? <span className="text-cyber-teal text-[10px] font-bold">YES</span> : <span className="text-slate-600 text-[10px]">NO</span>}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={r.status === 'Running' ? 'auditing' : 'low'} pulse={r.status === 'Running'}>{r.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
