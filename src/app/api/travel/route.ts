import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { createTravelSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'viewTravel')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const travels = await prisma.travel.findMany({ orderBy: { departureDate: 'desc' } })
    return NextResponse.json(travels)
  } catch (error) {
    logger.error('Travel GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'editTravel')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createTravelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { departureDate, returnDate, ...rest } = parsed.data
    const travel = await prisma.travel.create({
      data: {
        ...rest,
        departureDate: new Date(departureDate),
        returnDate: returnDate ? new Date(returnDate) : null,
      },
    })

    await logAudit(req, user.id, user.email, 'CREATE', 'Travel', travel.id, { opponent: travel.opponent })
    return NextResponse.json(travel, { status: 201 })
  } catch (error) {
    logger.error('Travel POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
