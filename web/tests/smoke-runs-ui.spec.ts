import { expect, test } from '@playwright/test'

test('runs page can launch and complete one experiment', async ({ page }, testInfo) => {
  await page.goto('/runs', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'Run Configuration' })).toBeVisible()

  const agentInput = page.locator('input[type="number"]').first()
  await agentInput.fill('100')

  await page.getByRole('button', { name: 'Launch Experiment' }).click()

  await expect(page.getByText(/Run ID:/i)).toBeVisible()
  await expect(page.locator('text=Run ID:').locator('..').locator('span.font-mono')).not.toHaveText('-', {
    timeout: 20_000,
  })

  const statusBadge = page.getByText(/COMPLETED|FAILED|RUNNING|QUEUED/i).first()
  await expect(statusBadge).toBeVisible()

  await expect(page.getByText(/Cost Eff:/i)).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/Risk Mit:/i)).toBeVisible()

  const shotPath = testInfo.outputPath('runs-ui-result.png')
  await page.screenshot({ path: shotPath, fullPage: true })
})
