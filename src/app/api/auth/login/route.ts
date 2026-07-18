import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken, comparePassword } from '@/lib/auth'
import { loginSchema } from '@/lib/validations'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { validateCsrf, csrfError } from '@/lib/csrf'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request) {
  if (!validateCsrf(req)) return csrfError()

  const ip = getClientIp(req)
  const limit = await checkRateLimit(`login:${ip}`, { windowMs: 15 * 60 * 1000, max: 10 })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas tentativas. Aguarde 15 minutos.' },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) } }
    )
  }

  try {
    const body = await req.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const { email, password } = parsed.data
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        permissions: true,
        club: { select: { status: true, name: true, language: true, logoUrl: true, primaryColor: true, isFreeClub: true } },
      },
    })

    if (!user || !(await comparePassword(password, user.password))) {
      await logAudit(req, null, email, 'LOGIN_FAIL', 'User', undefined, { ip: getClientIp(req) })
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    // Block login for clubs that are not active (unless super admin)
    if (!user.isSuperAdmin && user.club && user.club.status !== 'ACTIVE') {
      const status = user.club.status
      const messages: Record<string, string> = {
        SUSPENDED: 'A subscrição deste clube foi cancelada e o acesso está suspenso.',
        PAST_DUE: 'O pagamento deste clube está em atraso e o acesso está suspenso.',
        CANCELLED: 'A subscrição deste clube foi cancelada e o acesso está suspenso.',
        PENDING_PAYMENT: 'O pagamento deste clube ainda não foi confirmado.',
      }
      // Reativação self-serve só faz sentido para clubes pagos suspensos/em atraso —
      // clubes grátis não têm Stripe customer associado, é preciso contactar o suporte.
      const canReactivate = !user.club.isFreeClub && (status === 'SUSPENDED' || status === 'PAST_DUE')
      return NextResponse.json(
        { error: messages[status] ?? 'Subscrição inativa. Verifique o seu plano em hoqueimanager.com.', status, canReactivate },
        { status: 403 }
      )
    }

    const perms = user.permissions
    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      clubId: user.clubId ?? null,
      isSuperAdmin: user.isSuperAdmin,
      tokenVersion: user.tokenVersion,
      permissions: perms
        ? {
            viewAthletes: perms.viewAthletes,
            editAthletes: perms.editAthletes,
            viewFees: perms.viewFees,
            editFees: perms.editFees,
            viewMembers: perms.viewMembers,
            editMembers: perms.editMembers,
            viewMaterials: perms.viewMaterials,
            editMaterials: perms.editMaterials,
            viewSponsors: perms.viewSponsors,
            manageSponsors: perms.manageSponsors,
            viewTraining: perms.viewTraining,
            editTraining: perms.editTraining,
            viewTravel: perms.viewTravel,
            editTravel: perms.editTravel,
            viewDirection: perms.viewDirection,
            editDirection: perms.editDirection,
            viewAttendance: perms.viewAttendance,
            editAttendance: perms.editAttendance,
            viewTextiles: perms.viewTextiles,
            editTextiles: perms.editTextiles,
            isAdmin: perms.isAdmin,
          }
        : null,
    })

    await Promise.all([
      logAudit(req, user.id, user.email, 'LOGIN', 'User', user.id, { ip: getClientIp(req) }, user.clubId),
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    ])

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
        clubName: user.club?.name ?? null,
        clubLanguage: user.club?.language ?? null,
        clubLogoUrl: user.club?.logoUrl ?? null,
        clubPrimaryColor: user.club?.primaryColor ?? null,
      },
      permissions: user.permissions,
      redirectTo: user.isSuperAdmin ? '/platform' : '/',
    })

    response.cookies.set('hm_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    })

    return response
  } catch (error) {
    logger.error('Login error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
