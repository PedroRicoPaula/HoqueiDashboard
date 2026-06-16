import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { updateTrainingSessionSchema } from '@/lib/validations'
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
    const session = await db.trainingSession.findUnique({
      where: { id },
      include: {
        records: {
          include: {
            athlete: { select: { id: true, name: true, number: true, ageGroup: true } },
          },
          orderBy: { athlete: { number: 'asc' } },
        },
      },
    })

    if (!session) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    return NextResponse.json(session)
  } catch (error) {
    logger.error('Attendance [id] GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = updateTrainingSessionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { date, ...rest } = parsed.data
    const session = await db.trainingSession.update({
      where: { id },
      data: { ...rest, ...(date ? { date: new Date(date) } : {}) },
    })

    await logAudit(req, user.id, user.email, 'UPDATE', 'TrainingSession', id, {})
    return NextResponse.json(session)
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }
    logger.error('Attendance [id] PUT error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    await db.trainingSession.delete({ where: { id } })
    await logAudit(req, user.id, user.email, 'DELETE', 'TrainingSession', id, {})
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }
    logger.error('Attendance [id] DELETE error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
