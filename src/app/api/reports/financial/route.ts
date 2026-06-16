import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { buildXlsx, XLSX_HEADERS } from '@/lib/xlsx'
import { SEASON_MONTHS, MONTH_LABELS, AGE_GROUP_LABELS as AGE_LABELS } from '@/lib/constants'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewFees')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const defaultSeason = currentMonth >= 9 ? now.getFullYear() : now.getFullYear() - 1
    const season = parseInt(searchParams.get('season') ?? String(defaultSeason))

    const athletes = await db.athlete.findMany({
      where: { ageGroup: { not: 'SENIORS' } },
      include: {
        payments: {
          where: {
            OR: [
              { year: season, month: { gte: 9 } },
              { year: season + 1, month: { lte: 6 } },
            ],
          },
        },
      },
      orderBy: [{ ageGroup: 'asc' }, { number: 'asc' }],
    }) as unknown as Array<{
      number: number; name: string; ageGroup: string; feeExempt: boolean; monthlyFee: number;
      payments: Array<{ month: number; year: number; paid: boolean; amount: number | null }>;
    }>

    const monthHeaders = SEASON_MONTHS.map((m: number) => {
      const year = m >= 9 ? season : season + 1
      return `${MONTH_LABELS[m]} ${year}`
    })

    const headers = ['N.º', 'Nome', 'Escalão', 'Isento', 'Mensalidade (€)', ...monthHeaders, 'Total Pago (€)', 'Em Falta (€)']

    const rows = athletes.map((a) => {
      const paidMonths = SEASON_MONTHS.map((m: number) => {
        const year = m >= 9 ? season : season + 1
        const p = a.payments.find((pay) => pay.month === m && pay.year === year)
        return p?.paid ? (p.amount ?? a.monthlyFee) : null
      })

      const totalPaid = paidMonths.reduce<number>((s, v) => s + (v ?? 0), 0)
      const expectedMonths = a.feeExempt ? 0 : SEASON_MONTHS.length
      const missing = Math.max(0, a.monthlyFee * expectedMonths - totalPaid)

      return [
        a.number, a.name, AGE_LABELS[a.ageGroup] ?? a.ageGroup,
        a.feeExempt ? 'Sim' : 'Não',
        a.monthlyFee,
        ...paidMonths.map((v) => v ?? ''),
        totalPaid,
        missing,
      ]
    })

    const buffer = await buildXlsx('Financeiro', headers, rows)
    const filename = `financeiro-${season}-${season + 1}.xlsx`

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
