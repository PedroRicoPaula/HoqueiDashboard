import { prisma } from './prisma'

// Models with a direct clubId column — Extension auto-injects clubId on all operations.
// Child models (AthletePayment, Quota, DirectionSalaryPayment, Playbook) are NOT listed:
// they have no clubId column and are protected via parent ownership checks in each route.
// AttendanceRecord: also no clubId — routes protect via `session: { clubId }` join filter;
// any new AttendanceRecord endpoint MUST include that filter explicitly.
const TENANTED = new Set([
  'athlete', 'member', 'sponsor', 'material', 'travel',
  'directionmember', 'training', 'trainingschedule',
  'trainingsession', 'textileitem', 'auditlog',
])

function isTenanted(model: string) {
  return TENANTED.has(model.toLowerCase())
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
        async updateMany({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
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
      },
    },
  })
}

export type TenantClient = ReturnType<typeof getTenantClient>
