import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { HiMoon, HiSun } from 'react-icons/hi'
import { useInquiryLink, useMarketingLinkTo } from '../hooks/useMarketingLinkTo'
import { useSavedPropertiesCount } from '../hooks/useSavedProperties'
import { useScrollTopOnRouteChange } from '../hooks/useScrollTopOnRouteChange'
import { useDarkMode } from '../hooks/useDarkMode'
import PageTransition from './PageTransition'
import faviconLogo from '../assets/favicon.png'
import './Layout.css'

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

  return (
    <div className="layout">
      {navOpen ? (
        <div
          className="nav-overlay"
          role="presentation"
          aria-hidden
          onClick={closeNav}
        />
      ) : null}
      <header className={`header${navOpen ? ' header--menu-open' : ''}`}>
        <div className="container header-inner">
          <Link to={homeTo} className="logo" onClick={closeNav}>
            <img
              src={faviconLogo}
              alt=""
              className="logo-img"
              width={56}
              height={56}
              decoding="async"
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
          <nav id="primary-navigation" className={`nav${navOpen ? ' nav--open' : ''}`}>
            <Link to={homeTo} onClick={closeNav}>
              Home
            </Link>
            <Link to={propertiesTo} onClick={closeNav}>
              Properties
            </Link>
            <Link to={savedTo} className="nav-link-saved" onClick={closeNav}>
              Saved
              {savedCount > 0 ? (
                <span className="nav-saved-badge" aria-label={`${savedCount} saved`}>
                  {savedCount > 99 ? '99+' : savedCount}
                </span>
              ) : null}
            </Link>
            <Link to={inquireTo} onClick={closeNav}>
              Inquire
            </Link>
            <Link to={aboutTo} onClick={closeNav}>
              About
            </Link>
            <Link to={helpTo} onClick={closeNav}>
              Help
            </Link>
            <Link to={contactTo} onClick={closeNav}>
              Contact
            </Link>
            <Link to="/admin/login" className="btn btn-outline btn-nav-login" onClick={closeNav}>
              Login
            </Link>
          </nav>
          <button
            type="button"
            className="btn-dark-mode"
            onClick={toggleDark}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            {dark ? <HiSun aria-hidden /> : <HiMoon aria-hidden />}
          </button>
        </div>
      </header>
      <main className="main">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <p className="footer-brand">
            <span className="logo-mark">CHara</span> Realty — Your trusted partner in finding the right property.
          </p>
          <div className="footer-links">
            <Link to={homeTo}>Home</Link>
            <Link to={propertiesTo}>Properties</Link>
            <Link to={savedTo}>Saved</Link>
            <Link to={inquireTo}>Inquire</Link>
            <Link to={aboutTo}>About</Link>
            <Link to={helpTo}>Help</Link>
            <Link to={contactTo}>Contact</Link>
          </div>
          <p className="footer-developer">
            Website by <strong>Antonino Balinado Jr.</strong>
            <span className="footer-developer-sep" aria-hidden>
              {' '}
              ·{' '}
            </span>
            <a href="mailto:antoninobalinado756@gmail.com">antoninobalinado756@gmail.com</a>
            <span className="footer-developer-sep" aria-hidden>
              {' '}
              ·{' '}
            </span>
            <a href="https://www.facebook.com/ninobalinadojr/" target="_blank" rel="noopener noreferrer">
              Facebook
            </a>
          </p>
          <p className="footer-copy">© {new Date().getFullYear()} CHara Realty. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
