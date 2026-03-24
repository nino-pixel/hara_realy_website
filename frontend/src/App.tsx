import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthSessionListener from './components/AuthSessionListener'
import MarketingAttributionSync from './components/MarketingAttributionSync'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Home from './pages/Home'
import Properties from './pages/Properties'
import PropertyDetails from './pages/PropertyDetails'
import SavedProperties from './pages/SavedProperties'
import Inquiry from './pages/Inquiry'
import Contact from './pages/Contact'
import About from './pages/About'
import Tutorials from './pages/Tutorials'
import AdminLayout from './pages/admin/AdminLayout'
import AdminLogin from './pages/admin/AdminLogin'
import Dashboard from './pages/admin/Dashboard'
import Clients from './pages/admin/Clients'
import ClientProfile from './pages/admin/ClientProfile'
import AdminProperties from './pages/admin/AdminProperties'
import AdminPropertyProfile from './pages/admin/AdminPropertyProfile'
import AdminDeals from './pages/admin/AdminDeals'
import AdminDealProfile from './pages/admin/AdminDealProfile'
import AdminUsers from './pages/admin/AdminUsers'
import Inquiries from './pages/admin/Inquiries'
import ActivityLog from './pages/admin/ActivityLog'
import Reports from './pages/admin/Reports'
import AdminArchives from './pages/admin/AdminArchives'

export default function App() {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const interactive = target.closest('.btn, .property-spec-card') as HTMLElement
      if (interactive) {
        const rect = interactive.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        interactive.style.setProperty('--mouse-x', `${x}px`)
        interactive.style.setProperty('--mouse-y', `${y}px`)
        
        /* Legacy support for old --btn-mouse-x names if needed, but we'll update CSS too */
        interactive.style.setProperty('--btn-mouse-x', `${x}px`)
        interactive.style.setProperty('--btn-mouse-y', `${y}px`)
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <BrowserRouter>
      <MarketingAttributionSync />
      <AuthSessionListener />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="properties" element={<Properties />} />
          <Route path="properties/:id" element={<PropertyDetails />} />
          <Route path="saved-properties" element={<SavedProperties />} />
          <Route path="inquiry" element={<Inquiry />} />
          <Route path="contact" element={<Contact />} />
          <Route path="about" element={<About />} />
          <Route path="help" element={<Tutorials />} />
        </Route>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientProfile />} />
            <Route path="properties" element={<AdminProperties />} />
            <Route path="properties/:id" element={<AdminPropertyProfile />} />
            <Route path="deals" element={<AdminDeals />} />
            <Route path="deals/:dealId" element={<AdminDealProfile />} />
            <Route path="inquiries" element={<Inquiries />} />
            <Route path="activity" element={<ActivityLog />} />
            <Route path="reports" element={<Reports />} />
            <Route path="archives" element={<AdminArchives />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
