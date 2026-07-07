import { SignJWT, jwtVerify } from 'jose'
import { prisma } from './prisma'

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET env var is not set')
  if (s.length < 32) throw new Error('JWT_SECRET too short — minimum 32 characters required')
  if (s.includes('change-in-production')) throw new Error('JWT_SECRET is using the development placeholder — set a real secret')
  return new TextEncoder().encode(s)
}

export async function signToken(payload: object): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(getSecret())
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload
  } catch {
    return null
  }
}

function uint8ToHex(arr: Uint8Array<ArrayBuffer>): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToUint8(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = (hex.match(/.{2}/g) ?? []).map(h => parseInt(h, 16))
  const buf = new ArrayBuffer(bytes.length)
  const view = new Uint8Array(buf)
  bytes.forEach((b, i) => { view[i] = b })
  return view
}

export async function hashPassword(plain: string): Promise<string> {
  const saltBuf = new ArrayBuffer(16)
  const salt = new Uint8Array(saltBuf)
  crypto.getRandomValues(salt)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(plain), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256,
  )
  return `pbkdf2:${uint8ToHex(salt)}:${uint8ToHex(new Uint8Array(bits as ArrayBuffer))}`
}

export async function comparePassword(plain: string, stored: string): Promise<boolean> {
  if (!stored.startsWith('pbkdf2:')) return false
  const parts = stored.split(':')
  if (parts.length !== 3) return false
  const salt = hexToUint8(parts[1])
  const storedHash = hexToUint8(parts[2])
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(plain), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256,
  )
  const derived = new Uint8Array(bits as ArrayBuffer)
  if (derived.length !== storedHash.length) return false
  let diff = 0
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ storedHash[i]
  return diff === 0
}

export function getTokenFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/(?:^|;\s*)hm_token=([^;]+)/)
  return match ? match[1] : null
}

export async function getUserFromRequest(req: Request) {
  const token = getTokenFromCookies(req.headers.get('cookie'))
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || !payload.userId) return null

  const user = await prisma.user.findUnique({
    where: { id: payload.userId as string },
    include: { permissions: true },
  })

  if (!user) return null

  // Reject tokens issued before the last logout
  if (user.tokenVersion !== (payload.tokenVersion as number)) return null

  return user
}
