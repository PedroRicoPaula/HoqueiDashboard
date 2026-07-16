/**
 * Auth setup — runs once before all E2E tests.
 * Logs in as HC Porto Demo admin and saves session to e2e/.auth/club-admin.json.
 *
 * Requires demo clubs to be seeded first:
 *   npx tsx scripts/seed-test-clubs.js
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '.auth', 'club-admin.json')

setup('authenticate as club admin', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel(/Email/i).fill('admin@hcporto-demo.com')
  await page.getByLabel(/Password|Palavra-passe/i).fill('porto123')
  await page.getByRole('button', { name: /Entrar|Login/i }).click()

  // Wait for redirect to dashboard root
  await page.waitForURL('/', { timeout: 10_000 })
  await expect(page).not.toHaveURL('/login')

  await page.context().storageState({ path: AUTH_FILE })
})
