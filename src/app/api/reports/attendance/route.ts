import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { buildXlsx, XLSX_HEADERS } from '@/lib/xlsx'

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'viewAttendance')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const ageGroup = searchParams.get('ageGroup')

    const athletes = await prisma.athlete.findMany({
      where: ageGroup ? { ageGroup: ageGroup as never } : {},
      orderBy: [{ ageGroup: 'asc' }, { number: 'asc' }],
      include: {
        attendanceRecords: {
          include: {
            session: { select: { date: true, primaryAgeGroup: true, sessionType: true } },
          },
        },
      },
    })

    const headers = ['Nº', 'Nome', 'Escalão', 'Total Sessões', 'Presenças', 'Faltas', '% Assiduidade', 'Treinos Próprios (Presenças)', 'Outros Escalões (Presenças)']

    const rows = athletes.map((a) => {
      const records = a.attendanceRecords
      const total = records.length
      const present = records.filter((r) => r.present).length
      const pct = total > 0 ? Math.round((present / total) * 100) : 0
      const ownPresent = records.filter((r) => r.present && r.session.primaryAgeGroup === a.ageGroup).length
      const otherPresent = records.filter((r) => r.present && r.session.primaryAgeGroup !== a.ageGroup).length
      return [a.number, a.name, a.ageGroup, total, present, total - present, `${pct}%`, ownPresent, otherPresent]
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
