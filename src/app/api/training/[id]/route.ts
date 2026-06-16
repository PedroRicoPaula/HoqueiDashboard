import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { updateTrainingSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewTraining')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const training = await db.training.findUnique({
      where: { id },
      include: { playbook: true },
    })

    if (!training) return NextResponse.json({ error: 'Treino não encontrado' }, { status: 404 })
    return NextResponse.json(training)
  } catch (error) {
    logger.error('Training GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editTraining')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateTrainingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { date, ...rest } = parsed.data
    const training = await db.training.update({
      where: { id },
      data: { ...rest, ...(date ? { date: new Date(date) } : {}) },
    })

    await logAudit(req, user.id, user.email, 'UPDATE', 'Training', (training as { id: string }).id, { title: (training as { title: string }).title })
    return NextResponse.json(training)
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Treino não encontrado' }, { status: 404 })
    }
    logger.error('Training PUT error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editTraining')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    await db.training.delete({ where: { id } })
    await logAudit(req, user.id, user.email, 'DELETE', 'Training', id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Treino não encontrado' }, { status: 404 })
    }
    logger.error('Training DELETE error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
