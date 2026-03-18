import { type Page, test } from '@playwright/test'

export function getE2ECredentials() {
  const email = process.env.SMARTGRID_E2E_EMAIL || process.env.E2E_AUTH_EMAIL || ''
  const password = process.env.SMARTGRID_E2E_PASSWORD || process.env.E2E_AUTH_PASSWORD || ''
  return { email, password }
}

export async function loginToPath(page: Page, nextPath: string, email: string, password: string) {
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL(`**${nextPath}`, { timeout: 30_000 })
}

export function requireE2ECredentials() {
  const creds = getE2ECredentials()
  test.skip(!creds.email || !creds.password, 'Set SMARTGRID_E2E_EMAIL and SMARTGRID_E2E_PASSWORD to run authenticated smoke tests.')
  return creds
}
