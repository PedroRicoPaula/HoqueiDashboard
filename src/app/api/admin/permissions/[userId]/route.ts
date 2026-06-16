import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function PUT(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user } = ctx
    if (!hasPermission(user.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const {
      viewAthletes, editAthletes,
      viewFees, editFees,
      viewMembers, editMembers,
      viewMaterials, editMaterials,
      viewSponsors, manageSponsors,
      viewTraining, editTraining,
      viewTravel, editTravel,
      viewDirection, editDirection,
      viewAttendance, editAttendance,
      viewTextiles, editTextiles,
      isAdmin,
    } = body

    const data = {
      viewAthletes: Boolean(viewAthletes),
      editAthletes: Boolean(editAthletes),
      viewFees: Boolean(viewFees),
      editFees: Boolean(editFees),
      viewMembers: Boolean(viewMembers),
      editMembers: Boolean(editMembers),
      viewMaterials: Boolean(viewMaterials),
      editMaterials: Boolean(editMaterials),
      viewSponsors: Boolean(viewSponsors),
      manageSponsors: Boolean(manageSponsors),
      viewTraining: Boolean(viewTraining),
      editTraining: Boolean(editTraining),
      viewTravel: Boolean(viewTravel),
      editTravel: Boolean(editTravel),
      viewDirection: Boolean(viewDirection),
      editDirection: Boolean(editDirection),
      viewAttendance: Boolean(viewAttendance),
      editAttendance: Boolean(editAttendance),
      viewTextiles: Boolean(viewTextiles),
      editTextiles: Boolean(editTextiles),
      isAdmin: Boolean(isAdmin),
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
