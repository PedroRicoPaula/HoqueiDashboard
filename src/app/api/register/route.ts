import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { logger } from '@/lib/logger'
import Stripe from 'stripe'
import { z } from 'zod'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' })

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
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const { name, email, country, language, plan } = parsed.data

    // Check email not already registered
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Este email já está registado.' }, { status: 409 })
    }

    const priceId = plan === 'monthly'
      ? process.env.STRIPE_PRICE_MONTHLY!
      : process.env.STRIPE_PRICE_YEARLY!

    // Create Stripe customer first to get customerId
    const customer = await stripe.customers.create({ name, email })

    // Create club (PENDING_PAYMENT until webhook confirms)
    const slug = await uniqueSlug(slugify(name))
    const club = await prisma.club.create({
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

    // Create admin user for the club
    const tempPassword = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
    const user = await prisma.user.create({
      data: {
        clubId: club.id,
        name: 'Administrador',
        email,
        password: await hashPassword(tempPassword),
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

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { clubId: club.id, userId: user.id },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/login?registered=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/${language}/register?cancelled=1`,
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
