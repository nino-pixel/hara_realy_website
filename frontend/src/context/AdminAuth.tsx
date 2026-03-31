import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { AdminUser } from '../data/mockAdmin'
import { AUTH_SESSION_EXPIRED_EVENT, clearAuthSession, getAuthToken } from '../services/authStore'
import { runApiBootstrap } from '../services/apiBootstrap'
import { fetchCurrentUser, loginWithPassword, logoutApi } from '../services/authApi'
import { AdminAuthContext } from './AdminAuthContext'

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const onSessionExpired = () => setUser(null)
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired)
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = getAuthToken()
      if (!token) {
        if (!cancelled) {
          setUser(null)
          setIsReady(true)
        }
        return
      }
      const me = await fetchCurrentUser()
      if (cancelled) return
      if (!me) {
        clearAuthSession()
        setUser(null)
        setIsReady(true)
        return
      }
      const normalized: AdminUser = {
        id: me.id,
        role: 'admin',
        name: me.name,
        email: me.email,
      }
      setUser(normalized)
      setIsReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loginWithCredentials = useCallback(async (email: string, password: string) => {
    try {
      const u = await loginWithPassword(email.trim(), password)
      const normalized: AdminUser = {
        id: u.id,
        role: 'admin',
        name: u.name,
        email: u.email,
      }
      setUser(normalized)
      void runApiBootstrap()
      return { ok: true as const }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not sign in.'
      return { ok: false as const, error: msg }
    }
  }, [])

  const logout = useCallback(async () => {
    await logoutApi()
    setUser(null)
  }, [])

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        isReady,
        isAuthenticated: !!user && !!getAuthToken(),
        loginWithCredentials,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

