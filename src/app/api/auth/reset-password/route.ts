import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { validateCsrf, csrfError } from '@/lib/csrf'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: Request) {
  if (!validateCsrf(req)) return csrfError()

  const ip = getClientIp(req)
  const limit = await checkRateLimit(`reset:${ip}`, { windowMs: 15 * 60 * 1000, max: 5 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Muitos pedidos. Aguarde.' }, { status: 429 })
  }

  try {
    const { token, password } = await req.json()
    if (!token || !password || password.length < 8) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const record = await prisma.passwordResetToken.findUnique({ where: { token } })

    if (!record || record.used || record.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 400 })
    }

    const hashed = await hashPassword(password)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          password: hashed,
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { used: true },
      }),
    ])

    await logAudit(req, record.userId, '', 'PASSWORD_RESET', 'User', record.userId, {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('Reset password error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
