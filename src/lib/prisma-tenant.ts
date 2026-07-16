import { prisma } from './prisma'

// Models with a direct clubId column — Extension auto-injects clubId on all operations.
// AthletePayment, Quota, DirectionSalaryPayment, AttendanceRecord have clubId directly
// (migration 20260626000001) and are listed below. Playbook has no clubId column — it is
// protected via parent Training ownership checks in its route, not by this extension.
const TENANTED = new Set([
  'season',
  'athlete', 'member', 'sponsor', 'material', 'travel',
  'directionmember', 'training', 'trainingschedule',
  'trainingsession', 'textileitem', 'auditlog',
  // Payment/attendance models now have explicit clubId (migration 20260626000001)
  'athletepayment', 'quota', 'directionsalarypayment', 'attendancerecord',
])

function isTenanted(model: string) {
  return TENANTED.has(model.toLowerCase())
}

// WhereUniqueInput wraps compound keys in a named object, e.g. { athleteId_month_year: { athleteId, month, year } }.
// findFirst/findMany take a plain WhereInput, so flatten any such wrapper into top-level fields.
function flattenUniqueWhere(where: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(where)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flat, value as Record<string, unknown>)
    } else {
      flat[key] = value
    }
  }
  return flat
}

export function getTenantClient(clubId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (isTenanted(model)) args.where = { ...(args.where as object), clubId }
          return query(args)
        },
        async findFirst({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (isTenanted(model)) args.where = { ...(args.where as object), clubId }
          return query(args)
        },
        async findUnique({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (isTenanted(model)) args.where = { ...(args.where as object), clubId }
          return query(args)
        },
        async create({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (isTenanted(model)) {
            const data = args.data as Record<string, unknown>
            args.data = { ...data, clubId }
          }
          return query(args)
        },
        async createMany({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (isTenanted(model)) {
            const data = args.data as Record<string, unknown>[]
            args.data = Array.isArray(data) ? data.map(d => ({ ...d, clubId })) : { ...(data as object), clubId }
          }
          return query(args)
        },
        async update({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (isTenanted(model)) args.where = { ...(args.where as object), clubId }
          return query(args)
        },
        async updateMany({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (isTenanted(model)) args.where = { ...(args.where as object), clubId }
          return query(args)
        },
        async delete({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (isTenanted(model)) args.where = { ...(args.where as object), clubId }
          return query(args)
        },
        async deleteMany({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (isTenanted(model)) args.where = { ...(args.where as object), clubId }
          return query(args)
        },
        async count({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (isTenanted(model)) args.where = { ...(args.where as object), clubId }
          return query(args)
        },
        async aggregate({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (isTenanted(model)) args.where = { ...(args.where as object), clubId }
          return query(args)
        },
        async groupBy({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (isTenanted(model)) args.where = { ...(args.where as object), clubId }
          return query(args)
        },
        async upsert({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          if (isTenanted(model)) {
            // Prisma's generated WhereUniqueInput for these models rejects clubId as an
            // extra filter (compound key only), so it can't be merged into args.where like
            // the other operations. Instead, resolve ownership via findFirst before running
            // the upsert — otherwise it could match and silently overwrite another club's
            // row sharing the same non-clubId unique key (e.g. athleteId+month+year).
            const delegateName = model.charAt(0).toLowerCase() + model.slice(1)
            const delegate = (prisma as unknown as Record<string, {
              findFirst: (args: { where: unknown }) => Promise<{ clubId: string } | null>
            }>)[delegateName]
            const existing = await delegate.findFirst({ where: flattenUniqueWhere(args.where as Record<string, unknown>) })
            if (existing && existing.clubId !== clubId) {
              throw new Error(`Tenant isolation violation: upsert on ${model} matched a row belonging to another club`)
            }
            const create = args.create as Record<string, unknown>
            args.create = { ...create, clubId }
          }
          return query(args)
        },
      },
    },
  })
}

export type TenantClient = ReturnType<typeof getTenantClient>
