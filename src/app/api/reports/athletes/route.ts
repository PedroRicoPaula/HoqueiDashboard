import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { athleteMembershipWhere } from '@/lib/athleteMembership'
import { computeEffectiveFee } from '@/lib/feeCalc'
import { logger } from '@/lib/logger'
import { buildXlsx, XLSX_HEADERS } from '@/lib/xlsx'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewAthletes')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
    const canViewFees = hasPermission(user.permissions, 'viewFees')

    const { searchParams } = new URL(req.url)
    const ageGroup = searchParams.get('ageGroup') ?? ''
    const search = searchParams.get('search') ?? ''
    const seasonId = searchParams.get('seasonId') ?? ''

    let seasonDefaultFee: number | null = null
    let seasonWindow: { startDate: Date; endDate: Date } | null = null
    if (seasonId) {
      const season = await db.season.findUnique({ where: { id: seasonId }, select: { startDate: true, endDate: true, defaultAthleteMonthlyFee: true } })
      if (season) {
        const s = season as { startDate: Date; endDate: Date; defaultAthleteMonthlyFee: number | null }
        seasonWindow = { startDate: new Date(s.startDate), endDate: new Date(s.endDate) }
        if (canViewFees) seasonDefaultFee = s.defaultAthleteMonthlyFee
      }
    }

    const athletes = await db.athlete.findMany({
      where: {
        AND: [
          ageGroup ? { ageGroup: ageGroup as never } : {},
          search
            ? { OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search, mode: 'insensitive' as const } },
              ] }
            : {},
          athleteMembershipWhere(seasonWindow),
        ],
      },
      orderBy: [{ ageGroup: 'asc' }, { number: 'asc' }],
    }) as unknown as Array<{
      number: number; name: string; ageGroup: string; birthDate: Date;
      phone: string | null; email: string | null; nif: string | null; idCard: string | null;
      address: string | null; school: string | null; parentName: string | null; parentPhone: string | null;
      monthlyFee: number; discountPercent: number | null; feeExempt: boolean;
    }>

    const AGE_LABELS: Record<string, string> = {
      SUB11: 'Sub-11', SUB13: 'Sub-13', SUB15: 'Sub-15',
      SUB17: 'Sub-17', SUB19: 'Sub-19', SENIORS: 'Seniores',
    }

    const headers = [
      'N.º', 'Nome', 'Escalão', 'Data Nascimento', 'Idade',
      'Telefone', 'Email', 'NIF', 'N.º CC/BI', 'Morada', 'Escola',
      'Encarregado', 'Tel. Encarregado',
      ...(canViewFees ? ['Mensalidade (€)', 'Isento'] : []),
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
        ...(canViewFees
          ? [computeEffectiveFee(a.monthlyFee, a.discountPercent, seasonDefaultFee), a.feeExempt ? 'Sim' : 'Não']
          : []),
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
