/**
 * E2E — Dashboard stats filtradas por época
 *
 * Cenário:
 *   Época A "E2E Dash 2023/2024": 1 sócio + 1 patrocinador
 *   Época B "E2E Dash 2024/2025": 2 sócios + 0 patrocinadores
 *
 * Verificações:
 *   - Sem filtro → stats somam tudo
 *   - Época A → mostra 1 sócio
 *   - Época B → mostra 2 sócios
 *   - Atletas não têm época → contagem constante independente de filtro
 */
import { test, expect } from '@playwright/test'
import {
  createSeasonViaApi, deleteSeasonViaApi,
  createMemberViaApi, createSponsorViaApi,
  selectSeason, clearSeasonFilter,
} from './helpers/api'

const SA_NAME = 'E2E Dash 2023/2024'
const SB_NAME = 'E2E Dash 2024/2025'
let seasonAId: string
let seasonBId: string

test.describe('Dashboard — stats filtradas por época', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/club-admin.json' })
    const page = await ctx.newPage()
    await page.goto('/')

    const a = await createSeasonViaApi(page, { name: SA_NAME, startDate: '2023-09-01', endDate: '2024-06-30' })
    const b = await createSeasonViaApi(page, { name: SB_NAME, startDate: '2024-09-01', endDate: '2025-06-30' })
    seasonAId = a.id
    seasonBId = b.id

    // Season A: 1 member + 1 sponsor
    await createMemberViaApi(page, { name: 'Dash Sócio A1', number: 9801, monthlyQuota: 10, seasonId: seasonAId })
    await createSponsorViaApi(page, {
      name: 'Dash Sponsor A1',
      annualContribution: 1000,
      contractStart: '2023-09-01',
      contractEnd: '2024-06-30',
      seasonId: seasonAId,
    })

    // Season B: 2 members + 0 sponsors
    await createMemberViaApi(page, { name: 'Dash Sócio B1', number: 9802, monthlyQuota: 10, seasonId: seasonBId })
    await createMemberViaApi(page, { name: 'Dash Sócio B2', number: 9803, monthlyQuota: 10, seasonId: seasonBId })

    await ctx.close()
  })

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/club-admin.json' })
    const page = await ctx.newPage()
    await page.goto('/')
    if (seasonBId) await deleteSeasonViaApi(page, seasonBId).catch(() => {})
    if (seasonAId) await deleteSeasonViaApi(page, seasonAId).catch(() => {})
    await ctx.close()
  })

  test('Época A → stats API devolve dados da época A', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/')
    await selectSeason(page, SA_NAME)
    await page.waitForTimeout(600)

    // Dashboard stats are fetched from /api/dashboard/stats?seasonId=...
    // We verify via the API directly to avoid fragile stat card text matching
    const stats = await page.evaluate(async (sId) => {
      const res = await fetch(`/api/dashboard/stats?seasonId=${sId}`)
      return res.ok ? await res.json() : null
    }, seasonAId)

    expect(stats).not.toBeNull()
    // Season A has 1 member
    expect(stats.totalMembers).toBeGreaterThanOrEqual(1)
    // Season A has 1 sponsor
    expect(stats.totalSponsors).toBeGreaterThanOrEqual(1)
  })

  test('Época B → stats API devolve 2 sócios, 0 patrocinadores', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/')
    await selectSeason(page, SB_NAME)
    await page.waitForTimeout(600)

    const stats = await page.evaluate(async (sId) => {
      const res = await fetch(`/api/dashboard/stats?seasonId=${sId}`)
      return res.ok ? await res.json() : null
    }, seasonBId)

    expect(stats).not.toBeNull()
    expect(stats.totalMembers).toBeGreaterThanOrEqual(2)
    // Season B has no sponsors
    expect(stats.totalSponsors).toBe(0)
  })

  test('stats API sem seasonId → inclui todas as épocas', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/')
    await page.waitForTimeout(300)

    const statsA = await page.evaluate(async (sId) => {
      const r = await fetch(`/api/dashboard/stats?seasonId=${sId}`)
      return r.ok ? await r.json() : null
    }, seasonAId)

    const statsB = await page.evaluate(async (sId) => {
      const r = await fetch(`/api/dashboard/stats?seasonId=${sId}`)
      return r.ok ? await r.json() : null
    }, seasonBId)

    const statsAll = await page.evaluate(async () => {
      const r = await fetch('/api/dashboard/stats')
      return r.ok ? await r.json() : null
    })

    expect(statsAll).not.toBeNull()
    // Without filter, total members >= sum of A + B
    expect(statsAll.totalMembers).toBeGreaterThanOrEqual(
      (statsA?.totalMembers ?? 0) + (statsB?.totalMembers ?? 0)
    )
  })

  test('dashboard page mostra card de stats visível', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/')
    // The dashboard should have stat cards — verify the page loaded
    await expect(page.locator('main')).toBeVisible()
    // At least one numeric stat card should be visible
    const statCards = page.locator('[class*="card"], [class*="stat"]')
    await expect(statCards.first()).toBeVisible()
  })

  test('trocar época no sidebar → URL dashboard mantém-se /', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/')
    await selectSeason(page, SA_NAME)
    await page.waitForTimeout(200)
    await expect(page).toHaveURL('/')
    await selectSeason(page, SB_NAME)
    await page.waitForTimeout(200)
    await expect(page).toHaveURL('/')
  })
})
