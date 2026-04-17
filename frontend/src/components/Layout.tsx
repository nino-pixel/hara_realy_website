import { useEffect, useState } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { HiMoon, HiSun, HiX } from 'react-icons/hi'
import { useInquiryLink, useMarketingLinkTo } from '../hooks/useMarketingLinkTo'
import { useSavedPropertiesCount } from '../hooks/useSavedProperties'
import { useScrollTopOnRouteChange } from '../hooks/useScrollTopOnRouteChange'
import { useDarkMode } from '../hooks/useDarkMode'
import PageTransition from './PageTransition'
import Footer from './Footer'
import './Layout.css'

const menuVariants: Variants = {
  closed: { x: '100%', transition: { type: 'spring', stiffness: 300, damping: 35 } },
  open: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 35, staggerChildren: 0.08, delayChildren: 0.2 } },
}

const itemVariants: Variants = {
  closed: { opacity: 0, x: 25 },
  open: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
}

export default function Layout() {
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const savedCount = useSavedPropertiesCount()
  const { dark, toggle: toggleDark } = useDarkMode()
  useScrollTopOnRouteChange()

  // Sync: close nav on route change (including back button)
  const [prevPath, setPrevPath] = useState(location.pathname + location.search)
  if (location.pathname + location.search !== prevPath) {
    setPrevPath(location.pathname + location.search)
    if (navOpen) setNavOpen(false)
  }

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [navOpen])

  const closeNav = () => setNavOpen(false)
  const homeTo = useMarketingLinkTo('/')
  const propertiesTo = useMarketingLinkTo('/properties')
  const savedTo = useMarketingLinkTo('/saved-properties')
  const aboutTo = useMarketingLinkTo('/about')
  const helpTo = useMarketingLinkTo('/help')
  const contactTo = useMarketingLinkTo('/contact')
  const inquireTo = useInquiryLink()

  const navLinks = [
    { to: homeTo, label: 'Home' },
    { to: propertiesTo, label: 'Properties' },
    { to: savedTo, label: 'Saved', isSaved: true },
    { to: inquireTo, label: 'Inquire' },
    { to: aboutTo, label: 'About' },
    { to: helpTo, label: 'Help' },
    { to: contactTo, label: 'Contact' },
  ]

  return (
    <div className="layout">
      <AnimatePresence>
        {navOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="nav-overlay"
            onClick={closeNav}
          />
        )}
      </AnimatePresence>

      <header className={`header${navOpen ? ' header--menu-open' : ''}`}>
        <div className="container header-inner">
          <Link to={homeTo} className="logo" onClick={closeNav}>
            <img
              src="/favicon.png"
              alt=""
              className="logo-img"
              width={56}
              height={56}
            />
            <span className="logo-text">
              <span className="logo-mark">CHara</span> Realty
            </span>
          </Link>

          <button
            type="button"
            className={`nav-toggle${navOpen ? ' nav-toggle--open' : ''}`}
            onClick={() => setNavOpen((o) => !o)}
            aria-expanded={navOpen}
            aria-controls="primary-navigation"
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
          >
            <span className="nav-toggle-bars" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </button>

          {/* Desktop Nav */}
          <nav className="nav nav--desktop">
            {navLinks.map((link) => (
              <Link
                key={typeof link.to === 'string' ? link.to : JSON.stringify(link.to)}
                to={link.to}
                className={link.isSaved ? 'nav-link-saved' : ''}
              >
                {link.label}
                {link.isSaved && savedCount > 0 && (
                  <span className="nav-saved-badge">
                    {savedCount > 99 ? '99+' : savedCount}
                  </span>
                )}
              </Link>
            ))}
            <Link to="/admin/login" className="btn btn-outline btn-nav-login">
              Login
            </Link>
          </nav>

          <button
            type="button"
            className="btn-dark-mode btn-dark-mode-desktop"
            onClick={toggleDark}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <HiSun /> : <HiMoon />}
          </button>
        </div>
      </header>

      {/* Mobile Nav Drawer - Moved outside header-inner for proper fixed positioning */}
      <AnimatePresence>
        {navOpen && (
          <motion.nav
            id="primary-navigation"
            className="nav nav--mobile"
            variants={menuVariants}
            initial="closed"
            animate="open"
            exit="closed"
          >
            <button 
              type="button" 
              className="btn-mobile-close" 
              onClick={closeNav}
              aria-label="Close menu"
            >
              <HiX />
            </button>

            {navLinks.map((link, index) => (
              <motion.div 
                key={index} 
                variants={itemVariants}
                className="nav-mobile-item"
              >
                <Link
                  to={link.to}
                  onClick={closeNav}
                  className={link.isSaved ? 'nav-link-saved' : ''}
                >
                  {link.label}
                  {link.isSaved && savedCount > 0 && (
                    <span className="nav-saved-badge">
                      {savedCount > 99 ? '99+' : savedCount}
                    </span>
                  )}
                </Link>
              </motion.div>
            ))}
            
            <motion.div variants={itemVariants} className="nav-mobile-footer">
              <button
                type="button"
                className="btn btn-dark-mode-mobile"
                onClick={toggleDark}
                aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {dark ? <HiSun /> : <HiMoon />}
                <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              
              <Link to="/admin/login" className="btn btn-outline btn-nav-login" onClick={closeNav}>
                Login
              </Link>
            </motion.div>
          </motion.nav>
        )}
      </AnimatePresence>
      <main className="main">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
      {location.pathname !== '/' && <Footer />}
    </div>
  )
}
