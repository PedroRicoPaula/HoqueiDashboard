import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  language: z.enum(['pt', 'es', 'en', 'fr', 'it']).optional(),
  country: z.string().min(2).max(10).optional(),
  primaryColor: z.string().regex(/^\d{1,3} \d{1,3}% \d{1,3}%$/).optional(),
})

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user || !user.clubId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const club = await prisma.club.findUnique({ where: { id: user.clubId } })
  if (!club) return NextResponse.json({ error: 'Clube não encontrado' }, { status: 404 })

  return NextResponse.json(club)
}

export async function PATCH(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user || !user.clubId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!user.permissions?.isAdmin) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

    const club = await prisma.club.update({
      where: { id: user.clubId },
      data: parsed.data,
    })

    await logAudit(req, user.id, user.email, 'UPDATE', 'Club', club.id, parsed.data)

    return NextResponse.json(club)
  } catch (error) {
    logger.error('Settings update error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
