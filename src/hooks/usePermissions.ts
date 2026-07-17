'use client'
import { useCallback, useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import type { Permission } from '@prisma/client'

export function usePermissions() {
  const permissions = useAuthStore((s) => s.permissions)

  // `can` tem de manter a mesma referência entre renders enquanto `permissions` não
  // mudar — muitos componentes metem `can` (ou algo que o usa, ex: fetchX) numa
  // dependency array de useEffect/useCallback. Sem isto, cada render cria um `can`
  // novo → o efeito volta a disparar → novo state update → novo render → loop
  // infinito de fetches (confirmado em produção: ERR_INSUFFICIENT_RESOURCES no
  // perfil do atleta, 2026-07-17).
  const can = useCallback(
    (flag: keyof Omit<Permission, 'id' | 'userId'>) => {
      if (!permissions) return false
      if (permissions.isAdmin) return true
      return Boolean(permissions[flag])
    },
    [permissions]
  )

  return useMemo(
    () => ({ can, isAdmin: permissions?.isAdmin ?? false, permissions }),
    [can, permissions]
  )
}
