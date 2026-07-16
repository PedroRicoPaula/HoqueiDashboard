import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'

const SEASON_MONTHS_FIRST_HALF = [9, 10, 11, 12]
const SEASON_MONTHS_SECOND_HALF = [1, 2, 3, 4, 5, 6]
const PAGE_SIZE = 25

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

type AthleteWithPayments = {
  id: string; number: number; name: string; ageGroup: string;
  monthlyFee: number; feeExempt: boolean;
  payments: { year: number; month: number; paid: boolean; amount: number | null }[]
}

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewFees')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const seasonId = searchParams.get('seasonId') || null
    const ageGroup = searchParams.get('ageGroup') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))

    // Compute months — from Season record or hardcoded fallback
    let months: Array<{ year: number; month: number }>
    let seasonStart: number
    let seasonLabel: string | undefined

    if (seasonId) {
      const season = await db.season.findUnique({ where: { id: seasonId } })
      if (!season) return NextResponse.json({ error: 'Época não encontrada' }, { status: 404 })
      months = computeSeasonMonths(new Date((season as { startDate: Date }).startDate), new Date((season as { endDate: Date }).endDate))
      seasonStart = new Date((season as { startDate: Date }).startDate).getFullYear()
      seasonLabel = (season as { name: string }).name
    } else {
      const yearParam = searchParams.get('season')
      seasonStart = yearParam ? parseInt(yearParam) : getCurrentSeasonStart()
      const seasonEnd = seasonStart + 1
      months = [
        ...SEASON_MONTHS_FIRST_HALF.map((month) => ({ year: seasonStart, month })),
        ...SEASON_MONTHS_SECOND_HALF.map((month) => ({ year: seasonEnd, month })),
      ]
    }

    const where = {
      ageGroup: { not: 'SENIORS' as never },
      ...(ageGroup ? { ageGroup: ageGroup as never } : {}),
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const isMonthPast = (month: number, year: number) =>
      year < currentYear || (year === currentYear && month < currentMonth)

    // Payment filter: OR of all season month/year pairs
    const paymentWhere = {
      OR: months.map(({ year, month }) => ({ year, month })),
    }

    // Get summary from ALL athletes (not paginated)
    const allAthletes = await db.athlete.findMany({
      where,
      include: { payments: { where: paymentWhere } },
    }) as unknown as AthleteWithPayments[]

    let totalCollected = 0
    let totalPending = 0
    let athletesFullyPaid = 0
    let athletesWithArrears = 0

    for (const athlete of allAthletes) {
      const paymentsMap = new Map(athlete.payments.map((p) => [`${p.year}-${p.month}`, p]))
      let hasArrears = false
      let allPastPaid = true

      for (const { year, month } of months) {
        const payment = paymentsMap.get(`${year}-${month}`)
        if (payment?.paid && payment.amount != null) totalCollected += payment.amount
        if (!athlete.feeExempt && athlete.monthlyFee > 0 && isMonthPast(month, year) && !payment?.paid) {
          hasArrears = true; allPastPaid = false; totalPending += athlete.monthlyFee
        }
      }

      if (!athlete.feeExempt && athlete.monthlyFee > 0) {
        if (hasArrears) athletesWithArrears++
        else if (allPastPaid) athletesFullyPaid++
      }
    }

    const total = allAthletes.length
    const pages = Math.ceil(total / PAGE_SIZE)

    // Get paginated athletes with payments
    const athletes = await db.athlete.findMany({
      where,
      include: {
        payments: {
          where: paymentWhere,
          orderBy: [{ year: 'asc' }, { month: 'asc' }],
        },
      },
      orderBy: { number: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }) as unknown as AthleteWithPayments[]

    const athletesData = athletes.map((athlete) => ({
      id: athlete.id,
      number: athlete.number,
      name: athlete.name,
      ageGroup: athlete.ageGroup,
      monthlyFee: athlete.monthlyFee,
      feeExempt: athlete.feeExempt,
      payments: athlete.payments,
    }))

    return NextResponse.json({
      athletes: athletesData,
      summary: {
        totalCollected,
        totalPending,
        athletesFullyPaid,
        athletesWithArrears,
        totalAthletes: total,
        exemptAthletes: allAthletes.filter((a) => a.feeExempt).length,
      },
      seasonStart,
      seasonLabel,
      months,
      page,
      pages,
      total,
    })
  } catch (error) {
    logger.error('Fees GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
