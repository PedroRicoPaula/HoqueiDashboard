import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { logger } from '@/lib/logger'

function getCurrentSeasonStart(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 9 ? year : year - 1
}

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const seasonStart = getCurrentSeasonStart()
    const seasonEnd = seasonStart + 1

    const [
      athleteCount,
      memberCount,
      sponsorCount,
      materialCount,
      athletesByAgeGroup,
      materialsByState,
      upcomingTravels,
      expiringSponsors,
      lateQuotas,
      athletePaymentData,
      // Revenue queries
      athleteFeeRevenue,
      paidQuotasWithMembers,
      sponsorRevenueAgg,
      // Material cost queries
      materialTotalCostAgg,
      materialSavingsAgg,
      // Attendance stats (last 30 days)
      attendanceSessionsRecent,
      attendanceRecordsRecent,
      // Textile stats
      textileCount,
      textileSavingsAgg,
      textileClubCostAgg,
      directionSalariesAgg,
    ] = await Promise.all([
      prisma.athlete.count(),
      prisma.member.count(),
      prisma.sponsor.count(),
      prisma.material.count(),
      prisma.athlete.groupBy({ by: ['ageGroup'], _count: { id: true } }),
      prisma.material.groupBy({ by: ['state'], _count: { id: true } }),
      prisma.travel.findMany({
        where: { departureDate: { gte: now } },
        orderBy: { departureDate: 'asc' },
        take: 5,
      }),
      prisma.sponsor.findMany({
        where: { contractEnd: { lte: thirtyDaysFromNow, gte: now } },
        orderBy: { contractEnd: 'asc' },
      }),
      prisma.quota.count({
        where: {
          paid: false,
          OR: [
            { year: { lt: currentYear } },
            { year: currentYear, month: { lt: currentMonth } },
          ],
        },
      }),
      // Athletes with late payments (current year, excluding seniors)
      currentMonth > 1
        ? prisma.athlete.findMany({
            where: { feeExempt: false, monthlyFee: { gt: 0 }, ageGroup: { not: 'SENIORS' } },
            select: {
              id: true,
              payments: {
                where: { year: currentYear, month: { lt: currentMonth }, paid: true },
                select: { id: true },
              },
            },
          })
        : Promise.resolve([] as { id: string; payments: { id: string }[] }[]),
      // Athlete fee revenue for current season
      prisma.athletePayment.aggregate({
        _sum: { amount: true },
        where: {
          paid: true,
          OR: [
            { year: seasonStart, month: { in: [9, 10, 11, 12] } },
            { year: seasonEnd, month: { in: [1, 2, 3, 4, 5, 6] } },
          ],
        },
      }),
      // Member quotas paid this year — use stored amount, fallback to current monthlyQuota
      prisma.quota.findMany({
        where: { paid: true, year: currentYear },
        select: { amount: true, member: { select: { monthlyQuota: true } } },
      }),
      // Active sponsor annual contributions
      prisma.sponsor.aggregate({
        _sum: { annualContribution: true },
        where: { contractEnd: { gte: now } },
      }),
      // Total material cost (all materials with a value set)
      prisma.material.aggregate({
        _sum: { paidAmount: true },
      }),
      // Material savings (paid by athlete)
      prisma.material.aggregate({
        _sum: { paidAmount: true },
        where: { paidByAthlete: true },
      }),
      // Attendance: sessions in last 30 days
      prisma.trainingSession.count({
        where: { date: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      // Attendance: records in last 30 days
      prisma.attendanceRecord.aggregate({
        _count: { id: true },
        where: {
          present: true,
          session: { date: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
        },
      }),
      // Textile: total count assigned
      prisma.textileItem.count({ where: { state: 'ASSIGNED' } }),
      // Textile: savings (paid by athlete)
      prisma.textileItem.aggregate({
        _sum: { paidAmount: true },
        where: { paidByAthlete: true },
      }),
      // Textile: cost paid by club (not by athlete)
      prisma.textileItem.aggregate({
        _sum: { paidAmount: true },
        where: { paidByAthlete: false, paidAmount: { not: null } },
      }),
      // Direction: salaries paid this year
      prisma.directionSalaryPayment.aggregate({
        _sum: { amount: true },
        where: { paid: true, year: currentYear },
      }),
    ])

    // Compute athletes with late payments
    const pastMonthsThisYear = currentMonth - 1
    const athletesWithLatePayments = athletePaymentData.filter(
      (a) => a.payments.length < pastMonthsThisYear
    ).length

    // Compute total member quotas collected (use stored amount; fallback to current monthlyQuota for old records)
    const totalMemberQuotaRevenue = paidQuotasWithMembers.reduce(
      (sum, q) => sum + (q.amount ?? q.member.monthlyQuota),
      0
    )

    const totalCost = materialTotalCostAgg._sum.paidAmount ?? 0
    const totalSavings = materialSavingsAgg._sum.paidAmount ?? 0

    return NextResponse.json({
      attendance: {
        sessionsLast30Days: attendanceSessionsRecent,
        presencesLast30Days: attendanceRecordsRecent._count.id,
      },
      textiles: {
        assignedCount: textileCount,
        savedByAthletes: textileSavingsAgg._sum.paidAmount ?? 0,
        clubCost: textileClubCostAgg._sum.paidAmount ?? 0,
      },
      counts: {
        athletes: athleteCount,
        members: memberCount,
        sponsors: sponsorCount,
        materials: materialCount,
      },
      athletesByAgeGroup: athletesByAgeGroup.map((g) => ({ ageGroup: g.ageGroup, count: g._count.id })),
      materialsByState: materialsByState.map((g) => ({ state: g.state, count: g._count.id })),
      upcomingTravels,
      expiringSponsors,
      lateQuotas,
      athletesWithLatePayments,
      revenue: {
        seasonLabel: `${seasonStart}/${(seasonStart + 1).toString().slice(-2)}`,
        athleteFees: athleteFeeRevenue._sum.amount ?? 0,
        memberQuotas: totalMemberQuotaRevenue,
        sponsors: sponsorRevenueAgg._sum.annualContribution ?? 0,
      },
      materialCosts: {
        total: totalCost,
        savedByAthletes: totalSavings,
        clubCost: totalCost - totalSavings,
      },
      expenses: {
        year: currentYear,
        materialsClubCost: totalCost - totalSavings,
        textilesClubCost: textileClubCostAgg._sum.paidAmount ?? 0,
        directionSalaries: directionSalariesAgg._sum.amount ?? 0,
      },
    })
  } catch (error) {
    logger.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
