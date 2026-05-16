'use client'
import { useState } from 'react'
import { ChevronRight, Send } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

const ENDPOINTS = [
  { group: 'Grid', method: 'GET',  path: '/grid/status',              desc: 'Returns live grid snapshot: agent count, health, attack rate, risk score.' },
  { group: 'Grid', method: 'GET',  path: '/grid/agents',              desc: 'Full agent list with anomaly scores, states, and last-seen metrics.' },
  { group: 'Grid', method: 'GET',  path: '/grid/agents/{agent_id}',   desc: 'Single-agent detail with physical/cyber metrics breakdown.' },
  { group: 'Audit',method: 'GET',  path: '/audit/log',                desc: 'Recent audit records with severity, flags, and trigger conditions.' },
  { group: 'Audit',method: 'GET',  path: '/audit/explain/{agent_id}', desc: 'SHAP XAI explanation for the last audit decision on an agent.' },
  { group: 'Audit',method: 'POST', path: '/audit/schedule',           desc: 'Trigger an immediate audit schedule optimization cycle.' },
  { group: 'RL',   method: 'GET',  path: '/rl/policy',                desc: 'Current Q-table snapshot, epsilon value, and reward history.' },
  { group: 'RL',   method: 'POST', path: '/rl/run',                   desc: 'Launch a new RL training run with supplied config parameters.' },
  { group: 'SCADA',method: 'POST', path: '/v1/scada/ingest/tags',     desc: 'Ingest a batch of SCADA tag readings (used by Rapid SCADA bridge).' },
  { group: 'SCADA',method: 'GET',  path: '/v1/scada/channels',        desc: 'Return all registered SCADA channel mappings.' },
  { group: 'Health',method: 'GET', path: '/health',                   desc: 'Liveness probe — returns {status:"ok"} when API is reachable.' },
  { group: 'Health',method: 'GET', path: '/metrics',                  desc: 'Prometheus-format metrics for scraping (cost, risk, accuracy gauges).' },
]

const METHOD_COLOR: Record<string, string> = {
  GET:  'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/40',
  POST: 'bg-cyber-green/20 text-cyber-green border border-cyber-green/40',
  PUT:  'bg-cyber-amber/20 text-cyber-amber border border-cyber-amber/40',
}

const MOCK_RESPONSE = {
  '/grid/status': { agents: 100, healthy: 89, anomalous: 7, auditing: 4, attack_rate: 0.07, risk_score: 0.31, cost_efficiency: 0.836, timestamp: '2026-03-15T14:22:00Z' },
  '/health':      { status: 'ok', uptime_s: 18432 },
}

export default function ApiStudioPage() {
  const [selected, setSelected] = useState(ENDPOINTS[0])
  const [response, setResponse] = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  function handleSend() {
    setLoading(true)
    setTimeout(() => {
      const key = Object.keys(MOCK_RESPONSE).find(k => selected.path.startsWith(k))
      const data = key ? MOCK_RESPONSE[key as keyof typeof MOCK_RESPONSE] : { message: 'Endpoint available — connect backend to see live data.', path: selected.path }
      setResponse(JSON.stringify(data, null, 2))
      setLoading(false)
    }, 600)
  }

  const groups = [...new Set(ENDPOINTS.map(e => e.group))]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">API Studio</h1>
        <p className="text-sm text-slate-500 mt-1">Explore and test FastAPI backend endpoints — proxied at <code className="text-cyber-blue text-xs">/api/backend/*</code></p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: '60vh' }}>
        {/* Endpoint list */}
        <div className="glass-card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">Endpoints</div>
          <div className="overflow-y-auto" style={{ maxHeight: '68vh' }}>
            {groups.map(g => (
              <div key={g}>
                <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">{g}</div>
                {ENDPOINTS.filter(e => e.group === g).map(ep => (
                  <button key={ep.path} onClick={() => { setSelected(ep); setResponse(null) }}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-slate-700/30 transition-colors ${selected.path === ep.path ? 'bg-cyber-blue/10 border-l-2 border-cyber-blue' : 'border-l-2 border-transparent'}`}>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${METHOD_COLOR[ep.method]}`}>{ep.method}</span>
                    <span className="text-xs text-slate-700 font-mono truncate">{ep.path}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Request + response */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-1 rounded ${METHOD_COLOR[selected.method]}`}>{selected.method}</span>
              <code className="text-sm text-slate-800 font-mono flex-1">/api/backend{selected.path}</code>
            </div>
            <p className="text-xs text-slate-500">{selected.desc}</p>
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 bg-slate-50 rounded px-3 py-1.5 text-xs font-mono text-slate-500 border border-slate-200">
                X-API-Key: <span className="text-cyber-amber">••••••••••••••••</span>
              </div>
              <button onClick={handleSend} disabled={loading}
                className="flex items-center gap-2 bg-cyber-blue/20 hover:bg-cyber-blue/30 border border-cyber-blue/40 text-cyber-blue text-xs font-semibold px-4 py-1.5 rounded transition-colors">
                <Send size={12} /> {loading ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>

          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Response</span>
              {response && <Badge variant="healthy">200 OK</Badge>}
            </div>
            <div className="bg-slate-50 rounded border border-slate-200 p-4 min-h-[200px] font-mono text-xs">
              {loading ? (
                <span className="text-slate-500 animate-pulse">Waiting for response…</span>
              ) : response ? (
                <pre className="text-cyber-green/90 whitespace-pre-wrap">{response}</pre>
              ) : (
                <span className="text-slate-600">Click Send to execute request</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
