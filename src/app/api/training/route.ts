import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { createTrainingSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db, clubId } = ctx
    if (!hasPermission(user.permissions, 'viewTraining')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const trainings = await db.training.findMany({
      orderBy: { date: 'desc' },
      select: {
        id: true, title: true, date: true, notes: true,
        createdAt: true, updatedAt: true,
        playbook: { select: { id: true } },
      },
    })

    return NextResponse.json(trainings)
  } catch (error) {
    logger.error('Training GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db, clubId } = ctx
    if (!hasPermission(user.permissions, 'editTraining')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createTrainingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { date, ...rest } = parsed.data
    const training = await db.training.create({ data: { ...rest, date: new Date(date), clubId } })
    await logAudit(req, user.id, user.email, 'CREATE', 'Training', (training as { id: string }).id, { title: (training as { title: string }).title })
    return NextResponse.json(training, { status: 201 })
  } catch (error) {
    logger.error('Training POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
