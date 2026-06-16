import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { webcrypto } from 'node:crypto'

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgresql123@localhost:5432/hoqueimanager'

async function hashPassword(plain: string): Promise<string> {
  const subtle = webcrypto.subtle
  const salt = webcrypto.getRandomValues(new Uint8Array(16))
  const key = await subtle.importKey('raw', new TextEncoder().encode(plain), 'PBKDF2', false, ['deriveBits'])
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 } as Pbkdf2Params,
    key, 256,
  )
  const toHex = (a: Uint8Array) => Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:${toHex(salt)}:${toHex(new Uint8Array(bits))}`
}

function createClient() {
  const adapter = new PrismaPg({ connectionString: DB_URL })
  return new PrismaClient({ adapter })
}

async function main() {
  const prisma = createClient()

  try {
    const existing = await prisma.user.findUnique({ where: { email: 'superadmin@hoqueimanager.com' } })
    if (!existing) {
      await prisma.user.create({
        data: {
          name: 'Super Admin',
          email: 'superadmin@hoqueimanager.com',
          password: await hashPassword('superadmin123'),
          isSuperAdmin: true,
          clubId: null,
        },
      })
      console.log('✓ Super admin criado: superadmin@hoqueimanager.com / superadmin123')
    } else {
      console.log('· Super admin já existe')
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
