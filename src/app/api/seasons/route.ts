import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { createSeasonSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { db } = ctx

    const seasons = await db.season.findMany({
      orderBy: { startDate: 'desc' },
      select: {
        id: true, name: true, startDate: true, endDate: true, isActive: true,
        defaultAthleteMonthlyFee: true, defaultMemberMonthlyQuota: true,
        createdAt: true,
        _count: { select: { members: true, sponsors: true } },
      },
    })

    return NextResponse.json(seasons)
  } catch (error) {
    logger.error('Seasons GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createSeasonSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { name, startDate, endDate } = parsed.data

    if (new Date(endDate) <= new Date(startDate)) {
      return NextResponse.json({ error: 'Data de fim deve ser posterior à data de início' }, { status: 400 })
    }

    const season = await db.season.create({
      data: { name, startDate: new Date(startDate), endDate: new Date(endDate), clubId: ctx.clubId },
    })

    await logAudit(req, user.id, user.email, 'CREATE', 'Season', season.id, { name })
    return NextResponse.json(season, { status: 201 })
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Já existe uma época com esse nome' }, { status: 409 })
    }
    logger.error('Seasons POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
