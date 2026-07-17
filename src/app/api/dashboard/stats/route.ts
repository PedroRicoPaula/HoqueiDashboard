import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { logger } from '@/lib/logger'

function getCurrentSeasonStart(): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= 9 ? year : year - 1
}

function computeSeasonMonths(startDate: Date, endDate: Date): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = []
  const d = new Date(startDate)
  d.setDate(1)
  const end = new Date(endDate)
  while (d <= end) {
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
    d.setMonth(d.getMonth() + 1)
  }
  return months
}

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { db } = ctx

    const { searchParams } = new URL(req.url)
    const seasonId = searchParams.get('seasonId') || null

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    let seasonStart: number
    let seasonEnd: number
    let seasonLabelStr: string
    let allSeasonMonths: Array<{ year: number; month: number }>
    let seasonFilter: { seasonId: string } | Record<string, never> = {}

    let seasonDefaultAthleteMonthlyFee: number | null = null

    if (seasonId) {
      const season = await db.season.findUnique({ where: { id: seasonId } })
      if (!season) return NextResponse.json({ error: 'Época não encontrada' }, { status: 404 })
      const s = season as { name: string; startDate: Date; endDate: Date; defaultAthleteMonthlyFee: number | null }
      seasonLabelStr = s.name
      seasonStart = new Date(s.startDate).getFullYear()
      seasonEnd = new Date(s.endDate).getFullYear()
      allSeasonMonths = computeSeasonMonths(new Date(s.startDate), new Date(s.endDate))
      seasonFilter = { seasonId }
      seasonDefaultAthleteMonthlyFee = s.defaultAthleteMonthlyFee
    } else {
      seasonStart = getCurrentSeasonStart()
      seasonEnd = seasonStart + 1
      seasonLabelStr = `${seasonStart}/${(seasonStart + 1).toString().slice(-2)}`
      allSeasonMonths = [
        ...[9, 10, 11, 12].map(m => ({ year: seasonStart, month: m })),
        ...[1, 2, 3, 4, 5, 6].map(m => ({ year: seasonEnd, month: m })),
      ]
    }

    // Past months from the season range
    const pastSeasonMonths = allSeasonMonths.filter(({ year, month }) =>
      year < currentYear || (year === currentYear && month < currentMonth)
    )
    const totalPastSeasonMonths = pastSeasonMonths.length

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
      db.athlete.count(),
      db.member.count({ where: Object.keys(seasonFilter).length ? seasonFilter : undefined }),
      db.sponsor.count({ where: Object.keys(seasonFilter).length ? seasonFilter : undefined }),
      db.material.count({ where: Object.keys(seasonFilter).length ? seasonFilter : undefined }),
      db.athlete.groupBy({ by: ['ageGroup'], _count: { id: true } }),
      db.material.groupBy({ by: ['state'], _count: { id: true } }),
      db.travel.findMany({
        where: { departureDate: { gte: now } },
        orderBy: { departureDate: 'asc' },
        take: 5,
      }),
      db.sponsor.findMany({
        where: { contractEnd: { lte: thirtyDaysFromNow, gte: now } },
        orderBy: { contractEnd: 'asc' },
      }),
      db.quota.count({
        where: {
          paid: false,
          OR: [
            { year: { lt: currentYear } },
            { year: currentYear, month: { lt: currentMonth } },
          ],
        },
      }),
      // Athletes with late payments — full season range, not just current year
      totalPastSeasonMonths > 0
        ? db.athlete.findMany({
            where: { feeExempt: false, ageGroup: { not: 'SENIORS' } },
            select: {
              id: true,
              monthlyFee: true,
              discountPercent: true,
              payments: {
                where: {
                  paid: true,
                  OR: pastSeasonMonths.map(({ year, month }) => ({ year, month })),
                },
                select: { id: true },
              },
            },
          })
        : Promise.resolve([] as { id: string; monthlyFee: number; discountPercent: number | null; payments: { id: string }[] }[]),
      // Athlete fee revenue for current season
      allSeasonMonths.length > 0
        ? db.athletePayment.aggregate({
            _sum: { amount: true },
            where: {
              paid: true,
              OR: allSeasonMonths.map(({ year, month }) => ({ year, month })),
            },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      // Member quotas paid — use stored amount, fallback to current monthlyQuota
      db.quota.findMany({
        where: { paid: true, year: currentYear, ...seasonFilter },
        select: { amount: true, member: { select: { monthlyQuota: true } } },
      }),
      // Active sponsor annual contributions
      db.sponsor.aggregate({
        _sum: { annualContribution: true },
        where: { contractEnd: { gte: now }, ...seasonFilter },
      }),
      // Total material cost (filtered by season if selected)
      db.material.aggregate({
        _sum: { paidAmount: true },
        where: Object.keys(seasonFilter).length ? seasonFilter : undefined,
      }),
      // Material savings (paid by athlete, filtered by season)
      db.material.aggregate({
        _sum: { paidAmount: true },
        where: { paidByAthlete: true, ...(Object.keys(seasonFilter).length ? seasonFilter : {}) },
      }),
      // Attendance: sessions in last 30 days
      db.trainingSession.count({
        where: { date: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      // Attendance: records in last 30 days
      db.attendanceRecord.aggregate({
        _count: { id: true },
        where: {
          present: true,
          session: { date: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
        },
      }),
      // Textile: total count assigned (filtered by season if selected)
      db.textileItem.count({ where: { state: 'ASSIGNED', ...(Object.keys(seasonFilter).length ? seasonFilter : {}) } }),
      // Textile: savings (paid by athlete, filtered by season)
      db.textileItem.aggregate({
        _sum: { paidAmount: true },
        where: { paidByAthlete: true, ...(Object.keys(seasonFilter).length ? seasonFilter : {}) },
      }),
      // Textile: cost paid by club (filtered by season)
      db.textileItem.aggregate({
        _sum: { paidAmount: true },
        where: { paidByAthlete: false, paidAmount: { not: null }, ...(Object.keys(seasonFilter).length ? seasonFilter : {}) },
      }),
      // Direction: salaries paid this year
      db.directionSalaryPayment.aggregate({
        _sum: { amount: true },
        where: { paid: true, year: currentYear },
      }),
    ])

    // Athletes with late payments: those with effectiveFee > 0 and paid months < past season months
    const athletesWithLatePayments = (athletePaymentData as { id: string; monthlyFee: number; discountPercent: number | null; payments: { id: string }[] }[]).filter(
      (a) => {
        const base = seasonDefaultAthleteMonthlyFee ?? a.monthlyFee
        const disc = a.discountPercent ?? 0
        const eff = base > 0 ? base * (1 - disc / 100) : 0
        return eff > 0 && a.payments.length < totalPastSeasonMonths
      }
    ).length

    // Compute total member quotas collected (use stored amount; fallback to current monthlyQuota for old records)
    const totalMemberQuotaRevenue = (paidQuotasWithMembers as { amount: number | null; member: { monthlyQuota: number } }[]).reduce(
      (sum, q) => sum + (q.amount ?? q.member.monthlyQuota),
      0
    )

    const totalCost = (materialTotalCostAgg as { _sum: { paidAmount: number | null } })._sum.paidAmount ?? 0
    const totalSavings = (materialSavingsAgg as { _sum: { paidAmount: number | null } })._sum.paidAmount ?? 0

    return NextResponse.json({
      attendance: {
        sessionsLast30Days: attendanceSessionsRecent,
        presencesLast30Days: (attendanceRecordsRecent as { _count: { id: number } })._count.id,
      },
      textiles: {
        assignedCount: textileCount,
        savedByAthletes: (textileSavingsAgg as { _sum: { paidAmount: number | null } })._sum.paidAmount ?? 0,
        clubCost: (textileClubCostAgg as { _sum: { paidAmount: number | null } })._sum.paidAmount ?? 0,
      },
      counts: {
        athletes: athleteCount,
        members: memberCount,
        sponsors: sponsorCount,
        materials: materialCount,
      },
      // aliases for easier E2E test assertions
      totalAthletes: athleteCount,
      totalMembers: memberCount,
      totalSponsors: sponsorCount,
      athletesByAgeGroup: (athletesByAgeGroup as { ageGroup: string; _count: { id: number } }[]).map((g) => ({ ageGroup: g.ageGroup, count: g._count.id })),
      materialsByState: (materialsByState as { state: string; _count: { id: number } }[]).map((g) => ({ state: g.state, count: g._count.id })),
      upcomingTravels,
      expiringSponsors,
      lateQuotas,
      athletesWithLatePayments,
      revenue: {
        seasonLabel: seasonLabelStr,
        athleteFees: (athleteFeeRevenue as { _sum: { amount: number | null } })._sum.amount ?? 0,
        memberQuotas: totalMemberQuotaRevenue,
        sponsors: (sponsorRevenueAgg as { _sum: { annualContribution: number | null } })._sum.annualContribution ?? 0,
      },
      materialCosts: {
        total: totalCost,
        savedByAthletes: totalSavings,
        clubCost: totalCost - totalSavings,
      },
      expenses: {
        year: currentYear,
        materialsClubCost: totalCost - totalSavings,
        textilesClubCost: (textileClubCostAgg as { _sum: { paidAmount: number | null } })._sum.paidAmount ?? 0,
        directionSalaries: (directionSalariesAgg as { _sum: { amount: number | null } })._sum.amount ?? 0,
      },
    })
  } catch (error) {
    logger.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
