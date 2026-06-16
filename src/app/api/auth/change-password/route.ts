import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest, comparePassword, hashPassword } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const schema = z.object({
  currentPassword: z.string().min(1, 'Password atual obrigatória'),
  newPassword: z.string().min(8, 'Nova password deve ter pelo menos 8 caracteres'),
})

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const limit = await checkRateLimit(`change-password:${ip}`, { windowMs: 15 * 60 * 1000, max: 5 })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas tentativas. Aguarde 15 minutos.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    )
  }

  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { currentPassword, newPassword } = parsed.data

    const isValid = await comparePassword(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Password atual incorreta' }, { status: 401 })
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'A nova password deve ser diferente da atual' }, { status: 400 })
    }

    const hashed = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        tokenVersion: { increment: 1 },
      },
    })

    await logAudit(req, user.id, user.email, 'CHANGE_PASSWORD', 'User', user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Change password error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
