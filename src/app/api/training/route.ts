import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { createTrainingSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'viewTraining')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const trainings = await prisma.training.findMany({
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
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'editTraining')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createTrainingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { date, ...rest } = parsed.data
    const training = await prisma.training.create({ data: { ...rest, date: new Date(date) } })
    await logAudit(req, user.id, user.email, 'CREATE', 'Training', training.id, { title: training.title })
    return NextResponse.json(training, { status: 201 })
  } catch (error) {
    logger.error('Training POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
