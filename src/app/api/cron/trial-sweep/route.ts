import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

// Corrido 1x/dia pela Vercel Cron (ver vercel.json) — suspende clubes cujo trial de 14 dias
// (Club.trialEndsAt, definido em /api/register) passou sem terem escolhido/pago um plano
// (stripeSubscriptionId continua null). Idempotente: correr duas vezes no mesmo dia não
// tem efeito extra (updateMany só apanha quem ainda está ACTIVE).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const expired = await prisma.club.findMany({
      where: {
        status: 'ACTIVE',
        isFreeClub: false,
        stripeSubscriptionId: null,
        trialEndsAt: { lte: new Date() },
      },
      select: { id: true, name: true, email: true },
    })

    if (expired.length === 0) {
      return NextResponse.json({ suspended: 0 })
    }

    await prisma.club.updateMany({
      where: { id: { in: expired.map((c) => c.id) } },
      data: { status: 'SUSPENDED', statusChangedAt: new Date() },
    })

    for (const club of expired) {
      await logAudit(req, null, club.email, 'CHANGE_CLUB_STATUS', 'Club', club.id, {
        previousStatus: 'ACTIVE',
        newStatus: 'SUSPENDED',
        reason: 'trial_expired',
      }, club.id)
    }

    logger.info(`Trial sweep: suspended ${expired.length} club(s)`, { clubIds: expired.map((c) => c.id) })
    return NextResponse.json({ suspended: expired.length })
  } catch (error) {
    logger.error('Trial sweep error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
