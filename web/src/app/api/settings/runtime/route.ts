import { NextResponse } from 'next/server'
import { NO_STORE_HEADERS, proxyFetch } from '@/lib/proxyClient'

type SettingsPayload = Record<string, string | number>

export const dynamic = 'force-dynamic'
export const revalidate = 0

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function toRatio(value: unknown, fallback: number): number {
  const num = toNumber(value, fallback)
  const normalized = num > 1 ? num / 100 : num
  return Math.max(0, Math.min(1, normalized))
}

function buildRuntimeOverrides(payload: SettingsPayload): Record<string, any> {
  return {
    audit: {
      audit_budget_ratio: toNumber(payload.audit_budget_ratio, 0.07),
      risk_threshold: toNumber(payload.risk_threshold, 0.5),
      f_min: 1,
      f_max: 5,
      max_audits_per_cycle: 100,
    },
    thresholds: {
      k_sigma: 4.0,
      score_threshold: toNumber(payload.anomaly_th, 0.25),
      prob_threshold: toNumber(payload.prob_threshold, 0.43),
      hybrid_w_dev: 0.55,
      hybrid_w_prob: 0.45,
      sigma_window: 24,
    },
    gradient: { lr: 0.01 },
    rl: { gamma: 0.95 },
    anomaly_model: {
      lstm: { window: 24, hidden_size: 64, num_layers: 2, dropout: 0.2 },
    },
  }
}

function buildRuntimeEnv(payload: SettingsPayload): Record<string, string> {
  return {
    SMARTGRID_SEEDS: String(payload.seeds ?? '42,43,44'),
    SMARTGRID_TRAIN_EPISODES: String(toNumber(payload.episodes, 200)),
    SMARTGRID_FDI_RATE: String(toRatio(payload.fdi_rate, 0.10)),
    SMARTGRID_DOS_RATE: String(toRatio(payload.dos_rate, 0.05)),
    SMARTGRID_CHAIN_RATE: String(toRatio(payload.chain_rate, 0.20)),
    SMARTGRID_FAULT_RATE: String(toRatio(payload.fault_rate, 0.20)),
    SMARTGRID_SCORE_THRESHOLD: String(toNumber(payload.anomaly_th, 0.25)),
    SMARTGRID_ANOMALY_PROB_THRESHOLD: String(toNumber(payload.prob_threshold, 0.43)),
    SMARTGRID_RISK_THRESHOLD: String(toNumber(payload.risk_threshold, 0.5)),
    SMARTGRID_AUDIT_BUDGET_RATIO: String(toNumber(payload.audit_budget_ratio, 0.07)),
    // Hardcoded defaults for parameters removed from UI
    SMARTGRID_F_MAX: '5',
    SMARTGRID_MAX_AUDITS_PER_CYCLE: '100',
    SMARTGRID_RL_ALPHA: '0.4',
    SMARTGRID_RL_GAMMA: '0.95',
    SMARTGRID_RL_EPSILON_START: '1.0',
    SMARTGRID_RL_EPSILON_MIN: '0.05',
    SMARTGRID_RL_EPSILON_DECAY: '0.995',
    SMARTGRID_ALPHA_LOW: '0.05',
    SMARTGRID_ALPHA_HIGH: '0.8',
    SMARTGRID_BETA: '0.3',
    SMARTGRID_HYBRID_W_DEV: '0.55',
    SMARTGRID_HYBRID_W_PROB: '0.45',
    SMARTGRID_THRESHOLD_WINDOW: '24',
    SMARTGRID_LSTM_WINDOW: '24',
    SMARTGRID_RW_AUDIT: '0.05',
    SMARTGRID_RW_ATTACK: '10.0',
    SMARTGRID_CONSTRAINT_LOG_LEVEL: 'WARNING',
    SMARTGRID_MITIGATION_DELAY: '1',
    SMARTGRID_AUDIT_SUCCESS_PROB: '0.95',
    SMARTGRID_API_HOST: '127.0.0.1',
    SMARTGRID_API_PORT: '8000',
    SMARTGRID_SCADA_POLL_SEC: '2',
    SMARTGRID_SCADA_DEMO_ANOMALY_PHASE: 'Independent',
    SMARTGRID_SCADA_INDEPENDENT_RATE_PRESET: 'Realistic',
    SMARTGRID_SCADA_ANOMALY_CYCLE_SECONDS: '150',
    SMARTGRID_SCADA_ANOMALY_INTENSITY: '1.0',
  }
}

export async function GET() {
  const { status, data } = await proxyFetch({
    path: '/v1/settings/runtime',
    timeoutMs: 8000,
  })
  if (status >= 400) {
    return NextResponse.json(
      { status: 'error', detail: (data as any)?.detail ?? `Backend request failed (${status})` },
      { status, headers: NO_STORE_HEADERS },
    )
  }
  return NextResponse.json(data, { status: 200, headers: NO_STORE_HEADERS })
}

export async function POST(req: Request) {
  const payload = (await req.json()) as SettingsPayload
  const overrides = buildRuntimeOverrides(payload)
  const envMap = buildRuntimeEnv(payload)

  const { status, data, backend } = await proxyFetch({
    path: '/v1/settings/runtime',
    method: 'POST',
    body: {
      values: payload,
      runtime_overrides: overrides,
      runtime_env: envMap,
    },
    timeoutMs: 10000,
  })

  if (status >= 400) {
    return NextResponse.json(
      { status: 'error', detail: (data as any)?.detail ?? `Backend request failed (${status})` },
      { status, headers: NO_STORE_HEADERS },
    )
  }

  return NextResponse.json(
    {
      status: 'ok',
      message: 'Runtime settings persisted to backend',
      backend: data,
      backend_url: backend,
    },
    { headers: NO_STORE_HEADERS },
  )
}
