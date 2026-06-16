import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    })
    await logAudit(req, user.id, user.email, 'LOGOUT', 'User', user.id, {})
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('hcpdl_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  })
  return response
}
