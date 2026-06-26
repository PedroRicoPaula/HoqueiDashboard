/**
 * Seed 3 test clubs with realistic data for local development.
 * Run with: npx tsx scripts/seed-test-clubs.ts
 */
if (process.env.NODE_ENV === 'production') {
  throw new Error('seed-test-clubs.ts must not run in production')
}

import { PrismaClient, type AgeGroup } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { randomBytes, pbkdf2 as pbkdf2Cb } from 'crypto'
import { promisify } from 'util'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const pbkdf2 = promisify(pbkdf2Cb)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function hashPassword(password: string): Promise<string> {
  const saltBuf = randomBytes(16)  // raw 16 bytes — matches hexToUint8 in comparePassword
  const hash = await pbkdf2(password, saltBuf, 100000, 32, 'sha256')
  return `pbkdf2:${saltBuf.toString('hex')}:${hash.toString('hex')}`
}

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const seasonStart = currentMonth >= 9 ? currentYear : currentYear - 1

function monthsAgo(n: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d
}

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

const CLUBS = [
  {
    name: 'HC Porto Demo',
    slug: 'hc-porto-demo',
    email: 'admin@hcporto-demo.com',
    country: 'pt',
    language: 'pt',
    primaryColor: '217 91% 50%', // Azul
    adminPassword: 'porto123',
    athletes: [
      { number: 1,  name: 'João Silva',      ageGroup: 'SENIORS', monthlyFee: 35, birthDate: '1998-03-14' },
      { number: 7,  name: 'Miguel Ferreira', ageGroup: 'SENIORS', monthlyFee: 35, birthDate: '2000-07-22' },
      { number: 10, name: 'André Costa',     ageGroup: 'SUB19',   monthlyFee: 30, birthDate: '2006-11-05' },
      { number: 5,  name: 'Carlos Mendes',   ageGroup: 'SUB19',   monthlyFee: 30, birthDate: '2007-02-18' },
      { number: 3,  name: 'Rui Oliveira',    ageGroup: 'SUB17',   monthlyFee: 25, birthDate: '2008-09-30' },
      { number: 8,  name: 'Tiago Santos',    ageGroup: 'SUB17',   monthlyFee: 25, birthDate: '2009-04-12' },
      { number: 4,  name: 'Diogo Lopes',     ageGroup: 'SUB15',   monthlyFee: 20, birthDate: '2010-06-25' },
      { number: 12, name: 'Pedro Rodrigues', ageGroup: 'SUB15',   monthlyFee: 20, birthDate: '2011-01-08' },
    ],
    members: [
      { name: 'António Silva',  email: 'antonio@porto-demo.com', monthlyQuota: 10 },
      { name: 'Maria Ferreira', email: 'maria@porto-demo.com',   monthlyQuota: 10 },
      { name: 'José Costa',     email: 'jose@porto-demo.com',    monthlyQuota: 15 },
      { name: 'Ana Mendes',     email: 'ana@porto-demo.com',     monthlyQuota: 10 },
      { name: 'Paulo Santos',   email: 'paulo@porto-demo.com',   monthlyQuota: 20 },
    ],
    sponsors: [
      { name: 'Desportiva Norte', annualContribution: 2000, contractStart: monthsAgo(6), contractEnd: daysFromNow(180) },
      { name: 'SuperSport Porto', annualContribution: 1500, contractStart: monthsAgo(2), contractEnd: daysFromNow(300) },
    ],
  },
  {
    name: 'HC Lisboa Demo',
    slug: 'hc-lisboa-demo',
    email: 'admin@hclisboa-demo.com',
    country: 'pt',
    language: 'pt',
    primaryColor: '0 72% 51%', // Vermelho
    adminPassword: 'lisboa123',
    athletes: [
      { number: 1,  name: 'Bruno Alves',    ageGroup: 'SENIORS', monthlyFee: 40, birthDate: '1995-05-10' },
      { number: 9,  name: 'Nuno Pereira',   ageGroup: 'SENIORS', monthlyFee: 40, birthDate: '1999-12-03' },
      { number: 11, name: 'Filipe Marques', ageGroup: 'SUB19',   monthlyFee: 32, birthDate: '2006-08-17' },
      { number: 6,  name: 'Hugo Gomes',     ageGroup: 'SUB17',   monthlyFee: 28, birthDate: '2008-03-22' },
      { number: 2,  name: 'Sérgio Dias',    ageGroup: 'SUB15',   monthlyFee: 22, birthDate: '2010-11-14' },
      { number: 14, name: 'Marco Sousa',    ageGroup: 'SUB13',   monthlyFee: 18, birthDate: '2012-07-06' },
    ],
    members: [
      { name: 'Ricardo Alves',  email: 'ricardo@lisboa-demo.com',  monthlyQuota: 12 },
      { name: 'Sandra Pereira', email: 'sandra@lisboa-demo.com',   monthlyQuota: 12 },
      { name: 'Manuel Gomes',   email: 'manuel@lisboa-demo.com',   monthlyQuota: 15 },
    ],
    sponsors: [
      { name: 'SportZone Lisboa', annualContribution: 3000, contractStart: monthsAgo(3), contractEnd: daysFromNow(270) },
      { name: 'TechSports LDA',   annualContribution: 800,  contractStart: monthsAgo(8), contractEnd: daysFromNow(25) }, // expira em breve!
    ],
  },
  {
    name: 'HC Braga Demo',
    slug: 'hc-braga-demo',
    email: 'admin@hcbraga-demo.com',
    country: 'pt',
    language: 'pt',
    primaryColor: '271 81% 56%', // Roxo
    adminPassword: 'braga123',
    athletes: [
      { number: 1,  name: 'Luís Correia',  ageGroup: 'SENIORS', monthlyFee: 30, birthDate: '2001-04-28' },
      { number: 7,  name: 'Paulo Vieira',  ageGroup: 'SENIORS', monthlyFee: 30, birthDate: '2002-09-15' },
      { number: 3,  name: 'Fábio Cunha',   ageGroup: 'SUB19',   monthlyFee: 25, birthDate: '2007-01-20' },
      { number: 10, name: 'Gonçalo Pinto', ageGroup: 'SUB17',   monthlyFee: 20, birthDate: '2009-06-11' },
    ],
    members: [
      { name: 'Armindo Ferreira', email: 'armindo@braga-demo.com', monthlyQuota: 8 },
      { name: 'Teresa Cunha',     email: 'teresa@braga-demo.com',  monthlyQuota: 8 },
    ],
    sponsors: [
      { name: 'Norte Desporto', annualContribution: 1200, contractStart: monthsAgo(1), contractEnd: daysFromNow(365) },
    ],
  },
]

async function seedClub(club: typeof CLUBS[0]) {
  console.log(`\n→ Seeding ${club.name}...`)

  // Create club
  const createdClub = await prisma.club.create({
    data: {
      name: club.name,
      slug: club.slug,
      email: club.email,
      country: club.country,
      language: club.language,
      primaryColor: club.primaryColor,
      status: 'ACTIVE',
    },
  })
  console.log(`  ✓ Club created: ${createdClub.id}`)

  // Create admin user (with full admin permissions nested)
  const hashedPw = await hashPassword(club.adminPassword)
  const adminUser = await prisma.user.create({
    data: {
      clubId: createdClub.id,
      name: `Admin ${club.name}`,
      email: club.email,
      password: hashedPw,
      tokenVersion: 0,
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
  console.log(`  ✓ Admin user: ${adminUser.email} / ${club.adminPassword}`)

  // Create athletes
  const createdAthletes = await Promise.all(
    club.athletes.map((a) =>
      prisma.athlete.create({
        data: {
          clubId: createdClub.id,
          number: a.number,
          name: a.name,
          ageGroup: a.ageGroup as AgeGroup,
          birthDate: new Date(a.birthDate),
          monthlyFee: a.monthlyFee,
          feeExempt: false,
        },
      })
    )
  )
  console.log(`  ✓ ${createdAthletes.length} athletes created`)

  // Create athlete payments — current season, with some unpaid (simulate late)
  const seasonMonths = [
    { year: seasonStart, month: 9 },
    { year: seasonStart, month: 10 },
    { year: seasonStart, month: 11 },
    { year: seasonStart, month: 12 },
    { year: seasonStart + 1, month: 1 },
    { year: seasonStart + 1, month: 2 },
    { year: seasonStart + 1, month: 3 },
  ].filter((m) => {
    // only months up to current
    if (m.year < currentYear) return true
    if (m.year === currentYear && m.month <= currentMonth) return true
    return false
  })

  let paymentCount = 0
  for (const athlete of createdAthletes) {
    // skip seniors for fee tracking (they're exempt by convention in many clubs)
    if (athlete.ageGroup === 'SENIORS') continue
    for (let i = 0; i < seasonMonths.length; i++) {
      const { year, month } = seasonMonths[i]
      // last 2 months: 50% chance of being unpaid (simulate late payments)
      const isLast2 = i >= seasonMonths.length - 2
      const paid = isLast2 ? Math.random() > 0.4 : true
      await prisma.athletePayment.create({
        data: {
          athleteId: athlete.id,
          year,
          month,
          paid,
          amount: athlete.monthlyFee,
          paidAt: paid ? new Date(year, month - 1, Math.floor(Math.random() * 10) + 1) : null,
        },
      })
      if (paid) paymentCount++
    }
  }
  console.log(`  ✓ ${paymentCount} athlete payments (season ${seasonStart}/${seasonStart + 1})`)

  // Create members
  const createdMembers = await Promise.all(
    club.members.map((m) =>
      prisma.member.create({
        data: {
          clubId: createdClub.id,
          name: m.name,
          email: m.email,
          monthlyQuota: m.monthlyQuota,
        },
      })
    )
  )
  console.log(`  ✓ ${createdMembers.length} members created`)

  // Create member quotas — current year, most paid
  let quotaCount = 0
  for (const member of createdMembers) {
    for (let month = 1; month <= currentMonth; month++) {
      const paid = month < currentMonth ? Math.random() > 0.1 : Math.random() > 0.5
      await prisma.quota.create({
        data: {
          memberId: member.id,
          year: currentYear,
          month,
          paid,
          amount: member.monthlyQuota,
          paidAt: paid ? new Date(currentYear, month - 1, Math.floor(Math.random() * 5) + 1) : null,
        },
      })
      if (paid) quotaCount++
    }
  }
  console.log(`  ✓ ${quotaCount} member quotas paid`)

  // Create sponsors
  for (const s of club.sponsors) {
    await prisma.sponsor.create({
      data: {
        clubId: createdClub.id,
        name: s.name,
        annualContribution: s.annualContribution,
        contractStart: s.contractStart,
        contractEnd: s.contractEnd,
      },
    })
  }
  console.log(`  ✓ ${club.sponsors.length} sponsors created`)

  // Create some materials
  const materials = [
    { name: 'Stick Reno R4',  category: 'ATHLETE',     type: 'Stick',     state: 'FREE',     paidAmount: 85,  paidByAthlete: true },
    { name: 'Capacete Tour',  category: 'ATHLETE',     type: 'Capacete',  state: 'FREE',     paidAmount: 120, paidByAthlete: false },
    { name: 'Luvas Bauer',    category: 'ATHLETE',     type: 'Luvas',     state: 'ASSIGNED', paidAmount: 45,  paidByAthlete: true },
    { name: 'Stick TK',       category: 'ATHLETE',     type: 'Stick',     state: 'DAMAGED',  paidAmount: 70,  paidByAthlete: false },
    { name: 'Máscara GK Pro', category: 'GOALKEEPER',  type: 'Máscara',   state: 'ASSIGNED', paidAmount: 200, paidByAthlete: false },
  ]
  for (const m of materials) {
    await prisma.material.create({
      data: {
        clubId: createdClub.id,
        name: m.name,
        category: m.category as 'ATHLETE' | 'GOALKEEPER' | 'SMALL',
        type: m.type,
        state: m.state as 'FREE' | 'ASSIGNED' | 'DAMAGED',
        paidAmount: m.paidAmount,
        paidByAthlete: m.paidByAthlete,
      },
    })
  }
  console.log(`  ✓ ${materials.length} materials created`)

  // Create a travel
  await prisma.travel.create({
    data: {
      clubId: createdClub.id,
      opponent: 'HC Rival Demo',
      departureDate: daysFromNow(14),
      returnDate: daysFromNow(15),
      transport: 'BUS',
      notes: 'Jogo da liga — convocatória a confirmar',
    },
  })
  console.log(`  ✓ 1 travel created (14 days from now)`)

  return createdClub
}

async function main() {
  console.log('🏒 HoqueiManager — Seed test clubs\n')

  // Clean existing test clubs
  for (const c of CLUBS) {
    const existing = await prisma.club.findUnique({ where: { slug: c.slug } })
    if (existing) {
      await prisma.club.delete({ where: { slug: c.slug } })
      console.log(`  ✗ Deleted existing club: ${c.slug}`)
    }
  }

  for (const club of CLUBS) {
    await seedClub(club)
  }

  console.log('\n✅ Done! Test credentials:')
  for (const club of CLUBS) {
    console.log(`  ${club.name}: ${club.email} / ${club.adminPassword}`)
  }
  console.log('\n  Super admin: superadmin@hoqueimanager.com / superadmin123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
