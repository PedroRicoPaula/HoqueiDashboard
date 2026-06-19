import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, clubId } = ctx
    if (!hasPermission(user.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum ficheiro enviado' }, { status: 400 })

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      return NextResponse.json({ error: 'Apenas PNG e JPG são permitidos' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 2MB)' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    if (!isPng && !isJpeg) {
      return NextResponse.json({ error: 'Ficheiro inválido' }, { status: 400 })
    }

    const ext = file.type === 'image/png' ? '.png' : '.jpg'
    const randomBytes = crypto.getRandomValues(new Uint8Array(16))
    const filename = 'club-' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('') + ext

    let logoUrl: string

    if (process.env.R2_BUCKET_NAME) {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
      const client = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      })
      await client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: `logos/${filename}`,
        Body: buffer,
        ContentType: file.type,
      }))
      logoUrl = `${process.env.R2_PUBLIC_URL!.replace(/\/$/, '')}/logos/${filename}`
    } else {
      const { writeFile, mkdir } = await import('fs/promises')
      const { default: path } = await import('path')
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
      await mkdir(uploadDir, { recursive: true })
      await writeFile(path.join(uploadDir, filename), buffer)
      logoUrl = `/uploads/logos/${filename}`
    }

    await prisma.club.update({ where: { id: clubId }, data: { logoUrl } })
    await logAudit(req, user.id, user.email, 'UPDATE_CLUB_LOGO', 'Club', clubId, {})

    return NextResponse.json({ logoUrl })
  } catch (err) {
    logger.error('Club logo upload error:', err)
    return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, clubId } = ctx
    if (!hasPermission(user.permissions, 'isAdmin')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    await prisma.club.update({ where: { id: clubId }, data: { logoUrl: null } })
    await logAudit(req, user.id, user.email, 'REMOVE_CLUB_LOGO', 'Club', clubId, {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('Club logo delete error:', err)
    return NextResponse.json({ error: 'Erro ao remover logo' }, { status: 500 })
  }
}
