import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const paymentSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  paid: z.boolean(),
  amount: z.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewFees')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : new Date().getFullYear()

    const payments = await db.athletePayment.findMany({
      where: { athleteId: id, year },
      orderBy: { month: 'asc' },
    })

    return NextResponse.json(payments)
  } catch (error) {
    logger.error('Athlete payments GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editFees')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = paymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { month, year, paid, amount, notes } = parsed.data

    const athlete = await db.athlete.findUnique({ where: { id } })
    if (!athlete) return NextResponse.json({ error: 'Atleta não encontrado' }, { status: 404 })

    const payment = await db.athletePayment.upsert({
      where: { athleteId_month_year: { athleteId: id, month, year } },
      update: {
        paid,
        amount: paid ? (amount ?? (athlete as { monthlyFee: number }).monthlyFee) : null,
        paidAt: paid ? new Date() : null,
        notes: notes ?? null,
      },
      create: {
        athleteId: id,
        month,
        year,
        paid,
        amount: paid ? (amount ?? (athlete as { monthlyFee: number }).monthlyFee) : null,
        paidAt: paid ? new Date() : null,
        notes: notes ?? null,
      },
    })

    await logAudit(
      req,
      user.id,
      user.email,
      'UPDATE',
      'AthletePayment',
      payment.id,
      { athleteId: id, month, year, paid, amount: payment.amount }
    )

    return NextResponse.json(payment)
  } catch (error) {
    logger.error('Athlete payments POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
