import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { createTextileSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import type { TextileCategory, TextileState } from '@prisma/client'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'viewTextiles')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category')
    const state = searchParams.get('state')
    const season = searchParams.get('season')
    const athleteId = searchParams.get('athleteId')

    const items = await db.textileItem.findMany({
      where: {
        ...(search ? {
          OR: [
            { personalizationDetails: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
        ...(category ? { category: category as TextileCategory } : {}),
        ...(state ? { state: state as TextileState } : {}),
        ...(season ? { season } : {}),
        ...(athleteId ? { athleteId } : {}),
      },
      orderBy: [{ season: 'desc' }, { category: 'asc' }, { type: 'asc' }],
      include: {
        athlete: { select: { id: true, name: true, number: true } },
      },
    })

    return NextResponse.json(items)
  } catch (error) {
    logger.error('Textiles GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db } = ctx
    if (!hasPermission(user.permissions, 'editTextiles')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createTextileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    if (data.athleteId) data.state = 'ASSIGNED'
    if (data.state !== 'ASSIGNED') {
      data.athleteId = null
      data.paidByAthlete = false
      data.paidAmount = null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = await db.textileItem.create({ data: data as any })
    await logAudit(req, user.id, user.email, 'CREATE', 'TextileItem', (item as { id: string }).id, { type: (item as { type: string }).type, season: (item as { season: string }).season })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    logger.error('Textiles POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
