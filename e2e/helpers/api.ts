/**
 * API helpers for E2E tests.
 * All calls go through page.evaluate() so they run inside the browser context —
 * Origin header is set automatically, satisfying CSRF middleware checks.
 */
import type { Page } from '@playwright/test'

// ─── Season ──────────────────────────────────────────────────────────────────

export interface SeasonData {
  name: string
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
}

export interface Season extends SeasonData {
  id: string
  isActive: boolean
}

export async function createSeasonViaApi(page: Page, data: SeasonData): Promise<Season> {
  const result = await page.evaluate(async (payload) => {
    const res = await fetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { ok: res.ok, status: res.status, body: await res.json() }
  }, data)

  if (!result.ok) {
    throw new Error(`createSeason failed (${result.status}): ${JSON.stringify(result.body)}`)
  }
  return result.body as Season
}

export async function deleteSeasonViaApi(page: Page, id: string): Promise<void> {
  await page.evaluate(async (seasonId) => {
    await fetch(`/api/seasons/${seasonId}`, { method: 'DELETE' })
  }, id)
}

export async function activateSeasonViaApi(page: Page, id: string): Promise<void> {
  const result = await page.evaluate(async (seasonId) => {
    const res = await fetch(`/api/seasons/${seasonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate' }),
    })
    return { ok: res.ok, body: await res.json() }
  }, id)
  if (!result.ok) throw new Error(`activateSeason failed: ${JSON.stringify(result.body)}`)
}

// ─── Member ───────────────────────────────────────────────────────────────────

export interface MemberData {
  name: string
  number: number
  monthlyQuota: number
  seasonId?: string | null
}

export interface Member extends MemberData {
  id: string
}

export async function createMemberViaApi(page: Page, data: MemberData): Promise<Member> {
  const result = await page.evaluate(async (payload) => {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { ok: res.ok, status: res.status, body: await res.json() }
  }, data)

  if (!result.ok) {
    throw new Error(`createMember failed (${result.status}): ${JSON.stringify(result.body)}`)
  }
  return result.body as Member
}

// ─── Sponsor ─────────────────────────────────────────────────────────────────

export interface SponsorData {
  name: string
  annualContribution: number
  contractStart: string   // YYYY-MM-DD
  contractEnd: string     // YYYY-MM-DD
  seasonId?: string | null
}

export interface Sponsor extends SponsorData {
  id: string
}

export async function createSponsorViaApi(page: Page, data: SponsorData): Promise<Sponsor> {
  const result = await page.evaluate(async (payload) => {
    const res = await fetch('/api/sponsors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { ok: res.ok, status: res.status, body: await res.json() }
  }, data)

  if (!result.ok) {
    throw new Error(`createSponsor failed (${result.status}): ${JSON.stringify(result.body)}`)
  }
  return result.body as Sponsor
}

// ─── Season selector (UI) ────────────────────────────────────────────────────

/** Clicks the SeasonSelector dropdown and selects the given season name. */
export async function selectSeason(page: Page, seasonName: string) {
  const selector = page.getByTestId('season-selector')
  await selector.click()
  await page.getByRole('button', { name: seasonName }).click()
}

/** Clicks the SeasonSelector and selects "Selecionar época" (all seasons / reset). */
export async function clearSeasonFilter(page: Page) {
  const selector = page.getByTestId('season-selector')
  await selector.click()
  // The selector shows the current season name when something is selected.
  // Clicking it again and pressing Escape closes it; alternatively look for a "clear" option.
  // Since there's no explicit "all" option in SeasonSelector, we reload the page to reset Zustand.
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    // Reset Zustand persisted state directly
    const key = 'hm-season'
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.state) {
        parsed.state.selectedSeasonId = null
        localStorage.setItem(key, JSON.stringify(parsed))
      }
    }
  })
  await page.reload()
}
