import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const entity = searchParams.get('entity') ?? ''
    const action = searchParams.get('action') ?? ''
    const before = searchParams.get('before') ?? ''

    // Always show login attempts; exclude admin actions from everything else
    const adminPerms = await prisma.permission.findMany({
      where: { isAdmin: true, user: { clubId: ctx.clubId } },
      select: { userId: true },
    })
    const adminIds = adminPerms.map((p: { userId: string }) => p.userId)

    const where = {
      ...(adminIds.length > 0 ? {
        OR: [
          { action: { in: ['LOGIN', 'LOGIN_FAIL'] } },
          {
            action: { notIn: ['LOGIN', 'LOGIN_FAIL'] },
            NOT: { userId: { in: adminIds } },
          },
        ],
      } : {}),
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    }

    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
    })

    const filename = `auditoria-${new Date().toISOString().split('T')[0]}.json`
    return new NextResponse(JSON.stringify(logs, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    logger.error('Audit export error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
