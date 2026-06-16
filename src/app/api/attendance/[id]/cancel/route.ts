import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const cancelSchema = z.object({
  cancelled: z.boolean(),
  cancellationReason: z.string().optional().nullable(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = cancelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const session = await db.trainingSession.update({
      where: { id },
      data: {
        cancelled: parsed.data.cancelled,
        cancellationReason: parsed.data.cancelled ? (parsed.data.cancellationReason ?? null) : null,
      },
    })

    await logAudit(req, user.id, user.email, 'UPDATE', 'TrainingSession', id, {
      cancelled: parsed.data.cancelled,
    })
    return NextResponse.json(session)
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }
    logger.error('Attendance cancel PATCH error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
