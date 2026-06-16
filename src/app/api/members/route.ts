import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { createMemberSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

const PAGE_SIZE = 50

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
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

    const toResult = (members: Array<{ quotas: { month: number; paid: boolean }[]; id: string; number: number; name: string; phone: string | null; email: string | null; address: string | null; monthlyQuota: number; createdAt: Date; updatedAt: Date }>) =>
      members.map((m) => {
        const paidCount = m.quotas.filter((q) => q.paid).length
        const pastMonthCount = currentMonth - 1
        const lateMonths = m.monthlyQuota > 0
          ? Array.from({ length: pastMonthCount }, (_, i) => i + 1).filter((month) => {
              const quota = m.quotas.find((q) => q.month === month)
              return !quota?.paid
            }).length
          : 0
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { quotas: _quotas, ...rest } = m
        return { ...rest, paidCount, lateMonths }
      })

    const [membersData, total] = await Promise.all([
      prisma.member.findMany({
        where,
        orderBy: { number: 'asc' },
        include: { quotas: { where: { year: currentYear }, select: { month: true, paid: true } } },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.member.count({ where }),
    ])

    return NextResponse.json({
      members: toResult(membersData),
      total,
      page,
      pages: Math.ceil(total / PAGE_SIZE),
    })
  } catch (error) {
    logger.error('Members GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'editMembers')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const member = await prisma.member.create({ data: parsed.data })
    await logAudit(req, user.id, user.email, 'CREATE', 'Member', member.id, { name: member.name })
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    logger.error('Members POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
