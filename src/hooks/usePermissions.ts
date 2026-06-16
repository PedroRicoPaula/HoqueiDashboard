'use client'
import { useAuthStore } from '@/store/authStore'
import type { Permission } from '@prisma/client'

export function usePermissions() {
  const permissions = useAuthStore((s) => s.permissions)
  return {
    can: (flag: keyof Omit<Permission, 'id' | 'userId'>) => {
      if (!permissions) return false
      if (permissions.isAdmin) return true
      return Boolean(permissions[flag])
    },
    isAdmin: permissions?.isAdmin ?? false,
    permissions,
  }
}
