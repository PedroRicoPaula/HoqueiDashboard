import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Permission } from '@prisma/client'

interface User {
  id: string
  name: string
  email: string
}

interface AuthState {
  user: User | null
  permissions: Omit<Permission, 'id' | 'userId'> | null
  setAuth: (user: User, permissions: Omit<Permission, 'id' | 'userId'>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      permissions: null,
      setAuth: (user, permissions) => set({ user, permissions }),
      logout: () => set({ user: null, permissions: null }),
    }),
    { name: 'hcpdl-auth' }
  )
)
