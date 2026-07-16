/**
 * E2E — Members com 2 épocas diferentes
 *
 * Cenário crítico: mesmo nº de sócio (99) em 2 épocas distintas.
 * Verifica isolamento via SeasonSelector — cada época mostra apenas os seus sócios.
 *
 * Dados criados:
 *   Época A "E2E Mbr 2023/2024":  Sócio "Ana E2E" nº 99
 *   Época B "E2E Mbr 2024/2025":  Sócio "João E2E" nº 99 (mesmo nº, época diferente)
 */
import { test, expect } from '@playwright/test'
import {
  createSeasonViaApi, deleteSeasonViaApi,
  createMemberViaApi,
  selectSeason, clearSeasonFilter,
} from './helpers/api'

const SA_NAME = 'E2E Mbr 2023/2024'
const SB_NAME = 'E2E Mbr 2024/2025'
let seasonAId: string
let seasonBId: string

test.describe('Members — isolamento por época', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/club-admin.json' })
    const page = await ctx.newPage()
    await page.goto('/')

    const a = await createSeasonViaApi(page, { name: SA_NAME, startDate: '2023-09-01', endDate: '2024-06-30' })
    const b = await createSeasonViaApi(page, { name: SB_NAME, startDate: '2024-09-01', endDate: '2025-06-30' })
    seasonAId = a.id
    seasonBId = b.id

    // Create members in each season with the SAME number (99)
    await createMemberViaApi(page, { name: 'Ana E2E', number: 9901, monthlyQuota: 10, seasonId: seasonAId })
    await createMemberViaApi(page, { name: 'João E2E', number: 9901, monthlyQuota: 15, seasonId: seasonBId })

    await ctx.close()
  })

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/club-admin.json' })
    const page = await ctx.newPage()
    await page.goto('/')
    // Deleting seasons cascades to members
    if (seasonBId) await deleteSeasonViaApi(page, seasonBId).catch(() => {})
    if (seasonAId) await deleteSeasonViaApi(page, seasonAId).catch(() => {})
    await ctx.close()
  })

  test('mesmo nº de sócio (99) existe nas duas épocas sem conflito', async ({ page }) => {
    // Both were created in beforeAll without error — no unique constraint violation.
    // Simply verify both appear when no season filter is active.
    await clearSeasonFilter(page)
    await page.goto('/members')
    await expect(page.getByText('Ana E2E')).toBeVisible()
    await expect(page.getByText('João E2E')).toBeVisible()
  })

  test('filtro Época A → só Ana E2E aparece', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/members')
    await selectSeason(page, SA_NAME)
    // Wait for list to refresh
    await page.waitForTimeout(500)
    await expect(page.getByText('Ana E2E')).toBeVisible()
    await expect(page.getByText('João E2E')).not.toBeVisible()
  })

  test('filtro Época B → só João E2E aparece', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/members')
    await selectSeason(page, SB_NAME)
    await page.waitForTimeout(500)
    await expect(page.getByText('João E2E')).toBeVisible()
    await expect(page.getByText('Ana E2E')).not.toBeVisible()
  })

  test('sem filtro de época → ambos os sócios visíveis', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/members')
    await page.waitForTimeout(300)
    await expect(page.getByText('Ana E2E')).toBeVisible()
    await expect(page.getByText('João E2E')).toBeVisible()
  })

  test('chip de época aparece na toolbar quando época selecionada', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/members')
    await selectSeason(page, SA_NAME)
    // The season chip (badge) with the season name should appear in the toolbar
    await expect(page.getByText(SA_NAME)).toHaveCount(2) // sidebar selector + toolbar chip
  })

  test('formulário de criar sócio pré-seleciona a época ativa do sidebar', async ({ page }) => {
    await clearSeasonFilter(page)
    await page.goto('/members')
    await selectSeason(page, SA_NAME)
    // Open create form
    await page.getByRole('button', { name: /Adicionar Sócio|Novo Sócio/i }).click()
    // The season dropdown in the form should show Season A
    const form = page.locator('[role="dialog"], aside').last()
    await expect(form.getByText(SA_NAME)).toBeVisible()
  })
})
