import { describe, it, expect } from 'vitest'
import { hasPermission } from '@/lib/permissions'
import type { Permission } from '@prisma/client'

// Minimal Permission object for testing
const base: Permission = {
  id: 'perm-1',
  userId: 'user-1',
  viewAthletes: false,
  editAthletes: false,
  viewFees: false,
  editFees: false,
  viewMembers: false,
  editMembers: false,
  viewMaterials: false,
  editMaterials: false,
  viewSponsors: false,
  manageSponsors: false,
  viewTraining: false,
  editTraining: false,
  viewTravel: false,
  editTravel: false,
  viewDirection: false,
  editDirection: false,
  viewAttendance: false,
  editAttendance: false,
  viewTextiles: false,
  editTextiles: false,
  isAdmin: false,
}

describe('hasPermission', () => {
  it('returns false when permissions is null', () => {
    expect(hasPermission(null, 'viewAthletes')).toBe(false)
  })

  it('returns false when permissions is undefined', () => {
    expect(hasPermission(undefined, 'viewAthletes')).toBe(false)
  })

  it('returns false when flag is false', () => {
    const perms = { ...base, viewAthletes: false }
    expect(hasPermission(perms, 'viewAthletes')).toBe(false)
  })

  it('returns true when flag is true', () => {
    const perms = { ...base, viewAthletes: true }
    expect(hasPermission(perms, 'viewAthletes')).toBe(true)
  })

  it('isAdmin bypasses any false flag', () => {
    const perms = { ...base, isAdmin: true, viewAthletes: false, editAthletes: false }
    expect(hasPermission(perms, 'viewAthletes')).toBe(true)
    expect(hasPermission(perms, 'editAthletes')).toBe(true)
    expect(hasPermission(perms, 'editFees')).toBe(true)
  })

  it('isAdmin=false with flag=true returns true', () => {
    const perms = { ...base, isAdmin: false, editMaterials: true }
    expect(hasPermission(perms, 'editMaterials')).toBe(true)
  })

  it('isAdmin=true also returns true for isAdmin flag itself', () => {
    const perms = { ...base, isAdmin: true }
    expect(hasPermission(perms, 'isAdmin')).toBe(true)
  })

  it('covers all 20 permission flags independently', () => {
    const flags: Array<keyof Permission> = [
      'viewAthletes', 'editAthletes', 'viewFees', 'editFees',
      'viewMembers', 'editMembers', 'viewMaterials', 'editMaterials',
      'viewSponsors', 'manageSponsors', 'viewTraining', 'editTraining',
      'viewTravel', 'editTravel', 'viewDirection', 'editDirection',
      'viewAttendance', 'editAttendance', 'viewTextiles', 'editTextiles',
    ]
    for (const flag of flags) {
      expect(hasPermission({ ...base, [flag]: true }, flag)).toBe(true)
      expect(hasPermission({ ...base, [flag]: false }, flag)).toBe(false)
    }
  })
})
