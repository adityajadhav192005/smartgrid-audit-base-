'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export type ExperimentTrendPoint = {
  time: string
  anomalyScore: number
  riskScore: number
  auditCount: number
  attackCount: number
  anomalyCount?: number
}

export type ExperimentEventItem = {
  id: string
  ts: string
  type: string
  msg: string
  severity: string
}

export type ExperimentAgent = {
  id: string
  type: string
  anomalyScore: number
  riskScore: number
  attack: string
  auditCount: number
  severity?: string
  source?: string
  scoreThreshold?: number
  xai?: Record<string, any>
  criticalityWeight?: number
}

export type PerAttackMetric = {
  tpr: number
  tnr: number
  fpr: number
  fnr: number
  accuracy: number
  support: number
  predictedSupport: number
}

export type StatisticalTest = {
  pValue: number | null
  test: string
  significant: boolean
}

export type AttackTypingSummary = {
  typingAccuracy: number
  macroTpr: number
  macroFpr: number
  positiveSupport: number
}

export type ConvergenceSummary = {
  rlIterations: number
  rlConverged: boolean
  rlEpsilonFinal: number
  gradientIterations: number
  gradientConverged: boolean
}

export type AttackFamilyDistribution = {
  name: string
  support: number
  detected: number
  tpr: number
  fnr: number
}

export type AuditFrequencyByType = {
  agentType: string
  count: number
  meanAuditCount: number
  meanCriticality: number
  meanRisk: number
}

type ExperimentTelemetryPayload = {
  summary?: {
    totalAgents?: number
    detectionAccuracy?: number
    riskMitigation?: number
    costEfficiency?: number
    auditCoverage?: number
    precision?: number
    recall?: number
    f1?: number
    fpr?: number
    fnr?: number
    tpr?: number
    tnr?: number
    tp?: number
    fp?: number
    fn?: number
    tn?: number
    attackRateDynamic?: number
    attackRateBaseline?: number
    attackRateReduction?: number
    costAdjustedMitigation?: number
    auditsPerMitigationPoint?: number
    riskReducedPerCost?: number
    crossLayerStability?: number
    runId?: string
    status?: string
    scoreThreshold?: number
    perAttackMetrics?: Record<string, PerAttackMetric>
    statisticalTests?: Record<string, StatisticalTest>
    attackTyping?: AttackTypingSummary
    severityLevelDistribution?: Record<string, number>
    convergence?: ConvergenceSummary
    optimizationProfile?: string
    ablationMode?: string
    attackFamilyDistribution?: AttackFamilyDistribution[]
    auditFrequencyByType?: AuditFrequencyByType[]
  }
  trend?: ExperimentTrendPoint[]
  events?: ExperimentEventItem[]
  agents?: ExperimentAgent[]
  topAgents?: ExperimentAgent[]
  statusCounts?: {
    healthy?: number
    anomalous?: number
    suspect?: number
    underAudit?: number
    attacked?: number
  }
  attackTypeDistribution?: Array<{ name: string; value: number }>
  health?: {
    crossLayerStability?: number
    attackResistance?: number
    risk?: number
    anomaly?: number
  }
}

type ExperimentLiveAgentRow = {
  id: string
  type: string
  state: 'Healthy' | 'Anomalous' | 'Under Audit' | 'Attacked' | 'Suspect' | 'Offline'
  physicalHealth: number
  cyberHealth: number
  anomalyScore: number
  riskScore: number
  lastAttack: string
  auditTriggered: boolean
  criticalityWeight: number
  source: string
  severity: string
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function stateFromExperiment(agent: ExperimentAgent, threshold: number): ExperimentLiveAgentRow['state'] {
  const risk = Number(agent.riskScore ?? 0)
  const severity = String(agent.severity ?? '').toUpperCase()
  if (severity === 'CRITICAL' || risk >= threshold * 2) return 'Attacked'
  if ((agent.auditCount ?? 0) > 0 && risk >= threshold) return 'Under Audit'
  if (risk >= threshold) return 'Anomalous'
  if (risk >= threshold * 0.7) return 'Suspect'
  return 'Healthy'
}

export function useExperimentTelemetry(pollMs = 8000) {
  const [payload, setPayload] = useState<ExperimentTelemetryPayload | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/proxy/experiment/telemetry', { cache: 'no-store' }).catch(() => null)
    if (!res?.ok) return
    const nextPayload = await res.json().catch(() => null)
    if (nextPayload) setPayload(nextPayload)
  }, [])

  useEffect(() => {
    void refresh()
    if (!pollMs || pollMs <= 0) return
    const id = setInterval(() => void refresh(), pollMs)
    return () => clearInterval(id)
  }, [pollMs, refresh])

  const threshold = Number(payload?.summary?.scoreThreshold ?? 0.5)
  const liveAgents = useMemo<ExperimentLiveAgentRow[]>(() => {
    return (payload?.agents ?? []).map(agent => ({
      id: agent.id,
      type: agent.type,
      state: stateFromExperiment(agent, threshold),
      physicalHealth: clamp01(1 - Math.min(1, Number(agent.anomalyScore ?? 0) / Math.max(threshold * 2, 1))),
      cyberHealth: clamp01(1 - Math.min(1, Number(agent.riskScore ?? 0) / Math.max(threshold * 2, 1))),
      anomalyScore: Number(agent.anomalyScore ?? 0),
      riskScore: Number(agent.riskScore ?? 0),
      lastAttack: agent.attack ?? '-',
      auditTriggered: Number(agent.auditCount ?? 0) > 0,
      criticalityWeight: Number(agent.criticalityWeight ?? 1),
      source: String(agent.source ?? 'experiment'),
      severity: String(agent.severity ?? 'LOW'),
    }))
  }, [payload?.agents, threshold])

  return {
    summary: payload?.summary ?? null,
    trend: payload?.trend ?? [],
    events: payload?.events ?? [],
    topAgents: payload?.topAgents ?? [],
    agentSnapshots: payload?.agents ?? [],
    liveAgents,
    statusCounts: payload?.statusCounts ?? { healthy: 0, anomalous: 0, suspect: 0, underAudit: 0, attacked: 0 },
    attackTypeDistribution: payload?.attackTypeDistribution ?? [],
    health: payload?.health ?? { crossLayerStability: 0, attackResistance: 0, risk: 0, anomaly: 0 },
    refresh,
  }
}
