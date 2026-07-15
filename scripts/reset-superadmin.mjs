/**
 * Recuperação de super admin — correr quando forgot-password não funciona
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node scripts/reset-superadmin.mjs <nova-password>
 *
 * Exemplo com .env local:
 *   node -e "require('dotenv').config()" scripts/reset-superadmin.mjs minhaPassword123
 *
 * Ou simplesmente:
 *   DATABASE_URL="postgresql://postgres:postgresql123@localhost:5432/hoqueimanager" \
 *     node scripts/reset-superadmin.mjs superadmin123
 */

import crypto from 'crypto'
import pg from 'pg'

const { Client } = pg

const newPassword = process.argv[2]

if (!newPassword || newPassword.length < 8) {
  console.error('❌  Fornece uma nova password com pelo menos 8 caracteres:')
  console.error('   node scripts/reset-superadmin.mjs <nova-password>')
  process.exit(1)
}

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('❌  DATABASE_URL não definida.')
  console.error('   Corre: DATABASE_URL="postgresql://..." node scripts/reset-superadmin.mjs <password>')
  process.exit(1)
}

async function hashPassword(plain) {
  const salt = crypto.randomBytes(16)
  const hash = await new Promise((resolve, reject) =>
    crypto.pbkdf2(plain, salt, 100_000, 32, 'sha256', (err, key) =>
      err ? reject(err) : resolve(key)
    )
  )
  return `pbkdf2:${salt.toString('hex')}:${hash.toString('hex')}`
}

const client = new Client({ connectionString: dbUrl, ssl: dbUrl.includes('neon.tech') ? { rejectUnauthorized: false } : false })

try {
  await client.connect()

  // Encontrar o(s) super admin(s)
  const { rows: admins } = await client.query(
    'SELECT id, name, email FROM "User" WHERE "isSuperAdmin" = true ORDER BY "createdAt" ASC'
  )

  if (admins.length === 0) {
    console.error('❌  Nenhum super admin encontrado na base de dados.')
    console.error('   Vai a app.hoqueimanager.com/setup para criar o primeiro.')
    process.exit(1)
  }

  // Se houver mais de um, usa o primeiro (mais antigo)
  const admin = admins[0]
  console.log(`\n✅  Super admin encontrado: ${admin.name} <${admin.email}>`)
  if (admins.length > 1) {
    console.log(`⚠️   (${admins.length - 1} super admin(s) adicional/ais ignorado(s))`)
  }

  console.log('   A gerar hash PBKDF2...')
  const hashed = await hashPassword(newPassword)

  await client.query(
    'UPDATE "User" SET password = $1, "updatedAt" = NOW() WHERE id = $2',
    [hashed, admin.id]
  )

  console.log(`\n🎉  Password atualizada com sucesso!`)
  console.log(`   Email:    ${admin.email}`)
  console.log(`   Password: ${newPassword}`)
  console.log(`\n   Vai a /login e usa estas credenciais.`)
  console.log(`   Depois vai a /platform (super admin não acede ao dashboard dos clubes).\n`)

} catch (err) {
  console.error('❌  Erro:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
