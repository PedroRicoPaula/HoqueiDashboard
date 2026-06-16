import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getClientIp } from '@/lib/rateLimit'

// ── Mock prisma ────────────────────────────────────────────────────────────────
// checkRateLimit uses $queryRaw — simulate the DB upsert behaviour in-memory.

const mockStore: Map<string, { count: number; resetAt: Date }> = new Map()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(async (_query: unknown, ...args: unknown[]) => {
      // args[0] = identifier, args[1] = resetAt (new window), args[2] = resetAt again
      const key = args[0] as string
      const newResetAt = args[1] as Date
      const now = new Date()

      const existing = mockStore.get(key)
      if (!existing || existing.resetAt < now) {
        mockStore.set(key, { count: 1, resetAt: newResetAt })
        return [{ count: 1, resetAt: newResetAt }]
      }
      const count = existing.count + 1
      mockStore.set(key, { ...existing, count })
      return [{ count, resetAt: existing.resetAt }]
    }),
  },
}))

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  beforeEach(() => {
    mockStore.clear()
    vi.clearAllMocks()
  })

  it('allows first request', async () => {
    const { checkRateLimit } = await import('@/lib/rateLimit')
    const result = await checkRateLimit('test-ip-1', { windowMs: 60000, max: 5 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks after exceeding max', async () => {
    const { checkRateLimit } = await import('@/lib/rateLimit')
    const key = 'test-ip-block'
    for (let i = 0; i < 3; i++) await checkRateLimit(key, { windowMs: 60000, max: 3 })
    const result = await checkRateLimit(key, { windowMs: 60000, max: 3 })
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resets after window expires', async () => {
    const { checkRateLimit } = await import('@/lib/rateLimit')
    const key = 'test-ip-reset'
    for (let i = 0; i < 3; i++) await checkRateLimit(key, { windowMs: 1, max: 3 })
    // Simulate expiry by backdating the store entry
    const entry = mockStore.get(key)!
    mockStore.set(key, { ...entry, resetAt: new Date(Date.now() - 100) })
    const result = await checkRateLimit(key, { windowMs: 60000, max: 3 })
    expect(result.allowed).toBe(true)
  })

  it('returns correct resetAt timestamp', async () => {
    const { checkRateLimit } = await import('@/lib/rateLimit')
    const before = Date.now()
    const result = await checkRateLimit('test-reset-at', { windowMs: 60000, max: 5 })
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 60000 - 100)
  })
})

// ── getClientIp ────────────────────────────────────────────────────────────────

describe('getClientIp', () => {
  const makeReq = (headers: Record<string, string>) =>
    ({ headers: { get: (k: string) => headers[k] ?? null } }) as unknown as Request

  it('prefers cf-connecting-ip', () => {
    const req = makeReq({ 'cf-connecting-ip': '1.2.3.4', 'x-real-ip': '5.6.7.8' })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const req = makeReq({ 'x-real-ip': '5.6.7.8' })
    expect(getClientIp(req)).toBe('5.6.7.8')
  })

  it('falls back to x-forwarded-for first entry', () => {
    const req = makeReq({ 'x-forwarded-for': '9.10.11.12, 13.14.15.16' })
    expect(getClientIp(req)).toBe('9.10.11.12')
  })

  it('returns unknown when no headers', () => {
    const req = makeReq({})
    expect(getClientIp(req)).toBe('unknown')
  })
})
