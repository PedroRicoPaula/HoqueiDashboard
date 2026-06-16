import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { updateMaterialSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'viewMaterials')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const material = await prisma.material.findUnique({
      where: { id },
      include: { athlete: { select: { id: true, name: true, number: true } } },
    })

    if (!material) return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
    return NextResponse.json(material)
  } catch (error) {
    logger.error('Material GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'editMaterials')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = updateMaterialSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    if (data.athleteId && data.state !== 'ASSIGNED') data.state = 'ASSIGNED'
    if (!data.athleteId && data.state === 'ASSIGNED') {
      data.state = 'FREE'
      data.athleteId = null
    }
    // clear payment info when not assigned
    if (data.state !== 'ASSIGNED') {
      data.paidByAthlete = false
      data.paidAmount = null
    }

    const material = await prisma.material.update({
      where: { id },
      data,
      include: { athlete: { select: { id: true, name: true, number: true } } },
    })

    await logAudit(req, user.id, user.email, 'UPDATE', 'Material', material.id, { name: material.name, state: material.state })
    return NextResponse.json(material)
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
    }
    logger.error('Material PUT error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(user.permissions, 'editMaterials')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    await prisma.material.delete({ where: { id } })
    await logAudit(req, user.id, user.email, 'DELETE', 'Material', id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
    }
    logger.error('Material DELETE error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
