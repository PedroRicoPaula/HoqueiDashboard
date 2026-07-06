import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getTenantClient } from '@/lib/prisma-tenant'

// These tests require a real database with the multi-tenant schema.
// Run with: npm test -- tenant-isolation
// They will create and clean up test data.

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgresql123@localhost:5432/hoqueimanager'

function createBase() {
  const adapter = new PrismaPg({ connectionString: DB_URL })
  return new PrismaClient({ adapter })
}

const base = createBase()

let clubAId: string
let clubBId: string
let athleteAId: string

beforeAll(async () => {
  // Create two test clubs
  const clubA = await base.club.create({
    data: {
      name: 'Test Club A',
      slug: `test-club-a-${Date.now()}`,
      email: 'a@test.com',
      status: 'ACTIVE',
    },
  })
  const clubB = await base.club.create({
    data: {
      name: 'Test Club B',
      slug: `test-club-b-${Date.now()}`,
      email: 'b@test.com',
      status: 'ACTIVE',
    },
  })
  clubAId = clubA.id
  clubBId = clubB.id

  // Create an athlete in each club directly (bypassing tenant extension)
  const athA = await base.athlete.create({
    data: {
      clubId: clubAId,
      number: 999,
      name: 'Athlete A Only',
      ageGroup: 'SENIORS',
      birthDate: new Date('2000-01-01'),
    },
  })
  await base.athlete.create({
    data: {
      clubId: clubBId,
      number: 998,
      name: 'Athlete B Only',
      ageGroup: 'SENIORS',
      birthDate: new Date('2000-01-01'),
    },
  })
  athleteAId = athA.id
})

afterAll(async () => {
  // Clean up: delete clubs (cascades to athletes)
  await base.club.deleteMany({
    where: { id: { in: [clubAId, clubBId] } },
  })
  await base.$disconnect()
})

describe('Tenant isolation via Prisma Extension', () => {
  it('Club A client only sees Club A athletes', async () => {
    const dbA = getTenantClient(clubAId)
    const athletes = await dbA.athlete.findMany()
    expect(athletes.every(a => a.clubId === clubAId)).toBe(true)
    expect(athletes.some(a => a.name === 'Athlete A Only')).toBe(true)
    expect(athletes.some(a => a.name === 'Athlete B Only')).toBe(false)
  })

  it('Club B client only sees Club B athletes', async () => {
    const dbB = getTenantClient(clubBId)
    const athletes = await dbB.athlete.findMany()
    expect(athletes.every(a => a.clubId === clubBId)).toBe(true)
    expect(athletes.some(a => a.name === 'Athlete B Only')).toBe(true)
    expect(athletes.some(a => a.name === 'Athlete A Only')).toBe(false)
  })

  it('create via tenant client auto-injects clubId', async () => {
    const dbA = getTenantClient(clubAId)
    const created = await dbA.athlete.create({
      data: {
        number: 997,
        name: 'Auto ClubId Athlete',
        ageGroup: 'SENIORS',
        birthDate: new Date('2001-01-01'),
      } as Parameters<typeof dbA.athlete.create>[0]['data'],
    })
    expect(created.clubId).toBe(clubAId)

    // Verify not visible from Club B
    const dbB = getTenantClient(clubBId)
    const fromB = await dbB.athlete.findMany({ where: { name: 'Auto ClubId Athlete' } })
    expect(fromB).toHaveLength(0)

    // Cleanup
    await base.athlete.delete({ where: { id: created.id } })
  })

  it('count is scoped to club', async () => {
    const dbA = getTenantClient(clubAId)
    const dbB = getTenantClient(clubBId)
    const countA = await dbA.athlete.count()
    const countB = await dbB.athlete.count()
    const totalDirect = await base.athlete.count({
      where: { clubId: { in: [clubAId, clubBId] } },
    })
    expect(countA + countB).toBe(totalDirect)
  })

  it('findUnique cross-tenant IDOR — Club B cannot read Club A athlete by id', async () => {
    const dbB = getTenantClient(clubBId)
    // athleteAId belongs to Club A — Club B client should not find it
    const result = await dbB.athlete.findUnique({ where: { id: athleteAId } })
    expect(result).toBeNull()
  })

  it('update cross-tenant — Club B cannot modify Club A athlete', async () => {
    const dbB = getTenantClient(clubBId)
    // Extension injects clubId: clubBId into where, so no rows match → update returns null/throws
    const result = await dbB.athlete.updateMany({
      where: { id: athleteAId },
      data: { name: 'Hacked' },
    })
    expect(result.count).toBe(0)
    // Verify original data is unchanged
    const original = await base.athlete.findUnique({ where: { id: athleteAId } })
    expect(original?.name).toBe('Athlete A Only')
  })

  it('delete cross-tenant — Club B cannot delete Club A athlete', async () => {
    const dbB = getTenantClient(clubBId)
    const result = await dbB.athlete.deleteMany({ where: { id: athleteAId } })
    expect(result.count).toBe(0)
    // Verify record still exists
    const stillExists = await base.athlete.findUnique({ where: { id: athleteAId } })
    expect(stillExists).not.toBeNull()
  })

  it('nested relation — findMany on Club A does not leak Club B athletes via include', async () => {
    const dbA = getTenantClient(clubAId)
    const athletes = await dbA.athlete.findMany({
      include: { materials: true },
    })
    // All returned athletes must belong to Club A
    expect(athletes.every(a => a.clubId === clubAId)).toBe(true)
    expect(athletes.some(a => a.clubId === clubBId)).toBe(false)
  })

  it('upsert cross-tenant — Club B cannot overwrite Club A payment sharing the same non-clubId unique key', async () => {
    const dbA = getTenantClient(clubAId)
    // Club A creates its payment record first
    await dbA.athletePayment.upsert({
      where: { athleteId_month_year: { athleteId: athleteAId, month: 6, year: 2026 } },
      create: { athleteId: athleteAId, month: 6, year: 2026, paid: true, amount: 30 },
      update: { paid: true, amount: 30 },
    } as Parameters<typeof dbA.athletePayment.upsert>[0])

    const dbB = getTenantClient(clubBId)
    // Club B tries to upsert using Club A's athleteId + same month/year (same unique key).
    // Must not silently update Club A's row — where is now scoped by clubId, so this either
    // finds nothing (create path, which then throws on the DB unique constraint) or is rejected.
    await expect(
      dbB.athletePayment.upsert({
        where: { athleteId_month_year: { athleteId: athleteAId, month: 6, year: 2026 } },
        create: { athleteId: athleteAId, month: 6, year: 2026, paid: false, amount: 999 },
        update: { paid: false, amount: 999 },
      } as Parameters<typeof dbB.athletePayment.upsert>[0])
    ).rejects.toThrow()

    // Club A's original row must be untouched
    const original = await base.athletePayment.findUnique({
      where: { athleteId_month_year: { athleteId: athleteAId, month: 6, year: 2026 } },
    })
    expect(original?.amount).toBe(30)
    expect(original?.paid).toBe(true)

    // Cleanup
    await base.athletePayment.deleteMany({ where: { athleteId: athleteAId } })
  })
})
