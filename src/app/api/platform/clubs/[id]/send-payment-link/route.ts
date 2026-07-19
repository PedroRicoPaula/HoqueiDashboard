import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { getStripe } from '@/lib/stripe'
import { sendEmail, paymentLinkEmailHtml } from '@/lib/email'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const schema = z.object({ plan: z.enum(['monthly', 'test']) })

const PLAN_LABELS: Record<'monthly' | 'test', { label: string; priceText: string }> = {
  monthly: { label: 'Plano Principal', priceText: '€59/mês' },
  test:    { label: 'Plano de Teste',   priceText: '€3/mês' },
}

// Super admin envia por email um link de Stripe Checkout para um clube grátis
// passar a pagar. O clube paga com o próprio cartão (não o do super admin) e,
// depois de pagar, é reencaminhado para /login para iniciar sessão com as
// credenciais que já tinha. A ativação (status ACTIVE + isFreeClub:false) é feita
// pelo webhook checkout.session.completed via src/lib/clubActivation.ts, tal como
// no registo normal.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getUserFromRequest(req)
    if (!admin?.isSuperAdmin) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
    }

    const club = await prisma.club.findUnique({ where: { id } })
    if (!club) return NextResponse.json({ error: 'Clube não encontrado' }, { status: 404 })
    if (!club.isFreeClub) {
      return NextResponse.json({ error: 'Este clube já não é grátis' }, { status: 422 })
    }

    const { plan } = parsed.data
    const priceId = plan === 'monthly'
      ? process.env.STRIPE_PRICE_MONTHLY!
      : process.env.STRIPE_PRICE_TEST!

    const stripe = getStripe()
    const customerId = club.stripeCustomerId
      ?? (await stripe.customers.create({ name: club.name, email: club.email })).id

    if (!club.stripeCustomerId) {
      await prisma.club.update({ where: { id: club.id }, data: { stripeCustomerId: customerId } })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_update: { name: 'auto', address: 'auto' },
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { clubId: club.id },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/login?upgraded=1&lang=${club.language}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      subscription_data: { metadata: { clubId: club.id } },
      tax_id_collection: { enabled: true },
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Erro ao criar sessão de pagamento' }, { status: 500 })
    }

    const planInfo = PLAN_LABELS[plan]
    const sent = await sendEmail({
      to: club.email,
      subject: 'Ativa o pagamento do teu clube — HoqueiManager',
      html: paymentLinkEmailHtml(club.name, session.url, planInfo.label, planInfo.priceText),
    })

    await logAudit(req, admin.id, admin.email, 'PAYMENT_LINK_SENT', 'Club', club.id, {
      plan,
      clubName: club.name,
      clubEmail: club.email,
      emailSent: sent,
    })

    return NextResponse.json({ sent, checkoutUrl: session.url })
  } catch (error) {
    logger.error('Send payment link error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
