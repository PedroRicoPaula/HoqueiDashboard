import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  language: z.enum(['pt', 'es', 'en', 'fr', 'it']).optional(),
  country: z.string().min(2).max(10).optional(),
  primaryColor: z.string().regex(/^\d{1,3} \d{1,3}% \d{1,3}%$/).optional(),
})

// Campos visíveis nas Definições — deliberadamente exclui stripeCustomerId/
// stripeSubscriptionId/stripePriceId e outros internos de faturação, que não são
// necessários no cliente e não devem ser lidos por um utilizador não-admin (ver PATCH).
const CLUB_SELECT = {
  id: true, name: true, slug: true, email: true, country: true, language: true,
  logoUrl: true, primaryColor: true, status: true, createdAt: true, updatedAt: true,
}

export async function GET(req: Request) {
  const ctx = await getDbForRequest(req)
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { user, db, clubId } = ctx
  if (!hasPermission(user.permissions, 'isAdmin')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const club = await db.club.findUnique({ where: { id: clubId }, select: CLUB_SELECT })
  if (!club) return NextResponse.json({ error: 'Clube não encontrado' }, { status: 404 })

  return NextResponse.json(club)
}

export async function PATCH(req: Request) {
  const ctx = await getDbForRequest(req)
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { user, db, clubId } = ctx
  if (!hasPermission(user.permissions, 'isAdmin')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

    const club = await db.club.update({
      where: { id: clubId },
      data: parsed.data,
      select: CLUB_SELECT,
    })

    await logAudit(req, user.id, user.email, 'UPDATE', 'Club', club.id, parsed.data)

    return NextResponse.json(club)
  } catch (error) {
    logger.error('Settings update error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
