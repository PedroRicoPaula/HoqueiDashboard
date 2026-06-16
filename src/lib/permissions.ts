import type { Permission } from '@prisma/client'

export function hasPermission(
  permissions: Permission | null | undefined,
  flag: keyof Permission
): boolean {
  if (!permissions) return false
  if (permissions.isAdmin) return true
  return Boolean(permissions[flag])
}
