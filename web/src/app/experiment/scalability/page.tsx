'use client'

import { useEffect, useState } from 'react'
import { formatPct } from '@/lib/utils'

type ScalabilityRow = {
  n: number
  precision: number
  recall: number
  f1: number
  fp: number
  fn: number
  cost_efficiency: number
  audit_spend: number
  budget_allowed: number
  attack_typing_accuracy: number
  avg_e2e_delay_ms: number
  coverage_dynamic: number
  cross_layer_stability: number
  attack_rate_reduction: number
  risk_mitigation: number
  detection_accuracy: number
  total_runtime_sec: number
}

export default function ScalabilityPage() {
  const [rows, setRows] = useState<ScalabilityRow[]>([])

  useEffect(() => {
    fetch('/api/proxy/scalability', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setRows(d.results ?? []))
      .catch(() => setRows([]))
  }, [])

  const metrics: { label: string; key: keyof ScalabilityRow; fmt: (v: number) => string }[] = [
    { label: 'Precision', key: 'precision', fmt: v => v.toFixed(3) },
    { label: 'Recall', key: 'recall', fmt: v => v.toFixed(3) },
    { label: 'F1 Score', key: 'f1', fmt: v => v.toFixed(3) },
    { label: 'False Positives', key: 'fp', fmt: v => v.toFixed(0) },
    { label: 'False Negatives', key: 'fn', fmt: v => v.toLocaleString() },
    { label: 'Cost Efficiency', key: 'cost_efficiency', fmt: v => v.toFixed(3) },
    { label: 'Audit Spend', key: 'audit_spend', fmt: v => v.toLocaleString() },
    { label: 'Budget Allowed', key: 'budget_allowed', fmt: v => v.toLocaleString() },
    { label: 'Attack Typing Accuracy', key: 'attack_typing_accuracy', fmt: v => formatPct(v, 1) },
    { label: 'Avg E2E Delay', key: 'avg_e2e_delay_ms', fmt: v => `${v.toFixed(1)} ms` },
    { label: 'Coverage (dynamic)', key: 'coverage_dynamic', fmt: v => v.toFixed(3) },
    { label: 'Cross-Layer Stability', key: 'cross_layer_stability', fmt: v => v.toFixed(3) },
    { label: 'Attack Rate Reduction', key: 'attack_rate_reduction', fmt: v => formatPct(v, 1) },
    { label: 'Risk Mitigation', key: 'risk_mitigation', fmt: v => v.toFixed(3) },
    { label: 'Detection Accuracy', key: 'detection_accuracy', fmt: v => formatPct(v, 2) },
    { label: 'Total Runtime', key: 'total_runtime_sec', fmt: v => `${v.toFixed(1)} s` },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Scalability Comparison</h1>
        <p className="text-sm text-slate-500 mt-1">
          Side-by-side results across N=100, N=200, and N=500 agent configurations (24h simulation cycle).
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="border border-slate-200 rounded-md p-12 text-center text-sm text-slate-500">
          No scalability data available. Run experiments for N=100, N=200, and N=500 first.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-md overflow-hidden">
          <table className="report-table">
            <thead className="bg-slate-50">
              <tr>
                <th className="pl-4">Metric</th>
                {rows.map(r => (
                  <th key={r.n} className="text-center">N={r.n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map(m => (
                <tr key={m.key}>
                  <td className="pl-4 text-slate-700">{m.label}</td>
                  {rows.map(r => (
                    <td key={r.n} className="font-mono text-slate-900 text-center">
                      {m.fmt(Number(r[m.key]) || 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
