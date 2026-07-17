import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { updateSeasonSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const season = await db.season.findUnique({ where: { id } })
    if (!season) return NextResponse.json({ error: 'Época não encontrada' }, { status: 404 })

    const body = await req.json()

    // Special action: activate
    if (body.action === 'activate') {
      // Deactivate all seasons for this club then activate this one
      await db.season.updateMany({ where: {}, data: { isActive: false } })
      const updated = await db.season.update({ where: { id }, data: { isActive: true } })
      await logAudit(req, user.id, user.email, 'UPDATE', 'Season', id, { action: 'activate', name: season.name })
      return NextResponse.json(updated)
    }

    const parsed = updateSeasonSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { name, startDate, endDate, defaultAthleteMonthlyFee, defaultMemberMonthlyQuota } = parsed.data
    const newStart = startDate ? new Date(startDate) : undefined
    const newEnd   = endDate   ? new Date(endDate)   : undefined

    if (newStart && newEnd && newEnd <= newStart) {
      return NextResponse.json({ error: 'Data de fim deve ser posterior à data de início' }, { status: 400 })
    }

    const updated = await db.season.update({
      where: { id },
      data: {
        ...(name      ? { name }                : {}),
        ...(newStart  ? { startDate: newStart } : {}),
        ...(newEnd    ? { endDate: newEnd }     : {}),
        ...(defaultAthleteMonthlyFee  !== undefined ? { defaultAthleteMonthlyFee }  : {}),
        ...(defaultMemberMonthlyQuota !== undefined ? { defaultMemberMonthlyQuota } : {}),
      },
    })

    await logAudit(req, user.id, user.email, 'UPDATE', 'Season', id, parsed.data)
    return NextResponse.json(updated)
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Já existe uma época com esse nome' }, { status: 409 })
    }
    logger.error('Season PATCH error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const season = await db.season.findUnique({
      where: { id },
      include: { _count: { select: { members: true, sponsors: true, athletePayments: true, quotas: true } } },
    })
    if (!season) return NextResponse.json({ error: 'Época não encontrada' }, { status: 404 })

    const total = season._count.members + season._count.sponsors + season._count.athletePayments + season._count.quotas
    if (total > 0) {
      return NextResponse.json(
        { error: `Não é possível eliminar a época "${season.name}" — tem ${total} registos associados` },
        { status: 422 }
      )
    }

    await db.season.delete({ where: { id } })
    await logAudit(req, user.id, user.email, 'DELETE', 'Season', id, { name: season.name })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    logger.error('Season DELETE error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
