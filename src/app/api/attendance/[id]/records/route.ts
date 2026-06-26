import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { bulkAttendanceSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const records = await db.attendanceRecord.findMany({
      where: { sessionId: id },
      include: {
        athlete: { select: { id: true, name: true, number: true, ageGroup: true } },
      },
      orderBy: { athlete: { number: 'asc' } },
    })

    return NextResponse.json(records)
  } catch (error) {
    logger.error('Attendance records GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// Upsert all attendance records for a session at once
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id: sessionId } = await params
    const body = await req.json()
    const parsed = bulkAttendanceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    // Verify session exists
    const session = await db.trainingSession.findUnique({ where: { id: sessionId } })
    if (!session) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

    // Upsert each record
    await Promise.all(
      parsed.data.records.map((r: { athleteId: string; present: boolean; notes?: string | null; paidByAthlete?: boolean | null; paidAmount?: number | null }) =>
        db.attendanceRecord.upsert({
          where: { sessionId_athleteId: { sessionId, athleteId: r.athleteId } },
          create: {
            sessionId, athleteId: r.athleteId, present: r.present, notes: r.notes,
            paidByAthlete: r.paidByAthlete ?? false,
            paidAmount: r.paidAmount ?? null,
          },
          update: {
            present: r.present, notes: r.notes,
            paidByAthlete: r.paidByAthlete ?? false,
            paidAmount: r.paidAmount ?? null,
          },
        })
      )
    )

    await logAudit(req, user.id, user.email, 'UPDATE', 'AttendanceRecord', sessionId, {
      count: parsed.data.records.length,
    })

    const updated = await db.attendanceRecord.findMany({
      where: { sessionId },
      include: {
        athlete: { select: { id: true, name: true, number: true, ageGroup: true } },
      },
      orderBy: { athlete: { number: 'asc' } },
    })

    return NextResponse.json(updated)
  } catch (error) {
    logger.error('Attendance records PUT error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
