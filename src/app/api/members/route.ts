import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { createMemberSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

const PAGE_SIZE = 50

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewMembers')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const searchNum = search ? parseInt(search) : NaN
    const where = search
      ? { OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          ...(!isNaN(searchNum) ? [{ number: searchNum }] : []),
        ]}
      : {}

    type MemberRow = {
      id: string; number: number; name: string; phone: string | null; email: string | null;
      address: string | null; monthlyQuota: number; createdAt: Date; updatedAt: Date;
      quotas: { month: number; paid: boolean }[]
    }

    const toResult = (members: MemberRow[]) =>
      members.map(({ quotas, ...rest }) => {
        const paidCount = quotas.filter((q) => q.paid).length
        const pastMonthCount = currentMonth - 1
        const lateMonths = rest.monthlyQuota > 0
          ? Array.from({ length: pastMonthCount }, (_, i) => i + 1).filter((month) => {
              const quota = quotas.find((q) => q.month === month)
              return !quota?.paid
            }).length
          : 0
        return { ...rest, paidCount, lateMonths }
      })

    const [membersData, total] = await Promise.all([
      db.member.findMany({
        where,
        orderBy: { number: 'asc' },
        include: { quotas: { where: { year: currentYear }, select: { month: true, paid: true } } },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.member.count({ where }),
    ])

    return NextResponse.json({
      members: toResult(membersData as unknown as MemberRow[]),
      total,
      page,
      pages: Math.ceil((total as number) / PAGE_SIZE),
    })
  } catch (error) {
    logger.error('Members GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editMembers')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    // Compute next sequential number for this club
    const maxResult = await db.member.aggregate({ _max: { number: true } })
    const nextNumber = ((maxResult as { _max: { number: number | null } })._max.number ?? 0) + 1

    const member = await db.member.create({ data: { ...parsed.data, number: nextNumber, clubId: ctx.clubId } })
    await logAudit(req, user.id, user.email, 'CREATE', 'Member', (member as { id: string }).id, { name: (member as { name: string }).name })
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    logger.error('Members POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
