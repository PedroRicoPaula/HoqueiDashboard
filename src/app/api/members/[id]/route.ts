import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { updateMemberSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewMembers')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const member = await db.member.findUnique({
      where: { id },
      include: { quotas: { orderBy: [{ year: 'desc' }, { month: 'desc' }] } },
    })

    if (!member) return NextResponse.json({ error: 'Sócio não encontrado' }, { status: 404 })
    return NextResponse.json(member)
  } catch (error) {
    logger.error('Member GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editMembers')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const member = await db.member.update({ where: { id }, data: parsed.data })
    await logAudit(req, user.id, user.email, 'UPDATE', 'Member', (member as { id: string }).id, { name: (member as { name: string }).name })
    return NextResponse.json(member)
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Sócio não encontrado' }, { status: 404 })
    }
    logger.error('Member PUT error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editMembers')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    await db.member.delete({ where: { id } })
    await logAudit(req, user.id, user.email, 'DELETE', 'Member', id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Sócio não encontrado' }, { status: 404 })
    }
    logger.error('Member DELETE error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
