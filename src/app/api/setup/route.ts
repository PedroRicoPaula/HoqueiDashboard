import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { setupSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { validateCsrf, csrfError } from '@/lib/csrf'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { logAudit } from '@/lib/audit'

export async function GET() {
  try {
    const count = await prisma.user.count()
    return NextResponse.json({ needsSetup: count === 0 })
  } catch (error) {
    logger.error('Setup GET error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!validateCsrf(req)) return csrfError()

  try {
    const ip = getClientIp(req)
    const rateLimit = await checkRateLimit(`setup:${ip}`, { windowMs: 15 * 60 * 1000, max: 3 })
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Demasiadas tentativas. Tente mais tarde.' }, { status: 429 })
    }

    const count = await prisma.user.count()
    if (count > 0) {
      return NextResponse.json({ error: 'Setup já concluído' }, { status: 409 })
    }

    const body = await req.json()
    const parsed = setupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { name, email, password } = parsed.data
    const hashed = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        isSuperAdmin: true,
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

    await logAudit(req, user.id, user.email, 'CREATE', 'User', user.id, { setup: true })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    logger.error('Setup POST error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
