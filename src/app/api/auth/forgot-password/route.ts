import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, resetPasswordEmailHtml } from '@/lib/email'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { validateCsrf, csrfError } from '@/lib/csrf'
import crypto from 'crypto'

export async function POST(req: Request) {
  if (!validateCsrf(req)) return csrfError()

  const ip = getClientIp(req)
  const limit = await checkRateLimit(`forgot:${ip}`, { windowMs: 15 * 60 * 1000, max: 5 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Muitos pedidos. Aguarde.' }, { status: 429 })
  }

  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (!user) {
      return NextResponse.json({ ok: true })
    }

    // Invalidate previous tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    })

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.hoqueimanager.com'
    const resetUrl = `${appUrl}/reset-password?token=${token}`

    await sendEmail({
      to: user.email,
      subject: 'Redefinir palavra-passe — HoqueiManager',
      html: resetPasswordEmailHtml(user.name, resetUrl),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('Forgot password error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
