import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { buildXlsx, XLSX_HEADERS } from '@/lib/xlsx'
import { computeAttendanceStats } from '@/lib/attendanceStats'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const ageGroup = searchParams.get('ageGroup')

    const stats = await computeAttendanceStats(db, ageGroup)

    const headers = ['Nº', 'Nome', 'Escalão', 'Total Sessões', 'Presenças', 'Faltas', '% Assiduidade', 'Treinos Próprios (Presenças)', 'Outros Escalões (Presenças)']

    const rows = stats.map((a) => {
      const pct = a.total > 0 ? Math.round((a.totalPresent / a.total) * 100) : 0
      return [a.number, a.name, a.ageGroup, a.total, a.totalPresent, a.total - a.totalPresent, `${pct}%`, a.ownPresent, a.otherPresent]
    })

    const buffer = await buildXlsx('Assiduidades', headers, rows)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': XLSX_HEADERS.contentType,
        'Content-Disposition': 'attachment; filename="assiduidades.xlsx"',
      },
    })
  } catch (error) {
    logger.error('Reports attendance GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
