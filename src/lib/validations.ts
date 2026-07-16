import { z } from 'zod'
import { DIRECTION_ROLES } from '@/lib/constants'

// ─── Seasons ──────────────────────────────────────────────────────────────────

export const createSeasonSchema = z.object({
  name:      z.string().min(3, 'Nome obrigatório (ex: 2025/2026)').max(20),
  startDate: z.string().min(1, 'Data de início obrigatória'),
  endDate:   z.string().min(1, 'Data de fim obrigatória'),
})

export const updateSeasonSchema = createSeasonSchema.partial()

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

export const createAthleteSchema = z.object({
  number: z.coerce.number().int().positive('Número deve ser positivo'),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  ageGroup: z.enum(['SUB11', 'SUB13', 'SUB15', 'SUB17', 'SUB19', 'SENIORS']),
  birthDate: z.string().min(1, 'Data de nascimento obrigatória'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  nif: z.string().optional(),
  address: z.string().optional(),
  school: z.string().optional(),
  idCard: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  monthlyFee: z.coerce.number().min(0).optional().default(0),
  feeExempt: z.boolean().optional().default(false),
})

export const updateAthleteSchema = createAthleteSchema.partial()

// ─── Members ──────────────────────────────────────────────────────────────────

export const createMemberSchema = z.object({
  name:         z.string().min(2, 'Nome obrigatório'),
  seasonId:     z.string().uuid('Época inválida').optional().nullable(),
  phone:        z.string().optional(),
  email:        z.string().email('Email inválido').optional().or(z.literal('')),
  address:      z.string().optional(),
  monthlyQuota: z.coerce.number().min(0).default(0),
})

export const updateMemberSchema = createMemberSchema.partial()

// ─── Materials ────────────────────────────────────────────────────────────────

export const createMaterialSchema = z.object({
  name: z.string().optional().default(''),
  category: z.enum(['ATHLETE', 'GOALKEEPER', 'SMALL']),
  type: z.string().min(1, 'Tipo obrigatório'),
  state: z.enum(['FREE', 'ASSIGNED', 'DAMAGED']).optional().default('FREE'),
  athleteId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  paidByAthlete: z.boolean().optional().default(false),
  paidAmount: z.coerce.number().nullable().optional(),
})

export const updateMaterialSchema = createMaterialSchema.partial()

// ─── Sponsors ─────────────────────────────────────────────────────────────────

export const createSponsorSchema = z.object({
  name:               z.string().min(1, 'Nome obrigatório'),
  seasonId:           z.string().uuid('Época inválida').optional().nullable(),
  website:            z.string().optional(),
  phone:              z.string().optional(),
  email:              z.string().email('Email inválido').optional().or(z.literal('')),
  annualContribution: z.coerce.number().min(0).default(0),
  contractStart:      z.string().min(1, 'Data de início obrigatória'),
  contractEnd:        z.string().min(1, 'Data de fim obrigatória'),
  notes:              z.string().optional(),
  logoUrl:            z.string().optional().nullable(),
  sponsorTypes:       z.array(z.string()).default([]),
  equipmentZones:     z.array(z.coerce.number().int().min(1).max(6)).default([]),
  bannerCount:        z.coerce.number().int().min(0).optional().nullable(),
  includesSticks:     z.boolean().default(false),
  includesShinguards: z.boolean().default(false),
})

export const updateSponsorSchema = createSponsorSchema.partial()

// ─── Travel ───────────────────────────────────────────────────────────────────

export const createTravelSchema = z.object({
  opponent: z.string().min(1, 'Adversário obrigatório'),
  pavilionUrl: z.string().optional().refine(
    (v) => !v || /^https?:\/\//.test(v),
    { message: 'URL inválida (deve começar com http:// ou https://)' }
  ),
  departureDate: z.string().min(1, 'Data de partida obrigatória'),
  returnDate: z.string().optional().nullable(),
  departureTime: z.string().optional(),
  transport: z.string().optional(),
  drivers: z.array(z.string()).default([]),
  meal: z.string().optional(),
  notes: z.string().optional(),
  convocados: z.array(z.string()).default([]),
  budgetTransport: z.coerce.number().optional().nullable(),
  budgetMeal: z.coerce.number().optional().nullable(),
  budgetAccommodation: z.coerce.number().optional().nullable(),
  checklistItems: z.array(z.string()).default([]),
})

export const updateTravelSchema = createTravelSchema.partial()

// ─── Training ─────────────────────────────────────────────────────────────────

export const createTrainingSchema = z.object({
  date: z.string().min(1, 'Data obrigatória'),
  title: z.string().min(1, 'Título obrigatório'),
  notes: z.string().optional(),
})

export const updateTrainingSchema = createTrainingSchema.partial()

// ─── Direction ────────────────────────────────────────────────────────────────

export const createDirectionSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  roles: z.array(z.enum(DIRECTION_ROLES)).min(1, 'Selecione pelo menos um cargo'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  salary: z.coerce.number().min(0).nullable().optional(),
  athleteId: z.string().uuid().nullable().optional(),
  trainerAgeGroups: z.array(z.string()).optional().default([]),
  sectionistAgeGroups: z.array(z.string()).optional().default([]),
})

export const updateDirectionSchema = createDirectionSchema.partial()

// ─── Attendance ───────────────────────────────────────────────────────────────

export const createTrainingSessionSchema = z.object({
  date: z.string().min(1, 'Data obrigatória'),
  time: z.string().optional(),
  primaryAgeGroup: z.enum(['SUB11', 'SUB13', 'SUB15', 'SUB17', 'SUB19', 'SENIORS']),
  sessionType: z.enum(['GENERAL', 'GOALKEEPERS', 'FIELD_PLAYERS', 'SPECIFIC']).default('GENERAL'),
  title: z.string().optional(),
  notes: z.string().optional(),
  scheduleId: z.string().uuid().optional().nullable(),
})

export const updateTrainingSessionSchema = createTrainingSessionSchema.partial()

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

export const createTextileSchema = z.object({
  category: z.enum(['GAME', 'TRAINING', 'OTHER']),
  type: z.enum(['GAME_SHIRT', 'GAME_SHORTS', 'GAME_SOCKS', 'GK_SHIRT', 'TRAINING_TOP', 'TRAINING_PANTS', 'TRAINING_KIT', 'JACKET', 'TSHIRT', 'OTHER']),
  size: z.string().min(1, 'Tamanho obrigatório'),
  // Use union to avoid coerce-then-positive failing on null values in Zod v4
  jerseyNumber: z.union([z.number().int().positive(), z.null()]).optional(),
  personalized: z.boolean().optional().default(false),
  personalizationDetails: z.string().nullable().optional(),
  season: z.string().regex(/^\d{4}\/\d{2}$/, 'Formato inválido — use AAAA/AA (ex: 2025/26)'),
  state: z.enum(['STOCK', 'ASSIGNED', 'DAMAGED', 'LOST']).optional().default('STOCK'),
  athleteId: z.string().uuid().nullable().optional(),
  isPartOfKit: z.boolean().optional().default(false),
  kitRef: z.string().nullable().optional(),
  paidByAthlete: z.boolean().optional().default(false),
  paidAmount: z.union([z.number().min(0), z.null()]).optional(),
  totalCost: z.union([z.number().min(0), z.null()]).optional(),
  notes: z.string().nullable().optional(),
})

export const updateTextileSchema = createTextileSchema.partial()
