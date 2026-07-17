import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { activateClubFromSession } from '@/lib/clubActivation'
import Stripe from 'stripe'

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' })
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    logger.error('Stripe webhook signature error:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const clubId = session.metadata?.clubId
        if (!clubId) break

        // Idempotente com /api/register/complete — ver src/lib/clubActivation.ts.
        // A password já foi definida pelo utilizador no formulário de registo;
        // este webhook só existe como backstop caso o browser nunca volte ao
        // success_url (ex: fecha o separador do Stripe Checkout antes de voltar).
        const expanded = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items'],
        })
        const club = await activateClubFromSession(expanded)
        if (!club) break

        await logAudit(req, null, club.email, 'SUBSCRIPTION_ACTIVATED', 'Club', clubId, {
          stripeEventId: event.id,
          stripeSubscriptionId: session.subscription,
        })
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const sub = invoice.subscription
        if (!sub) break

        const subscription = await stripe.subscriptions.retrieve(sub as string)
        const clubId = subscription.metadata?.clubId
        if (!clubId) break

        await prisma.club.update({
          where: { id: clubId },
          data: {
            status: 'ACTIVE',
            stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        })

        await logAudit(req, null, clubId, 'PAYMENT_SUCCEEDED', 'Club', clubId, {
          stripeEventId: event.id,
          subscriptionId: sub,
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const sub = invoice.subscription
        if (!sub) break

        const subscription = await stripe.subscriptions.retrieve(sub as string)
        const clubId = subscription.metadata?.clubId
        if (!clubId) break

        await prisma.club.update({
          where: { id: clubId },
          data: { status: 'PAST_DUE', statusChangedAt: new Date() },
        })

        await logAudit(req, null, clubId, 'PAYMENT_FAILED', 'Club', clubId, {
          stripeEventId: event.id,
          subscriptionId: sub,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const clubId = subscription.metadata?.clubId
        if (!clubId) break

        await prisma.club.update({
          where: { id: clubId },
          data: { status: 'CANCELLED', statusChangedAt: new Date() },
        })

        await logAudit(req, null, clubId, 'SUBSCRIPTION_CANCELLED', 'Club', clubId, {
          stripeEventId: event.id,
          subscriptionId: subscription.id,
        })
        break
      }

      default:
        break
    }
  } catch (err) {
    logger.error(`Stripe webhook handler error (${event.type}):`, err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
