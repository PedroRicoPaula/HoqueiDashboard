import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rateLimit'

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user?.isSuperAdmin) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // SEC-036: mesmo limite do endpoint irmão POST /api/platform/clubs — eliminação é
    // irreversível, faz sentido ter pelo menos o mesmo travão que a criação.
    const rl = await checkRateLimit(`platform:delete-club:${user.id}`, { windowMs: 60 * 60 * 1000, max: 20 })
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Demasiados pedidos. Tente mais tarde.' }, { status: 429 })
    }

    const { id } = await params
    const club = await prisma.club.findUnique({
      where: { id },
      include: { _count: { select: { athletes: true, users: true } } },
    })
    if (!club) {
      return NextResponse.json({ error: 'Clube não encontrado' }, { status: 404 })
    }

    if (club.isFreeClub) {
      if (club.status !== 'SUSPENDED') {
        return NextResponse.json(
          { error: 'O clube grátis tem de estar suspenso para ser eliminado' },
          { status: 422 }
        )
      }
    } else {
      if (club.status !== 'SUSPENDED') {
        return NextResponse.json(
          { error: 'O clube pago tem de estar suspenso para ser eliminado' },
          { status: 422 }
        )
      }
      const changedAt = club.statusChangedAt ?? club.updatedAt
      const ageMs = Date.now() - changedAt.getTime()
      if (ageMs < ONE_YEAR_MS) {
        const daysLeft = Math.ceil((ONE_YEAR_MS - ageMs) / (24 * 60 * 60 * 1000))
        return NextResponse.json(
          { error: `O clube pago só pode ser eliminado após 1 ano em atraso. Faltam ${daysLeft} dia(s).` },
          { status: 422 }
        )
      }
    }

    // Snapshot details before cascade delete (for audit trail after the fact)
    const auditDetails = {
      clubName: club.name,
      clubEmail: club.email,
      isFreeClub: club.isFreeClub,
      status: club.status,
      athleteCount: club._count.athletes,
      userCount: club._count.users,
    }

    await prisma.club.delete({ where: { id } })

    // Log after delete so it uses the global prisma (not scoped to the now-deleted club)
    await logAudit(req, user.id, user.email, 'DELETE_CLUB', 'Club', id, auditDetails)

    return NextResponse.json({ deleted: true })
  } catch (error) {
    logger.error('Platform delete club error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
