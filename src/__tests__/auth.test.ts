import { describe, it, expect, beforeAll } from 'vitest'
import { signToken, verifyToken, hashPassword, comparePassword } from '@/lib/auth'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-for-unit-tests-32chars'
})

describe('JWT helpers', () => {
  it('signs and verifies a token', async () => {
    const payload = { userId: 'u1', email: 'test@test.com', tokenVersion: 0 }
    const token = await signToken(payload)
    expect(typeof token).toBe('string')

    const verified = await verifyToken(token)
    expect(verified?.userId).toBe('u1')
    expect(verified?.email).toBe('test@test.com')
  })

  it('returns null for invalid token', async () => {
    const result = await verifyToken('invalid.token.here')
    expect(result).toBeNull()
  })

  it('returns null for tampered token', async () => {
    const token = await signToken({ userId: 'u1' })
    const tampered = token.slice(0, -5) + 'XXXXX'
    const result = await verifyToken(tampered)
    expect(result).toBeNull()
  })
})

describe('Password helpers', () => {
  it('hashes and compares password correctly', async () => {
    const hash = await hashPassword('my-secure-password')
    expect(hash).not.toBe('my-secure-password')
    expect(await comparePassword('my-secure-password', hash)).toBe(true)
    expect(await comparePassword('wrong-password', hash)).toBe(false)
  })
})
