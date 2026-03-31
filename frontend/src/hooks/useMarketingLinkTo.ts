import { useMemo } from 'react'
import type { To } from 'react-router-dom'
import { getMarketingAttribution } from '../utils/marketingAttribution'

/**
 * Internal navigation target that keeps `utm_*` (and fbclid-derived attribution) on the URL
 * so the address bar stays consistent across Home, Properties, Saved, About, etc.
 * Relies on `getMarketingAttribution()` (current URL + session from first touch in this tab).
 */
export function useMarketingLinkTo(pathname: string): To {
  return useMemo(() => {
    const m = getMarketingAttribution()
    const p = new URLSearchParams()
    if (m.utm_source) p.set('utm_source', m.utm_source)
    if (m.utm_medium) p.set('utm_medium', m.utm_medium)
    if (m.utm_campaign) p.set('utm_campaign', m.utm_campaign)
    const q = p.toString()
    if (!q) return pathname
    return { pathname, search: `?${q}` }
  }, [pathname])
}

/** Shorthand for the general inquiry page. */
export function useInquiryLink(): To {
  return useMarketingLinkTo('/inquiry')
}
