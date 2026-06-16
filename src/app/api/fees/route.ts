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
    const seasonStart = searchParams.get('season')
      ? parseInt(searchParams.get('season')!)
      : getCurrentSeasonStart()
    const ageGroup = searchParams.get('ageGroup') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const seasonEnd = seasonStart + 1

    const where = {
      ageGroup: { not: 'SENIORS' as never },
      ...(ageGroup ? { ageGroup: ageGroup as never } : {}),
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const isMonthPast = (month: number, year: number) =>
      year < currentYear || (year === currentYear && month < currentMonth)

    // Get summary from ALL athletes (not paginated)
    const allAthletes = await db.athlete.findMany({
      where,
      include: {
        payments: {
          where: {
            OR: [
              { year: seasonStart, month: { in: SEASON_MONTHS_FIRST_HALF } },
              { year: seasonEnd, month: { in: SEASON_MONTHS_SECOND_HALF } },
            ],
          },
        },
      },
    }) as unknown as AthleteWithPayments[]

    let totalCollected = 0
    let totalPending = 0
    let athletesFullyPaid = 0
    let athletesWithArrears = 0

    for (const athlete of allAthletes) {
      const paymentsMap = new Map(athlete.payments.map((p) => [`${p.year}-${p.month}`, p]))
      let hasArrears = false
      let allPastPaid = true

      for (const month of SEASON_MONTHS_FIRST_HALF) {
        const payment = paymentsMap.get(`${seasonStart}-${month}`)
        if (payment?.paid && payment.amount != null) totalCollected += payment.amount
        if (!athlete.feeExempt && athlete.monthlyFee > 0 && isMonthPast(month, seasonStart) && !payment?.paid) {
          hasArrears = true; allPastPaid = false; totalPending += athlete.monthlyFee
        }
      }
      for (const month of SEASON_MONTHS_SECOND_HALF) {
        const payment = paymentsMap.get(`${seasonEnd}-${month}`)
        if (payment?.paid && payment.amount != null) totalCollected += payment.amount
        if (!athlete.feeExempt && athlete.monthlyFee > 0 && isMonthPast(month, seasonEnd) && !payment?.paid) {
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
          where: {
            OR: [
              { year: seasonStart, month: { in: SEASON_MONTHS_FIRST_HALF } },
              { year: seasonEnd, month: { in: SEASON_MONTHS_SECOND_HALF } },
            ],
          },
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
      page,
      pages,
      total,
    })
  } catch (error) {
    logger.error('Fees GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
