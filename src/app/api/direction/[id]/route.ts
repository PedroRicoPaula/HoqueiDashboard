import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { updateDirectionSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewDirection')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const member = await db.directionMember.findUnique({ where: { id } })
    if (!member) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
    return NextResponse.json(member)
  } catch (error) {
    logger.error('Direction GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editDirection')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateDirectionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    if (data.roles && !data.roles.includes('TRAINER')) data.trainerAgeGroups = []
    if (data.roles && !data.roles.includes('SECCIONISTA')) data.sectionistAgeGroups = []

    const member = await db.directionMember.update({ where: { id }, data })

    await logAudit(req, user.id, user.email, 'UPDATE', 'DirectionMember', (member as { id: string }).id, { name: (member as { name: string }).name })
    return NextResponse.json(member)
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
    }
    logger.error('Direction PUT error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editDirection')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    await db.directionMember.delete({ where: { id } })
    await logAudit(req, user.id, user.email, 'DELETE', 'DirectionMember', id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
    }
    logger.error('Direction DELETE error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
