import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const schema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user?.isSuperAdmin) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }

    const club = await prisma.club.findUnique({ where: { id } })
    if (!club) {
      return NextResponse.json({ error: 'Clube não encontrado' }, { status: 404 })
    }

    const { status: newStatus } = parsed.data
    const previousStatus = club.status

    // Business rules
    if (club.isFreeClub) {
      if (newStatus !== 'ACTIVE' && newStatus !== 'SUSPENDED') {
        return NextResponse.json({ error: 'Clube grátis só pode ser ACTIVE ou SUSPENDED' }, { status: 422 })
      }
    } else {
      if (newStatus === 'SUSPENDED' && club.status !== 'PAST_DUE' && club.status !== 'CANCELLED') {
        return NextResponse.json(
          { error: 'Clubes pagos só podem ser suspensos se tiverem pagamento em atraso (PAST_DUE)' },
          { status: 422 }
        )
      }
      if (newStatus === 'ACTIVE' && club.status !== 'SUSPENDED') {
        return NextResponse.json(
          { error: 'Só é possível ativar um clube pago que esteja suspenso' },
          { status: 422 }
        )
      }
    }

    const updated = await prisma.club.update({
      where: { id },
      data: { status: newStatus, statusChangedAt: new Date() },
    })

    await logAudit(req, user.id, user.email, 'CHANGE_CLUB_STATUS', 'Club', id, {
      previousStatus,
      newStatus,
      isFreeClub: club.isFreeClub,
      clubName: club.name,
    })

    return NextResponse.json({ id: updated.id, status: updated.status })
  } catch (error) {
    logger.error('Platform status update error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
