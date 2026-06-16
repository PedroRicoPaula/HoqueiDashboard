import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const elementSchema = z.object({
  id: z.string().max(64),
  type: z.enum(['player', 'opponent', 'ball', 'cone']),
  label: z.string().max(20).optional(),
})

const frameSchema = z.object({
  frameIndex: z.number().int().min(0).max(99),
  positions: z.record(z.string().max(64), z.object({ x: z.number(), y: z.number() })),
})

const playbookSchema = z.object({
  name: z.string().max(100).optional(),
  elements: z.array(elementSchema).max(50),
  frames: z.array(frameSchema).max(100),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user } = ctx
    if (!hasPermission(user.permissions, 'editTraining')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = playbookSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const playbook = await prisma.playbook.upsert({
      where: { trainingId: id },
      update: { frames: parsed.data },
      create: { trainingId: id, frames: parsed.data },
    })

    await logAudit(req, user.id, user.email, 'UPDATE', 'Playbook', id, {})
    return NextResponse.json(playbook)
  } catch (error) {
    logger.error('Playbook PUT error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
