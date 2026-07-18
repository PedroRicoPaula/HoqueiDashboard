import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { getStripe } from '@/lib/stripe'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

// Cancelamento self-serve pelo próprio clube (admin). Corta acesso imediatamente
// (sem manter até fim do período pago — decisão de produto): cancela a subscrição
// no Stripe já, marca o clube SUSPENDED (mesmo estado usado pelo webhook
// customer.subscription.deleted — ver src/app/api/stripe/webhook/route.ts) e invalida
// a sessão de TODOS os utilizadores do clube (incrementa tokenVersion em massa),
// não só a de quem clicou. Reativação: /api/billing/reactivate.
export async function POST(req: Request) {
  const ctx = await getDbForRequest(req)
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { user, db, clubId } = ctx

  if (!hasPermission(user.permissions, 'isAdmin')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const club = await db.club.findUnique({ where: { id: clubId } })
  if (!club) return NextResponse.json({ error: 'Clube não encontrado' }, { status: 404 })

  if (club.isFreeClub) {
    return NextResponse.json({ error: 'Clubes grátis não têm subscrição para cancelar' }, { status: 422 })
  }

  try {
    if (club.stripeSubscriptionId) {
      const stripe = getStripe()
      await stripe.subscriptions.cancel(club.stripeSubscriptionId).catch((err) => {
        // Já pode ter sido cancelada no Stripe (ex: falha de pagamento repetida) —
        // não bloquear a suspensão local por causa disso.
        logger.error('Stripe subscription cancel error:', err)
      })
    }

    await db.club.update({
      where: { id: clubId },
      data: { status: 'SUSPENDED', statusChangedAt: new Date() },
    })

    await prisma.user.updateMany({
      where: { clubId },
      data: { tokenVersion: { increment: 1 } },
    })

    await logAudit(req, user.id, user.email, 'SUBSCRIPTION_CANCELLED', 'Club', clubId, {
      trigger: 'self-service',
      previousStatus: club.status,
    })

    const response = NextResponse.json({ cancelled: true })
    response.cookies.set('hm_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    })
    return response
  } catch (error) {
    logger.error('Billing cancel error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
