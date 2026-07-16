import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const deleteAuditSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('all') }),
  z.object({ mode: z.literal('before'), before: z.string().datetime() }),
  z.object({ mode: z.literal('ids'), ids: z.array(z.string().uuid()).min(1).max(500) }),
])

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = 50
    const entity = searchParams.get('entity') ?? ''
    const action = searchParams.get('action') ?? ''
    const userId = searchParams.get('userId') ?? ''

    // Show: LOGIN_FAIL (anyone) + all actions from non-admin users
    const adminPerms = await prisma.permission.findMany({
      where: { isAdmin: true, user: { clubId: ctx.clubId } },
      select: { userId: true },
    })
    const adminIds = adminPerms.map((p: { userId: string }) => p.userId)

    const baseFilter = adminIds.length > 0
      ? { OR: [{ action: 'LOGIN_FAIL' as const }, { userId: { notIn: adminIds } }] }
      : {}

    const where = {
      ...baseFilter,
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
      ...(userId ? { userId } : {}),
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ])

    return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) })
  } catch (error) {
    logger.error('Audit log GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = deleteAuditSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parâmetros inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    let count = 0
    if (parsed.data.mode === 'all') {
      const result = await db.auditLog.deleteMany({})
      count = result.count
    } else if (parsed.data.mode === 'before') {
      const result = await db.auditLog.deleteMany({
        where: { createdAt: { lt: new Date(parsed.data.before) } },
      })
      count = result.count
    } else if (parsed.data.mode === 'ids') {
      const result = await db.auditLog.deleteMany({
        where: { id: { in: parsed.data.ids } },
      })
      count = result.count
    }

    await logAudit(req, user.id, user.email, 'DELETE', 'AuditLog', undefined, { mode: parsed.data.mode, count })
    return NextResponse.json({ deleted: count })
  } catch (error) {
    logger.error('Audit log DELETE error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
