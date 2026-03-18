import { NextResponse } from 'next/server'

type SettingsPayload = Record<string, string | number>

const FASTAPI = process.env.SMARTGRID_API_URL ?? 'https://smartgrid-public-api-1001036509634.us-central1.run.app'
const FASTAPI_KEY = process.env.SMARTGRID_API_KEY ?? 'smartgrid-dev-key'

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function setNested(obj: Record<string, any>, pathParts: string[], value: any) {
  let cursor: Record<string, any> = obj
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const key = pathParts[index]
    if (!cursor[key] || typeof cursor[key] !== 'object') {
      cursor[key] = {}
    }
    cursor = cursor[key]
  }
  cursor[pathParts[pathParts.length - 1]] = value
}

function buildRuntimeOverrides(payload: SettingsPayload): Record<string, any> {
  const overrides: Record<string, any> = {}

  const mappings: Array<{ key: string; path: string[]; fallback?: number }> = [
    { key: 'audit_budget_ratio', path: ['audit', 'audit_budget_ratio'], fallback: 0.07 },
    { key: 'risk_threshold', path: ['audit', 'risk_threshold'], fallback: 0.5 },
    { key: 'f_min', path: ['audit', 'f_min'], fallback: 1 },
    { key: 'f_max', path: ['audit', 'f_max'], fallback: 5 },
    { key: 'max_audits_cycle', path: ['audit', 'max_audits_per_cycle'], fallback: 100 },
    { key: 'k_scale', path: ['thresholds', 'k_sigma'], fallback: 4.0 },
    { key: 'anomaly_th', path: ['thresholds', 'score_threshold'], fallback: 4.0 },
    { key: 'prob_threshold', path: ['thresholds', 'prob_threshold'], fallback: 0.999 },
    { key: 'sigma_window', path: ['thresholds', 'sigma_window'], fallback: 24 },
    { key: 'learning_rate', path: ['gradient', 'lr'], fallback: 0.01 },
    { key: 'rl_gamma', path: ['rl', 'gamma'], fallback: 0.95 },
    { key: 'lstm_window', path: ['anomaly_model', 'lstm', 'window'], fallback: 24 },
    { key: 'lstm_hidden_size', path: ['anomaly_model', 'lstm', 'hidden_size'], fallback: 64 },
    { key: 'lstm_num_layers', path: ['anomaly_model', 'lstm', 'num_layers'], fallback: 2 },
    { key: 'lstm_dropout', path: ['anomaly_model', 'lstm', 'dropout'], fallback: 0.2 },
  ]

  for (const item of mappings) {
    if (!(item.key in payload)) continue
    const fallback = item.fallback ?? 0
    setNested(overrides, item.path, toNumber(payload[item.key], fallback))
  }

  return overrides
}

function buildRuntimeEnv(payload: SettingsPayload): Record<string, string> {
  const env: Record<string, string> = {}

  const setEnv = (envKey: string, value: unknown, fallback: number | string) => {
    if (typeof fallback === 'number') {
      env[envKey] = String(toNumber(value, fallback))
    } else {
      const finalValue = typeof value === 'string' && value.trim().length > 0 ? value : fallback
      env[envKey] = String(finalValue)
    }
  }

  setEnv('SMARTGRID_AUDIT_BUDGET_RATIO', payload.audit_budget_ratio, 0.07)
  setEnv('SMARTGRID_RISK_THRESHOLD', payload.risk_threshold, 0.5)
  setEnv('SMARTGRID_F_MAX', payload.f_max, 5)
  setEnv('SMARTGRID_MAX_AUDITS_PER_CYCLE', payload.max_audits_cycle, 100)

  setEnv('SMARTGRID_RL_ALPHA', payload.rl_alpha, 0.4)
  setEnv('SMARTGRID_RL_GAMMA', payload.rl_gamma, 0.95)
  setEnv('SMARTGRID_RL_EPSILON_START', payload.rl_epsilon_start, 1.0)
  setEnv('SMARTGRID_RL_EPSILON_MIN', payload.rl_epsilon_min, 0.05)
  setEnv('SMARTGRID_RL_EPSILON_DECAY', payload.rl_epsilon_decay, 0.995)

  setEnv('SMARTGRID_ALPHA_LOW', payload.alpha_low, 0.05)
  setEnv('SMARTGRID_ALPHA_HIGH', payload.alpha_high, 0.5)
  setEnv('SMARTGRID_BETA', payload.beta, 0.1)

  setEnv('SMARTGRID_ANOMALY_PROB_THRESHOLD', payload.prob_threshold, 0.999)
  setEnv('SMARTGRID_THRESHOLD_WINDOW', payload.sigma_window, 24)
  setEnv('SMARTGRID_LSTM_WINDOW', payload.lstm_window, 24)

  setEnv('SMARTGRID_FDI_RATE', payload.fdi_rate, 0.10)
  setEnv('SMARTGRID_DOS_RATE', payload.dos_rate, 0.05)
  setEnv('SMARTGRID_CHAIN_RATE', payload.chain_rate, 0.20)
  setEnv('SMARTGRID_FAULT_RATE', payload.fault_rate, 0.20)

  setEnv('SMARTGRID_RW_ATTACK', payload.reward_missed_attack_penalty, 10.0)
  setEnv('SMARTGRID_CONSTRAINT_LOG_LEVEL', payload.constraint_log_level, 'WARNING')

  setEnv('SMARTGRID_MITIGATION_DELAY', payload.mitigation_delay, 1)

  const explicitSuccess = typeof payload.audit_success_prob === 'number' ? payload.audit_success_prob : undefined
  const explicitMissing = typeof payload.missing_audit_prob === 'number' ? payload.missing_audit_prob : undefined
  const successFromMissing = explicitMissing !== undefined ? 1 - explicitMissing : undefined
  const success = explicitSuccess ?? successFromMissing ?? 0.95
  env.SMARTGRID_AUDIT_SUCCESS_PROB = String(Math.max(0, Math.min(1, success)))

  setEnv('SMARTGRID_API_HOST', payload.api_host, '127.0.0.1')
  setEnv('SMARTGRID_API_PORT', payload.api_port, 8000)

  return env
}

export async function GET() {
  if (!FASTAPI) {
    return NextResponse.json({ status: 'error', detail: 'SMARTGRID_API_URL is not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(`${FASTAPI}/v1/settings/runtime`, {
      method: 'GET',
      headers: {
        'x-api-key': FASTAPI_KEY,
      },
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        { status: 'error', detail: data?.detail ?? `Backend request failed (${response.status})` },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ status: 'error', detail: String(error) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!FASTAPI) {
    return NextResponse.json({ status: 'error', detail: 'SMARTGRID_API_URL is not configured' }, { status: 500 })
  }

  try {
    const payload = (await req.json()) as SettingsPayload

    const overrides = buildRuntimeOverrides(payload)
    const envMap = buildRuntimeEnv(payload)

    const response = await fetch(`${FASTAPI}/v1/settings/runtime`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': FASTAPI_KEY,
      },
      body: JSON.stringify({
        values: payload,
        runtime_overrides: overrides,
        runtime_env: envMap,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        { status: 'error', detail: data?.detail ?? `Backend request failed (${response.status})` },
        { status: response.status }
      )
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Runtime settings persisted to Railway backend',
      backend: data,
    })
  } catch (error) {
    return NextResponse.json({ status: 'error', detail: String(error) }, { status: 500 })
  }
}
