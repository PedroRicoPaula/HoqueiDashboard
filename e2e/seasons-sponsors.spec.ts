/**
 * E2E — Sponsors com 2 épocas diferentes
 *
 * Cenário: patrocinador A na época 2023/2024, patrocinador B na 2024/2025.
 * Ao selecionar cada época no sidebar só o patrocinador correto aparece.
 * Sem filtro → ambos visíveis.
 */
import { test, expect } from '@playwright/test'
import {
  createSeasonViaApi, deleteSeasonViaApi,
  createSponsorViaApi,
  selectSeason, clearSeasonFilter,
} from './helpers/api'

const SA_NAME = 'E2E Spo 2023/2024'
const SB_NAME = 'E2E Spo 2024/2025'
let seasonAId: string
let seasonBId: string

test.describe('Sponsors — isolamento por época', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/club-admin.json' })
    const page = await ctx.newPage()
    await page.goto('/')

    const a = await createSeasonViaApi(page, { name: SA_NAME, startDate: '2023-09-01', endDate: '2024-06-30' })
    const b = await createSeasonViaApi(page, { name: SB_NAME, startDate: '2024-09-01', endDate: '2025-06-30' })
    seasonAId = a.id
    seasonBId = b.id

    await createSponsorViaApi(page, {
      name: 'Patrocinador E2E Alpha',
      annualContribution: 5000,
      contractStart: '2023-09-01',
      contractEnd: '2024-06-30',
      seasonId: seasonAId,
    })

    await createSponsorViaApi(page, {
      name: 'Patrocinador E2E Beta',
      annualContribution: 8000,
      contractStart: '2024-09-01',
      contractEnd: '2025-06-30',
      seasonId: seasonBId,
    })

    await ctx.close()
  })

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/club-admin.json' })
    const page = await ctx.newPage()
    await page.goto('/')
    // Deleting seasons cascades to sponsors (via FK SET NULL then orphan clean up is not needed
    // but we explicitly delete seasons to keep data clean)
    if (seasonBId) await deleteSeasonViaApi(page, seasonBId).catch(() => {})
    if (seasonAId) await deleteSeasonViaApi(page, seasonAId).catch(() => {})
    await ctx.close()
  })

  test('sem filtro → ambos patrocinadores visíveis', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/sponsors')
    await expect(page.getByText('Patrocinador E2E Alpha')).toBeVisible()
    await expect(page.getByText('Patrocinador E2E Beta')).toBeVisible()
  })

  test('Época A → só Patrocinador Alpha visível', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/sponsors')
    await selectSeason(page, SA_NAME)
    await page.waitForTimeout(500)
    await expect(page.getByText('Patrocinador E2E Alpha')).toBeVisible()
    await expect(page.getByText('Patrocinador E2E Beta')).not.toBeVisible()
  })

  test('Época B → só Patrocinador Beta visível', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/sponsors')
    await selectSeason(page, SB_NAME)
    await page.waitForTimeout(500)
    await expect(page.getByText('Patrocinador E2E Beta')).toBeVisible()
    await expect(page.getByText('Patrocinador E2E Alpha')).not.toBeVisible()
  })

  test('chip de época aparece na toolbar de Sponsors', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/sponsors')
    await selectSeason(page, SA_NAME)
    // The season badge chip should appear in the sponsors toolbar
    await expect(page.getByText(SA_NAME)).toHaveCount(2) // sidebar selector + toolbar chip
  })

  test('trocar época → lista atualiza sem reload', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/sponsors')
    await selectSeason(page, SA_NAME)
    await page.waitForTimeout(300)
    await expect(page.getByText('Patrocinador E2E Alpha')).toBeVisible()
    // Now switch to B
    await selectSeason(page, SB_NAME)
    await page.waitForTimeout(300)
    await expect(page.getByText('Patrocinador E2E Beta')).toBeVisible()
    await expect(page.getByText('Patrocinador E2E Alpha')).not.toBeVisible()
    // URL stays at /sponsors
    await expect(page).toHaveURL('/sponsors')
  })
})
