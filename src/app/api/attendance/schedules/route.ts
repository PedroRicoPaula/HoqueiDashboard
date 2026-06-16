import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const scheduleSchema = z.object({
  season: z.string().min(1),
  seasonStart: z.string().optional().nullable(),
  ageGroup: z.enum(['SUB11', 'SUB13', 'SUB15', 'SUB17', 'SUB19', 'SENIORS']),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().min(1),
  endTime: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  sessionType: z.enum(['GENERAL', 'GOALKEEPERS', 'FIELD_PLAYERS', 'SPECIFIC']).default('GENERAL'),
  active: z.boolean().optional().default(true),
})

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'viewAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const season = searchParams.get('season')

    const schedules = await prisma.trainingSchedule.findMany({
      where: season ? { season } : {},
      orderBy: [{ ageGroup: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })

    return NextResponse.json(schedules)
  } catch (error) {
    logger.error('Schedules GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'editAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = scheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { seasonStart, ...rest } = parsed.data
    const schedule = await prisma.trainingSchedule.create({
      data: { ...rest, seasonStart: seasonStart ? new Date(seasonStart) : null },
    })

    await logAudit(req, user.id, user.email, 'CREATE', 'TrainingSchedule', schedule.id, {
      season: schedule.season, ageGroup: schedule.ageGroup,
    })
    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    logger.error('Schedules POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
