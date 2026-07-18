import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { updateAthleteSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewAthletes')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const athlete = await db.athlete.findUnique({
      where: { id },
      include: { materials: true, directionRole: true },
    })

    if (!athlete) return NextResponse.json({ error: 'Atleta não encontrado' }, { status: 404 })
    return NextResponse.json(athlete)
  } catch (error) {
    logger.error('Athlete GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editAthletes')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateAthleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { birthDate, leftAt, ...rest } = parsed.data
    const athlete = await db.athlete.update({
      where: { id },
      data: {
        ...rest,
        ...(birthDate ? { birthDate: new Date(birthDate) } : {}),
        ...(leftAt !== undefined ? { leftAt: leftAt ? new Date(leftAt) : null } : {}),
      },
    })

    await logAudit(req, user.id, user.email, 'UPDATE', 'Athlete', (athlete as { id: string }).id, {
      name: (athlete as { name: string }).name,
      ...(leftAt !== undefined ? { leftAt: leftAt ?? null } : {}),
    })
    return NextResponse.json(athlete)
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Atleta não encontrado' }, { status: 404 })
    }
    logger.error('Athlete PUT error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editAthletes')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    await db.athlete.delete({ where: { id } })
    await logAudit(req, user.id, user.email, 'DELETE', 'Athlete', id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Atleta não encontrado' }, { status: 404 })
    }
    logger.error('Athlete DELETE error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
