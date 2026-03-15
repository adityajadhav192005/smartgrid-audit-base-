'use client'
import { useState } from 'react'
import { Download, FileText, FileJson, FileSpreadsheet, BarChart2, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

const REPORTS = [
  {
    id: 'experiment-summary',
    name: 'Experiment Summary',
    format: 'PDF',
    icon: <FileText size={16} className="text-cyber-red/80" />,
    desc: 'Full run report: configuration, episode metrics, convergence charts, cost/risk breakdown, anomaly detection accuracy, and comparison with paper baseline.',
    size: '~2.1 MB',
    lastGenerated: '2026-03-14 22:18',
  },
  {
    id: 'shap-pdf',
    name: 'SHAP Attribution Report',
    format: 'PDF',
    icon: <FileText size={16} className="text-cyber-red/80" />,
    desc: 'Per-agent SHAP explanations, feature importance waterfall charts, and XAI narrative for all audited agents in the last run.',
    size: '~4.3 MB',
    lastGenerated: '2026-03-14 22:19',
  },
  {
    id: 'audit-csv',
    name: 'Audit Log CSV',
    format: 'CSV',
    icon: <FileSpreadsheet size={16} className="text-cyber-green/80" />,
    desc: 'Tabular export of all audit records: timestamp, agent, severity, anomaly score, trigger condition, decision, action taken.',
    size: '~180 KB',
    lastGenerated: '2026-03-14 22:20',
  },
  {
    id: 'attack-timeline',
    name: 'Attack Timeline CSV',
    format: 'CSV',
    icon: <FileSpreadsheet size={16} className="text-cyber-green/80" />,
    desc: 'Chronological log of all detected attacks with injection rate, detection accuracy, convergence impact, and RL response.',
    size: '~85 KB',
    lastGenerated: '2026-03-14 22:20',
  },
  {
    id: 'run-json',
    name: 'Full Run JSON',
    format: 'JSON',
    icon: <FileJson size={16} className="text-cyber-amber/80" />,
    desc: 'Complete machine-readable run artifact: Q-table snapshot, baseline/threshold matrices, reward history, all metrics, and config parameters.',
    size: '~8.7 MB',
    lastGenerated: '2026-03-14 22:21',
  },
  {
    id: 'comparison-chart',
    name: 'Comparison Chart Pack',
    format: 'PNG',
    icon: <BarChart2 size={16} className="text-cyber-teal/80" />,
    desc: 'Publication-ready charts: cost efficiency vs N, risk mitigation over episodes, precision/recall curves, and 4-method comparative bar charts.',
    size: '~3.2 MB',
    lastGenerated: '2026-03-14 22:22',
  },
]

const FORMAT_BADGE: Record<string, React.ReactNode> = {
  PDF:  <Badge variant="critical">PDF</Badge>,
  CSV:  <Badge variant="healthy">CSV</Badge>,
  JSON: <Badge variant="info">JSON</Badge>,
  PNG:  <Badge variant="medium">PNG</Badge>,
}

export default function ReportsPage() {
  const [generated, setGenerated] = useState<string[]>([])

  function handleGenerate(id: string) {
    setTimeout(() => setGenerated(prev => [...prev, id]), 800)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Reports &amp; Export</h1>
        <p className="text-sm text-slate-400 mt-1">Generate and download experiment artifacts, SHAP explanations, audit logs, and publication assets</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {REPORTS.map(r => (
          <div key={r.id} className="glass-card p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-grid-900 border border-slate-700/40 flex items-center justify-center">{r.icon}</div>
                <div>
                  <div className="font-semibold text-slate-200 text-sm">{r.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Last generated: {r.lastGenerated}</div>
                </div>
              </div>
              {FORMAT_BADGE[r.format]}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{r.desc}</p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500">Estimated size: {r.size}</span>
              <div className="flex gap-2">
                {generated.includes(r.id) ? (
                  <button className="flex items-center gap-1.5 text-xs bg-cyber-green/10 border border-cyber-green/30 text-cyber-green px-3 py-1.5 rounded">
                    <Download size={11} /> Download
                  </button>
                ) : (
                  <button onClick={() => handleGenerate(r.id)}
                    className="flex items-center gap-1.5 text-xs bg-grid-900 hover:bg-slate-700/40 border border-slate-700/50 text-slate-300 px-3 py-1.5 rounded transition-colors">
                    <CheckCircle2 size={11} /> Generate
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
