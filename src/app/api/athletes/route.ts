import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { createAthleteSchema } from '@/lib/validations'
import { athleteMembershipWhere } from '@/lib/athleteMembership'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import type { AgeGroup } from '@prisma/client'

const PAGE_SIZE = 50

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewAthletes')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const ageGroup = searchParams.get('ageGroup') || ''
    const seasonId = searchParams.get('seasonId') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const all = searchParams.get('all') === 'true'

    const searchAsNumber = /^\d+$/.test(search) ? parseInt(search) : null

    let season: { startDate: Date; endDate: Date } | null = null
    if (seasonId) {
      season = await db.season.findUnique({ where: { id: seasonId }, select: { startDate: true, endDate: true } })
      if (!season) return NextResponse.json({ error: 'Época não encontrada' }, { status: 404 })
    }

    const where = {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search, mode: 'insensitive' as const } },
                ...(searchAsNumber != null ? [{ number: searchAsNumber }] : []),
              ],
            }
          : {},
        ageGroup ? { ageGroup: ageGroup as AgeGroup } : {},
        athleteMembershipWhere(season),
      ],
    }

    if (all) {
      const athletes = await db.athlete.findMany({ where, orderBy: { number: 'asc' } })
      return NextResponse.json({ athletes, total: (athletes as unknown[]).length, page: 1, pages: 1 })
    }

    const [athletes, total] = await Promise.all([
      db.athlete.findMany({
        where,
        orderBy: { number: 'asc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.athlete.count({ where }),
    ])

    return NextResponse.json({ athletes, total, page, pages: Math.ceil((total as number) / PAGE_SIZE) })
  } catch (error) {
    logger.error('Athletes GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db, clubId } = ctx
    if (!hasPermission(user.permissions, 'editAthletes')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()

    // Bulk import mode
    if (Array.isArray(body)) {
      const results = []
      const errors = []
      for (const item of body) {
        const parsed = createAthleteSchema.safeParse(item)
        if (!parsed.success) {
          errors.push({ item, error: parsed.error.flatten() })
          continue
        }
        const { birthDate, ...rest } = parsed.data
        try {
          const athlete = await db.athlete.create({
            data: { ...rest, birthDate: new Date(birthDate), clubId },
          })
          results.push(athlete)
          await logAudit(req, user.id, user.email, 'CREATE', 'Athlete', (athlete as { id: string }).id, { name: (athlete as { name: string }).name, import: true })
        } catch (e: unknown) {
          if ((e as { code?: string })?.code === 'P2002') {
            errors.push({ item, error: 'Número de atleta já existe' })
          } else {
            errors.push({ item, error: 'Erro ao criar' })
          }
        }
      }
      return NextResponse.json({ created: results.length, errors })
    }

    const parsed = createAthleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { birthDate, ...rest } = parsed.data
    const athlete = await db.athlete.create({
      data: { ...rest, birthDate: new Date(birthDate), clubId },
    })

    await logAudit(req, user.id, user.email, 'CREATE', 'Athlete', (athlete as { id: string }).id, { name: (athlete as { name: string }).name })
    return NextResponse.json(athlete, { status: 201 })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Número de atleta já existe' }, { status: 409 })
    }
    logger.error('Athletes POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
