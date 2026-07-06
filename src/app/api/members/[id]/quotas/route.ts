import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const quotaSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  paid: z.boolean(),
  notes: z.string().optional().nullable(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewMembers')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Verify member belongs to this club before reading child records
    const member = await db.member.findUnique({ where: { id } })
    if (!member) return NextResponse.json({ error: 'Sócio não encontrado' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()

    const quotas = await db.quota.findMany({
      where: { memberId: id, year },
      orderBy: { month: 'asc' },
    })

    return NextResponse.json(quotas)
  } catch (error) {
    logger.error('Quotas GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db, clubId } = ctx
    if (!hasPermission(user.permissions, 'editMembers')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = quotaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const { month, year, paid, notes } = parsed.data

    const member = await db.member.findUnique({ where: { id } })
    if (!member) return NextResponse.json({ error: 'Sócio não encontrado' }, { status: 404 })

    const memberQuota = (member as { monthlyQuota: number }).monthlyQuota

    const quota = await db.quota.upsert({
      where: { memberId_month_year: { memberId: id, month, year } },
      update: { paid, paidAt: paid ? new Date() : null, amount: paid ? memberQuota : null, notes: notes ?? null },
      create: { clubId, memberId: id, month, year, paid, paidAt: paid ? new Date() : null, amount: paid ? memberQuota : null, notes: notes ?? null },
    })

    await logAudit(req, user.id, user.email, 'UPDATE', 'Quota', quota.id, { month, year, paid })
    return NextResponse.json(quota)
  } catch (error) {
    logger.error('Quotas POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
