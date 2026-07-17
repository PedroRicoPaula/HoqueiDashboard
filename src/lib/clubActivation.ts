import { prisma } from '@/lib/prisma'
import type Stripe from 'stripe'

// Chamado tanto pelo webhook (checkout.session.completed) como por /api/register/complete
// (confirmação direta ao voltar do Stripe Checkout) — qualquer um pode chegar primeiro,
// por isso é idempotente: repetir com o mesmo clubId só volta a gravar os mesmos dados.
// `session` deve vir de stripe.checkout.sessions.retrieve(id, { expand: ['line_items'] }).
export async function activateClubFromSession(session: Stripe.Checkout.Session) {
  const clubId = session.metadata?.clubId
  if (!clubId) return null

  const stripePriceId = session.line_items?.data?.[0]?.price?.id ?? null

  return prisma.club.update({
    where: { id: clubId },
    data: {
      status: 'ACTIVE',
      ...(session.subscription ? { stripeSubscriptionId: session.subscription as string } : {}),
      stripePriceId,
    },
  })
}
