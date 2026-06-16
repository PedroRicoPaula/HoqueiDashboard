import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { updateTextileSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'viewTextiles')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const item = await prisma.textileItem.findUnique({
      where: { id },
      include: { athlete: { select: { id: true, name: true, number: true } } },
    })

    if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
    return NextResponse.json(item)
  } catch (error) {
    logger.error('Textiles [id] GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'editTextiles')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = updateTextileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = { ...parsed.data }
    if (data.athleteId && data.state !== 'ASSIGNED') data.state = 'ASSIGNED'
    if (!data.athleteId && data.state === 'ASSIGNED') {
      data.state = 'STOCK'
      data.athleteId = null
    }
    if (data.state !== 'ASSIGNED') {
      data.paidByAthlete = false
      data.paidAmount = null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = await prisma.textileItem.update({ where: { id }, data: data as any })
    await logAudit(req, user.id, user.email, 'UPDATE', 'TextileItem', id, {})
    return NextResponse.json(item)
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Item têxtil não encontrado' }, { status: 404 })
    }
    logger.error('Textiles [id] PUT error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'editTextiles')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    await prisma.textileItem.delete({ where: { id } })
    await logAudit(req, user.id, user.email, 'DELETE', 'TextileItem', id, {})
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Item têxtil não encontrado' }, { status: 404 })
    }
    logger.error('Textiles [id] DELETE error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
