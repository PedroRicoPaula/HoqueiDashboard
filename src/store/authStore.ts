import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Permission } from '@prisma/client'

interface User {
  id: string
  name: string
  email: string
  isSuperAdmin?: boolean
  clubName?: string | null
  clubLanguage?: string | null
  clubLogoUrl?: string | null
  clubPrimaryColor?: string | null
}

interface AuthState {
  user: User | null
  permissions: Omit<Permission, 'id' | 'userId'> | null
  clubLanguage: string | null
  clubPrimaryColor: string | null
  setAuth: (user: User, permissions: Omit<Permission, 'id' | 'userId'> | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      permissions: null,
      clubLanguage: null,
      clubPrimaryColor: null,
      setAuth: (user, permissions) => set({
        user,
        permissions,
        clubLanguage: user.clubLanguage ?? null,
        clubPrimaryColor: user.clubPrimaryColor ?? null,
      }),
      logout: () => set({ user: null, permissions: null, clubLanguage: null, clubPrimaryColor: null }),
    }),
    { name: 'hm-auth', skipHydration: true }
  )
)
