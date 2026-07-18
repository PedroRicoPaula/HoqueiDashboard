import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { buildXlsx, XLSX_HEADERS } from '@/lib/xlsx'

const MONTH_NAMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewMembers')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
    const seasonId = searchParams.get('seasonId') || null

    const members = await db.member.findMany({
      where: seasonId ? { seasonId } : {},
      orderBy: { number: 'asc' },
      include: {
        quotas: {
          where: { year },
          select: { month: true, paid: true, amount: true },
        },
      },
    }) as unknown as Array<{
      number: number; name: string; phone: string | null; email: string | null;
      address: string | null; monthlyQuota: number;
      quotas: Array<{ month: number; paid: boolean; amount: number | null }>;
    }>

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const monthHeaders = Array.from({ length: 12 }, (_, i) => MONTH_NAMES[i + 1])
    const headers = ['N.º', 'Nome', 'Telefone', 'Email', 'Morada', 'Quota Mensal (€)', ...monthHeaders, 'Total Pago (€)', 'Em Atraso']

    const rows = members.map((m) => {
      const monthValues = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1
        const quota = m.quotas.find((q) => q.month === month)
        return quota?.paid ? (quota.amount ?? m.monthlyQuota) : null
      })
      const totalPaid = monthValues.reduce<number>((s, v) => s + (v ?? 0), 0)
      const pastMonths = year < currentYear ? 12 : year === currentYear ? currentMonth - 1 : 0
      const lateMonths = Array.from({ length: pastMonths }, (_, i) => i + 1).filter((month) => {
        const quota = m.quotas.find((q) => q.month === month)
        return !quota?.paid && m.monthlyQuota > 0
      }).length

      return [
        m.number, m.name, m.phone ?? '', m.email ?? '', m.address ?? '',
        m.monthlyQuota,
        ...monthValues.map((v) => v ?? ''),
        totalPaid,
        lateMonths > 0 ? `${lateMonths} ${lateMonths === 1 ? 'mês' : 'meses'}` : 'Em dia',
      ]
    })

    const buffer = await buildXlsx('Sócios', headers, rows)
    const filename = `socios-${year}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': XLSX_HEADERS.contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    logger.error('Reports members error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
