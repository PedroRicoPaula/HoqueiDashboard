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

  const allowedOrigin = new URL(appUrl).origin
  if (origin) return origin === allowedOrigin
  if (referer) return referer.startsWith(allowedOrigin)
  return false
}

export function csrfError() {
  return Response.json({ error: 'Pedido inválido' }, { status: 403 })
}
