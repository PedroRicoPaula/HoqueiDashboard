import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest, hashPassword } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { z } from 'zod'

const createFreeClubSchema = z.object({
  clubName:      z.string().min(2).max(100),
  clubEmail:     z.string().email().max(255),
  country:       z.string().min(2).max(2).default('pt'),
  language:      z.string().min(2).max(2).default('pt'),
  adminName:     z.string().min(2).max(100),
  adminEmail:    z.string().email().max(255),
  adminPassword: z.string().min(8).max(128),
})

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user?.isSuperAdmin) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Rate limit: max 20 free club creations per hour per super admin session
    const rl = await checkRateLimit(`platform:create-club:${user.id}`, { windowMs: 60 * 60 * 1000, max: 20 })
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Demasiados pedidos. Tente mais tarde.' }, { status: 429 })
    }

    const body = await req.json()
    const parsed = createFreeClubSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { clubName, clubEmail, country, language, adminName, adminEmail, adminPassword } = parsed.data

    const slug = clubName
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) + '-' + Date.now().toString(36)

    const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
    if (existing) {
      return NextResponse.json({ error: 'Já existe um utilizador com esse email' }, { status: 409 })
    }

    const hashedPassword = await hashPassword(adminPassword)

    const club = await prisma.$transaction(async (tx) => {
      const newClub = await tx.club.create({
        data: {
          name: clubName,
          slug,
          email: clubEmail,
          country,
          language,
          status: 'ACTIVE',
          isFreeClub: true,
          statusChangedAt: new Date(),
        },
      })

      await tx.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          password: hashedPassword,
          clubId: newClub.id,
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

      return newClub
    })

    await logAudit(req, user.id, user.email, 'CREATE_FREE_CLUB', 'Club', club.id, {
      clubName: club.name,
      clubEmail: club.email,
      adminEmail,
      country,
      language,
      ip: getClientIp(req),
    })

    return NextResponse.json({ id: club.id, name: club.name, slug: club.slug }, { status: 201 })
  } catch (error) {
    logger.error('Platform create club error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
