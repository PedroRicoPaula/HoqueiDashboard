import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { buildXlsx, XLSX_HEADERS } from '@/lib/xlsx'
import { TEXTILE_TYPE_LABELS, TEXTILE_CATEGORY_LABELS, TEXTILE_STATE_LABELS } from '@/lib/constants'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewTextiles')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const season = searchParams.get('season')

    const items = await db.textileItem.findMany({
      where: season ? { season } : {},
      orderBy: [{ season: 'desc' }, { category: 'asc' }, { type: 'asc' }],
      include: { athlete: { select: { number: true, name: true } } },
    }) as unknown as Array<{
      season: string; category: string; type: string; size: string;
      jerseyNumber: string | null; personalized: boolean; state: string;
      totalCost: number | null; paidAmount: number | null; paidByAthlete: boolean;
      athlete: { number: number; name: string } | null;
    }>

    const headers = ['Época', 'Categoria', 'Tipo', 'Tamanho', 'Nº Camisola', 'Personalizado', 'Estado', 'Atleta', 'Custo Total (€)', 'Pago Atleta (€)', 'Pago Pelo Atleta']

    const rows = items.map((i) => [
      i.season,
      TEXTILE_CATEGORY_LABELS[i.category] ?? i.category,
      TEXTILE_TYPE_LABELS[i.type] ?? i.type,
      i.size,
      i.jerseyNumber ?? '',
      i.personalized ? 'Sim' : 'Não',
      TEXTILE_STATE_LABELS[i.state] ?? i.state,
      i.athlete ? `#${i.athlete.number} ${i.athlete.name}` : '',
      i.totalCost ?? '',
      i.paidAmount ?? '',
      i.paidByAthlete ? 'Sim' : 'Não',
    ])

    const buffer = await buildXlsx('Têxteis', headers, rows)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': XLSX_HEADERS.contentType,
        'Content-Disposition': 'attachment; filename="texteis.xlsx"',
      },
    })
  } catch (error) {
    logger.error('Reports textiles GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
