import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const salaryPaymentSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  paid: z.boolean(),
  amount: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewDirection')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Verify direction member belongs to this club before reading child records
    const dirMember = await db.directionMember.findUnique({ where: { id } })
    if (!dirMember) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()

    const payments = await db.directionSalaryPayment.findMany({
      where: { memberId: id, year },
      orderBy: { month: 'asc' },
    })

    return NextResponse.json(payments)
  } catch (error) {
    logger.error('Salary GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editDirection')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = salaryPaymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { month, year, paid, amount, notes } = parsed.data

    const member = await db.directionMember.findUnique({ where: { id } })
    if (!member) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

    const memberSalary = (member as { salary: number | null }).salary

    const payment = await db.directionSalaryPayment.upsert({
      where: { memberId_month_year: { memberId: id, month, year } },
      update: {
        paid,
        paidAt: paid ? new Date() : null,
        amount: amount ?? (paid ? memberSalary : null),
        notes: notes ?? null,
      },
      create: {
        memberId: id,
        month,
        year,
        paid,
        paidAt: paid ? new Date() : null,
        amount: amount ?? (paid ? memberSalary : null),
        notes: notes ?? null,
      },
    })

    await logAudit(req, user.id, user.email, 'UPDATE', 'DirectionSalaryPayment', payment.id, { month, year, paid })
    return NextResponse.json(payment)
  } catch (error) {
    logger.error('Salary POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
