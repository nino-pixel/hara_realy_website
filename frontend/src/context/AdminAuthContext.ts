import { createContext } from 'react'
import type { AdminUser } from '../data/mockAdmin'

export type AdminAuthContextType = {
  user: AdminUser | null
  isReady: boolean
  isAuthenticated: boolean
  loginWithCredentials: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
}

export const AdminAuthContext = createContext<AdminAuthContextType | null>(null)
