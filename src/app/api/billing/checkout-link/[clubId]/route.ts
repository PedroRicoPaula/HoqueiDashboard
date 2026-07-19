import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

// Link "estável" para usar em email — Stripe Checkout Sessions expiram ao fim de 24h no
// máximo (limite da própria API, não configurável), por isso não dá para pôr a URL de uma
// sessão já criada num email que o clube só pode abrir dias depois (trial dura 14 dias).
// Este endpoint gera a sessão na hora do clique e redirige — o link do email nunca expira,
// só a sessão gerada em cada clique (que dura o suficiente para o clube completar o Checkout).
export async function GET(req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const ip = getClientIp(req)
  const limit = await checkRateLimit(`billing:checkout-link:${ip}`, { windowMs: 60 * 60 * 1000, max: 30 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Tente mais tarde.' }, { status: 429 })
  }

  try {
    const { clubId } = await params
    const { searchParams } = new URL(req.url)
    const plan = searchParams.get('plan')
    if (plan !== 'monthly' && plan !== 'yearly') {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
    }

    const club = await prisma.club.findUnique({ where: { id: clubId } })
    if (!club) return NextResponse.json({ error: 'Clube não encontrado' }, { status: 404 })
    if (club.isFreeClub) return NextResponse.json({ error: 'Contacte o suporte' }, { status: 422 })
    if (club.stripeSubscriptionId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?already=1`)
    }

    const priceId = plan === 'monthly'
      ? process.env.STRIPE_PRICE_MONTHLY!
      : process.env.STRIPE_PRICE_YEARLY!

    const stripe = getStripe()
    const customerId = club.stripeCustomerId
      ?? (await stripe.customers.create({ name: club.name, email: club.email })).id
    if (!club.stripeCustomerId) {
      await prisma.club.update({ where: { id: club.id }, data: { stripeCustomerId: customerId } })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { clubId: club.id },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/login?upgraded=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      subscription_data: { metadata: { clubId: club.id } },
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Erro ao criar sessão de pagamento' }, { status: 500 })
    }
    return NextResponse.redirect(session.url)
  } catch (error) {
    logger.error('Billing checkout-link error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
