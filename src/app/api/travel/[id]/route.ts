import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { updateTravelSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'viewTravel')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const travel = await prisma.travel.findUnique({ where: { id } })
    if (!travel) return NextResponse.json({ error: 'Viagem não encontrada' }, { status: 404 })
    return NextResponse.json(travel)
  } catch (error) {
    logger.error('Travel GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'editTravel')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateTravelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { departureDate, returnDate, ...rest } = parsed.data
    const travel = await prisma.travel.update({
      where: { id },
      data: {
        ...rest,
        ...(departureDate ? { departureDate: new Date(departureDate) } : {}),
        ...(returnDate ? { returnDate: new Date(returnDate) } : {}),
      },
    })

    await logAudit(req, user.id, user.email, 'UPDATE', 'Travel', travel.id, { opponent: travel.opponent })
    return NextResponse.json(travel)
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Viagem não encontrada' }, { status: 404 })
    }
    logger.error('Travel PUT error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'editTravel')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    await prisma.travel.delete({ where: { id } })
    await logAudit(req, user.id, user.email, 'DELETE', 'Travel', id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Viagem não encontrada' }, { status: 404 })
    }
    logger.error('Travel DELETE error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
