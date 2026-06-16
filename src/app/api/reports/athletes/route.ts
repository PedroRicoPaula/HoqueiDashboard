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
    if (!hasPermission(user.permissions, 'viewAthletes')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const ageGroup = searchParams.get('ageGroup') ?? ''

    const athletes = await prisma.athlete.findMany({
      where: ageGroup ? { ageGroup: ageGroup as never } : {},
      orderBy: [{ ageGroup: 'asc' }, { number: 'asc' }],
    })

    const AGE_LABELS: Record<string, string> = {
      SUB11: 'Sub-11', SUB13: 'Sub-13', SUB15: 'Sub-15',
      SUB17: 'Sub-17', SUB19: 'Sub-19', SENIORS: 'Seniores',
    }

    const headers = [
      'N.º', 'Nome', 'Escalão', 'Data Nascimento', 'Idade',
      'Telefone', 'Email', 'NIF', 'N.º CC/BI', 'Morada', 'Escola',
      'Encarregado', 'Tel. Encarregado', 'Mensalidade (€)', 'Isento',
    ]

    const now = new Date()
    const rows = athletes.map((a) => {
      const birth = new Date(a.birthDate)
      const age = now.getFullYear() - birth.getFullYear() -
        (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0)
      return [
        a.number, a.name, AGE_LABELS[a.ageGroup] ?? a.ageGroup,
        birth.toLocaleDateString('pt-PT'),
        age, a.phone ?? '', a.email ?? '', a.nif ?? '', a.idCard ?? '',
        a.address ?? '', a.school ?? '',
        a.parentName ?? '', a.parentPhone ?? '',
        a.monthlyFee, a.feeExempt ? 'Sim' : 'Não',
      ]
    })

    const buffer = await buildXlsx('Atletas', headers, rows)
    const filename = `atletas-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': XLSX_HEADERS.contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    logger.error('Reports athletes error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
