import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { getStripe } from '@/lib/stripe'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const schema = z.object({ plan: z.enum(['monthly', 'yearly']) })

// Self-serve: o próprio clube (ainda em trial, ou já pago mas a trocar de plano) escolhe
// mensal/anual em /settings e paga com o seu cartão. Contraparte "cliente inicia" do
// /api/platform/clubs/[id]/send-payment-link (onde é o super admin que inicia por um clube
// grátis). success_url volta directo para /settings — ao contrário do registo/reactivate,
// aqui o utilizador já tem sessão activa, não precisa de passar pelo /login.
export async function POST(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, clubId } = ctx
    if (!hasPermission(user.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
    }

    const club = await ctx.db.club.findUnique({ where: { id: clubId } })
    if (!club) return NextResponse.json({ error: 'Clube não encontrado' }, { status: 404 })
    if (club.isFreeClub) {
      return NextResponse.json({ error: 'Contacte o suporte para activar o pagamento deste clube' }, { status: 422 })
    }

    const { plan } = parsed.data
    const priceId = plan === 'monthly'
      ? process.env.STRIPE_PRICE_MONTHLY!
      : process.env.STRIPE_PRICE_YEARLY!

    const stripe = getStripe()
    const customerId = club.stripeCustomerId
      ?? (await stripe.customers.create({ name: club.name, email: club.email })).id

    if (!club.stripeCustomerId) {
      await ctx.db.club.update({ where: { id: club.id }, data: { stripeCustomerId: customerId } })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_update: { name: 'auto', address: 'auto' },
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { clubId: club.id },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?upgraded=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
      subscription_data: { metadata: { clubId: club.id } },
      tax_id_collection: { enabled: true },
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Erro ao criar sessão de pagamento' }, { status: 500 })
    }

    await logAudit(req, user.id, user.email, 'UPDATE', 'Club', club.id, { action: 'subscribe_checkout_started', plan }, clubId)

    return NextResponse.json({ checkoutUrl: session.url })
  } catch (error) {
    logger.error('Billing subscribe error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
