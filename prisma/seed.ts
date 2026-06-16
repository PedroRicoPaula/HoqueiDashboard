import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { webcrypto } from 'node:crypto'

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgresql123@localhost:5432/hcpdl'

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
    // ─── Admin user ───────────────────────────────────────────────────────────
    const existing = await prisma.user.findUnique({ where: { email: 'admin@hcpdl.pt' } })
    if (!existing) {
      await prisma.user.create({
        data: {
          name: 'Administrador',
          email: 'admin@hcpdl.pt',
          password: await hashPassword('admin123'),
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
      console.log('✓ Admin criado: admin@hcpdl.pt / admin123')
    } else {
      console.log('· Admin já existe')
    }

    // ─── Direção ──────────────────────────────────────────────────────────────
    const direcaoCount = await prisma.directionMember.count()
    if (direcaoCount === 0) {
      await prisma.directionMember.createMany({
        data: [
          { name: 'Carlos Guimarães', roles: ['TRAINER'], trainerAgeGroups: ['SENIORS'], sectionistAgeGroups: [] },
          { name: 'João Oliveira', roles: ['DIRECTOR'], sectionistAgeGroups: [] },
          { name: 'Paulo Benjamim', roles: ['DIRECTOR'], sectionistAgeGroups: [] },
          { name: 'Fernando Pimentel', roles: ['DIRECTOR'], sectionistAgeGroups: [] },
          { name: 'Paulo Correia', roles: ['ASSISTANT_TRAINER'], sectionistAgeGroups: [] },
        ],
      })
      console.log('✓ Direção criada (5 membros)')
    }

    // ─── Atletas ──────────────────────────────────────────────────────────────
    const athleteCount = await prisma.athlete.count()
    if (athleteCount === 0) {
      const athletes = [
        // Seniores
        { number: 1,  name: 'Nuno Teixeira',       ageGroup: 'SENIORS', birthDate: new Date('1990-01-01') },
        { number: 2,  name: 'Simão Loureiro',       ageGroup: 'SENIORS', birthDate: new Date('1991-03-15') },
        { number: 3,  name: 'Tiago Pimentel',       ageGroup: 'SENIORS', birthDate: new Date('1995-06-20') },
        { number: 4,  name: 'Alexandre Resendes',   ageGroup: 'SENIORS', birthDate: new Date('1994-09-10') },
        { number: 5,  name: 'Vicente Correia',      ageGroup: 'SENIORS', birthDate: new Date('1996-11-05') },
        { number: 6,  name: 'Alexandre Ornelas',    ageGroup: 'SENIORS', birthDate: new Date('1993-04-22') },
        { number: 7,  name: 'Miguel Pimentel',      ageGroup: 'SENIORS', birthDate: new Date('1997-07-18') },
        { number: 8,  name: 'Carlos Guimarães',     ageGroup: 'SENIORS', birthDate: new Date('1985-02-14') },
        { number: 9,  name: 'Tiago Leite',          ageGroup: 'SENIORS', birthDate: new Date('1998-12-01') },
        { number: 10, name: 'Pedro Paula',          ageGroup: 'SENIORS', birthDate: new Date('1992-05-30') },
        { number: 11, name: 'Francisco Freitas',    ageGroup: 'SENIORS', birthDate: new Date('1999-08-25') },
        // Sub-17
        { number: 20, name: 'Rafael Rocha',         ageGroup: 'SUB17', birthDate: new Date('2009-03-10') },
        { number: 21, name: 'João Albuquerque',     ageGroup: 'SUB17', birthDate: new Date('2009-07-22') },
        { number: 22, name: 'Gil Ribeiro',          ageGroup: 'SUB17', birthDate: new Date('2010-01-15') },
        { number: 23, name: 'Gonçalo Mendonça',     ageGroup: 'SUB17', birthDate: new Date('2009-11-03') },
        { number: 24, name: 'Gustavo Cordeiro',     ageGroup: 'SUB17', birthDate: new Date('2010-04-18') },
        { number: 25, name: 'Benjamim Castanheira', ageGroup: 'SUB17', birthDate: new Date('2009-09-27') },
        { number: 26, name: 'Miguel Silva',         ageGroup: 'SUB17', birthDate: new Date('2010-02-08') },
        { number: 27, name: 'Pedro Massa',          ageGroup: 'SUB17', birthDate: new Date('2009-06-14') },
        { number: 28, name: 'Gonçalo Cordovil',     ageGroup: 'SUB17', birthDate: new Date('2010-05-20') },
        { number: 29, name: 'Carolina Benjamim',    ageGroup: 'SUB17', birthDate: new Date('2009-12-31') },
        { number: 30, name: 'Kelly Silvestre',      ageGroup: 'SUB17', birthDate: new Date('2010-03-17') },
        { number: 31, name: 'David Oliveira',       ageGroup: 'SUB17', birthDate: new Date('2009-08-09') },
        { number: 32, name: 'Ana Benjamim',         ageGroup: 'SUB17', birthDate: new Date('2010-07-04') },
        { number: 33, name: 'Marco Pacheco',        ageGroup: 'SUB17', birthDate: new Date('2009-10-16') },
        { number: 34, name: 'Rodrigo Cachapa',      ageGroup: 'SUB17', birthDate: new Date('2010-06-28') },
        // Sub-13
        { number: 40, name: 'Santiago Sousa',       ageGroup: 'SUB13', birthDate: new Date('2013-02-05') },
        { number: 41, name: 'Pedro Pacheco',        ageGroup: 'SUB13', birthDate: new Date('2013-06-18') },
        { number: 42, name: 'Santiago Resendes',    ageGroup: 'SUB13', birthDate: new Date('2013-09-23') },
        { number: 43, name: 'Salvador Resendes',    ageGroup: 'SUB13', birthDate: new Date('2013-11-11') },
        { number: 44, name: 'João Dias',            ageGroup: 'SUB13', birthDate: new Date('2013-04-07') },
        { number: 45, name: 'Guilherme Tavares',    ageGroup: 'SUB13', birthDate: new Date('2013-08-30') },
        { number: 46, name: 'Núria Faria',          ageGroup: 'SUB13', birthDate: new Date('2013-01-19') },
        { number: 47, name: 'Simão Melo',           ageGroup: 'SUB13', birthDate: new Date('2013-05-14') },
        { number: 48, name: 'Lourenço Áspera',      ageGroup: 'SUB13', birthDate: new Date('2013-12-02') },
        // Sub-11
        { number: 50, name: 'Jonas Oliveira',       ageGroup: 'SUB11', birthDate: new Date('2015-03-12') },
        { number: 51, name: 'Joana Lourenço',       ageGroup: 'SUB11', birthDate: new Date('2015-07-25') },
        { number: 52, name: 'João Barroso',         ageGroup: 'SUB11', birthDate: new Date('2015-01-08') },
        { number: 53, name: 'Nuno Massa',           ageGroup: 'SUB11', birthDate: new Date('2015-10-16') },
        { number: 54, name: 'Leandro Rodrigues',    ageGroup: 'SUB11', birthDate: new Date('2015-05-03') },
        { number: 55, name: 'Rafael Malheiro',      ageGroup: 'SUB11', birthDate: new Date('2015-09-29') },
        { number: 56, name: 'Tiago Pereira',        ageGroup: 'SUB11', birthDate: new Date('2015-04-20') },
        { number: 57, name: 'José Vieira',          ageGroup: 'SUB11', birthDate: new Date('2015-11-07') },
        { number: 58, name: 'Vasco Lourenço',       ageGroup: 'SUB11', birthDate: new Date('2016-02-14') },
      ] as const

      for (const a of athletes) {
        await prisma.athlete.create({ data: a })
      }
      console.log(`✓ ${athletes.length} atletas criados`)
    }

    // ─── Patrocinadores ───────────────────────────────────────────────────────
    const sponsorCount = await prisma.sponsor.count()
    if (sponsorCount === 0) {
      await prisma.sponsor.createMany({
        data: [
          {
            name: 'Azemad',
            website: 'https://azemad.com/',
            annualContribution: 1500,
            contractStart: new Date('2025-01-01'),
            contractEnd: new Date('2026-12-31'),
            logoUrl: '/uploads/AzemadLogo.jpg',
          },
          {
            name: 'Auto Cordeiro',
            website: 'https://autocordeiro.com',
            annualContribution: 1200,
            contractStart: new Date('2025-01-01'),
            contractEnd: new Date('2026-12-31'),
            logoUrl: '/uploads/AutoCordeiroLogo1.png',
          },
          {
            name: 'Crenku',
            website: 'https://www.facebook.com/crenku/?locale=pt_PT',
            annualContribution: 800,
            contractStart: new Date('2025-01-01'),
            contractEnd: new Date('2026-12-31'),
            logoUrl: '/uploads/CrenkuLogo.png',
          },
          {
            name: 'Catchawards',
            website: 'https://www.catchawardsportugal.pt/',
            annualContribution: 1000,
            contractStart: new Date('2025-01-01'),
            contractEnd: new Date('2026-12-31'),
            logoUrl: '/uploads/catchawards.png',
          },
          {
            name: 'Agência Funerária Lindo',
            website: 'https://www.facebook.com/funerarialindo/?locale=pt_PT',
            annualContribution: 600,
            contractStart: new Date('2025-01-01'),
            contractEnd: new Date('2026-12-31'),
            logoUrl: '/uploads/FunerariaLindoLogo.jpg',
          },
        ],
      })
      console.log('✓ 5 patrocinadores criados')
    }

    // ─── Viagens (eventos da landing page) ───────────────────────────────────
    const travelCount = await prisma.travel.count()
    if (travelCount === 0) {
      await prisma.travel.createMany({
        data: [
          {
            opponent: 'AJ Salesiana',
            departureDate: new Date('2026-03-21T15:00:00'),
            pavilionUrl: '',
            departureTime: '13:30',
            transport: 'Autocar',
            drivers: [],
            notes: 'Seniores — Pavilhão Sidónio Serpa',
          },
          {
            opponent: 'HCP Grândola',
            departureDate: new Date('2026-04-11T16:00:00'),
            pavilionUrl: '',
            departureTime: '14:00',
            transport: 'Autocar',
            drivers: [],
            notes: 'Seniores — Pavilhão Sidónio Serpa',
          },
          {
            opponent: 'HC Sintra',
            departureDate: new Date('2026-05-02T16:00:00'),
            pavilionUrl: '',
            departureTime: '14:00',
            transport: 'Autocar',
            drivers: [],
            notes: 'Seniores — Pavilhão Sidónio Serpa',
          },
          {
            opponent: 'CD Boliqueime',
            departureDate: new Date('2026-05-23T16:00:00'),
            pavilionUrl: '',
            departureTime: '14:00',
            transport: 'Autocar',
            drivers: [],
            notes: 'Seniores — Pavilhão Sidónio Serpa',
          },
          {
            opponent: 'Caldeiras HC (Sub-11)',
            departureDate: new Date('2026-03-21T17:00:00'),
            pavilionUrl: '',
            departureTime: '15:30',
            transport: 'Automóveis Particulares',
            drivers: [],
            notes: 'Formação Sub-11 — Pavilhão Sidónio Serpa',
          },
          {
            opponent: 'Caldeiras HC (Sub-13)',
            departureDate: new Date('2026-03-22T10:00:00'),
            pavilionUrl: '',
            departureTime: '08:30',
            transport: 'Automóveis Particulares',
            drivers: [],
            notes: 'Formação Sub-13 — Pavilhão Sidónio Serpa',
          },
        ],
      })
      console.log('✓ 6 viagens criadas')
    }

  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
