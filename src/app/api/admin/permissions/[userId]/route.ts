import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const permissionsSchema = z.object({
  viewAthletes: z.boolean(), editAthletes: z.boolean(),
  viewFees: z.boolean(), editFees: z.boolean(),
  viewMembers: z.boolean(), editMembers: z.boolean(),
  viewMaterials: z.boolean(), editMaterials: z.boolean(),
  viewSponsors: z.boolean(), manageSponsors: z.boolean(),
  viewTraining: z.boolean(), editTraining: z.boolean(),
  viewTravel: z.boolean(), editTravel: z.boolean(),
  viewDirection: z.boolean(), editDirection: z.boolean(),
  viewAttendance: z.boolean(), editAttendance: z.boolean(),
  viewTextiles: z.boolean(), editTextiles: z.boolean(),
  isAdmin: z.boolean(),
})

export async function PUT(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, clubId } = ctx
    if (!hasPermission(user.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId, clubId } })
    if (!targetUser) return NextResponse.json({ error: 'Utilizador não encontrado' }, { status: 404 })

    const body = await req.json()
    const parsed = permissionsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    // Um admin nunca pode remover o próprio isAdmin — chegar aqui já exige isAdmin (linha
    // acima), por isso userId === user.id implica que é o único caminho de acesso a esta
    // página para si próprio; sem esta proteção ficaria trancado de /admin/* sem forma de
    // recuperar dentro da app (super admin não acede ao dashboard de clubes, regra 12).
    if (userId === user.id) {
      data.isAdmin = true
    }

    const permissions = await prisma.permission.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    })

    // Invalidate the target user's existing JWT so new permissions take effect immediately
    await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } })

    await logAudit(req, user.id, user.email, 'CHANGE_PERMISSIONS', 'User', userId, data)
    return NextResponse.json(permissions)
  } catch (error) {
    logger.error('Admin permissions PUT error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
