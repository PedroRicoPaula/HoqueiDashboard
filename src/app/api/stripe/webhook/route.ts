import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { sendEmail, welcomeEmailHtml } from '@/lib/email'
import Stripe from 'stripe'
import crypto from 'crypto'

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
        const userId = session.metadata?.userId
        if (!clubId) break

        const expanded = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items'],
        })
        const stripePriceId = expanded.line_items?.data?.[0]?.price?.id ?? null

        const club = await prisma.club.update({
          where: { id: clubId },
          data: {
            status: 'ACTIVE',
            stripeSubscriptionId: session.subscription as string,
            stripePriceId,
          },
        })

        await logAudit(req, null, club.email, 'SUBSCRIPTION_ACTIVATED', 'Club', clubId, {
          stripeEventId: event.id,
          stripeSubscriptionId: session.subscription,
        })

        if (userId) {
          const user = await prisma.user.findUnique({ where: { id: userId } })
          if (user) {
            // Create a password reset token so the user can set their own password
            await prisma.passwordResetToken.updateMany({
              where: { userId: user.id, used: false },
              data: { used: true },
            })
            const token = crypto.randomBytes(32).toString('hex')
            // Give 24h to set the password (longer window for new registrations)
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
            await prisma.passwordResetToken.create({
              data: { userId: user.id, token, expiresAt },
            })

            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.hoqueimanager.com'
            const setPasswordUrl = `${appUrl}/reset-password?token=${token}`

            await sendEmail({
              to: user.email,
              subject: `Bem-vindo ao HoqueiManager — ${club.name}`,
              html: welcomeEmailHtml(club.name, user.email, setPasswordUrl),
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
