import { prisma } from './prisma'

export interface RateLimitOptions {
  windowMs: number
  max: number
}

// Atomic DB-backed rate limiting — works correctly across multiple serverless instances.
// Uses a single INSERT ... ON CONFLICT upsert to avoid race conditions.
export async function checkRateLimit(
  identifier: string,
  { windowMs, max }: RateLimitOptions
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const resetAt = new Date(Date.now() + windowMs)

  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" (key, count, "resetAt", "updatedAt")
    VALUES (${identifier}, 1, ${resetAt}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      count     = CASE WHEN "RateLimit"."resetAt" < NOW() THEN 1 ELSE "RateLimit".count + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN ${resetAt} ELSE "RateLimit"."resetAt" END,
      "updatedAt" = NOW()
    RETURNING count, "resetAt"
  `

  const { count, resetAt: dbResetAt } = rows[0]
  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    resetAt: dbResetAt.getTime(),
  }
}

export function getClientIp(req: Request): string {
  // Cloudflare sets CF-Connecting-IP to the real client IP (cannot be spoofed behind CF)
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()

  // Vercel / nginx set x-real-ip to the verified client IP
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()

  // x-forwarded-for: "client, proxy1, proxy2" — first entry is the client IP
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  return 'unknown'
}
