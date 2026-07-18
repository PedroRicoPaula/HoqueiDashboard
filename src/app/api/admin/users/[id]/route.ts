import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDbForRequest } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
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
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user: admin, clubId } = ctx
    if (!hasPermission(admin.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
    // Este reset não pede a password actual (ao contrário de /api/auth/change-password)
    // — é para o admin repor a de OUTRO utilizador. Se pudesse alvejar-se a si próprio,
    // uma sessão comprometida (XSS, etc.) conseguia trocar a password do admin em
    // silêncio, sem nunca precisar de saber a password actual.
    if (id === admin.id) {
      return NextResponse.json({ error: 'Usa "Mudar palavra-passe" no teu perfil para a tua própria conta' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const target = await prisma.user.findUnique({ where: { id, clubId } })
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
