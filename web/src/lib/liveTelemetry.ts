'use client'

import { useEffect, useMemo, useState } from 'react'

export type LiveTrendPoint = {
  time: string
  anomalyScore: number
  riskScore: number
  auditCount: number
  attackCount: number
}

export type LiveRiskAgent = {
  id: string
  type: string
  anomalyScore: number
  riskScore: number
  attack: string
  auditCount: number
  severity?: string
  source?: 'live' | 'mixed' | 'fallback'
  scoreThreshold?: number
  xai?: Record<string, any>
}

export type LiveEventItem = {
  id: string
  ts: string
  type: string
  msg: string
  severity: string
}

export type LiveAgentRow = {
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
  source: 'live' | 'mixed' | 'fallback'
  severity: string
}

type LiveScorePayload = {
  deviation_score?: number
  risk_score?: number
  anomaly_flag?: number
  anomaly_prob?: number
  audit_frequency?: number
  decision?: string
  severity?: string
  agent_id?: string
  attack_type?: string
  response?: {
    action?: string
    severity_level?: string
  }
  xai?: Record<string, any>
}

function indexFromAgentId(agentId: string): number | null {
  const normalized = String(agentId ?? '').trim().toUpperCase()
  const matched = normalized.match(/(GEN|SUB|PMU|BRK|BREAKER)[-_]?(\d{1,3})/)
  if (!matched) return null

  const seq = Number(matched[2])
  if (!Number.isFinite(seq) || seq < 1 || seq > 100) return null
  return seq - 1
}

type GridStatusPayload = {
  n_agents?: number
  live_verification?: {
    run_id?: string | null
    status?: string
    attacks_detected?: number
    attacks_resolved?: number
    risk_mitigation?: number
    total_agents?: number
  }
  rapid_scada?: {
    connection?: {
      connected?: boolean
      last_error?: string | null
      data_age_sec?: number | null
      last_agent_update_utc?: string | null
    }
    live_tags?: Record<string, number>
    live_score?: {
      deviation_score?: number
      risk_score?: number
      anomaly_flag?: number
      decision?: string
      severity?: string
      agent_id?: string
      attack_type?: string
      response?: {
        action?: string
        severity_level?: string
      }
      xai?: Record<string, any>
    }
    config?: {
      score_threshold?: number
      profiles?: Record<string, any>
      feature_names_phys?: string[]
      feature_names_cyber?: string[]
    }
    experiment_pipeline?: {
      enabled?: boolean
      step_count?: number
      agent_count?: number
      history_window?: number
      cluster_window?: number
      cluster_k?: number
      risk_threshold?: number
      f_min?: number
      f_max?: number
      min_coverage_pct?: number
      scheduler_converged?: boolean
      gradient_converged?: boolean
      lstm_enabled?: boolean
      lstm_model_path?: string | null
      lstm_error?: string | null
    }
    agent_scores?: Array<{
      agent_id?: string
      tags?: Record<string, number>
      source?: 'live' | 'mixed' | 'fallback'
      criticality_weight?: number
      score_threshold?: number
      score?: {
        deviation_score?: number
        risk_score?: number
        anomaly_flag?: number
        decision?: string
        severity?: string
        agent_id?: string
        attack_type?: string
        response?: {
          action?: string
          severity_level?: string
        }
        xai?: Record<string, any>
      }
      last_update_utc?: string
    }>
  }
  attack_rate?: number
  coverage?: number
  risk_mitigation?: number
  cost_efficiency?: number
  cross_layer_stability?: number
}

function stateFromScore(score: number, auditCount: number, scoreThreshold: number, severity?: string): LiveAgentRow['state'] {
  const threshold = Number.isFinite(scoreThreshold) && scoreThreshold > 0 ? scoreThreshold : 3
  const normalizedSeverity = String(severity ?? '').toUpperCase()
  if (normalizedSeverity === 'CRITICAL' || score >= threshold * 2) return 'Attacked'
  if (auditCount > 0) return 'Under Audit'
  if (score >= threshold) return 'Anomalous'
  if (score >= threshold * 0.7) return 'Suspect'
  return 'Healthy'
}

function buildAgentId(index: number): { id: string; type: string; criticalityWeight: number } {
  const seq = index + 1
  if (seq <= 20) return { id: `GEN-${String(seq).padStart(2, '0')}`, type: 'Generator', criticalityWeight: 1.0 }
  if (seq <= 50) return { id: `SUB-${String(seq).padStart(2, '0')}`, type: 'Substation', criticalityWeight: 0.7 }
  if (seq <= 75) return { id: `PMU-${String(seq).padStart(2, '0')}`, type: 'PMU', criticalityWeight: 0.3 }
  return { id: `BRK-${String(seq).padStart(2, '0')}`, type: 'Breaker', criticalityWeight: 0.5 }
}

function inferPhysicalHealth(agent: LiveRiskAgent): number {
  return clamp01(1 - Math.min(1, agent.anomalyScore / 2))
}

function inferCyberHealth(agent: LiveRiskAgent): number {
  return clamp01(1 - Math.min(1, agent.riskScore))
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function agentTypeFromId(agentId: string): string {
  const lower = agentId.toLowerCase()
  if (lower.includes('gen')) return 'Generator'
  if (lower.includes('sub')) return 'Substation'
  if (lower.includes('pmu')) return 'PMU'
  if (lower.includes('brk') || lower.includes('breaker')) return 'Breaker'
  return 'Agent'
}

function currentAuditCount(scorePayload: Record<string, any>, threshold: number): number {
  const auditFrequency = asNumber(scorePayload?.audit_frequency, 0)
  if (auditFrequency > 0) return auditFrequency
  const decision = String(scorePayload?.decision ?? scorePayload?.response?.action ?? '').toUpperCase()
  const anomalyScore = asNumber(scorePayload?.deviation_score, asNumber(scorePayload?.risk_score, 0))
  if (decision.includes('INCREASE_AUDIT')) return 1
  if (decision.includes('AUDIT') && anomalyScore >= threshold) return 1
  return 0
}

function currentDecisionLabel(scorePayload: LiveScorePayload): string {
  const decision = String(scorePayload?.decision ?? scorePayload?.response?.action ?? '').trim().toUpperCase()
  if (decision) return decision
  if (asNumber(scorePayload?.anomaly_flag, 0) >= 1) return 'ANOMALY'
  return 'MAINTAIN'
}

export function useLiveTelemetry(pollMs = 5000) {
  const [gridStatus, setGridStatus] = useState<GridStatusPayload | null>(null)
  const [trend, setTrend] = useState<LiveTrendPoint[]>([])
  const [events, setEvents] = useState<LiveEventItem[]>([])
  const [rankedAgents, setRankedAgents] = useState<LiveRiskAgent[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        const ts = Date.now()
        const gridRes = await fetch(`/api/proxy/grid/status?_ts=${ts}`, {
          cache: 'no-store',
          headers: { 'cache-control': 'no-store' },
        }).catch(() => null)

        if (!gridRes?.ok) {
          if (!cancelled) setError(`grid-status-unavailable:${gridRes?.status ?? 'network'}`)
          return
        }

        const gridPayload = await gridRes.json().catch(() => null) as GridStatusPayload | null
        if (!gridPayload) {
          if (!cancelled) setError('grid-status-invalid')
          return
        }
        if (cancelled) return

        setError(null)
        setGridStatus(gridPayload)

        const liveScore = gridPayload?.rapid_scada?.live_score ?? {}
        const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
        const scadaAgents = Array.isArray(gridPayload?.rapid_scada?.agent_scores)
          ? gridPayload?.rapid_scada?.agent_scores ?? []
          : []

        const byAgent = new Map<string, LiveRiskAgent>()
        for (const snapshot of scadaAgents) {
          const agentId = String(snapshot?.agent_id ?? snapshot?.score?.agent_id ?? '').trim()
          if (!agentId) continue

          const scorePayload: LiveScorePayload = snapshot?.score ?? {}
          const nextRisk = asNumber(scorePayload.risk_score, asNumber(scorePayload.deviation_score, 0))
          const nextAnomaly = asNumber(scorePayload.deviation_score, nextRisk)
          const scoreThreshold = asNumber(snapshot?.score_threshold, asNumber(gridPayload?.rapid_scada?.config?.score_threshold, 3))
          byAgent.set(agentId, {
            id: agentId,
            type: agentTypeFromId(agentId),
            anomalyScore: nextAnomaly,
            riskScore: nextRisk,
            attack: asNumber(scorePayload.anomaly_flag, 0) >= 1
              ? String(scorePayload.attack_type ?? scorePayload.decision ?? scorePayload?.response?.action ?? 'Anomaly')
              : currentDecisionLabel(scorePayload),
            auditCount: currentAuditCount(scorePayload, scoreThreshold),
            severity: String(scorePayload.severity ?? 'LOW'),
            source: (snapshot?.source ?? 'fallback') as 'live' | 'mixed' | 'fallback',
            scoreThreshold,
            xai: scorePayload.xai,
          })
        }

        const ranked = byAgent.size > 0
          ? Array.from(byAgent.values()).sort((a, b) => {
              if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore
              return b.anomalyScore - a.anomalyScore
            })
          : [{
              id: String(liveScore.agent_id ?? '').trim() || 'rapidscada-agent',
              type: agentTypeFromId(String(liveScore.agent_id ?? '').trim() || 'rapidscada-agent'),
              anomalyScore: asNumber(liveScore.deviation_score, asNumber(liveScore.risk_score, 0)),
              riskScore: asNumber(liveScore.risk_score, asNumber(liveScore.deviation_score, 0)),
              attack: currentDecisionLabel(liveScore),
              auditCount: currentAuditCount(liveScore, asNumber(gridPayload?.rapid_scada?.config?.score_threshold, 3)),
              severity: String(liveScore.severity ?? 'LOW'),
              source: 'fallback' as const,
              scoreThreshold: asNumber(gridPayload?.rapid_scada?.config?.score_threshold, 3),
              xai: liveScore.xai,
            }]

        setRankedAgents(ranked)

        const currentUnderAudit = ranked.filter(agent => agent.auditCount > 0).length
        const currentAttacked = ranked.filter(agent => String(agent.severity ?? '').toUpperCase() === 'CRITICAL').length
        const currentMaxAnomaly = ranked.reduce((max, agent) => Math.max(max, agent.anomalyScore), 0)
        const currentMaxRisk = ranked.reduce((max, agent) => Math.max(max, agent.riskScore), 0)

        setTrend(prev => {
          const nextPoint: LiveTrendPoint = {
            time: nowLabel,
            anomalyScore: currentMaxAnomaly,
            riskScore: currentMaxRisk,
            auditCount: currentUnderAudit,
            attackCount: currentAttacked,
          }
          const next = [...prev, nextPoint]
          return next.slice(-24)
        })

        const freshEvents: LiveEventItem[] = ranked
          .filter(agent =>
            agent.auditCount > 0 ||
            agent.anomalyScore >= (agent.scoreThreshold ?? asNumber(gridPayload?.rapid_scada?.config?.score_threshold, 3)) ||
            String(agent.severity ?? '').toUpperCase() === 'CRITICAL'
          )
          .slice(0, 20)
          .map((agent, index) => ({
            id: `${agent.id}-${ts}-${index}`,
            ts: nowLabel,
            type: agent.auditCount > 0 ? 'AUDIT_DECISION' : 'LIVE_SCORE',
            severity: String(agent.severity ?? 'info').toLowerCase(),
            msg: `${agent.id} - ${agent.source} - score ${agent.anomalyScore.toFixed(3)} - decision ${agent.attack}`,
          }))
        setEvents(freshEvents)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'live-refresh-failed')
      }
    }

    void refresh()
    if (!pollMs || pollMs <= 0) {
      return () => {
        cancelled = true
      }
    }

    const id = setInterval(() => {
      void refresh()
    }, pollMs)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [pollMs])

  const health = useMemo(() => {
    const liveScore = gridStatus?.rapid_scada?.live_score ?? {}
    const risk = asNumber(liveScore.risk_score, asNumber(liveScore.deviation_score, 0))
    const anomaly = asNumber(liveScore.deviation_score, risk)
    const backendCrossLayer = asNumber(gridStatus?.cross_layer_stability, -1)
    const crossLayerStability = backendCrossLayer >= 0 ? clamp01(backendCrossLayer) : clamp01(1 - Math.min(1, anomaly / 2))
    const attackResistance = clamp01(1 - Math.min(1, risk))
    return { crossLayerStability, attackResistance, risk, anomaly }
  }, [gridStatus])

  const topAgents = useMemo(() => rankedAgents.slice(0, 8), [rankedAgents])

  const liveAgents = useMemo<LiveAgentRow[]>(() => {
    const totalAgents = gridStatus?.rapid_scada?.experiment_pipeline?.agent_count ?? (rankedAgents.length || 100)
    const rows: LiveAgentRow[] = Array.from({ length: totalAgents }, (_, index) => {
      const fallbackMeta = buildAgentId(index)
      return {
        ...fallbackMeta,
        state: 'Healthy',
        physicalHealth: 1,
        cyberHealth: 1,
        anomalyScore: 0,
        riskScore: 0,
        lastAttack: '-',
        auditTriggered: false,
        source: 'fallback',
        severity: 'LOW',
      }
    })

    for (const agent of rankedAgents) {
      const index = indexFromAgentId(agent.id)
      if (index == null || index < 0 || index >= rows.length) continue
      const fallbackMeta = buildAgentId(index)
      rows[index] = {
        id: agent.id || fallbackMeta.id,
        type: agent.type || fallbackMeta.type,
        state: stateFromScore(agent.anomalyScore, agent.auditCount, agent.scoreThreshold ?? asNumber(gridStatus?.rapid_scada?.config?.score_threshold, 3), agent.severity),
        physicalHealth: inferPhysicalHealth(agent),
        cyberHealth: inferCyberHealth(agent),
        anomalyScore: agent.anomalyScore,
        riskScore: clamp01(agent.riskScore),
        lastAttack: agent.attack || '-',
        auditTriggered: agent.auditCount > 0 || agent.anomalyScore >= 1,
        criticalityWeight: fallbackMeta.criticalityWeight,
        source: agent.source ?? 'fallback',
        severity: agent.severity ?? 'LOW',
      }
    }

    return rows
  }, [gridStatus, rankedAgents])

  const statusCounts = useMemo(() => ({
    healthy: liveAgents.filter(agent => agent.state === 'Healthy').length,
    anomalous: liveAgents.filter(agent => agent.state === 'Anomalous').length,
    suspect: liveAgents.filter(agent => agent.state === 'Suspect').length,
    underAudit: liveAgents.filter(agent => agent.state === 'Under Audit').length,
    attacked: liveAgents.filter(agent => agent.state === 'Attacked').length,
  }), [liveAgents])

  const attackTypeDistribution = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const event of events) {
      const key = event.type || 'EVENT'
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
    const palette = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#f97316']
    return Array.from(buckets.entries()).map(([name, value], index) => ({
      name,
      value,
      color: palette[index % palette.length],
    }))
  }, [events])

  return {
    gridStatus,
    agentSnapshots: rankedAgents,
    trend,
    events,
    topAgents,
    liveAgents,
    statusCounts,
    attackTypeDistribution,
    health,
    error,
  }
}
