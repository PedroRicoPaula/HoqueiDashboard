import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const schema = z.object({ email: z.string().email() })

// Rota pública (sem sessão — é chamada a partir do ecrã de "conta suspensa" no
// /login, onde o utilizador por definição ainda não consegue entrar). Reabre
// Stripe Checkout reutilizando o customer já existente do clube, para reativar
// uma subscrição cancelada/suspensa sem intervenção manual. Ver /api/billing/cancel
// e o handler customer.subscription.deleted no webhook — ambos deixam o clube em
// SUSPENDED, o estado que esta rota aceita reativar.
export async function POST(req: Request) {
  const ip = getClientIp(req)
  const limit = await checkRateLimit(`billing:reactivate:${ip}`, { windowMs: 60 * 60 * 1000, max: 10 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Aguarde e tente novamente.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      include: { club: true },
    })

    const club = user?.club
    if (!club || !user) {
      return NextResponse.json({ error: 'Não encontrámos nenhum clube com esse email' }, { status: 404 })
    }
    if (club.isFreeClub) {
      return NextResponse.json({ error: 'Contacte o suporte para reativar este clube' }, { status: 422 })
    }
    if (club.status !== 'SUSPENDED' && club.status !== 'PAST_DUE') {
      return NextResponse.json({ error: 'Este clube não está suspenso' }, { status: 422 })
    }

    const stripe = getStripe()
    // Clube nunca chegou a pagar (trial expirado sem escolher plano) — não tem
    // stripeCustomerId ainda. Cria-se aqui, tal como em send-payment-link/billing-subscribe.
    const customerId = club.stripeCustomerId
      ?? (await stripe.customers.create({ name: club.name, email: club.email })).id
    if (!club.stripeCustomerId) {
      await prisma.club.update({ where: { id: club.id }, data: { stripeCustomerId: customerId } })
    }
    const priceId = club.stripePriceId ?? process.env.STRIPE_PRICE_MONTHLY!

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { clubId: club.id },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/login?reactivated=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      subscription_data: { metadata: { clubId: club.id } },
      tax_id_collection: { enabled: true },
    })

    return NextResponse.json({ checkoutUrl: session.url })
  } catch (error) {
    logger.error('Billing reactivate error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
