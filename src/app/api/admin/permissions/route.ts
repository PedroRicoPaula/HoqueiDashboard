import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user } = ctx
    if (!hasPermission(user.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      where: { clubId: ctx.clubId },
      include: { permissions: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        permissions: u.permissions,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt ?? null,
      }))
    )
  } catch (error) {
    logger.error('Admin permissions GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
