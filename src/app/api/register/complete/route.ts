import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import { activateClubFromSession } from '@/lib/clubActivation'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { logAudit } from '@/lib/audit'
import Stripe from 'stripe'
import { z } from 'zod'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' })
}

const completeSchema = z.object({
  sessionId: z.string().min(1),
})

// Confirma o pagamento directamente junto do Stripe (em vez de esperar pelo webhook,
// que é assíncrono e pode chegar depois do browser voltar do Checkout) e faz login
// automático — o utilizador já definiu a password em /api/register, só falta o clube
// ficar ACTIVE. Idempotente com o webhook: qualquer um dos dois pode activar primeiro,
// ver src/lib/clubActivation.ts.
export async function POST(req: Request) {
  const ip = getClientIp(req)
  const limit = await checkRateLimit(`register-complete:${ip}`, { windowMs: 15 * 60 * 1000, max: 20 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Muitos pedidos. Aguarde.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const parsed = completeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
    }

    const stripe = getStripe()
    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.retrieve(parsed.data.sessionId, { expand: ['line_items'] })
    } catch {
      return NextResponse.json({ error: 'Sessão de pagamento não encontrada' }, { status: 404 })
    }

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Pagamento ainda não confirmado. Tente novamente em instantes.' }, { status: 402 })
    }

    const userId = session.metadata?.userId
    if (!session.metadata?.clubId || !userId) {
      return NextResponse.json({ error: 'Sessão de pagamento inválida' }, { status: 400 })
    }

    await activateClubFromSession(session)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        permissions: true,
        club: { select: { status: true, name: true, language: true, logoUrl: true, primaryColor: true } },
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'Utilizador não encontrado' }, { status: 404 })
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
      logAudit(req, user.id, user.email, 'LOGIN', 'User', user.id, { ip, via: 'register-complete' }),
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
      redirectTo: '/',
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
    logger.error('Register complete error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
