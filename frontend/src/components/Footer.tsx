import { Link } from 'react-router-dom'
import { useInquiryLink, useMarketingLinkTo } from '../hooks/useMarketingLinkTo'

export default function Footer() {
  const homeTo = useMarketingLinkTo('/')
  const propertiesTo = useMarketingLinkTo('/properties')
  const savedTo = useMarketingLinkTo('/saved-properties')
  const aboutTo = useMarketingLinkTo('/about')
  const helpTo = useMarketingLinkTo('/help')
  const contactTo = useMarketingLinkTo('/contact')
  const inquireTo = useInquiryLink()

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-columns">
          <div className="footer-column footer-about">
            <h3 className="footer-column-title">About Us</h3>
            <p className="footer-brand">
              <span className="logo-mark">CHara</span> Realty — Straight answers, real listings, and local know-how 
              in Central Luzon. We help you find homes you can actually afford, from inquiry to closing.
            </p>
          </div>
          <div className="footer-column">
            <h3 className="footer-column-title">Quick Links</h3>
            <div className="footer-links">
              <Link to={homeTo}>Home</Link>
              <Link to={propertiesTo}>Properties</Link>
              <Link to={savedTo}>Saved</Link>
              <Link to={inquireTo}>Inquire</Link>
              <Link to={aboutTo}>About Us</Link>
              <Link to={helpTo}>Help</Link>
              <Link to={contactTo}>Contact</Link>
            </div>
          </div>
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
  )
}
