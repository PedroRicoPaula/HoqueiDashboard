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
      include: { permissions: true },
    })

    if (!user || !(await comparePassword(password, user.password))) {
      await logAudit(req, null, email, 'LOGIN_FAIL', 'User', undefined, { ip: getClientIp(req) })
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    const perms = user.permissions
    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
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
        : {},
    })

    await Promise.all([
      logAudit(req, user.id, user.email, 'LOGIN', 'User', user.id, { ip: getClientIp(req) }),
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    ])

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
      permissions: user.permissions,
    })

    response.cookies.set('hcpdl_token', token, {
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
