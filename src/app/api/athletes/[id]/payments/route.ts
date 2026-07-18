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

    // Verify athlete belongs to this club before reading child records
    const athlete = await db.athlete.findUnique({ where: { id } })
    if (!athlete) return NextResponse.json({ error: 'Atleta não encontrado' }, { status: 404 })

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
    const { user, db, clubId } = ctx
    if (!hasPermission(user.permissions, 'editFees')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = paymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { month, year, paid, amount, notes } = parsed.data

    const { searchParams } = new URL(req.url)
    const seasonId = searchParams.get('seasonId') || null

    const athlete = await db.athlete.findUnique({ where: { id } })
    if (!athlete) return NextResponse.json({ error: 'Atleta não encontrado' }, { status: 404 })

    // Compute effective fee: season default (if season passed) × (1 - discount)
    let effectiveAmount = (athlete as { monthlyFee: number }).monthlyFee
    if (seasonId) {
      const season = await db.season.findUnique({ where: { id: seasonId }, select: { defaultAthleteMonthlyFee: true } })
      const seasonFee = (season as { defaultAthleteMonthlyFee: number | null } | null)?.defaultAthleteMonthlyFee
      if (seasonFee != null) {
        const disc = (athlete as { discountPercent: number | null }).discountPercent ?? 0
        effectiveAmount = parseFloat((seasonFee * (1 - disc / 100)).toFixed(2))
      }
    }

    // seasonId vem da época seleccionada no cliente no momento do registo — gravado
    // no pagamento para que o guard de eliminação de épocas (season._count.athletePayments
    // em /api/seasons/[id]) o veja; sem isto o campo fica sempre null e a época é eliminável
    // mesmo com pagamentos reais no seu intervalo de datas (achado ao vivo 2026-07-18).
    const payment = await db.athletePayment.upsert({
      where: { athleteId_month_year: { athleteId: id, month, year } },
      update: {
        paid,
        amount: paid ? (amount ?? effectiveAmount) : null,
        paidAt: paid ? new Date() : null,
        notes: notes ?? null,
        ...(seasonId ? { seasonId } : {}),
      },
      create: {
        clubId,
        athleteId: id,
        month,
        year,
        paid,
        amount: paid ? (amount ?? effectiveAmount) : null,
        paidAt: paid ? new Date() : null,
        notes: notes ?? null,
        seasonId,
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
