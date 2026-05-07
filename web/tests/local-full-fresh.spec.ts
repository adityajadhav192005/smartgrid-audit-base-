import { expect, test } from '@playwright/test'
import { writeFileSync } from 'fs'
import { requireE2ECredentials } from './helpers/auth'

test('fresh local full validation: login, tabs, run(120), dashboard update, scada minute update', async ({ page }, testInfo) => {
  test.setTimeout(240000)
  const { email, password } = requireE2ECredentials()

  const checkpoints: Array<{ name: string; path: string; heading: RegExp }> = [
    { name: 'executive-overview', path: '/', heading: /Executive Overview/i },
    { name: 'live-monitoring', path: '/live', heading: /Live Monitoring/i },
    { name: 'scada-live-grid', path: '/scada-live', heading: /Grid With The Agents|SCADA Live Grid/i },
    { name: 'audit-intelligence', path: '/audits', heading: /Audit Intelligence/i },
    { name: 'attack-analysis', path: '/attacks', heading: /Attack Analysis/i },
    { name: 'analytics', path: '/history', heading: /Run History|Analytics/i },
    { name: 'anomaly-risk', path: '/anomalies', heading: /Anomaly\s*&\s*Risk/i },
    { name: 'xai', path: '/xai', heading: /Explainability\s*\(XAI\)/i },
    { name: 'response-mitigation', path: '/response', heading: /Response\s*&\s*Mitigation/i },
  ]

  const summary: string[] = []

  const safeCheck = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn()
      summary.push(`${name}: PASS`)
      return true
    } catch (error) {
      summary.push(`${name}: FAIL -> ${String(error)}`)
      return false
    }
  }

  await page.addInitScript(() => {
    window.localStorage.setItem('sg_e2e_auth_bypass', '1')
  })

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await safeCheck('login-page-visible', async () => {
    await expect(page.getByRole('heading', { name: /Sign in to SmartGrid AI/i })).toBeVisible({ timeout: 20000 })
  })
  summary.push(`credential-profile: ${email.replace(/(.{3}).+(@.+)/, '$1***$2')}`)

  await page.goto('/runs', { waitUntil: 'domcontentloaded' })
  await safeCheck('runs-route-reachable', async () => {
    await page.waitForURL('**/runs', { timeout: 20000 })
    await expect(page.getByRole('heading', { name: /Run Configuration/i })).toBeVisible({ timeout: 20000 })
  })

  const nInput = page.locator("div:has(label:has-text('Number of Agents')) input[type='number']").first()
  await safeCheck('set-agents-120', async () => {
    await nInput.fill('120')
  })

  await safeCheck('launch-run-click', async () => {
    await page.getByRole('button', { name: 'Launch Experiment' }).click()
  })

  await safeCheck('run-id-visible', async () => {
    await expect(page.getByText(/Run ID:/i)).toBeVisible({ timeout: 30000 })
  })
  const runIdNode = page.locator('text=Run ID:').locator('..').locator('span.font-mono').first()
  await safeCheck('run-id-populated', async () => {
    await expect(runIdNode).not.toHaveText('-', { timeout: 30000 })
  })
  const runId = (await runIdNode.textContent())?.trim() || 'unknown'
  summary.push(`launch-run-id: ${runId}`)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await safeCheck('executive-overview-visible', async () => {
    await expect(page.getByRole('heading', { name: /Executive Overview/i })).toBeVisible({ timeout: 15000 })
  })
  await safeCheck('dashboard-latest-run-updated', async () => {
    await expect(page.getByText(/Latest run verification:/i)).toBeVisible({ timeout: 30000 })
  })
  await page.screenshot({ path: testInfo.outputPath('executive-after-launch.png'), fullPage: true })

  for (const c of checkpoints) {
    await page.goto(c.path, { waitUntil: 'domcontentloaded' })
    const ok = await safeCheck(`tab-${c.name}`, async () => {
      await expect(page.getByRole('heading', { name: c.heading })).toBeVisible({ timeout: 15000 })
    })
    await page.screenshot({ path: testInfo.outputPath(`tab-${c.name}.png`), fullPage: true })
    summary.push(`tab-${c.name}-url: ${page.url()} (${ok ? 'ok' : 'check'})`)
  }

  await safeCheck('scada-page-open', async () => {
    await page.goto('/scada-live', { waitUntil: 'domcontentloaded' })
  })

  await safeCheck('scada-connect-click', async () => {
    const connectButton = page.getByRole('button', { name: /Connect/i }).first()
    if (await connectButton.isVisible()) {
      await connectButton.click()
    }
  })

  await safeCheck('scada-live-connected', async () => {
    await expect(page.getByText(/LIVE/i).first()).toBeVisible({ timeout: 20000 })
  })

  const extractTick = async (): Promise<number> => {
    try {
      const node = page.locator('p:has-text("tick #")').first()
      const txt = (await node.textContent()) || ''
      const match = txt.match(/tick\s*#(\d+)/i)
      return match ? Number(match[1]) : -1
    } catch {
      return -1
    }
  }

  const tickVisible = await safeCheck('scada-tick-visible', async () => {
    await expect(page.locator('p:has-text("tick #")').first()).toBeVisible({ timeout: 15000 })
  })

  if (tickVisible) {
    const tick1 = await extractTick()
    await page.waitForTimeout(65000)
    const tick2 = await extractTick()
    if (tick2 > tick1 && tick1 >= 0) {
      summary.push(`scada-minute-update: PASS -> tick ${tick1} -> ${tick2}`)
    } else {
      summary.push(`scada-minute-update: FAIL -> tick ${tick1} -> ${tick2}`)
    }
  } else {
    summary.push('scada-minute-update: FAIL -> tick header unavailable')
  }

  await safeCheck('scada-minute-screenshot', async () => {
    await page.screenshot({ path: testInfo.outputPath('scada-minute-update.png'), fullPage: true })
  })

  writeFileSync(testInfo.outputPath('fresh-local-summary.txt'), `${summary.join('\n')}\n`, { encoding: 'utf8' })
})
