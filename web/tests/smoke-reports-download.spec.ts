import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import { loginToPath, requireE2ECredentials } from './helpers/auth'

test('authenticated user can generate report and trigger save/download', async ({ page }, testInfo) => {
  const { email, password } = requireE2ECredentials()

  await page.addInitScript(() => {
    try {
      Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true })
    } catch {
      // ignore in restricted runtimes
    }
  })

  await loginToPath(page, '/reports', email, password)

  await expect(page.getByRole('heading', { name: 'Reports & Export' })).toBeVisible()

  const generateButton = page.getByRole('button', { name: /^Generate$/ }).first()
  await expect(generateButton).toBeVisible()

  const download = await Promise.all([
    page.waitForEvent('download', { timeout: 20_000 }),
    generateButton.click(),
  ]).then(([dl]) => dl)

  const filename = download.suggestedFilename()
  expect(filename).toMatch(/\.(json|csv|txt)$/i)

  const savePath = testInfo.outputPath(filename)
  await download.saveAs(savePath)
  expect(fs.existsSync(savePath)).toBeTruthy()

  await expect(page.getByRole('button', { name: /^Download$/ }).first()).toBeVisible()
})
