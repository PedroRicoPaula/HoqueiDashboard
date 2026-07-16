import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { logger } from '@/lib/logger'

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user?.isSuperAdmin) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const club = await prisma.club.findUnique({ where: { id } })
    if (!club) {
      return NextResponse.json({ error: 'Clube não encontrado' }, { status: 404 })
    }

    if (club.isFreeClub) {
      // Free club: can only delete if SUSPENDED
      if (club.status !== 'SUSPENDED') {
        return NextResponse.json(
          { error: 'O clube grátis tem de estar suspenso para ser eliminado' },
          { status: 422 }
        )
      }
    } else {
      // Paid club: can delete if SUSPENDED (was PAST_DUE) and status changed 1+ year ago
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

    // Cascade delete — Prisma cascades handle all related records via onDelete: Cascade
    await prisma.club.delete({ where: { id } })

    return NextResponse.json({ deleted: true })
  } catch (error) {
    logger.error('Platform delete club error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
