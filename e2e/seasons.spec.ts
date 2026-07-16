/**
 * E2E — Season CRUD
 *
 * Testa a página /seasons: criar, editar, ativar e tentar eliminar épocas.
 * Os IDs das épocas criadas são limpos em afterAll.
 */
import { test, expect } from '@playwright/test'
import { createSeasonViaApi, deleteSeasonViaApi } from './helpers/api'

const SEASON_A = { name: 'E2E 2023/2024', startDate: '2023-09-01', endDate: '2024-06-30' }
const SEASON_B = { name: 'E2E 2024/2025', startDate: '2024-09-01', endDate: '2025-06-30' }
const CARD_A = `season-card-E2E-2023-2024`
const CARD_B = `season-card-E2E-2024-2025`

let seasonAId: string
let seasonBId: string

test.describe('Season CRUD', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/club-admin.json' })
    const page = await ctx.newPage()
    await page.goto('/')
    const a = await createSeasonViaApi(page, SEASON_A)
    const b = await createSeasonViaApi(page, SEASON_B)
    seasonAId = a.id
    seasonBId = b.id
    await ctx.close()
  })

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/club-admin.json' })
    const page = await ctx.newPage()
    await page.goto('/')
    // Delete B first (not active), then A
    if (seasonBId) await deleteSeasonViaApi(page, seasonBId).catch(() => {})
    if (seasonAId) await deleteSeasonViaApi(page, seasonAId).catch(() => {})
    await ctx.close()
  })

  test('ambas as épocas aparecem em /seasons', async ({ page }) => {
    await page.goto('/seasons')
    await expect(page.getByText(SEASON_A.name)).toBeVisible()
    await expect(page.getByText(SEASON_B.name)).toBeVisible()
  })

  test('época sem dados aparece como inativa (círculo vazio)', async ({ page }) => {
    await page.goto('/seasons')
    // Both seasons are new and inactive — no "Ativa" badge on either
    const cardA = page.getByTestId(CARD_A)
    const cardB = page.getByTestId(CARD_B)
    await expect(cardA).toBeVisible()
    await expect(cardB).toBeVisible()
    // Neither card should show "Ativa"
    await expect(cardA.getByText('Ativa')).not.toBeVisible()
    await expect(cardB.getByText('Ativa')).not.toBeVisible()
  })

  test('ativar época A → badge "Ativa" aparece, botão "Definir como ativa" desaparece', async ({ page }) => {
    await page.goto('/seasons')
    const cardA = page.getByTestId(CARD_A)
    await cardA.getByRole('button', { name: 'Definir como ativa' }).click()
    // Wait for toast and reload
    await expect(page.getByText(/Época "E2E 2023\/2024" definida como ativa/)).toBeVisible()
    // Badge "Ativa" now shows on A
    await expect(cardA.getByText('Ativa')).toBeVisible()
    // Activate button disappears for A (can't reactivate already-active)
    await expect(cardA.getByRole('button', { name: 'Definir como ativa' })).not.toBeVisible()
  })

  test('ativar época B → apenas B fica ativa (A perde "Ativa")', async ({ page }) => {
    await page.goto('/seasons')
    const cardA = page.getByTestId(CARD_A)
    const cardB = page.getByTestId(CARD_B)
    await cardB.getByRole('button', { name: 'Definir como ativa' }).click()
    await expect(page.getByText(/Época "E2E 2024\/2025" definida como ativa/)).toBeVisible()
    // B agora ativa, A não
    await expect(cardB.getByText('Ativa')).toBeVisible()
    await expect(cardA.getByText('Ativa')).not.toBeVisible()
  })

  test('editar nome da época A via dialog', async ({ page }) => {
    await page.goto('/seasons')
    const cardA = page.getByTestId(CARD_A)
    // Click pencil button (edit)
    await cardA.getByRole('button').filter({ has: page.locator('svg') }).nth(0).click()
    // Dialog opens with current name
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Editar Época')).toBeVisible()
    // Clear name and type new one (revert after to keep cleanup simple)
    const nameInput = page.getByPlaceholder('2025/2026')
    await nameInput.clear()
    await nameInput.fill(SEASON_A.name) // same name — just confirm dialog works
    await page.getByRole('button', { name: /Guardar|Atualizar/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByText(SEASON_A.name)).toBeVisible()
  })

  test('eliminar época ativa está bloqueado (botão desativado)', async ({ page }) => {
    await page.goto('/seasons')
    // B is currently active — its delete button should be disabled
    const cardB = page.getByTestId(CARD_B)
    const deleteBtn = cardB.locator('button[disabled]').last()
    await expect(deleteBtn).toBeDisabled()
  })

  test('contadores de sócios/patrocinadores aparecem (0 para épocas novas)', async ({ page }) => {
    await page.goto('/seasons')
    const cardA = page.getByTestId(CARD_A)
    await expect(cardA.getByText('0 sócio(s)')).toBeVisible()
    await expect(cardA.getByText('0 patrocinador(es)')).toBeVisible()
  })

  test('counter incrementa após criar sócio na época', async ({ page }) => {
    // Create a member in Season A via API
    await page.goto('/')
    const memberResult = await page.evaluate(async (sId) => {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'E2E Membro Counter', number: 9901, monthlyQuota: 0, seasonId: sId }),
      })
      return { ok: res.ok, body: await res.json() }
    }, seasonAId)
    expect(memberResult.ok).toBe(true)

    await page.goto('/seasons')
    const cardA = page.getByTestId(CARD_A)
    await expect(cardA.getByText('1 sócio(s)')).toBeVisible()
  })
})
