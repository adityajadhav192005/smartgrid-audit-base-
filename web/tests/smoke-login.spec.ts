import { expect, test } from '@playwright/test'

test('login page renders email auth only', async ({ page, request }) => {
  const health = await request.get('/api/proxy/health')
  expect(health.ok()).toBeTruthy()

  await page.goto('/login', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'Sign in to SmartGrid AI' })).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()

  await expect(page.getByRole('button', { name: /Continue with Google/i })).toHaveCount(0)
  await expect(page.getByText(/Google login is not enabled/i)).toHaveCount(0)
})
