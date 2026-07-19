import { prisma } from '@/lib/prisma'
import { sendEmail, paidWelcomeEmailHtml } from '@/lib/email'
import { logger } from '@/lib/logger'
import type Stripe from 'stripe'

function planLabelFor(stripePriceId: string | null): string {
  if (stripePriceId === process.env.STRIPE_PRICE_YEARLY) return 'Anual — €590/ano'
  if (stripePriceId === process.env.STRIPE_PRICE_TEST) return 'Teste — €3/mês'
  return 'Mensal — €59/mês'
}

// Chamado tanto pelo webhook (checkout.session.completed) como por /api/register/complete
// (confirmação direta ao voltar do Stripe Checkout) — qualquer um pode chegar primeiro,
// por isso é idempotente: repetir com o mesmo clubId só volta a gravar os mesmos dados.
// `session` deve vir de stripe.checkout.sessions.retrieve(id, { expand: ['line_items'] }).
export async function activateClubFromSession(session: Stripe.Checkout.Session) {
  const clubId = session.metadata?.clubId
  if (!clubId) return null

  const stripePriceId = session.line_items?.data?.[0]?.price?.id ?? null

  // "Já estava activo com subscrição" decide se isto é mesmo a primeira activação (envia
  // o email de boas-vindas) ou uma repetição idempotente (webhook a chegar depois do
  // register/complete já ter tratado tudo, ou vice-versa) — não reenviar o email nesse caso.
  const before = await prisma.club.findUnique({ where: { id: clubId }, select: { status: true, stripeSubscriptionId: true, name: true, email: true } })
  const isFirstActivation = !!before && !(before.status === 'ACTIVE' && before.stripeSubscriptionId)

  const club = await prisma.club.update({
    where: { id: clubId },
    data: {
      status: 'ACTIVE',
      isFreeClub: false, // cobre o upgrade de clube grátis → pago via /api/platform/clubs/[id]/send-payment-link
      ...(session.subscription ? { stripeSubscriptionId: session.subscription as string } : {}),
      stripePriceId,
    },
  })

  if (isFirstActivation) {
    await sendEmail({
      to: club.email,
      subject: 'Pagamento confirmado — bem-vindo ao HoqueiManager',
      html: paidWelcomeEmailHtml(club.name, planLabelFor(stripePriceId)),
    }).catch((err) => logger.error('Paid welcome email error:', err))
  }

  return club
}
