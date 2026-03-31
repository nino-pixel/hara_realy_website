import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageTransition from '../../components/PageTransition'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import { useScrollTopOnRouteChange } from '../../hooks/useScrollTopOnRouteChange'
import { logActivity } from '../../data/activityLog'
import './AdminLogin.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateForm(email: string, password: string) {
  const fieldErrors: { email?: string; password?: string } = {}
  const e = email.trim()
  if (!e) fieldErrors.email = 'Email is required.'
  else if (!EMAIL_RE.test(e)) fieldErrors.email = 'Enter a valid email address.'
  if (!password) fieldErrors.password = 'Password is required.'
  else if (password.length < 8) fieldErrors.password = 'Password must be at least 8 characters.'
  else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    fieldErrors.password = 'Password must include both letters and numbers.'
  }
  return fieldErrors
}

export default function AdminLogin() {
  const { loginWithCredentials, isAuthenticated, isReady } = useAdminAuth()
  const navigate = useNavigate()
  useScrollTopOnRouteChange()
  const loginRootRef = useRef<HTMLDivElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Global mouse glow tracker for the spotlight effect
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!loginRootRef.current) return
      loginRootRef.current.style.setProperty('--mouse-x', `${e.clientX}px`)
      loginRootRef.current.style.setProperty('--mouse-y', `${e.clientY}px`)
    }
    window.addEventListener('mousemove', handleGlobalMouseMove)
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove)
  }, [])

  useEffect(() => {
    if (isReady && isAuthenticated) {
      navigate('/admin/dashboard', { replace: true })
    }
  }, [isAuthenticated, isReady, navigate])

  if (!isReady) {
    return (
      <PageTransition>
        <div className="admin-login-page">
          <div className="admin-login-card admin-login-card--loading">
            <p className="admin-login-loading">Checking session…</p>
          </div>
        </div>
      </PageTransition>
    )
  }

  if (isAuthenticated) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const errs = validateForm(email, password)
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    const result = await loginWithCredentials(email.trim(), password)
    setSubmitting(false)

    if (!result.ok) {
      setFormError(result.error ?? 'Sign in failed.')
      return
    }

    logActivity({
      actor: email.trim(),
      action: 'login',
      entityType: 'settings',
      entityId: null,
      entityLabel: 'Admin',
      details: 'Logged in (API)',
    })
    navigate('/admin/dashboard', { replace: true })
  }

  return (
    <PageTransition>
      <div className="admin-login-page" ref={loginRootRef}>
        <div className="admin-login-spotlight"></div>
        <div className="admin-login-card">
        <h1 className="admin-login-title">Admin Login</h1>
        <p className="admin-login-subtitle">CHara Realty Admin System</p>
        <form onSubmit={handleSubmit} className="admin-login-form" noValidate>
          {formError && (
            <div className="admin-login-alert" role="alert">
              {formError}
            </div>
          )}
          <div className="admin-login-field">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }))
              }}
              placeholder="you@example.com"
              className={fieldErrors.email ? 'admin-login-input-error' : undefined}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'admin-email-err' : undefined}
              disabled={submitting}
            />
            {fieldErrors.email && (
              <span id="admin-email-err" className="admin-login-field-error">
                {fieldErrors.email}
              </span>
            )}
          </div>
          <div className="admin-login-field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }))
              }}
              placeholder="••••••••"
              className={fieldErrors.password ? 'admin-login-input-error' : undefined}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'admin-password-err' : undefined}
              disabled={submitting}
            />
            {fieldErrors.password && (
              <span id="admin-password-err" className="admin-login-field-error">
                {fieldErrors.password}
              </span>
            )}
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg admin-login-submit"
            disabled={submitting}
          >
            {submitting ? 'Signing in…' : 'Log in'}
          </button>
        </form>
        <Link to="/" className="admin-login-back">
          ← Back to homepage
        </Link>
        </div>
      </div>
    </PageTransition>
  )
}
