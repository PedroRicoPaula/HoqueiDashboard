import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── API routes: CSRF check only (auth is handled per-route) ──
  if (pathname.startsWith('/api/')) {
    if (!isCsrfValid(req)) {
      return NextResponse.json({ error: 'Pedido inválido' }, { status: 403 })
    }
    return NextResponse.next()
  }

  // ── Page routes: JWT auth + permission check ──
  const token = req.cookies.get('hcpdl_token')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  try {
    const { payload } = await jwtVerify(token, secret)
    const permissions = payload.permissions as Record<string, boolean>
    for (const route of PROTECTED_ROUTES) {
      if (route.pattern.test(pathname)) {
        if (!permissions?.isAdmin && !permissions?.[route.flag]) {
          return NextResponse.redirect(new URL('/?error=forbidden', req.url))
        }
      }
    }
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: ['/((?!login|setup|api/setup|_next/static|_next/image|favicon.ico|manifest.json|uploads).*)'],
}
