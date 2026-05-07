import { expect, test } from '@playwright/test'
import { writeFileSync } from 'fs'

test('live chromium walkthrough with section checkpoints', async ({ page }) => {
  const baseUrl = process.env.LOCAL_BASE_URL ?? 'http://localhost:3000'
  const email = process.env.SMARTGRID_TEST_EMAIL ?? 'adityajadhav192005@gmail.com'
  const password = process.env.SMARTGRID_TEST_PASSWORD ?? 'Adi@192005tya'

  const checkpoints: Array<{ name: string; path: string; heading: RegExp | string }> = [
    { name: 'executive-overview', path: '/', heading: /Executive Overview/i },
    { name: 'live-monitoring', path: '/live', heading: /Live Monitoring/i },
    { name: 'scada-live-grid', path: '/scada-live', heading: /Grid With The Agents|SCADA Live Grid/i },
    { name: 'audit-intelligence', path: '/audits', heading: /Audit Intelligence/i },
    { name: 'attack-analysis', path: '/attacks', heading: /Attack Analysis/i },
    { name: 'analytics', path: '/history', heading: /Run History|Analytics/i },
    { name: 'anomaly-and-risk', path: '/anomalies', heading: /Anomaly\s*&\s*Risk/i },
    { name: 'xai', path: '/xai', heading: /Explainability \(XAI\)/i },
    { name: 'response-and-mitigation', path: '/response', heading: /Response\s*&\s*Mitigation/i },
  ]

  const summary: string[] = []

  await test.step('Open login page and authenticate', async () => {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /Sign in to SmartGrid AI/i })).toBeVisible({ timeout: 15000 })
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: /Sign In/i }).click()

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 })
    await page.screenshot({ path: test.info().outputPath('checkpoint-login-success.png'), fullPage: true })
    summary.push(`login: PASS -> ${page.url()}`)
  })

  for (const point of checkpoints) {
    await test.step(`Checkpoint: ${point.name}`, async () => {
      await page.goto(`${baseUrl}${point.path}`, { waitUntil: 'domcontentloaded' })
      let ok = true
      try {
        await expect(page.getByRole('heading', { name: point.heading })).toBeVisible({ timeout: 15000 })
      } catch {
        ok = false
      }
      await page.waitForTimeout(1500)
      await page.screenshot({ path: test.info().outputPath(`checkpoint-${point.name}.png`), fullPage: true })
      const line = `[checkpoint] ${point.name} -> ${page.url()} -> ${ok ? 'PASS' : 'HEADING_MISMATCH'}`
      console.log(line)
      summary.push(`${point.name}: ${ok ? 'PASS' : 'HEADING_MISMATCH'} -> ${page.url()}`)
    })
  }

  writeFileSync(test.info().outputPath('checkpoint-summary.txt'), `${summary.join('\n')}\n`, { encoding: 'utf8' })
})
