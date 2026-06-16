import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { buildXlsx, XLSX_HEADERS } from '@/lib/xlsx'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewMaterials')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const materials = await db.material.findMany({
      include: { athlete: { select: { number: true, name: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }) as unknown as Array<{
      name: string; category: string; type: string; state: string; notes: string | null;
      athlete: { number: number; name: string } | null;
    }>

    const CAT_LABELS: Record<string, string> = { ATHLETE: 'Atleta', GOALKEEPER: 'Guarda-Redes', SMALL: 'Pequeno Material' }
    const STATE_LABELS: Record<string, string> = { FREE: 'Livre', ASSIGNED: 'Atribuído', DAMAGED: 'Danificado' }

    const headers = ['Nome', 'Categoria', 'Tipo', 'Estado', 'Atleta N.º', 'Atleta Nome', 'Notas']
    const rows = materials.map((m) => [
      m.name,
      CAT_LABELS[m.category] ?? m.category,
      m.type,
      STATE_LABELS[m.state] ?? m.state,
      m.athlete?.number ?? '',
      m.athlete?.name ?? '',
      m.notes ?? '',
    ])

    const buffer = await buildXlsx('Materiais', headers, rows)
    const filename = `materiais-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': XLSX_HEADERS.contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    logger.error('Reports materials error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
