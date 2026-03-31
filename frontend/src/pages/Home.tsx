import { Link, useNavigate } from 'react-router-dom'
import { useInquiryLink, useMarketingLinkTo } from '../hooks/useMarketingLinkTo'
import { buildPublicPath } from '../utils/marketingAttribution'
import { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react'
import {
  aggregateClientAnalyticsByProperty,
  trackEvent,
  type PropertyClientStats,
} from '../services/analyticsService'
import { fetchClients } from '../services/clientsService'
import { fetchProperties, type Property } from '../services/propertiesService'
import { getPublicPropertyCatalog, type PropertyCatalogItem } from '../utils/propertyGrouping'
import PropertyCard from '../components/PropertyCard'
import './Home.css'

/** Hero background slideshow — stock homes / interiors (replace with branded assets anytime). */
const HERO_SLIDES: { src: string; alt: string }[] = [
  {
    src: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&q=80',
    alt: 'Modern residential home',
  },
  {
    src: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=80',
    alt: 'House with pool at dusk',
  },
  {
    src: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=1920&q=80',
    alt: 'Living room interior',
  },
  {
    src: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1920&q=80',
    alt: 'Contemporary home facade',
  },
  {
    src: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1920&q=80',
    alt: 'Townhouse exterior',
  },
]

const HERO_SLIDE_MS = 6000

/** Placeholder client feedback for the home trust strip (replace with API data later). */
const HOME_TESTIMONIALS: { id: string; name: string; location: string; quote: string }[] = [
  {
    id: 't1',
    name: 'Maria R.',
    location: 'San Fernando, Pampanga',
    quote:
      'Clear numbers from day one. We never felt rushed, and they helped us compare two developments side by side.',
  },
  {
    id: 't2',
    name: 'Jon D.',
    location: 'Malolos, Bulacan',
    quote:
      'I was skeptical about pre-selling, but the site visits and paperwork were explained in plain language.',
  },
  {
    id: 't3',
    name: 'Angela T.',
    location: 'Angeles City',
    quote:
      'They matched us with a unit that fit our monthly budget, not just the list price. Huge relief.',
  },
  {
    id: 't4',
    name: 'Rico M.',
    location: 'Mabalacat',
    quote:
      'Responsive on chat and email. We had a lot of questions as first-time buyers and they stuck with us.',
  },
  {
    id: 't5',
    name: 'Liza K.',
    location: 'Baliuag, Bulacan',
    quote:
      'From inquiry to reservation, every step had a checklist. Made a stressful process feel manageable.',
  },
  {
    id: 't6',
    name: 'Paolo S.',
    location: 'Clark area',
    quote:
      'Honest about what was still under construction versus ready for occupancy. No surprises at turnover.',
  },
]

function HomeTestimonialCard({ t }: { t: (typeof HOME_TESTIMONIALS)[0] }) {
  return (
    <article className="home-testimonial-card">
      <div className="home-testimonial-stars" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="home-testimonial-star" aria-hidden>
            ★
          </span>
        ))}
      </div>
      <p className="home-testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
      <p className="home-testimonial-meta">
        <span className="home-testimonial-name">{t.name}</span>
        <span className="home-testimonial-loc">{t.location}</span>
      </p>
    </article>
  )
}

function parsePriceDigits(price: string): number {
  const n = parseInt(String(price).replace(/[^\d]/g, ''), 10)
  return Number.isNaN(n) ? 0 : n
}

/** Always returns a real Map — never undefined (guards HMR / partial module init). */
function safeAnalyticsMap(): Map<string, PropertyClientStats> {
  try {
    const fn = aggregateClientAnalyticsByProperty
    if (typeof fn !== 'function') return new Map()
    const m = fn()
    if (m == null) return new Map()
    if (m instanceof Map) return m as Map<string, PropertyClientStats>
    if (typeof (m as Map<string, PropertyClientStats>).get === 'function') {
      return m as Map<string, PropertyClientStats>
    }
  } catch {
    /* ignore */
  }
  return new Map<string, PropertyClientStats>()
}

function engagementScore(propertyId: string, agg: Map<string, PropertyClientStats> | undefined): number {
  if (agg == null || typeof agg.get !== 'function') return 0
  const s = agg.get(propertyId)
  if (!s) return 0
  return s.inquiries * 12 + s.views * 2 + s.saves * 4
}

function assignContextPills(
  properties: Property[],
  agg: Map<string, PropertyClientStats> | undefined
): Record<string, string> {
  const byId: Record<string, string> = {}
  const used = new Set<string>()
  if (properties.length === 0) return byId
  if (agg == null || typeof agg.get !== 'function') {
    for (const p of properties) {
      byId[p.id] = p.featuredListing === true ? 'Featured' : 'Handpicked for you'
    }
    return byId
  }

  const eligible = properties.filter((p) => p.featuredListing === true)
  for (const p of eligible) {
    byId[p.id] = 'Featured'
    used.add(p.id)
  }

  const maxInq = Math.max(
    ...properties.filter((p) => !used.has(p.id)).map((p) => agg.get(p.id)?.inquiries ?? 0),
    0
  )
  if (maxInq > 0) {
    const id = properties.find(
      (p) => !used.has(p.id) && (agg.get(p.id)?.inquiries ?? 0) === maxInq
    )?.id
    if (id) {
      byId[id] = 'Most inquired this week'
      used.add(id)
    }
  }

  const weekMs = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const newest = properties
    .filter((p) => !used.has(p.id) && p.updatedAt && now - new Date(p.updatedAt).getTime() < weekMs)
    .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())[0]
  if (newest) {
    byId[newest.id] = 'Newly listed'
    used.add(newest.id)
  }

  const remaining = properties.filter((p) => !used.has(p.id))
  if (remaining.length > 0 && properties.length > 1) {
    const lowest = remaining.reduce((a, b) => (parsePriceDigits(a.price) <= parsePriceDigits(b.price) ? a : b))
    byId[lowest.id] = 'Best value in this lineup'
    used.add(lowest.id)
  }

  for (const p of properties) {
    if (!byId[p.id]) byId[p.id] = 'Handpicked for you'
  }
  return byId
}

export default function Home() {
  const navigate = useNavigate()
  const inquiryTo = useInquiryLink()
  const propertiesTo = useMarketingLinkTo('/properties')
  const homeRootRef = useRef<HTMLDivElement>(null)
  const [now] = useState(() => Date.now())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [heroSlide, setHeroSlide] = useState(0)

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 120)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (loading) return
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const id = window.setInterval(() => {
      setHeroSlide((s) => (s + 1) % HERO_SLIDES.length)
    }, HERO_SLIDE_MS)
    return () => clearInterval(id)
  }, [loading])

  useEffect(() => {
    if (!loading) trackEvent('page_view', { page: 'home' })
  }, [loading])

  /** Full-page vertical scroll snap (CSS on html — see Home.css). */
  useEffect(() => {
    document.documentElement.classList.add('home-scroll-snap')
    return () => document.documentElement.classList.remove('home-scroll-snap')
  }, [])

  /** Global mouse glow tracker for the spotlight effect */
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!homeRootRef.current) return
      homeRootRef.current.style.setProperty('--mouse-x', `${e.clientX}px`)
      homeRootRef.current.style.setProperty('--mouse-y', `${e.clientY}px`)
    }
    window.addEventListener('mousemove', handleGlobalMouseMove)
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove)
  }, [])

  /**
   * Fade + slide-up when each snap section enters view (respects reduced motion).
   * Uses takeRecords() after observe — IO often skips the initial callback after refresh,
   * which left sections stuck at opacity: 0 without --visible.
   * useLayoutEffect: apply --visible before paint to avoid a flash of hidden content.
   */
  useLayoutEffect(() => {
    const root = homeRootRef.current
    if (!root) return
    const sections = root.querySelectorAll<HTMLElement>('.home-snap-section')
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      sections.forEach((el) => el.classList.add('home-snap-section--visible'))
      return
    }

    /** Toggle class so leaving view removes it — re-entering re-triggers CSS fade/slide. */
    const applyIntersection = (entry: IntersectionObserverEntry) => {
      const el = entry.target as HTMLElement
      if (entry.isIntersecting) {
        el.classList.add('home-snap-section--visible')
      } else {
        el.classList.remove('home-snap-section--visible')
      }
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(applyIntersection)
    }, {
      root: null,
      rootMargin: '-8% 0px -8% 0px',
      /* 0 = fire when any pixel enters/leaves the root, so scroll up/down can reset visibility */
      threshold: [0, 0.12, 0.25],
    })

    sections.forEach((el) => io.observe(el))

    const flushPending = () => {
      for (const entry of io.takeRecords()) {
        applyIntersection(entry)
      }
    }
    flushPending()
    let cancelled = false
    const raf1 = requestAnimationFrame(() => {
      flushPending()
      if (cancelled) return
      requestAnimationFrame(() => {
        if (!cancelled) flushPending()
      })
    })

    /** Fallback / bfcache: mirror IO — add in band, remove when out (enables re-animation). */
    const syncVisibleFromLayout = () => {
      const vh = window.innerHeight
      const topBound = vh * 0.08
      const bottomBound = vh * 0.92
      sections.forEach((el) => {
        const r = el.getBoundingClientRect()
        const overlap = Math.min(r.bottom, bottomBound) - Math.max(r.top, topBound)
        const ratio = overlap / Math.max(r.height, 1)
        const shouldShow = overlap > 0 && ratio >= 0.15
        if (shouldShow) el.classList.add('home-snap-section--visible')
        else el.classList.remove('home-snap-section--visible')
      })
    }

    const onPageShow = () => {
      flushPending()
      syncVisibleFromLayout()
    }
    window.addEventListener('pageshow', onPageShow)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      io.disconnect()
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [loading])

  const { featured, contextPills, newListingsThisWeek, trustClients, trustListings } = useMemo(() => {
    const agg = safeAnalyticsMap()
    const pool = getPublicPropertyCatalog(fetchProperties()).filter(
      (item) => item.displayProperty.status === 'available'
    )
    const sortByEngagement = (a: PropertyCatalogItem, b: PropertyCatalogItem) =>
      engagementScore(b.displayProperty.id, agg) - engagementScore(a.displayProperty.id, agg) ||
      (b.displayProperty.leads ?? 0) - (a.displayProperty.leads ?? 0)

    const featuredByAdmin = pool.filter((item) => item.displayProperty.featuredListing === true).sort(sortByEngagement)
    const rest = pool.filter((item) => item.displayProperty.featuredListing !== true).sort(sortByEngagement)

    const picked: PropertyCatalogItem[] = []
    const maxFeatured = 6
    for (const p of featuredByAdmin) {
      if (picked.length >= maxFeatured) break
      picked.push(p)
    }
    for (const p of rest) {
      if (picked.length >= maxFeatured) break
      picked.push(p)
    }

    const pills = assignContextPills(picked.map((item) => item.displayProperty), agg)

    const weekMs = 7 * 24 * 60 * 60 * 1000
    const newThisWeek = pool.filter(
      (item) =>
        item.displayProperty.updatedAt &&
        now - new Date(item.displayProperty.updatedAt).getTime() < weekMs
    ).length

    const clients = fetchClients().filter((c) => !c.archived)
    const trustClientsCount = clients.length

    return {
      featured: picked,
      contextPills: pills,
      newListingsThisWeek: newThisWeek,
      trustClients: trustClientsCount,
      trustListings: pool.length,
    }
  }, [now])

  const handleBrowse = () => {
    const q = searchQuery.trim()
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    navigate(buildPublicPath('/properties', p))
  }

  const heroSlideshow = (
    <>
      <div className="hero-slideshow" aria-hidden={loading}>
        {HERO_SLIDES.map((slide, i) => (
          <img
            key={slide.src}
            src={slide.src}
            alt=""
            className={`hero-slide-img ${i === heroSlide ? 'hero-slide-img--active' : ''}`}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
          />
        ))}
      </div>
      <div className="hero-overlay" aria-hidden />
    </>
  )

  if (loading) {
    return (
      <div className="home home--scroll-snap" ref={homeRootRef}>
        <div className="home-mouse-glow" aria-hidden />
        <section className="hero hero--has-slideshow home-snap-section home-snap-section--visible">
          {heroSlideshow}
          <div className="container hero-inner home-snap-reveal">
            <p className="client-page-loading client-page-loading--hero">Loading…</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="home home--scroll-snap" ref={homeRootRef}>
      <div className="home-mouse-glow" aria-hidden />
      <section className="hero hero--has-slideshow home-snap-section">
        {heroSlideshow}
        <div className="container hero-inner home-snap-reveal">
          <h1 className="hero-title">Find Homes You Can Actually Afford</h1>
          <p className="hero-subtitle">
            See real prices, estimate monthly payments, and get matched fast. No guesswork.
          </p>
          <div className="hero-search">
            <input
              type="search"
              className="hero-search-input"
              placeholder="Search by location, title, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBrowse()}
              aria-label="Search properties"
            />
          </div>
          <div className="hero-actions hero-actions--primary">
            <Link to={inquiryTo} className="btn btn-primary btn-lg hero-cta-primary">
              Start with Your Budget
            </Link>
            <Link to={propertiesTo} className="btn btn-outline btn-lg hero-cta-secondary">
              See Homes Under ₱20k/month
            </Link>
          </div>
          <div className="hero-actions hero-actions--secondary">
            <button type="button" className="btn btn-outline btn-sm" onClick={handleBrowse}>
              Browse Properties
            </button>
            <Link to={inquiryTo} className="btn btn-outline btn-sm">
              Inquire Now
            </Link>
          </div>
        </div>
        <div className="hero-dots" role="tablist" aria-label="Hero photo slides">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === heroSlide}
              aria-label={`Slide ${i + 1} of ${HERO_SLIDES.length}`}
              className={`hero-dot ${i === heroSlide ? 'hero-dot--active' : ''}`}
              onClick={() => setHeroSlide(i)}
            />
          ))}
        </div>
      </section>

      {/* Snap panel 2: trust + activity strip (one viewport “slide”) */}
      <div className="home-snap-panel home-snap-section home-snap-panel--trust">
        <div className="home-snap-reveal">
          <section className="home-trust section">
            <div className="container">
              <h2 className="section-title">Why Choose CHara Realty?</h2>
              <ul className="home-trust-list">
                <li>
                  <span className="home-trust-check" aria-hidden>✔</span>
                  <span className="home-trust-copy">
                    <strong>Verified listings</strong> — what you see is what we show.
                  </span>
                </li>
                <li>
                  <span className="home-trust-check" aria-hidden>✔</span>
                  <span className="home-trust-copy">
                    <strong>Trusted developers</strong> — vetted projects in Central Luzon.
                  </span>
                </li>
                <li>
                  <span className="home-trust-check" aria-hidden>✔</span>
                  <span className="home-trust-copy">
                    <strong>Guided from inquiry to closing</strong> — you’re not browsing alone.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          <div className="home-testimonials" aria-label="Client feedback">
            <div className="home-testimonials-marquee">
              <div className="home-testimonials-track">
                <div className="home-testimonials-group">
                  {HOME_TESTIMONIALS.map((t) => (
                    <HomeTestimonialCard key={t.id} t={t} />
                  ))}
                </div>
                <div className="home-testimonials-group" aria-hidden="true">
                  {HOME_TESTIMONIALS.map((t) => (
                    <HomeTestimonialCard key={`marquee-dup-${t.id}`} t={t} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="home-trust-lower">
            <div className="home-trust-lower-band">
              <div className="container">
                <p className="home-trust-footnote">
                  {trustClients > 0 ? (
                    <>
                      <strong>{trustClients}+</strong> clients assisted · <strong>{trustListings}</strong> active listings
                      today
                    </>
                  ) : (
                    <>Real people, real homes — we’re here for the long journey.</>
                  )}
                </p>
              </div>
            </div>
            {newListingsThisWeek > 0 && (
              <div className="home-trust-lower-band home-activity-strip">
                <div className="container">
                  <p className="home-activity-text">
                    <span className="home-activity-dot" aria-hidden />
                    <strong>{newListingsThisWeek}</strong> new {newListingsThisWeek === 1 ? 'listing' : 'listings'} added
                    this week.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Snap panel 3: featured + CTA */}
      <div className="home-snap-panel home-snap-section home-snap-panel--featured">
        <div className="home-snap-reveal">
          <section className="featured section">
            <div className="container">
              <h2 className="section-title">Featured Properties</h2>
              <p className="section-subtitle">
                Highlights from local demand—labels use recent activity on this site (views, saves, inquiries) plus
                freshness and value.
              </p>
              {featured.length === 0 ? (
                <p className="featured-empty">
                  No featured listings right now. Browse all properties to see what’s available.
                </p>
              ) : (
                <div className="property-grid">
                  {featured.map((item) => (
                    <PropertyCard
                      key={item.rootProperty.id}
                      property={item.displayProperty}
                      featured
                      contextPill={contextPills[item.displayProperty.id]}
                      metaNote={item.summaryNote}
                    />
                  ))}
                </div>
              )}
              <div className="featured-cta">
                <Link to={propertiesTo} className="btn btn-primary btn-lg">
                  View All Properties
                </Link>
              </div>
            </div>
          </section>

          <section className="cta-section">
            <div className="container">
              <h2 className="cta-title">Tell us your budget, and we’ll find the best options for you</h2>
              <p className="cta-text">No pressure. Share what you can afford and we’ll match you with homes that fit.</p>
              <Link to={inquiryTo} className="btn btn-primary btn-lg">
                Get matched now
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
