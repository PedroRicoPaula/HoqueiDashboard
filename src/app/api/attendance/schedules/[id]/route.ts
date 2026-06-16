import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const updateSchema = z.object({
  season: z.string().min(1).optional(),
  seasonStart: z.string().optional().nullable(),
  ageGroup: z.enum(['SUB11', 'SUB13', 'SUB15', 'SUB17', 'SUB19', 'SENIORS']).optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  sessionType: z.enum(['GENERAL', 'GOALKEEPERS', 'FIELD_PLAYERS', 'SPECIFIC']).optional(),
  active: z.boolean().optional(),
})

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'editAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { seasonStart, ...rest } = parsed.data
    const schedule = await prisma.trainingSchedule.update({
      where: { id },
      data: {
        ...rest,
        ...(seasonStart !== undefined ? { seasonStart: seasonStart ? new Date(seasonStart) : null } : {}),
      },
    })

    await logAudit(req, user.id, user.email, 'UPDATE', 'TrainingSchedule', id, {})
    return NextResponse.json(schedule)
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Horário não encontrado' }, { status: 404 })
    }
    logger.error('Schedules [id] PUT error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'editAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    await prisma.trainingSchedule.delete({ where: { id } })
    await logAudit(req, user.id, user.email, 'DELETE', 'TrainingSchedule', id, {})
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Horário não encontrado' }, { status: 404 })
    }
    logger.error('Schedules [id] DELETE error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
