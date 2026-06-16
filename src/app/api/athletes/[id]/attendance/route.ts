import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'viewAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id: athleteId } = await params

    const records = await prisma.attendanceRecord.findMany({
      where: { athleteId },
      include: {
        session: {
          select: { id: true, date: true, time: true, primaryAgeGroup: true, sessionType: true, title: true, cancelled: true },
        },
      },
      orderBy: { session: { date: 'desc' } },
    })

    const athlete = await prisma.athlete.findUnique({ where: { id: athleteId }, select: { ageGroup: true } })

    // Derive season from date
    function dateToSeason(d: Date): string {
      const m = d.getMonth() + 1
      const y = d.getFullYear()
      return m >= 9 ? `${y}/${String(y + 1).slice(-2)}` : `${y - 1}/${String(y).slice(-2)}`
    }

    // Build per-season breakdown (regular sessions only)
    const seasonMap = new Map<string, { total: number; present: number; ownTotal: number; ownPresent: number; otherTotal: number; otherPresent: number }>()
    for (const r of records.filter((r) => r.session.sessionType !== 'SPECIFIC' && !r.session.cancelled)) {
      const season = dateToSeason(new Date(r.session.date))
      if (!seasonMap.has(season)) {
        seasonMap.set(season, { total: 0, present: 0, ownTotal: 0, ownPresent: 0, otherTotal: 0, otherPresent: 0 })
      }
      const s = seasonMap.get(season)!
      s.total++
      if (r.present) s.present++
      const isOwn = r.session.primaryAgeGroup === athlete?.ageGroup
      if (isOwn) { s.ownTotal++; if (r.present) s.ownPresent++ }
      else { s.otherTotal++; if (r.present) s.otherPresent++ }
    }

    const bySeason = Array.from(seasonMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([season, stats]) => ({ season, ...stats }))

    const recent = records

    // Specific training stats
    const specificRecords = records.filter((r) => r.session.sessionType === 'SPECIFIC' && !r.session.cancelled)
    const specificStats = {
      total: specificRecords.length,
      attended: specificRecords.filter((r) => r.present).length,
      paid: specificRecords.filter((r) => r.present && r.paidByAthlete).length,
      totalPaid: specificRecords.filter((r) => r.present && r.paidByAthlete)
        .reduce((sum, r) => sum + (r.paidAmount ?? 0), 0),
      sessions: specificRecords.filter((r) => r.present).map((r) => ({
        sessionId: r.sessionId,
        date: r.session.date,
        title: r.session.title,
        paidByAthlete: r.paidByAthlete,
        paidAmount: r.paidAmount,
      })).slice(0, 10),
    }

    // For general stats, exclude SPECIFIC sessions
    const regularRecords = records.filter((r) => r.session.sessionType !== 'SPECIFIC' && !r.session.cancelled)

    return NextResponse.json({
      total: regularRecords.length,
      present: regularRecords.filter((r) => r.present).length,
      ownTotal: regularRecords.filter((r) => r.session.primaryAgeGroup === athlete?.ageGroup).length,
      ownPresent: regularRecords.filter((r) => r.present && r.session.primaryAgeGroup === athlete?.ageGroup).length,
      otherTotal: regularRecords.filter((r) => r.session.primaryAgeGroup !== athlete?.ageGroup).length,
      otherPresent: regularRecords.filter((r) => r.present && r.session.primaryAgeGroup !== athlete?.ageGroup).length,
      bySeason,
      specific: specificStats,
      recent: recent.filter((r) => r.session.sessionType !== 'SPECIFIC').slice(0, 8).map((r) => ({
        sessionId: r.sessionId,
        present: r.present,
        date: r.session.date,
        time: r.session.time,
        sessionType: r.session.sessionType,
        title: r.session.title,
        primaryAgeGroup: r.session.primaryAgeGroup,
      })),
    })
  } catch (error) {
    logger.error('Athlete attendance GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
