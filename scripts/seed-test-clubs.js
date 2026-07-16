const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const crypto = require('crypto')
require('dotenv').config({ path: '.env.local', override: true })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function uint8ToHex(buf) {
  return Buffer.from(buf).toString('hex')
}

async function hashPassword(password) {
  const salt = new Uint8Array(16)
  globalThis.crypto.getRandomValues(salt)
  const key = await globalThis.crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256
  )
  return `pbkdf2:${uint8ToHex(salt)}:${uint8ToHex(new Uint8Array(bits))}`
}

async function main() {
  const password = await hashPassword('Teste1234!')

  const club1 = await prisma.club.create({
    data: {
      name: 'HC Dragões do Porto',
      slug: 'hc-dragoes-porto',
      email: 'admin@dragoes-porto.pt',
      country: 'PT',
      language: 'pt',
      status: 'ACTIVE',
      stripeCustomerId: 'cus_test_club1',
      stripeSubscriptionId: 'sub_test_club1',
    },
  })

  const user1 = await prisma.user.create({
    data: {
      clubId: club1.id,
      name: 'Miguel Ferreira',
      email: 'admin@dragoes-porto.pt',
      password,
      permissions: {
        create: {
          viewAthletes: true, editAthletes: true,
          viewFees: true, editFees: true,
          viewMembers: true, editMembers: true,
          viewMaterials: true, editMaterials: true,
          viewSponsors: true, manageSponsors: true,
          viewTraining: true, editTraining: true,
          viewTravel: true, editTravel: true,
          viewDirection: true, editDirection: true,
          viewAttendance: true, editAttendance: true,
          viewTextiles: true, editTextiles: true,
          isAdmin: true,
        },
      },
    },
  })

  const club2 = await prisma.club.create({
    data: {
      name: 'HC Leões de Lisboa',
      slug: 'hc-leoes-lisboa',
      email: 'admin@leoes-lisboa.pt',
      country: 'PT',
      language: 'pt',
      status: 'ACTIVE',
      stripeCustomerId: 'cus_test_club2',
      stripeSubscriptionId: 'sub_test_club2',
    },
  })

  const user2 = await prisma.user.create({
    data: {
      clubId: club2.id,
      name: 'Ana Rodrigues',
      email: 'admin@leoes-lisboa.pt',
      password,
      permissions: {
        create: {
          viewAthletes: true, editAthletes: true,
          viewFees: true, editFees: true,
          viewMembers: true, editMembers: true,
          viewMaterials: true, editMaterials: true,
          viewSponsors: true, manageSponsors: true,
          viewTraining: true, editTraining: true,
          viewTravel: true, editTravel: true,
          viewDirection: true, editDirection: true,
          viewAttendance: true, editAttendance: true,
          viewTextiles: true, editTextiles: true,
          isAdmin: true,
        },
      },
    },
  })

  console.log('✓ Clube 1:', club1.name, '| Admin:', user1.email)
  console.log('✓ Clube 2:', club2.name, '| Admin:', user2.email)
  console.log('\nPassword para ambos: Teste1234!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
