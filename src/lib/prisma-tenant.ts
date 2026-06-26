import { prisma } from './prisma'

const TENANTED = new Set([
  'athlete', 'member', 'sponsor', 'material', 'travel',
  'directionmember', 'training', 'trainingschedule',
  'trainingsession', 'textileitem', 'auditlog',
  // Payment/attendance models now have explicit clubId (migration 20260626000001)
  'athletepayment', 'quota', 'directionsalarypayment', 'attendancerecord',
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
            // Only inject into create data — where must reference the existing unique constraint exactly
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
