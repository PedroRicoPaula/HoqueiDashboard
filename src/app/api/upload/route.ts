import { NextResponse } from 'next/server'
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request) {
  try {
    const ctx = await getDbForRequest(req)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user } = ctx
    if (!hasPermission(user.permissions, 'manageSponsors')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum ficheiro enviado' }, { status: 400 })
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Apenas ficheiros PNG e JPG são permitidos' }, { status: 400 })
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 2MB)' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Verify magic bytes — file.type is client-controlled and cannot be trusted alone
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    if (!isPng && !isJpeg) {
      return NextResponse.json({ error: 'Apenas ficheiros PNG e JPG são permitidos' }, { status: 400 })
    }

    const extMap: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
    }
    const ext = extMap[file.type] ?? '.bin'

    // Generate unpredictable filename via Web Crypto (edge-compatible)
    const randomBytes = crypto.getRandomValues(new Uint8Array(16))
    const filename = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('') + ext

    const r2BucketName = process.env.R2_BUCKET_NAME

    if (r2BucketName) {
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
        Bucket: r2BucketName,
        Key: `sponsors/${filename}`,
        Body: buffer,
        ContentType: file.type,
      }))
      const publicUrl = process.env.R2_PUBLIC_URL!.replace(/\/$/, '')
      const url = `${publicUrl}/sponsors/${filename}`
      await logAudit(req, user.id, user.email, 'CREATE', 'SponsorLogo', filename, { size: file.size })
      return NextResponse.json({ url })
    }

    // Local dev fallback — dynamic import keeps fs out of the Cloudflare bundle
    const { writeFile, mkdir } = await import('fs/promises')
    const { default: path } = await import('path')
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'sponsors')
    await mkdir(uploadDir, { recursive: true })
    await writeFile(path.join(uploadDir, filename), buffer)
    await logAudit(req, user.id, user.email, 'CREATE', 'SponsorLogo', filename, { size: file.size })
    return NextResponse.json({ url: `/uploads/sponsors/${filename}` })

  } catch (error) {
    logger.error('Upload error:', error)
    return NextResponse.json({ error: 'Erro ao fazer upload do ficheiro' }, { status: 500 })
  }
}
