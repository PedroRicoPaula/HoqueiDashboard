import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { createSponsorSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewSponsors')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const sponsors = await db.sponsor.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(sponsors)
  } catch (error) {
    logger.error('Sponsors GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'manageSponsors')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createSponsorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { contractStart, contractEnd, ...rest } = parsed.data
    const sponsor = await db.sponsor.create({
      data: { ...rest, contractStart: new Date(contractStart), contractEnd: new Date(contractEnd) },
    })

    await logAudit(req, user.id, user.email, 'CREATE', 'Sponsor', (sponsor as { id: string }).id, { name: (sponsor as { name: string }).name })
    return NextResponse.json(sponsor, { status: 201 })
  } catch (error) {
    logger.error('Sponsors POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
