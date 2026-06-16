import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { createAthleteSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import type { AgeGroup } from '@prisma/client'

const PAGE_SIZE = 50

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'viewAthletes')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const ageGroup = searchParams.get('ageGroup') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const all = searchParams.get('all') === 'true'

    const where = {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {},
        ageGroup ? { ageGroup: ageGroup as AgeGroup } : {},
      ],
    }

    if (all) {
      const athletes = await prisma.athlete.findMany({ where, orderBy: { number: 'asc' } })
      return NextResponse.json({ athletes, total: athletes.length, page: 1, pages: 1 })
    }

    const [athletes, total] = await Promise.all([
      prisma.athlete.findMany({
        where,
        orderBy: { number: 'asc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.athlete.count({ where }),
    ])

    return NextResponse.json({ athletes, total, page, pages: Math.ceil(total / PAGE_SIZE) })
  } catch (error) {
    logger.error('Athletes GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
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
          const athlete = await prisma.athlete.create({
            data: { ...rest, birthDate: new Date(birthDate) },
          })
          results.push(athlete)
          await logAudit(req, user.id, user.email, 'CREATE', 'Athlete', athlete.id, { name: athlete.name, import: true })
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
    const athlete = await prisma.athlete.create({
      data: { ...rest, birthDate: new Date(birthDate) },
    })

    await logAudit(req, user.id, user.email, 'CREATE', 'Athlete', athlete.id, { name: athlete.name })
    return NextResponse.json(athlete, { status: 201 })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Número de atleta já existe' }, { status: 409 })
    }
    logger.error('Athletes POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
