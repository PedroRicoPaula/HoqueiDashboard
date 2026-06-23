import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { createMaterialSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import type { MaterialState, MaterialCategory } from '@prisma/client'

export async function GET(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db, clubId } = ctx
    if (!hasPermission(user.permissions, 'viewMaterials')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const state = searchParams.get('state') || ''
    const category = searchParams.get('category') || ''
    const search = searchParams.get('search') || ''

    const materials = await db.material.findMany({
      where: {
        AND: [
          state ? { state: state as MaterialState } : {},
          category ? { category: category as MaterialCategory } : {},
          search ? { OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { type: { contains: search, mode: 'insensitive' } },
          ]} : {},
        ],
      },
      include: { athlete: { select: { id: true, name: true, number: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(materials)
  } catch (error) {
    logger.error('Materials GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db, clubId } = ctx
    if (!hasPermission(user.permissions, 'editMaterials')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createMaterialSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const material = await db.material.create({
      data: { ...parsed.data, clubId },
      include: { athlete: { select: { id: true, name: true, number: true } } },
    })

    await logAudit(req, user.id, user.email, 'CREATE', 'Material', (material as { id: string }).id, { name: (material as { name: string }).name })
    return NextResponse.json(material, { status: 201 })
  } catch (error) {
    logger.error('Materials POST error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
