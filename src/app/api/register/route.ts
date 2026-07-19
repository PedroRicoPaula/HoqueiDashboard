import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, signToken } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { logAudit } from '@/lib/audit'
import { getStripe } from '@/lib/stripe'
import { sendEmail, trialWelcomeEmailHtml } from '@/lib/email'
import { z } from 'zod'

const TRIAL_DAYS = 14

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  country: z.string().min(2).max(10),
  language: z.enum(['pt', 'es', 'en', 'fr', 'it']),
  plan: z.enum(['monthly', 'yearly', 'trial']),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As palavras-passe não coincidem',
  path: ['confirmPassword'],
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

    const { name, email, country, language, plan, password } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Este email já está registado.' }, { status: 409 })
    }

    // Teste grátis: sem Stripe nenhum, clube fica ACTIVE de imediato com prazo de 14 dias
    // (Club.trialEndsAt). Login automático, igual ao contrato de /api/register/complete.
    // Um cron diário (/api/cron/trial-sweep) suspende quem passar do prazo sem ter pago.
    if (plan === 'trial') {
      const slug = await uniqueSlug(slugify(name))
      const hashedPassword = await hashPassword(password)
      const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

      const [club, user] = await prisma.$transaction(async (tx) => {
        const c = await tx.club.create({
          data: {
            name, slug, email, country, language,
            status: 'ACTIVE',
            trialEndsAt,
          },
        })
        const u = await tx.user.create({
          data: {
            clubId: c.id,
            name: 'Administrador',
            email,
            password: hashedPassword,
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
          include: { permissions: true },
        })
        return [c, u] as const
      })

      await logAudit(req, user.id, user.email, 'REGISTER', 'Club', club.id, { name, email, country, language, plan: 'trial', trialEndsAt }, club.id)

      // Links estáveis (não expiram — cada clique gera uma sessão Stripe fresca), o clube
      // pode usá-los em qualquer dia dos 14 de trial. Best-effort: falha de email não chumba o registo.
      const monthlyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/billing/checkout-link/${club.id}?plan=monthly`
      const yearlyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/billing/checkout-link/${club.id}?plan=yearly`
      await sendEmail({
        to: email,
        subject: 'Bem-vindo ao HoqueiManager — o teu teste grátis começou',
        html: trialWelcomeEmailHtml(name, monthlyUrl, yearlyUrl),
      })

      const perms = user.permissions
      const token = await signToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        clubId: user.clubId ?? null,
        isSuperAdmin: false,
        tokenVersion: user.tokenVersion,
        permissions: perms
          ? {
              viewAthletes: perms.viewAthletes, editAthletes: perms.editAthletes,
              viewFees: perms.viewFees, editFees: perms.editFees,
              viewMembers: perms.viewMembers, editMembers: perms.editMembers,
              viewMaterials: perms.viewMaterials, editMaterials: perms.editMaterials,
              viewSponsors: perms.viewSponsors, manageSponsors: perms.manageSponsors,
              viewTraining: perms.viewTraining, editTraining: perms.editTraining,
              viewTravel: perms.viewTravel, editTravel: perms.editTravel,
              viewDirection: perms.viewDirection, editDirection: perms.editDirection,
              viewAttendance: perms.viewAttendance, editAttendance: perms.editAttendance,
              viewTextiles: perms.viewTextiles, editTextiles: perms.editTextiles,
              isAdmin: perms.isAdmin,
            }
          : null,
      })

      const response = NextResponse.json({
        user: {
          id: user.id, name: user.name, email: user.email, isSuperAdmin: false,
          clubName: club.name, clubLanguage: club.language, clubLogoUrl: null, clubPrimaryColor: club.primaryColor,
        },
        permissions: perms,
        redirectTo: '/',
      })
      response.cookies.set('hm_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24,
        path: '/',
      })
      return response
    }

    const priceId = plan === 'monthly'
      ? process.env.STRIPE_PRICE_MONTHLY!
      : process.env.STRIPE_PRICE_YEARLY!

    const stripe = getStripe()
    const customer = await stripe.customers.create({ name, email })

    const slug = await uniqueSlug(slugify(name))
    // Password definida pelo utilizador já aqui — fica pronta a usar assim que o
    // pagamento for confirmado (ver /api/register/complete). O clube só entra em
    // ACTIVE depois de pagar; até lá o login continua bloqueado independentemente
    // de a password já existir.
    const hashedPassword = await hashPassword(password)

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
          password: hashedPassword,
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

    await logAudit(req, user.id, user.email, 'REGISTER', 'Club', club.id, { name, email, country, language, plan }, club.id)

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { clubId: club.id, userId: user.id },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/register/complete?session_id={CHECKOUT_SESSION_ID}&lang=${language}`,
      cancel_url: `${process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://hoqueimanager.com'}/${language}/register?cancelled=1`,
      subscription_data: {
        metadata: { clubId: club.id },
      },
      tax_id_collection: { enabled: true },
    })

    return NextResponse.json({ checkoutUrl: session.url })
  } catch (error) {
    logger.error('Register error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
