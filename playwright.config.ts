import { defineConfig, devices } from '@playwright/test'

/**
 * E2E tests for the Season (Época Desportiva) feature.
 *
 * Prerequisites:
 *   1. npm run dev            (dev server on localhost:3000)
 *   2. npx tsx scripts/seed-test-clubs.js   (creates demo club HC Porto Demo)
 *   3. npx playwright install chromium      (first time only)
 *
 * Run:
 *   npm run test:e2e            (all E2E tests)
 *   npm run test:e2e -- --ui    (interactive mode)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
    // Auth state saved by e2e/auth.setup.ts — reused across all tests
    storageState: 'e2e/.auth/club-admin.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Setup project — runs first, saves auth state
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { storageState: undefined },
    },
    // Main tests — depend on setup
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  // Start dev server automatically if not already running
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
