import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { createTrainingSessionSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const ageGroup = searchParams.get('ageGroup')
    const sessionType = searchParams.get('sessionType')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const VALID_AGE_GROUPS = ['SUB11', 'SUB13', 'SUB15', 'SUB17', 'SUB19', 'SENIORS'] as const
    const VALID_SESSION_TYPES = ['GENERAL', 'GOALKEEPERS', 'FIELD_PLAYERS', 'SPECIFIC'] as const
    type AgeGroupEnum = typeof VALID_AGE_GROUPS[number]
    type SessionTypeEnum = typeof VALID_SESSION_TYPES[number]

    const safeAgeGroup = VALID_AGE_GROUPS.includes(ageGroup as AgeGroupEnum) ? ageGroup as AgeGroupEnum : undefined
    const safeSessionType = VALID_SESSION_TYPES.includes(sessionType as SessionTypeEnum) ? sessionType as SessionTypeEnum : undefined

    const sessions = await db.trainingSession.findMany({
      where: {
        ...(safeAgeGroup ? { primaryAgeGroup: safeAgeGroup } : {}),
        ...(safeSessionType ? { sessionType: safeSessionType } : {}),
        ...(from || to ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        } : {}),
      },
      orderBy: { date: 'desc' },
      include: {
        _count: { select: { records: true } },
        records: { select: { present: true } },
      },
    }) as unknown as Array<{
      id: string; date: Date; time: string; primaryAgeGroup: string; sessionType: string;
      title: string | null; notes: string | null; cancelled: boolean; cancellationReason: string | null;
      scheduleId: string | null; createdAt: Date;
      _count: { records: number };
      records: { present: boolean }[];
    }>

    const result = sessions.map((s) => ({
      id: s.id,
      date: s.date,
      time: s.time,
      primaryAgeGroup: s.primaryAgeGroup,
      sessionType: s.sessionType,
      title: s.title,
      notes: s.notes,
      cancelled: s.cancelled,
      cancellationReason: s.cancellationReason,
      scheduleId: s.scheduleId,
      totalRecords: s._count.records,
      presentCount: s.records.filter((r) => r.present).length,
      createdAt: s.createdAt,
    }))

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Attendance GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createTrainingSessionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { date, time, primaryAgeGroup, sessionType, title, notes, scheduleId } = parsed.data
    const session = await db.trainingSession.create({
      data: {
        date: new Date(date),
        time,
        primaryAgeGroup,
        sessionType,
        title,
        notes,
        ...(scheduleId ? { scheduleId } : {}),
      },
    })

    await logAudit(req, user.id, user.email, 'CREATE', 'TrainingSession', (session as { id: string }).id, { date: (session as { date: Date }).date, primaryAgeGroup })
    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    logger.error('Attendance POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
