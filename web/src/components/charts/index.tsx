'use client'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, RadialBarChart, RadialBar, Tooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { cn } from '@/lib/utils'

const GRID_COLOR  = 'rgba(255,255,255,0.05)'
const AXIS_COLOR  = 'rgba(255,255,255,0.2)'
const LABEL_STYLE = { fill: '#94a3b8', fontSize: 11 }
const TIP_STYLE   = {
  backgroundColor: '#0a1628',
  border: '1px solid rgba(0,212,255,0.2)',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
}

// ---------- Anomaly / Risk line chart ----------
export function AnomalyTrendChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis dataKey="time" tick={LABEL_STYLE} tickLine={false} axisLine={{ stroke: AXIS_COLOR }} interval={3} />
        <YAxis tick={LABEL_STYLE} tickLine={false} axisLine={false} domain={[0, 1.2]} />
        <Tooltip contentStyle={TIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Line type="monotone" dataKey="anomalyScore" stroke="#00d4ff" strokeWidth={2} dot={false} name="Anomaly Score" />
        <Line type="monotone" dataKey="riskScore"    stroke="#ffb700" strokeWidth={2} dot={false} name="Risk Score"    />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------- Attack occurrence bar chart ----------
export function AttackBarChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis dataKey="time" tick={LABEL_STYLE} tickLine={false} axisLine={{ stroke: AXIS_COLOR }} interval={3} />
        <YAxis tick={LABEL_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TIP_STYLE} />
        <Bar dataKey="attackCount" fill="#ff3860" radius={[3, 3, 0, 0]} name="Attacks" maxBarSize={20} />
        <Bar dataKey="auditCount"  fill="#00d4ff" radius={[3, 3, 0, 0]} name="Audits"  maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------- Attack type pie / donut ----------
export function AttackTypePie({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
          innerRadius="52%" outerRadius="75%" paddingAngle={3}
          label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip contentStyle={TIP_STYLE} formatter={(v: any, n: any) => [`${v} events`, n]} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ---------- Agent status donut ----------
export function AgentStatusDonut({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
          innerRadius="60%" outerRadius="80%" paddingAngle={2}
        >
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip contentStyle={TIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ---------- Radar chart ----------
export function AgentRadarChart({ data }: { data: { metric: string; score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
        <PolarGrid stroke={GRID_COLOR} />
        <PolarAngleAxis dataKey="metric" tick={{ ...LABEL_STYLE, fontSize: 10 }} />
        <Radar dataKey="score" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.15} strokeWidth={2} />
        <Tooltip contentStyle={TIP_STYLE} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ---------- Horizontal feature importance bars ----------
export function FeatureImportanceChart({ data }: { data: { feature: string; importance: number; direction: string }[] }) {
  const formatted = [...data]
    .sort((a, b) => b.importance - a.importance)
    .map(d => ({ ...d, label: d.feature.replace(/_/g, ' '), pct: +(d.importance * 100).toFixed(1) }))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={formatted} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 100 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
        <XAxis type="number" tick={LABEL_STYLE} tickLine={false} axisLine={false} domain={[0, 60]} unit="%" />
        <YAxis type="category" dataKey="label" tick={LABEL_STYLE} tickLine={false} axisLine={false} width={95} />
        <Tooltip contentStyle={TIP_STYLE} formatter={(v: any) => [`${v}%`, 'Importance']} />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={14}>
          {formatted.map((d, i) => (
            <Cell key={i} fill={d.direction === 'positive' ? '#ff3860' : '#00d4ff'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------- Area chart (system health over time) ----------
export function SystemHealthAreaChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#ff3860" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ff3860" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis dataKey="time" tick={LABEL_STYLE} tickLine={false} axisLine={{ stroke: AXIS_COLOR }} interval={3} />
        <YAxis tick={LABEL_STYLE} tickLine={false} axisLine={false} domain={[0, 1.5]} />
        <Tooltip contentStyle={TIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Area type="monotone" dataKey="auditCount" stroke="#00d4ff" fill="url(#healthGrad)" strokeWidth={2} name="Audit Count" />
        <Area type="monotone" dataKey="attackCount" stroke="#ff3860" fill="url(#riskGrad)" strokeWidth={2} name="Attack Count" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ---------- Gauge: single metric (0-100 style radial bar) ----------
// ---------- Per-attack TPR/FNR grouped bars ----------
export function PerAttackBarChart({ data }: { data: { name: string; tpr: number; fnr: number; fpr: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="name" stroke={AXIS_COLOR} tick={LABEL_STYLE} />
        <YAxis stroke={AXIS_COLOR} tick={LABEL_STYLE} domain={[0, 1]} tickFormatter={v => `${Math.round(Number(v) * 100)}%`} />
        <Tooltip contentStyle={TIP_STYLE} formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Bar dataKey="tpr" name="TPR (Recall)" fill="#10b981" radius={[2, 2, 0, 0]} />
        <Bar dataKey="fnr" name="FNR (Missed)" fill="#ef4444" radius={[2, 2, 0, 0]} />
        <Bar dataKey="fpr" name="FPR (False Alarm)" fill="#f59e0b" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------- Attack family distribution ----------
export function AttackFamilyChart({ data }: { data: { name: string; support: number; detected: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="name" stroke={AXIS_COLOR} tick={LABEL_STYLE} />
        <YAxis stroke={AXIS_COLOR} tick={LABEL_STYLE} />
        <Tooltip contentStyle={TIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Bar dataKey="support" name="Ground Truth" fill="#00d4ff" radius={[2, 2, 0, 0]} />
        <Bar dataKey="detected" name="Detected" fill="#a855f7" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------- Pareto frontier scatter (cost vs accuracy) ----------
export function ParetoFrontierChart({
  data,
}: {
  data: { profile: string; costEfficiency: number; detectionAccuracy: number; color: string }[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 8, bottom: 24, left: 8 }}>
        <CartesianGrid stroke={GRID_COLOR} />
        <XAxis
          type="number"
          dataKey="costEfficiency"
          stroke={AXIS_COLOR}
          tick={LABEL_STYLE}
          domain={[0, 1]}
          tickFormatter={v => `${Math.round(Number(v) * 100)}%`}
          label={{ value: 'Cost Efficiency', position: 'bottom', fill: '#94a3b8', fontSize: 11, offset: 8 }}
        />
        <YAxis
          type="number"
          dataKey="detectionAccuracy"
          stroke={AXIS_COLOR}
          tick={LABEL_STYLE}
          domain={[0, 1]}
          tickFormatter={v => `${Math.round(Number(v) * 100)}%`}
          label={{ value: 'Detection Accuracy', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
        />
        <ZAxis range={[160, 220]} />
        <Tooltip
          contentStyle={TIP_STYLE}
          formatter={(value: any) => `${(Number(value) * 100).toFixed(1)}%`}
          labelFormatter={(_, payload: any) => payload?.[0]?.payload?.profile ?? ''}
        />
        {data.map(d => (
          <Scatter key={d.profile} name={d.profile} data={[d]} fill={d.color} />
        ))}
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ---------- Audit frequency by agent type (heatmap-style bar) ----------
export function AuditFrequencyByTypeChart({
  data,
}: {
  data: { agentType: string; meanAuditCount: number; meanCriticality: number; meanRisk: number; count: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="agentType" stroke={AXIS_COLOR} tick={LABEL_STYLE} />
        <YAxis stroke={AXIS_COLOR} tick={LABEL_STYLE} />
        <Tooltip contentStyle={TIP_STYLE} formatter={(value: any) => Number(value).toFixed(3)} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Bar dataKey="meanAuditCount" name="Mean Audit Count" fill="#00d4ff" radius={[2, 2, 0, 0]} />
        <Bar dataKey="meanRisk" name="Mean Risk" fill="#ef4444" radius={[2, 2, 0, 0]} />
        <Bar dataKey="meanCriticality" name="Mean Criticality" fill="#10b981" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------- LSTM training curve ----------
export function LSTMTrainingCurveChart({
  data,
}: {
  data: { epoch: number; loss: number; valAccuracy: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="epoch" stroke={AXIS_COLOR} tick={LABEL_STYLE} label={{ value: 'Epoch', position: 'bottom', fill: '#94a3b8', fontSize: 11, offset: -4 }} />
        <YAxis yAxisId="loss" stroke={AXIS_COLOR} tick={LABEL_STYLE} />
        <YAxis yAxisId="acc" orientation="right" stroke={AXIS_COLOR} tick={LABEL_STYLE} domain={[0, 1]} tickFormatter={v => `${Math.round(Number(v) * 100)}%`} />
        <Tooltip contentStyle={TIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Line yAxisId="loss" type="monotone" dataKey="loss" name="Training Loss" stroke="#f59e0b" strokeWidth={2} dot={false} />
        <Line yAxisId="acc" type="monotone" dataKey="valAccuracy" name="Val Accuracy" stroke="#10b981" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function GaugeChart({ value, label, color = '#00d4ff' }: { value: number; label: string; color?: string }) {
  const pct = Math.round(value * 100)
  const data = [{ value: pct }, { value: 100 - pct }]
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <ResponsiveContainer width={120} height={70}>
        <PieChart>
          <Pie data={data} startAngle={180} endAngle={0} cx="50%" cy="100%"
            innerRadius={40} outerRadius={58} paddingAngle={0} dataKey="value"
          >
            <Cell fill={color} />
            <Cell fill="rgba(255,255,255,0.05)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="text-2xl font-bold font-mono" style={{ color }}>{pct}%</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}
