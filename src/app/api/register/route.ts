import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { logAudit } from '@/lib/audit'
import Stripe from 'stripe'
import { z } from 'zod'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' })
}

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  country: z.string().min(2).max(10),
  language: z.enum(['pt', 'es', 'en', 'fr', 'it']),
  plan: z.enum(['monthly', 'yearly']),
})

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  let i = 1
  while (await prisma.club.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`
  }
  return slug
}

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const limit = await checkRateLimit(`register:${ip}`, { windowMs: 60 * 60 * 1000, max: 5 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Muitos pedidos. Aguarde.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const { name, email, country, language, plan } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Este email já está registado.' }, { status: 409 })
    }

    const priceId = plan === 'monthly'
      ? process.env.STRIPE_PRICE_MONTHLY!
      : process.env.STRIPE_PRICE_YEARLY!

    const stripe = getStripe()
    const customer = await stripe.customers.create({ name, email })

    const slug = await uniqueSlug(slugify(name))
    // Placeholder password — user will set their own via reset-password link after checkout
    const placeholderPassword = await hashPassword(randomBytes(32).toString('hex'))

    const [club, user] = await prisma.$transaction(async (tx) => {
      const c = await tx.club.create({
        data: {
          name,
          slug,
          email,
          country,
          language,
          status: 'PENDING_PAYMENT',
          stripeCustomerId: customer.id,
        },
      })
      const u = await tx.user.create({
        data: {
          clubId: c.id,
          name: 'Administrador',
          email,
          password: placeholderPassword,
          permissions: {
            create: {
              viewAthletes: true, editAthletes: true,
              viewFees: true, editFees: true,
              viewMembers: true, editMembers: true,
              viewMaterials: true, editMaterials: true,
              viewSponsors: true, manageSponsors: true,
              viewTraining: true, editTraining: true,
              viewTravel: true, editTravel: true,
              viewDirection: true, editDirection: true,
              viewAttendance: true, editAttendance: true,
              viewTextiles: true, editTextiles: true,
              isAdmin: true,
            },
          },
        },
      })
      return [c, u] as const
    }).catch(async (err: unknown) => {
      await stripe.customers.del(customer.id).catch(() => {})
      throw err
    })

    await logAudit(req, user.id, user.email, 'REGISTER', 'Club', club.id, { name, email, country, language, plan })

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { clubId: club.id, userId: user.id },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/login?registered=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://hoqueimanager.com'}/${language}/register?cancelled=1`,
      subscription_data: {
        metadata: { clubId: club.id },
      },
    })

    return NextResponse.json({ checkoutUrl: session.url })
  } catch (error) {
    logger.error('Register error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
