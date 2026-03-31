import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../hooks/useAdminAuth'

/**
 * Guards `/admin/*` (except login): requires validated session via AdminAuthProvider
 * (token + GET /api/auth/me on load).
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isReady } = useAdminAuth()
  const location = useLocation()

  if (!isReady) {
    return (
      <div className="admin-auth-loading" style={{ padding: '2rem', textAlign: 'center' }}>
        Loading…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
