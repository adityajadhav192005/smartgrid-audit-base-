import { NextResponse } from 'next/server'

type SettingsPayload = Record<string, string | number>

const DEFAULT_FASTAPI = 'https://smartgrid-public-api-1001036509634.us-central1.run.app'
const LOCAL_API = process.env.SMARTGRID_LOCAL_API ?? 'http://127.0.0.1:8000'
const FASTAPI = process.env.SMARTGRID_API_URL ?? DEFAULT_FASTAPI
const FASTAPI_KEY = process.env.SMARTGRID_API_KEY ?? 'smartgrid-dev-key'
const SETTINGS_API = process.env.SMARTGRID_SETTINGS_API_URL
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function candidateApis(): string[] {
  const options = [LOCAL_API, FASTAPI, SETTINGS_API, DEFAULT_FASTAPI]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map(value => value.replace(/\/+$/, ''))

  return Array.from(new Set(options))
}

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
    { key: 'anomaly_th', path: ['thresholds', 'score_threshold'], fallback: 3.0 },
    { key: 'prob_threshold', path: ['thresholds', 'prob_threshold'], fallback: 0.97 },
    { key: 'hybrid_w_dev', path: ['thresholds', 'hybrid_w_dev'], fallback: 0.55 },
    { key: 'hybrid_w_prob', path: ['thresholds', 'hybrid_w_prob'], fallback: 0.45 },
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
  if ('num_agents' in payload) {
    setEnv('SMARTGRID_NUM_AGENTS', payload.num_agents, 100)
  }
  setEnv('SMARTGRID_TRAIN_EPISODES', payload.episodes, 200)

  setEnv('SMARTGRID_RL_ALPHA', payload.rl_alpha, 0.4)
  setEnv('SMARTGRID_RL_GAMMA', payload.rl_gamma, 0.95)
  setEnv('SMARTGRID_RL_EPSILON_START', payload.rl_epsilon_start, 1.0)
  setEnv('SMARTGRID_RL_EPSILON_MIN', payload.rl_epsilon_min, 0.05)
  setEnv('SMARTGRID_RL_EPSILON_DECAY', payload.rl_epsilon_decay, 0.995)

  setEnv('SMARTGRID_ALPHA_LOW', payload.alpha_low, 0.05)
  setEnv('SMARTGRID_ALPHA_HIGH', payload.alpha_high, 0.5)
  setEnv('SMARTGRID_BETA', payload.beta, 0.1)

  setEnv('SMARTGRID_SCORE_THRESHOLD', payload.anomaly_th, 3.0)
  setEnv('SMARTGRID_ANOMALY_PROB_THRESHOLD', payload.prob_threshold, 0.97)
  setEnv('SMARTGRID_HYBRID_W_DEV', payload.hybrid_w_dev, 0.55)
  setEnv('SMARTGRID_HYBRID_W_PROB', payload.hybrid_w_prob, 0.45)
  setEnv('SMARTGRID_THRESHOLD_WINDOW', payload.sigma_window, 24)
  setEnv('SMARTGRID_LSTM_WINDOW', payload.lstm_window, 24)
  setEnv('SMARTGRID_SEEDS', payload.seeds, '42,43,44')

  env.SMARTGRID_FDI_RATE = String(toRatio(payload.fdi_rate, 0.10))
  env.SMARTGRID_DOS_RATE = String(toRatio(payload.dos_rate, 0.05))
  env.SMARTGRID_CHAIN_RATE = String(toRatio(payload.chain_rate, 0.20))
  env.SMARTGRID_FAULT_RATE = String(toRatio(payload.fault_rate, 0.20))

  setEnv('SMARTGRID_RW_AUDIT', payload.lambda_audit ?? payload.reward_audit_penalty, 0.05)
  setEnv('SMARTGRID_RW_ATTACK', payload.reward_missed_attack_penalty ?? payload.lambda_attack, 10.0)
  setEnv('SMARTGRID_CONSTRAINT_LOG_LEVEL', payload.constraint_log_level, 'WARNING')

  setEnv('SMARTGRID_MITIGATION_DELAY', payload.mitigation_delay, 1)

  const explicitSuccess = typeof payload.audit_success_prob === 'number' ? payload.audit_success_prob : undefined
  const explicitMissing = typeof payload.missing_audit_prob === 'number' ? payload.missing_audit_prob : undefined
  const successFromMissing = explicitMissing !== undefined ? 1 - explicitMissing : undefined
  const success = explicitSuccess ?? successFromMissing ?? 0.95
  env.SMARTGRID_AUDIT_SUCCESS_PROB = String(Math.max(0, Math.min(1, success)))

  setEnv('SMARTGRID_API_HOST', payload.api_host, '127.0.0.1')
  setEnv('SMARTGRID_API_PORT', payload.api_port, 8000)
  setEnv('SMARTGRID_SCADA_POLL_SEC', payload.scada_poll, 2)
  setEnv('SMARTGRID_SCADA_DEMO_ANOMALY_PHASE', payload.scada_demo_phase, 'Independent')
  setEnv('SMARTGRID_SCADA_INDEPENDENT_RATE_PRESET', payload.scada_rate_preset, 'Realistic')
  setEnv('SMARTGRID_SCADA_ANOMALY_CYCLE_SECONDS', payload.scada_anomaly_cycle_seconds, 150)
  setEnv('SMARTGRID_SCADA_ANOMALY_INTENSITY', payload.scada_anomaly_intensity, 1.0)

  return env
}

export async function GET() {
  const apis = candidateApis()
  if (apis.length === 0) {
    return NextResponse.json({ status: 'error', detail: 'SMARTGRID_API_URL is not configured' }, { status: 500, headers: NO_STORE_HEADERS })
  }

  let lastError = ''
  try {
    for (const api of apis) {
      try {
        const response = await fetch(`${api}/v1/settings/runtime`, {
          method: 'GET',
          headers: {
            'x-api-key': FASTAPI_KEY,
          },
          cache: 'no-store',
        })

        const data = await response.json().catch(() => ({}))
        if (response.status === 404) {
          lastError = data?.detail ?? `Not found on ${api}`
          continue
        }

        if (!response.ok) {
          return NextResponse.json(
            { status: 'error', detail: data?.detail ?? `Backend request failed (${response.status})` },
            { status: response.status, headers: NO_STORE_HEADERS }
          )
        }

        return NextResponse.json(data, { headers: NO_STORE_HEADERS })
      } catch (error) {
        lastError = String(error)
      }
    }

    return NextResponse.json({ status: 'error', detail: lastError || 'No settings backend responded' }, { status: 503, headers: NO_STORE_HEADERS })
  } catch (error) {
    return NextResponse.json({ status: 'error', detail: String(error) }, { status: 500, headers: NO_STORE_HEADERS })
  }
}

export async function POST(req: Request) {
  const apis = candidateApis()
  if (apis.length === 0) {
    return NextResponse.json({ status: 'error', detail: 'SMARTGRID_API_URL is not configured' }, { status: 500, headers: NO_STORE_HEADERS })
  }

  try {
    const payload = (await req.json()) as SettingsPayload

    const overrides = buildRuntimeOverrides(payload)
    const envMap = buildRuntimeEnv(payload)

    let lastError = ''

    for (const api of apis) {
      try {
        const response = await fetch(`${api}/v1/settings/runtime`, {
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
        if (response.status === 404) {
          lastError = data?.detail ?? `Not found on ${api}`
          continue
        }

        if (!response.ok) {
          return NextResponse.json(
            { status: 'error', detail: data?.detail ?? `Backend request failed (${response.status})` },
            { status: response.status, headers: NO_STORE_HEADERS }
          )
        }

        return NextResponse.json({
          status: 'ok',
          message: 'Runtime settings persisted to backend',
          backend: data,
          backend_url: api,
        }, { headers: NO_STORE_HEADERS })
      } catch (error) {
        lastError = String(error)
      }
    }

    return NextResponse.json({ status: 'error', detail: lastError || 'No settings backend responded' }, { status: 503, headers: NO_STORE_HEADERS })
  } catch (error) {
    return NextResponse.json({ status: 'error', detail: String(error) }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
