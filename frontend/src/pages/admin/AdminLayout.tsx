import { AnimatePresence } from 'framer-motion'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { 
  HiOutlineChevronLeft, 
  HiOutlineMenu, 
  HiMoon, 
  HiSun, 
  // HiOutlineSparkles,
  HiOutlineViewGrid,
  HiOutlineUsers,
  HiOutlineHome,
  HiOutlineShoppingBag,
  HiOutlineChatAlt2,
  HiOutlineClipboardList,
  HiOutlineDocumentReport,
  HiOutlineArchive,
  HiOutlineUserGroup
} from 'react-icons/hi'
import { useAdminAuth } from '../../context/AdminAuth'
import { useDarkMode } from '../../hooks/useDarkMode'
import Swal from 'sweetalert2'
import PageTransition from '../../components/PageTransition'
import { useScrollTopOnRouteChange } from '../../hooks/useScrollTopOnRouteChange'
import faviconLogo from '../../assets/favicon.png'
import './AdminLayout.css'

export default function AdminLayout() {
  const location = useLocation()
  const { user, logout } = useAdminAuth()
  const navigate = useNavigate()
  const { dark, toggle: toggleDark } = useDarkMode()
  useScrollTopOnRouteChange()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [expandButtonTop, setExpandButtonTop] = useState(50)
  const [isDraggingExpand, setIsDraggingExpand] = useState(false)
  const dragRef = useRef({ isDragging: false, startY: 0, startTop: 0 })
  const didDragRef = useRef(false)

  const handleLogout = () => {
    Swal.fire({
      title: 'Log out of CHara?',
      text: 'Are you sure you want to end your current session?',
      icon: 'warning',
      iconHtml: '<div class="logout-swal-icon">🚪</div>',
      showCancelButton: true,
      confirmButtonText: 'Yes, Log Out',
      cancelButtonText: 'Keep Session',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: 'var(--color-bg-alt)',
      background: 'var(--color-surface)',
      color: 'var(--color-text)',
      customClass: {
        popup: 'logout-confirmation-modal',
        confirmButton: 'swal-btn-danger',
        cancelButton: 'swal-btn-secondary'
      },
      showClass: {
        popup: 'animate__animated animate__fadeInDown animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp animate__faster'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        void logout().then(() => navigate('/admin/login'))
      }
    })
  }

  const handleExpandClick = () => {
    if (didDragRef.current) return
    setSidebarCollapsed(false)
  }

  const handleExpandMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragRef.current = { isDragging: true, startY: e.clientY, startTop: expandButtonTop }
    didDragRef.current = false
    setIsDraggingExpand(true)
  }, [expandButtonTop])

  const handleExpandMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current.isDragging) return
    didDragRef.current = true
    const deltaY = e.clientY - dragRef.current.startY
    const percentPerPixel = 100 / window.innerHeight
    let newTop = dragRef.current.startTop + deltaY * percentPerPixel
    newTop = Math.max(5, Math.min(95, newTop))
    setExpandButtonTop(newTop)
    dragRef.current.startY = e.clientY
    dragRef.current.startTop = newTop
  }, [])

  const handleExpandMouseUp = useCallback(() => {
    dragRef.current.isDragging = false
    setIsDraggingExpand(false)
    setTimeout(() => { didDragRef.current = false }, 0)
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => handleExpandMouseMove(e)
    const onUp = () => handleExpandMouseUp()
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [handleExpandMouseMove, handleExpandMouseUp])

  return (
    <div className={`admin-layout ${sidebarCollapsed ? 'admin-layout--sidebar-collapsed' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-brand-row">
            <Link to="/admin/dashboard" className="admin-sidebar-brand-text">
              <img
                src={faviconLogo}
                alt=""
                className="admin-sidebar-brand-icon"
                width={44}
                height={44}
                decoding="async"
              />
              <span>CHara Realty</span>
            </Link>
            <button
              type="button"
              className="admin-sidebar-toggle"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Hide sidebar"
            >
              <HiOutlineChevronLeft />
            </button>
          </div>
          <span className="admin-sidebar-role">{user ? 'Admin' : 'Guest'}</span>
        </div>
        <nav className="admin-sidebar-nav">
          <NavLink to="/admin/dashboard">
            <HiOutlineViewGrid className="nav-icon" /> <span>Dashboard</span>
          </NavLink>
          {/* <NavLink to="/admin/assistant" className="admin-sidebar-nav-ai">
            <HiOutlineSparkles className="nav-ai-icon" /> <span>AI Assistant</span>
          </NavLink> */}
          <NavLink to="/admin/clients">
            <HiOutlineUsers className="nav-icon" /> <span>Clients</span>
          </NavLink>
          <NavLink to="/admin/properties">
            <HiOutlineHome className="nav-icon" /> <span>Properties</span>
          </NavLink>
          <NavLink to="/admin/deals">
            <HiOutlineShoppingBag className="nav-icon" /> <span>Deals</span>
          </NavLink>
          <NavLink to="/admin/inquiries">
            <HiOutlineChatAlt2 className="nav-icon" /> <span>Leads & Inquiries</span>
          </NavLink>
          <NavLink to="/admin/activity">
            <HiOutlineClipboardList className="nav-icon" /> <span>Activity Log</span>
          </NavLink>
          <NavLink to="/admin/reports">
            <HiOutlineDocumentReport className="nav-icon" /> <span>Reports</span>
          </NavLink>
          <NavLink to="/admin/archives">
            <HiOutlineArchive className="nav-icon" /> <span>Archives</span>
          </NavLink>
          <NavLink to="/admin/users">
            <HiOutlineUserGroup className="nav-icon" /> <span>Admin users</span>
          </NavLink>
        </nav>
        <div className="admin-sidebar-footer">
          <span className="admin-sidebar-user">{user?.name ?? '—'}</span>
          <button
            type="button"
            className="admin-dark-mode-btn"
            onClick={toggleDark}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            {dark ? <HiSun aria-hidden /> : <HiMoon aria-hidden />}
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button type="button" className="admin-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>
      <button
        type="button"
        className={`admin-sidebar-expand ${isDraggingExpand ? 'admin-sidebar-expand--dragging' : ''}`}
        onClick={handleExpandClick}
        onMouseDown={handleExpandMouseDown}
        style={{ top: `${expandButtonTop}%` }}
        aria-label="Show sidebar"
        aria-hidden={!sidebarCollapsed}
      >
        <HiOutlineMenu />
      </button>
      <main className="admin-main">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  )
}
