import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { updateSponsorSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'viewSponsors')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const sponsor = await prisma.sponsor.findUnique({ where: { id } })
    if (!sponsor) return NextResponse.json({ error: 'Patrocinador não encontrado' }, { status: 404 })
    return NextResponse.json(sponsor)
  } catch (error) {
    logger.error('Sponsor GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'manageSponsors')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateSponsorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { contractStart, contractEnd, ...rest } = parsed.data
    const sponsor = await prisma.sponsor.update({
      where: { id },
      data: {
        ...rest,
        ...(contractStart ? { contractStart: new Date(contractStart) } : {}),
        ...(contractEnd ? { contractEnd: new Date(contractEnd) } : {}),
      },
    })

    await logAudit(req, user.id, user.email, 'UPDATE', 'Sponsor', sponsor.id, { name: sponsor.name })
    return NextResponse.json(sponsor)
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Patrocinador não encontrado' }, { status: 404 })
    }
    logger.error('Sponsor PUT error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'manageSponsors')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    await prisma.sponsor.delete({ where: { id } })
    await logAudit(req, user.id, user.email, 'DELETE', 'Sponsor', id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Patrocinador não encontrado' }, { status: 404 })
    }
    logger.error('Sponsor DELETE error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
