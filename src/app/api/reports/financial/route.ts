import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { athleteMembershipWhere } from '@/lib/athleteMembership'
import { computeSeasonMonths, computeEffectiveFee, isMonthPast, getCurrentSeasonStart } from '@/lib/feeCalc'
import { logger } from '@/lib/logger'
import { buildXlsx, XLSX_HEADERS } from '@/lib/xlsx'
import { MONTH_LABELS, AGE_GROUP_LABELS as AGE_LABELS } from '@/lib/constants'

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

    // Mesma lógica de resolução de época que /api/fees — datas reais da Season quando
    // existe seasonId, com fallback para o cálculo Set-Jun por ano civil (compatibilidade
    // com o parâmetro `season` legado, sem Season real por trás).
    let months: Array<{ year: number; month: number }>
    let seasonStart: number
    let seasonDefaultFee: number | null = null
    let seasonWindow: { startDate: Date; endDate: Date } | null = null

    if (seasonId) {
      const season = await db.season.findUnique({ where: { id: seasonId } })
      if (!season) return NextResponse.json({ error: 'Época não encontrada' }, { status: 404 })
      const s = season as { startDate: Date; endDate: Date; defaultAthleteMonthlyFee: number | null }
      const start = new Date(s.startDate)
      const end = new Date(s.endDate)
      months = computeSeasonMonths(start, end)
      seasonStart = start.getFullYear()
      seasonDefaultFee = s.defaultAthleteMonthlyFee
      seasonWindow = { startDate: start, endDate: end }
    } else {
      const yearParam = searchParams.get('season')
      seasonStart = yearParam ? parseInt(yearParam) : getCurrentSeasonStart()
      const seasonEnd = seasonStart + 1
      months = [
        ...[9, 10, 11, 12].map((month) => ({ year: seasonStart, month })),
        ...[1, 2, 3, 4, 5, 6].map((month) => ({ year: seasonEnd, month })),
      ]
    }

    const athletes = await db.athlete.findMany({
      where: athleteMembershipWhere(seasonWindow),
      include: {
        payments: { where: { OR: months.map(({ year, month }) => ({ year, month })) } },
      },
      orderBy: [{ ageGroup: 'asc' }, { number: 'asc' }],
    }) as unknown as Array<{
      number: number; name: string; ageGroup: string; feeExempt: boolean;
      monthlyFee: number; discountPercent: number | null;
      payments: Array<{ month: number; year: number; paid: boolean; amount: number | null }>;
    }>

    const monthHeaders = months.map(({ year, month }) => `${MONTH_LABELS[month]} ${year}`)
    const headers = ['N.º', 'Nome', 'Escalão', 'Isento', 'Mensalidade (€)', ...monthHeaders, 'Total Pago (€)', 'Em Falta (€)']

    const rows = athletes.map((a) => {
      const effectiveFee = computeEffectiveFee(a.monthlyFee, a.discountPercent, seasonDefaultFee)
      let totalPaid = 0
      let missing = 0
      const paidMonths = months.map(({ year, month }) => {
        const p = a.payments.find((pay) => pay.month === month && pay.year === year)
        if (p?.paid) {
          const amount = p.amount ?? effectiveFee
          totalPaid += amount
          return amount
        }
        // Só conta como "em falta" um mês que já passou — um mês futuro ainda não é
        // devido, tal como na grelha de Mensalidades ao vivo (isMonthPast).
        if (!a.feeExempt && effectiveFee > 0 && isMonthPast(month, year)) {
          missing += effectiveFee
        }
        return null
      })

      return [
        a.number, a.name, AGE_LABELS[a.ageGroup] ?? a.ageGroup,
        a.feeExempt ? 'Sim' : 'Não',
        effectiveFee,
        ...paidMonths.map((v) => v ?? ''),
        totalPaid,
        missing,
      ]
    })

    const buffer = await buildXlsx('Financeiro', headers, rows)
    const filename = `financeiro-${seasonStart}-${seasonStart + 1}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': XLSX_HEADERS.contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    logger.error('Reports financial error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
