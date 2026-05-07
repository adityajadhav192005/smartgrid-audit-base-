'use client'

import { useCallback, useEffect, useState } from 'react'

export type PriorityBreakdown = {
  critical: number
  high: number
  medium: number
  low: number
}

export type LatestRunSnapshot = {
  runId: string | null
  status: string
  totalAgents: number
  costEfficiency: number
  riskMitigation: number
  detectionAccuracy: number
  auditCoverage: number
  precision: number
  recall: number
  f1: number
  attacksIdentified: number
  attacksDetected: number
  attacksResolved: number
  auditsTriggered: number
  activeIncidents: number
  crossLayerStability: number
  avgResponseSeconds: number
  runtimeSeconds: number
  convergenceIterations: number
  priority: PriorityBreakdown
}

type GridStatusPayload = {
  n_agents?: number
  cost_efficiency?: number
  risk_mitigation?: number
  attack_rate?: number
  coverage?: number
  precision?: number
  recall?: number
  f1?: number
  live_verification?: {
    run_id?: string | null
    status?: string
    attacks_detected?: number
    attacks_resolved?: number
    risk_mitigation?: number
    total_agents?: number
  }
  rapid_scada?: {
    live_score?: {
      anomaly_flag?: number
      anomaly_score?: number
      risk_score?: number
      decision?: string
      severity?: string
    }
  }
}

const DEFAULT_PRIORITY: PriorityBreakdown = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
}

function toObject(input: unknown): Record<string, any> {
  return input && typeof input === 'object' ? (input as Record<string, any>) : {}
}

function pickNumber(...candidates: unknown[]): number | null {
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const cleaned = value.replace(/[%,$\s]/g, '').replace(/,/g, '')
      const n = Number(cleaned)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function pickString(...candidates: unknown[]): string | null {
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

function asRatio(value: number | null, fallback = 0): number {
  if (value == null || !Number.isFinite(value)) return fallback
  if (value > 1) return value / 100
  if (value < 0) return 0
  return value
}

function extractPriority(summary: Record<string, any>, run: Record<string, any>): PriorityBreakdown {
  const fromCounts =
    toObject(summary.priority_breakdown).critical != null ||
    toObject(summary.priority_counts).critical != null ||
    toObject(summary.severity_counts).critical != null ||
    toObject(run.priority_breakdown).critical != null

  if (fromCounts) {
    const priority = {
      ...DEFAULT_PRIORITY,
      ...toObject(summary.priority_breakdown),
      ...toObject(summary.priority_counts),
      ...toObject(summary.severity_counts),
      ...toObject(run.priority_breakdown),
      ...toObject(run.priority_counts),
      ...toObject(run.severity_counts),
    }
    return {
      critical: Math.max(0, Math.floor(pickNumber(priority.critical) ?? 0)),
      high: Math.max(0, Math.floor(pickNumber(priority.high) ?? 0)),
      medium: Math.max(0, Math.floor(pickNumber(priority.medium) ?? 0)),
      low: Math.max(0, Math.floor(pickNumber(priority.low) ?? 0)),
    }
  }

  const events = Array.isArray(summary.attack_events)
    ? summary.attack_events
    : Array.isArray(run.attack_events)
      ? run.attack_events
      : Array.isArray(run.events)
        ? run.events
        : []

  const counts: PriorityBreakdown = { ...DEFAULT_PRIORITY }
  const severityDist = {
    ...toObject(summary.severity_level_distribution),
    ...toObject(run.severity_level_distribution),
  }
  if (Object.keys(severityDist).length > 0) {
    counts.critical += Math.max(0, Math.floor(pickNumber(severityDist.CRITICAL, severityDist.critical) ?? 0))
    counts.high += Math.max(0, Math.floor(pickNumber(severityDist.HIGH, severityDist.high) ?? 0))
    counts.medium += Math.max(0, Math.floor(pickNumber(severityDist.MEDIUM, severityDist.medium) ?? 0))
    counts.low += Math.max(0, Math.floor(pickNumber(severityDist.LOW, severityDist.low) ?? 0))
  }

  for (const event of events) {
    const item = toObject(event)
    const raw = String(item.priority ?? item.severity ?? '').toLowerCase()
    if (raw.includes('critical')) counts.critical += 1
    else if (raw.includes('high')) counts.high += 1
    else if (raw.includes('medium')) counts.medium += 1
    else if (raw.includes('low')) counts.low += 1
  }
  return counts
}

function normalizeGridStatus(payload: unknown): LatestRunSnapshot | null {
  const grid = toObject(payload) as GridStatusPayload
  const runLike = toObject(grid)
  if (!Object.keys(runLike).length) return null

  const verification = toObject(grid.live_verification)
  const nAgents = Math.max(0, Math.floor(pickNumber(grid.n_agents, verification.total_agents) ?? 0))
  const attackRate = asRatio(pickNumber(grid.attack_rate), 0)
  const detected = Math.max(0, Math.round(pickNumber(verification.attacks_detected, attackRate * nAgents) ?? 0))
  const mitigated = asRatio(pickNumber(grid.risk_mitigation, verification.risk_mitigation), 0)
  const resolved = Math.max(0, Math.round(detected * mitigated))
  const resolvedExact = Math.max(0, Math.round(pickNumber(verification.attacks_resolved, resolved) ?? 0))
  const active = Math.max(0, detected - resolvedExact)
  const coverage = asRatio(pickNumber(grid.coverage), 0)
  const auditsTriggered = Math.max(detected, Math.round(coverage * nAgents))
  const liveScore = toObject(toObject(grid.rapid_scada).live_score)
  const liveSeverity = String(liveScore.severity ?? '').toLowerCase()
  const priority: PriorityBreakdown = {
    critical: liveSeverity.includes('critical') ? 1 : 0,
    high: liveSeverity.includes('high') ? 1 : 0,
    medium: liveSeverity.includes('medium') ? 1 : 0,
    low: liveSeverity.includes('low') ? 1 : 0,
  }

  return {
    runId: pickString(verification.run_id),
    status: pickString(verification.status) ?? 'live',
    totalAgents: nAgents,
    costEfficiency: asRatio(pickNumber(grid.cost_efficiency), 0),
    riskMitigation: mitigated,
    detectionAccuracy: asRatio(pickNumber(grid.f1), 0),
    auditCoverage: coverage,
    precision: asRatio(pickNumber(grid.precision), 0),
    recall: asRatio(pickNumber(grid.recall), 0),
    f1: asRatio(pickNumber(grid.f1), 0),
    attacksIdentified: detected,
    attacksDetected: detected,
    attacksResolved: resolvedExact,
    auditsTriggered,
    activeIncidents: active,
    crossLayerStability: 0,
    avgResponseSeconds: 0,
    runtimeSeconds: 0,
    convergenceIterations: 0,
    priority,
  }
}

export function normalizeLatestRun(payload: unknown): LatestRunSnapshot | null {
  const root = toObject(payload)
  const maybeRun = toObject(root.run)
  const run = Object.keys(maybeRun).length ? maybeRun : root
  if (!Object.keys(run).length) return null

  const summary = {
    ...toObject(root.summary),
    ...toObject(run.summary),
  }
  const crossLayer = {
    ...toObject(summary.cross_layer_stability),
    ...toObject(run.cross_layer_stability),
  }
  const perAttack = {
    ...toObject(summary.per_attack_metrics),
    ...toObject(run.per_attack_metrics),
  }

  const perAttackEntries = Object.entries(perAttack)
  const nonNoneSupports = perAttackEntries
    .filter(([key]) => String(key).toUpperCase() !== 'NONE')
    .reduce((acc, [, metrics]) => acc + Math.max(0, Math.floor(pickNumber(toObject(metrics).support) ?? 0)), 0)
  const nonNonePredicted = perAttackEntries
    .filter(([key]) => String(key).toUpperCase() !== 'NONE')
    .reduce((acc, [, metrics]) => acc + Math.max(0, Math.floor(pickNumber(toObject(metrics).predicted_support) ?? 0)), 0)

  let attacksIdentified = Math.max(
    0,
    Math.round(
      pickNumber(
        summary.attacks_identified,
        summary.identified_attacks,
        summary.total_attacks,
        summary.anomaly_count,
        summary.total_anomalies,
        summary.total_detected,
        summary.chain_attack_agents,
        summary.chain_attack_pairs,
        summary.dynamic_events && summary.dynamic_mean_attack_rate
          ? Number(summary.dynamic_events) * Number(summary.dynamic_mean_attack_rate)
          : null,
        run.attacks_identified,
        run.identified_attacks,
        run.total_attacks,
        run.anomaly_count,
        run.total_anomalies,
        run.total_detected,
        nonNoneSupports,
      ) ?? 0,
    ),
  )

  let attacksDetected = Math.max(
    0,
    Math.round(
      pickNumber(
        summary.attacks_detected,
        summary.detected_attacks,
        summary.detections_total,
        summary.dynamic_events && summary.attack_rate_dyn
          ? Number(summary.dynamic_events) * Number(summary.attack_rate_dyn)
          : null,
        run.attacks_detected,
        run.detected_attacks,
        run.detections_total,
        nonNonePredicted,
        attacksIdentified,
      ) ?? 0,
    ),
  )

  let auditsTriggered = Math.max(
    0,
    Math.round(
      pickNumber(
        summary.audits_triggered,
        summary.total_audits,
        summary.audit_count,
        summary.audits_count,
        summary.audited_agents,
        summary.dynamic_events,
        run.audits_triggered,
        run.total_audits,
        run.audit_count,
        run.audits_count,
        run.audited_agents,
      ) ?? 0,
    ),
  )

  let attacksResolved = Math.max(
    0,
    Math.round(
      pickNumber(
        summary.attacks_resolved,
        summary.resolved_attacks,
        summary.mitigated_attacks,
        summary.resolved_count,
        summary.mitigated_count,
        run.attacks_resolved,
        run.resolved_attacks,
        run.mitigated_attacks,
        run.resolved_count,
        run.mitigated_count,
        attacksDetected > 0 ? attacksDetected * (pickNumber(summary.risk_mitigation, run.risk_mitigation) ?? 0) : null,
      ) ?? 0,
    ),
  )
  const priority = extractPriority(summary, run)
  const priorityTotal = priority.critical + priority.high + priority.medium + priority.low
  if (attacksIdentified === 0 && priorityTotal > 0) attacksIdentified = priorityTotal
  if (attacksDetected === 0 && attacksIdentified > 0) attacksDetected = attacksIdentified
  if (auditsTriggered === 0 && attacksDetected > 0) auditsTriggered = attacksDetected
  if (attacksResolved === 0 && attacksDetected > 0) {
    const mitigation = asRatio(pickNumber(summary.risk_mitigation, run.risk_mitigation), 0)
    attacksResolved = Math.round(attacksDetected * mitigation)
  }
  if (attacksResolved > attacksIdentified) attacksResolved = attacksIdentified

  const activeIncidents = Math.max(0, attacksIdentified - attacksResolved)

  return {
    runId: pickString(run.run_id, root.run_id),
    status: pickString(run.status, root.status) ?? 'unknown',
    totalAgents: Math.max(0, Math.floor(pickNumber(summary.total_agents, run.total_agents, toObject(run.params).num_agents) ?? 0)),
    costEfficiency: asRatio(pickNumber(summary.cost_efficiency, run.cost_efficiency), 0),
    riskMitigation: asRatio(pickNumber(summary.risk_mitigation, run.risk_mitigation), 0),
    detectionAccuracy: asRatio(pickNumber(summary.detection_accuracy, summary.accuracy, run.detection_accuracy, run.accuracy), 0),
    auditCoverage: asRatio(pickNumber(summary.audit_coverage, summary.coverage_cycle_dynamic, summary.coverage_dyn, run.audit_coverage, run.coverage_cycle_dynamic, run.coverage_dyn), 0),
    precision: asRatio(pickNumber(summary.precision, run.precision), 0),
    recall: asRatio(pickNumber(summary.recall, run.recall), 0),
    f1: asRatio(pickNumber(summary.f1, summary.f1_score, run.f1, run.f1_score), 0),
    attacksIdentified,
    attacksDetected,
    attacksResolved,
    auditsTriggered,
    activeIncidents,
    crossLayerStability: asRatio(pickNumber(summary.cross_layer_stability, run.cross_layer_stability, crossLayer.index), 0),
    avgResponseSeconds: Math.max(0, pickNumber(summary.avg_response_seconds, summary.response_time_seconds, summary.avg_response_time, run.avg_response_seconds, run.response_time_seconds, run.avg_response_time) ?? 0),
    runtimeSeconds: Math.max(0, pickNumber(summary.runtime_seconds, summary.execution_seconds, summary.total_runtime_sec, run.runtime_seconds, run.execution_seconds, run.total_runtime_sec) ?? 0),
    convergenceIterations: Math.max(0, Math.floor(pickNumber(summary.convergence_iterations, summary.convergence_steps, summary.iterations, run.convergence_iterations, run.convergence_steps, run.iterations) ?? 0)),
    priority,
  }
}

export function useLatestRun(pollMs = 15000) {
  const [latestRun, setLatestRun] = useState<LatestRunSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      let normalized: LatestRunSnapshot | null = null

      const latestResponse = await fetch('/api/proxy/runs/latest', { cache: 'no-store' })
      const latestPayload = await latestResponse.json()
      if (latestResponse.ok) {
        normalized = normalizeLatestRun(latestPayload)
      }

      if (!normalized) {
        const fallbackResponse = await fetch('/api/proxy/runs?limit=1', { cache: 'no-store' })
        const fallbackPayload = await fallbackResponse.json()
        if (fallbackResponse.ok) {
          const latest = Array.isArray(fallbackPayload?.runs) ? fallbackPayload.runs[0] : null
          normalized = normalizeLatestRun({ run: latest })
        }
      }

      if (!normalized) {
        const gridResponse = await fetch('/api/proxy/grid/status', { cache: 'no-store' })
        const gridPayload = await gridResponse.json()
        if (gridResponse.ok) {
          normalized = normalizeGridStatus(gridPayload)
        }
      }

      if (!normalized) {
        throw new Error(latestPayload?.detail ?? latestPayload?.error ?? `HTTP ${latestResponse.status}`)
      }

      setLatestRun(normalized)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load latest run')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    if (!pollMs || pollMs <= 0) return
    const intervalId = setInterval(() => {
      void refresh()
    }, pollMs)
    return () => clearInterval(intervalId)
  }, [pollMs, refresh])

  useEffect(() => {
    const onRefreshEvent = () => {
      void refresh()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }

    window.addEventListener('sg:refresh', onRefreshEvent)
    window.addEventListener('sg:run-updated', onRefreshEvent)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('sg:refresh', onRefreshEvent)
      window.removeEventListener('sg:run-updated', onRefreshEvent)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refresh])

  return { latestRun, isLoading, error, refresh }
}
