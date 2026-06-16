import { describe, it, expect, beforeEach } from 'vitest'
import { validateCsrf } from '@/lib/csrf'

function makeRequest(method: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/test', {
    method,
    headers,
  })
}

describe('validateCsrf', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  it('allows GET requests without origin', () => {
    expect(validateCsrf(makeRequest('GET'))).toBe(true)
  })

  it('allows POST with matching origin', () => {
    const req = makeRequest('POST', { origin: 'http://localhost:3000', host: 'localhost:3000' })
    expect(validateCsrf(req)).toBe(true)
  })

  it('blocks POST with foreign origin', () => {
    const req = makeRequest('POST', { origin: 'http://evil.com', host: 'localhost:3000' })
    expect(validateCsrf(req)).toBe(false)
  })

  it('allows DELETE with matching referer', () => {
    const req = makeRequest('DELETE', {
      referer: 'http://localhost:3000/athletes',
      host: 'localhost:3000',
    })
    expect(validateCsrf(req)).toBe(true)
  })

  it('blocks PUT with foreign referer', () => {
    const req = makeRequest('PUT', {
      referer: 'http://attacker.com/fake',
      host: 'localhost:3000',
    })
    expect(validateCsrf(req)).toBe(false)
  })
})
