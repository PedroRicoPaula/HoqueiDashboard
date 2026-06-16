import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  createAthleteSchema,
  createMaterialSchema,
  createTextileSchema,
  createTravelSchema,
  bulkAttendanceSchema,
} from '@/lib/validations'

// ── loginSchema ────────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const r = loginSchema.safeParse({ email: 'admin@hcpdl.pt', password: 'password123' })
    expect(r.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const r = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' })
    expect(r.success).toBe(false)
  })

  it('rejects password shorter than 6 chars', () => {
    const r = loginSchema.safeParse({ email: 'admin@hcpdl.pt', password: '12345' })
    expect(r.success).toBe(false)
  })
})

// ── createAthleteSchema ────────────────────────────────────────────────────────

describe('createAthleteSchema', () => {
  const valid = {
    number: 10,
    name: 'João Silva',
    ageGroup: 'SUB15',
    birthDate: '2010-03-15',
  }

  it('accepts minimal valid athlete', () => {
    const r = createAthleteSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it('coerces string number to int', () => {
    const r = createAthleteSchema.safeParse({ ...valid, number: '7' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.number).toBe(7)
  })

  it('rejects negative number', () => {
    const r = createAthleteSchema.safeParse({ ...valid, number: -1 })
    expect(r.success).toBe(false)
  })

  it('rejects short name', () => {
    const r = createAthleteSchema.safeParse({ ...valid, name: 'A' })
    expect(r.success).toBe(false)
  })

  it('rejects invalid ageGroup', () => {
    const r = createAthleteSchema.safeParse({ ...valid, ageGroup: 'SUB99' })
    expect(r.success).toBe(false)
  })

  it('accepts all valid ageGroups', () => {
    for (const ag of ['SUB11', 'SUB13', 'SUB15', 'SUB17', 'SUB19', 'SENIORS']) {
      const r = createAthleteSchema.safeParse({ ...valid, ageGroup: ag })
      expect(r.success).toBe(true)
    }
  })

  it('accepts valid optional email', () => {
    const r = createAthleteSchema.safeParse({ ...valid, email: 'joao@email.com' })
    expect(r.success).toBe(true)
  })

  it('rejects invalid optional email', () => {
    const r = createAthleteSchema.safeParse({ ...valid, email: 'not-email' })
    expect(r.success).toBe(false)
  })

  it('accepts empty string as email (form default)', () => {
    const r = createAthleteSchema.safeParse({ ...valid, email: '' })
    expect(r.success).toBe(true)
  })
})

// ── createMaterialSchema ───────────────────────────────────────────────────────

describe('createMaterialSchema', () => {
  const valid = { category: 'ATHLETE', type: 'Sticks' }

  it('accepts minimal material', () => {
    const r = createMaterialSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it('rejects invalid category', () => {
    const r = createMaterialSchema.safeParse({ ...valid, category: 'UNKNOWN' })
    expect(r.success).toBe(false)
  })

  it('defaults state to FREE', () => {
    const r = createMaterialSchema.safeParse(valid)
    if (r.success) expect(r.data.state).toBe('FREE')
  })

  it('accepts paidAmount as number or null', () => {
    expect(createMaterialSchema.safeParse({ ...valid, paidAmount: 15.5 }).success).toBe(true)
    expect(createMaterialSchema.safeParse({ ...valid, paidAmount: null }).success).toBe(true)
  })
})

// ── createTextileSchema ────────────────────────────────────────────────────────

describe('createTextileSchema', () => {
  const valid = {
    category: 'GAME',
    type: 'GAME_SHIRT',
    size: 'M',
    season: '2025/26',
  }

  it('accepts minimal textile', () => {
    const r = createTextileSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it('rejects missing size', () => {
    const r = createTextileSchema.safeParse({ ...valid, size: '' })
    expect(r.success).toBe(false)
  })

  it('accepts null for notes (custom state management sends null)', () => {
    const r = createTextileSchema.safeParse({ ...valid, notes: null })
    expect(r.success).toBe(true)
  })

  it('accepts null for personalizationDetails', () => {
    const r = createTextileSchema.safeParse({ ...valid, personalizationDetails: null })
    expect(r.success).toBe(true)
  })

  it('accepts totalCost and paidAmount as numbers or null', () => {
    expect(createTextileSchema.safeParse({ ...valid, totalCost: 20, paidAmount: 10 }).success).toBe(true)
    expect(createTextileSchema.safeParse({ ...valid, totalCost: null, paidAmount: null }).success).toBe(true)
  })

  it('rejects negative paidAmount', () => {
    const r = createTextileSchema.safeParse({ ...valid, paidAmount: -5 })
    expect(r.success).toBe(false)
  })

  it('defaults state to STOCK', () => {
    const r = createTextileSchema.safeParse(valid)
    if (r.success) expect(r.data.state).toBe('STOCK')
  })

  it('jerseyNumber accepts positive int or null', () => {
    expect(createTextileSchema.safeParse({ ...valid, jerseyNumber: 10 }).success).toBe(true)
    expect(createTextileSchema.safeParse({ ...valid, jerseyNumber: null }).success).toBe(true)
    expect(createTextileSchema.safeParse({ ...valid, jerseyNumber: -1 }).success).toBe(false)
  })
})

// ── createTravelSchema ─────────────────────────────────────────────────────────

describe('createTravelSchema', () => {
  const valid = {
    opponent: 'Sporting CP',
    departureDate: '2026-09-15',
  }

  it('accepts minimal travel', () => {
    const r = createTravelSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it('rejects empty opponent', () => {
    const r = createTravelSchema.safeParse({ ...valid, opponent: '' })
    expect(r.success).toBe(false)
  })

  it('rejects invalid pavilionUrl', () => {
    const r = createTravelSchema.safeParse({ ...valid, pavilionUrl: 'javascript:alert(1)' })
    expect(r.success).toBe(false)
  })

  it('accepts valid pavilionUrl', () => {
    const r = createTravelSchema.safeParse({ ...valid, pavilionUrl: 'https://maps.google.com/abc' })
    expect(r.success).toBe(true)
  })

  it('accepts empty pavilionUrl', () => {
    const r = createTravelSchema.safeParse({ ...valid, pavilionUrl: '' })
    expect(r.success).toBe(true)
  })

  it('accepts undefined pavilionUrl', () => {
    const r = createTravelSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })
})

// ── bulkAttendanceSchema ───────────────────────────────────────────────────────

describe('bulkAttendanceSchema', () => {
  it('accepts valid records array', () => {
    const r = bulkAttendanceSchema.safeParse({
      records: [
        { athleteId: '550e8400-e29b-41d4-a716-446655440000', present: true },
        { athleteId: '550e8400-e29b-41d4-a716-446655440001', present: false, paidByAthlete: true, paidAmount: 5 },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('rejects non-uuid athleteId', () => {
    const r = bulkAttendanceSchema.safeParse({
      records: [{ athleteId: 'not-a-uuid', present: true }],
    })
    expect(r.success).toBe(false)
  })

  it('accepts paidAmount as null', () => {
    const r = bulkAttendanceSchema.safeParse({
      records: [{ athleteId: '550e8400-e29b-41d4-a716-446655440000', present: true, paidAmount: null }],
    })
    expect(r.success).toBe(true)
  })
})
