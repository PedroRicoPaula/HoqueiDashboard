// NOTE: This module is NOT called by API routes directly.
// CSRF protection for page routes is handled in middleware.ts (edge runtime).
// This file exists for use in unit tests only (see tests/ directory).

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

export function validateCsrf(req: Request): boolean {
  if (SAFE_METHODS.includes(req.method)) return true

  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  // In development without APP_URL configured, allow all
  if (!appUrl || appUrl === 'http://localhost:3000') {
    const host = req.headers.get('host') ?? 'localhost:3000'
    const allowedOrigin = `http://${host}`
    const allowedOriginHttps = `https://${host}`

    if (origin) {
      return origin === allowedOrigin || origin === allowedOriginHttps
    }
    if (referer) {
      return referer.startsWith(allowedOrigin) || referer.startsWith(allowedOriginHttps)
    }
    return false
  }

  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL
  const allowedOrigins = new Set<string>()
  allowedOrigins.add(new URL(appUrl).origin)
  if (landingUrl) {
    const landingOrigin = new URL(landingUrl).origin
    allowedOrigins.add(landingOrigin)
    // also accept www. variant (e.g. https://www.hoqueimanager.com)
    allowedOrigins.add(landingOrigin.replace('://', '://www.'))
  }

  if (origin) return allowedOrigins.has(origin)
  if (referer) return [...allowedOrigins].some((o) => referer.startsWith(o))
  return false
}

export function csrfError() {
  return Response.json({ error: 'Pedido inválido' }, { status: 403 })
}
