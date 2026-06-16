import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']
const SUPPORTED_LOCALES = ['pt', 'es', 'en', 'fr', 'it']

const PROTECTED_ROUTES = [
  { pattern: /^\/athletes/, flag: 'viewAthletes' },
  { pattern: /^\/fees/, flag: 'viewFees' },
  { pattern: /^\/members/, flag: 'viewMembers' },
  { pattern: /^\/sponsors/, flag: 'viewSponsors' },
  { pattern: /^\/materials/, flag: 'viewMaterials' },
  { pattern: /^\/attendance/, flag: 'viewAttendance' },
  { pattern: /^\/textiles/, flag: 'viewTextiles' },
  { pattern: /^\/training/, flag: 'viewTraining' },
  { pattern: /^\/travel/, flag: 'viewTravel' },
  { pattern: /^\/direction/, flag: 'viewDirection' },
  { pattern: /^\/reports/, flag: 'viewAthletes' },
  { pattern: /^\/admin/, flag: 'isAdmin' },
]

function isCsrfValid(req: NextRequest): boolean {
  if (SAFE_METHODS.includes(req.method)) return true
  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  const host = req.headers.get('host') ?? ''
  const allowedOrigins = [
    `http://${host}`,
    `https://${host}`,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean)
  if (origin) return allowedOrigins.some((o) => o === origin)
  if (referer) return allowedOrigins.some((o) => referer.startsWith(o!))
  return false
}

function isLocalePublicPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return false
  const locale = segments[0]
  if (!SUPPORTED_LOCALES.includes(locale)) return false
  // Allow: /{locale}, /{locale}/register, /{locale}/register/*
  if (segments.length === 1) return true
  if (segments[1] === 'register') return true
  return false
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── Stripe webhook: skip CSRF (has own signature verification) ──
  if (pathname === '/api/stripe/webhook') return NextResponse.next()

  // ── API routes: CSRF check only (auth handled per-route) ──
  if (pathname.startsWith('/api/')) {
    if (!isCsrfValid(req)) {
      return NextResponse.json({ error: 'Pedido inválido' }, { status: 403 })
    }
    return NextResponse.next()
  }

  // ── Public paths: locale landing pages ──
  if (isLocalePublicPath(pathname)) return NextResponse.next()

  // ── Auth: verify JWT ──
  const token = req.cookies.get('hm_token')?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  let payload: Record<string, unknown>
  try {
    const result = await jwtVerify(token, secret)
    payload = result.payload as Record<string, unknown>
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const isSuperAdmin = Boolean(payload.isSuperAdmin)
  const clubId = payload.clubId as string | null

  // ── Platform: super admin only ──
  if (pathname.startsWith('/platform')) {
    if (!isSuperAdmin) return NextResponse.redirect(new URL('/?error=forbidden', req.url))
    return NextResponse.next()
  }

  // ── Dashboard: requires clubId (regular club user) ──
  if (isSuperAdmin && !clubId) {
    // Super admin trying to access dashboard — redirect to platform
    return NextResponse.redirect(new URL('/platform', req.url))
  }

  if (!clubId) return NextResponse.redirect(new URL('/login', req.url))

  // ── Permission check for protected dashboard routes ──
  const permissions = payload.permissions as Record<string, boolean> | null
  for (const route of PROTECTED_ROUTES) {
    if (route.pattern.test(pathname)) {
      if (!permissions?.isAdmin && !permissions?.[route.flag]) {
        return NextResponse.redirect(new URL('/?error=forbidden', req.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!login|setup|api/setup|_next/static|_next/image|favicon.ico|manifest.json|logo.png|uploads).*)',
  ],
}
