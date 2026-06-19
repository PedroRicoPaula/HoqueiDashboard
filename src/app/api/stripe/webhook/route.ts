import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendEmail, welcomeEmailHtml } from '@/lib/email'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

export async function POST(req: Request) {
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
        const userId = session.metadata?.userId
        if (!clubId) break

        const club = await prisma.club.update({
          where: { id: clubId },
          data: {
            status: 'ACTIVE',
            stripeSubscriptionId: session.subscription as string,
            stripePriceId: (session.line_items as unknown as { data: Array<{ price: { id: string } }> })?.data?.[0]?.price?.id ?? null,
          },
        })

        if (userId && session.metadata?.tempPassword) {
          const user = await prisma.user.findUnique({ where: { id: userId } })
          if (user) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.hoqueimanager.com'
            await sendEmail({
              to: user.email,
              subject: `Bem-vindo ao HoqueiManager — ${club.name}`,
              html: welcomeEmailHtml(club.name, user.email, session.metadata.tempPassword, appUrl),
            })
          }
        }
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
          data: { status: 'PAST_DUE' },
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const clubId = subscription.metadata?.clubId
        if (!clubId) break

        await prisma.club.update({
          where: { id: clubId },
          data: { status: 'CANCELLED' },
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
