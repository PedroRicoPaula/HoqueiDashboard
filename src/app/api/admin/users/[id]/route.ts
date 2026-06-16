import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest, hashPassword } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const admin = await getUserFromRequest(req)
    if (!admin) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!hasPermission(admin.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'Utilizador não encontrado' }, { status: 404 })

    const hashed = await hashPassword(parsed.data.password)
    await prisma.user.update({
      where: { id },
      data: {
        password: hashed,
        tokenVersion: { increment: 1 },
      },
    })

    await logAudit(req, admin.id, admin.email, 'UPDATE', 'User', id, { action: 'reset_password', target: target.email })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Admin reset password error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
