import { z } from 'zod'
import { DIRECTION_ROLES } from '@/lib/constants'

// Em Zod v4, `.partial()` NÃO neutraliza `.default(...)` — um campo com valor por
// omissão continua a ser injectado mesmo que a chave esteja ausente do pedido, o que
// faz um PUT parcial (ex: só `{ notes: "..." }`) apagar silenciosamente outros campos
// ao cair no valor por omissão. Por isso todos os pares create/update abaixo seguem o
// mesmo padrão: um "base" schema SEM `.default()`, estendido com defaults só no schema
// de create; o schema de update deriva do base (nunca do create) via `.partial()`.

// ─── Seasons ──────────────────────────────────────────────────────────────────

export const createSeasonSchema = z.object({
  name:      z.string().min(3, 'Nome obrigatório (ex: 2025/2026)').max(20),
  startDate: z.string().min(1, 'Data de início obrigatória'),
  endDate:   z.string().min(1, 'Data de fim obrigatória'),
})

export const updateSeasonSchema = createSeasonSchema.partial().extend({
  defaultAthleteMonthlyFee:  z.coerce.number().min(0).nullable().optional(),
  defaultMemberMonthlyQuota: z.coerce.number().min(0).nullable().optional(),
})

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const setupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

// ─── Athletes ─────────────────────────────────────────────────────────────────

const athleteBaseSchema = z.object({
  number: z.coerce.number().int().positive('Número deve ser positivo'),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  ageGroup: z.enum(['SUB11', 'SUB13', 'SUB15', 'SUB17', 'SUB19', 'SENIORS']),
  birthDate: z.string().min(1, 'Data de nascimento obrigatória')
    .refine((v) => new Date(v) <= new Date(), 'Data de nascimento não pode ser futura'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  nif: z.string().optional(),
  address: z.string().optional(),
  school: z.string().optional(),
  idCard: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  monthlyFee: z.coerce.number().min(0).optional(),
  discountPercent: z.coerce.number().min(0).max(100).nullable().optional(),
  feeExempt: z.boolean().optional(),
  // "saiu do clube" — não exposto no formulário de criação/edição normal, só através
  // da ação dedicada "Atleta saiu do clube" / "Reativar". null = ainda activo.
  leftAt: z.string().nullable().optional(),
})

export const createAthleteSchema = athleteBaseSchema.extend({
  monthlyFee: z.coerce.number().min(0).optional().default(0),
  feeExempt:  z.boolean().optional().default(false),
})

export const updateAthleteSchema = athleteBaseSchema.partial()

// ─── Members ──────────────────────────────────────────────────────────────────

const memberBaseSchema = z.object({
  name:         z.string().min(2, 'Nome obrigatório'),
  seasonId:     z.string().uuid('Época inválida').optional().nullable(),
  phone:        z.string().optional(),
  email:        z.string().email('Email inválido').optional().or(z.literal('')),
  address:      z.string().optional(),
  monthlyQuota: z.coerce.number().min(0).optional(),
})

export const createMemberSchema = memberBaseSchema.extend({
  monthlyQuota: z.coerce.number().min(0).optional().default(0),
})

export const updateMemberSchema = memberBaseSchema.partial()

// ─── Materials ────────────────────────────────────────────────────────────────

const materialBaseSchema = z.object({
  name:          z.string().optional(),
  category:      z.enum(['ATHLETE', 'GOALKEEPER', 'SMALL']),
  type:          z.string().min(1, 'Tipo obrigatório'),
  state:         z.enum(['FREE', 'ASSIGNED', 'DAMAGED']).optional(),
  seasonId:      z.string().uuid().nullable().optional(),
  athleteId:     z.string().uuid().nullable().optional(),
  notes:         z.string().optional(),
  paidByAthlete: z.boolean().optional(),
  paidAmount:    z.coerce.number().nullable().optional(),
})

export const createMaterialSchema = materialBaseSchema.extend({
  name:          z.string().optional().default(''),
  state:         z.enum(['FREE', 'ASSIGNED', 'DAMAGED']).optional().default('FREE'),
  paidByAthlete: z.boolean().optional().default(false),
})

export const updateMaterialSchema = materialBaseSchema.partial()

// ─── Sponsors ─────────────────────────────────────────────────────────────────

const sponsorBaseSchema = z.object({
  name:               z.string().min(1, 'Nome obrigatório'),
  seasonId:           z.string().uuid('Época inválida').optional().nullable(),
  website:            z.string().optional(),
  phone:              z.string().optional(),
  email:              z.string().email('Email inválido').optional().or(z.literal('')),
  annualContribution: z.coerce.number().min(0).optional(),
  contractStart:      z.string().min(1, 'Data de início obrigatória'),
  contractEnd:        z.string().min(1, 'Data de fim obrigatória'),
  notes:              z.string().optional(),
  logoUrl:            z.string().optional().nullable(),
  sponsorTypes:       z.array(z.string()).optional(),
  equipmentZones:     z.array(z.coerce.number().int().min(1).max(6)).optional(),
  bannerCount:        z.coerce.number().int().min(0).optional().nullable(),
  includesSticks:     z.boolean().optional(),
  includesShinguards: z.boolean().optional(),
})

export const createSponsorSchema = sponsorBaseSchema.extend({
  annualContribution: z.coerce.number().min(0).default(0),
  sponsorTypes:       z.array(z.string()).default([]),
  equipmentZones:     z.array(z.coerce.number().int().min(1).max(6)).default([]),
  includesSticks:     z.boolean().default(false),
  includesShinguards: z.boolean().default(false),
})

export const updateSponsorSchema = sponsorBaseSchema.partial()

// ─── Travel ───────────────────────────────────────────────────────────────────

const travelBaseSchema = z.object({
  opponent: z.string().min(1, 'Adversário obrigatório'),
  pavilionUrl: z.string().optional().refine(
    (v) => !v || /^https?:\/\//.test(v),
    { message: 'URL inválida (deve começar com http:// ou https://)' }
  ),
  departureDate: z.string().min(1, 'Data de partida obrigatória'),
  returnDate: z.string().optional().nullable(),
  departureTime: z.string().optional(),
  transport: z.string().optional(),
  drivers: z.array(z.string()).optional(),
  meal: z.string().optional(),
  notes: z.string().optional(),
  convocados: z.array(z.string()).optional(),
  budgetTransport: z.coerce.number().optional().nullable(),
  budgetMeal: z.coerce.number().optional().nullable(),
  budgetAccommodation: z.coerce.number().optional().nullable(),
  checklistItems: z.array(z.string()).optional(),
})

export const createTravelSchema = travelBaseSchema.extend({
  drivers: z.array(z.string()).default([]),
  convocados: z.array(z.string()).default([]),
  checklistItems: z.array(z.string()).default([]),
})

export const updateTravelSchema = travelBaseSchema.partial()

// ─── Training ─────────────────────────────────────────────────────────────────

export const createTrainingSchema = z.object({
  date: z.string().min(1, 'Data obrigatória'),
  title: z.string().min(1, 'Título obrigatório'),
  notes: z.string().optional(),
})

export const updateTrainingSchema = createTrainingSchema.partial()

// ─── Direction ────────────────────────────────────────────────────────────────

const directionBaseSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  numFpp: z.string().max(30).nullable().optional(),
  roles: z.array(z.enum(DIRECTION_ROLES)).min(1, 'Selecione pelo menos um cargo'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  salary: z.coerce.number().min(0).nullable().optional(),
  athleteId: z.string().uuid().nullable().optional(),
  trainerAgeGroups: z.array(z.string()).optional(),
  sectionistAgeGroups: z.array(z.string()).optional(),
})

export const createDirectionSchema = directionBaseSchema.extend({
  trainerAgeGroups: z.array(z.string()).optional().default([]),
  sectionistAgeGroups: z.array(z.string()).optional().default([]),
})

export const updateDirectionSchema = directionBaseSchema.partial()

// ─── Attendance ───────────────────────────────────────────────────────────────

const trainingSessionBaseSchema = z.object({
  date: z.string().min(1, 'Data obrigatória'),
  time: z.string().optional(),
  primaryAgeGroup: z.enum(['SUB11', 'SUB13', 'SUB15', 'SUB17', 'SUB19', 'SENIORS']),
  sessionType: z.enum(['GENERAL', 'GOALKEEPERS', 'FIELD_PLAYERS', 'SPECIFIC']).optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
  scheduleId: z.string().uuid().optional().nullable(),
})

export const createTrainingSessionSchema = trainingSessionBaseSchema.extend({
  sessionType: z.enum(['GENERAL', 'GOALKEEPERS', 'FIELD_PLAYERS', 'SPECIFIC']).default('GENERAL'),
})

export const updateTrainingSessionSchema = trainingSessionBaseSchema.partial()

export const bulkAttendanceSchema = z.object({
  records: z.array(z.object({
    athleteId: z.string().uuid(),
    present: z.boolean(),
    notes: z.string().optional(),
    paidByAthlete: z.boolean().optional().default(false),
    paidAmount: z.coerce.number().nullable().optional(),
  })),
})

// ─── Textiles ─────────────────────────────────────────────────────────────────

const textileBaseSchema = z.object({
  category:      z.enum(['GAME', 'TRAINING', 'OTHER']),
  type:          z.enum(['GAME_SHIRT', 'GAME_SHORTS', 'GAME_SOCKS', 'GK_SHIRT', 'TRAINING_TOP', 'TRAINING_PANTS', 'TRAINING_KIT', 'JACKET', 'TSHIRT', 'OTHER']),
  size:          z.string().min(1, 'Tamanho obrigatório'),
  seasonId:      z.string().uuid().nullable().optional(),
  // Use union to avoid coerce-then-positive failing on null values in Zod v4
  jerseyNumber:  z.union([z.number().int().positive(), z.null()]).optional(),
  personalized:  z.boolean().optional(),
  personalizationDetails: z.string().nullable().optional(),
  // Legado (label de época em texto livre) — segue o mesmo limite do nome de Season,
  // já não é restrito a "AAAA/AA" porque Season.name aceita qualquer formato (ex: "2025/2026").
  season:        z.string().min(3, 'Época obrigatória').max(20),
  state:         z.enum(['STOCK', 'ASSIGNED', 'DAMAGED', 'LOST']).optional(),
  athleteId: z.string().uuid().nullable().optional(),
  isPartOfKit: z.boolean().optional(),
  kitRef: z.string().nullable().optional(),
  paidByAthlete: z.boolean().optional(),
  paidAmount: z.union([z.number().min(0), z.null()]).optional(),
  totalCost: z.union([z.number().min(0), z.null()]).optional(),
  notes: z.string().nullable().optional(),
})

export const createTextileSchema = textileBaseSchema.extend({
  personalized:  z.boolean().optional().default(false),
  state:         z.enum(['STOCK', 'ASSIGNED', 'DAMAGED', 'LOST']).optional().default('STOCK'),
  isPartOfKit: z.boolean().optional().default(false),
  paidByAthlete: z.boolean().optional().default(false),
})

export const updateTextileSchema = textileBaseSchema.partial()
