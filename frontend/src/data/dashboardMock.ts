/**
 * Mock data for Admin Dashboard (chart-based).
 * KEEP IT LEAN: This is a single-user CRM. Do NOT add enterprise fluff:
 *   - weather, calendar, quotes, notifications, agent ranking.
 * BACKEND NOTES (for when wiring API):
 * - Summary cards: clients count(id), properties status=available, transactions sum(amount) this month,
 *   inquiries status=pending/new, transactions status=closed.
 * - Sales trend: SUM(deal amount) per month from transactions/deals — NOT property price.
 *   Deals can have discounts, different closing price. Use transaction.amount only.
 *   Chart: Jan–Dec, sales amount per month.
 * - Lead source: clients.source (Facebook, Website, Walk-in, Referral).
 * - Property status: properties.status (Available, Reserved, Sold).
 * - Inquiries/leads per month: COUNT of leads created per month (GROUP BY month, created_at). Jan–Dec.
 *   Use for lead growth and marketing performance. Chart = new leads created that month.
 * - Recent activity: Last 5 system activities (e.g. property added, lead created, client saved property, deal closed, status changed). Activity + date.
 * - OPTIONAL LATER: Average Property Price (Avg Listing Price) — e.g. ₱6,200,000. Helps brokers understand market positioning. Formula: AVG(price) over active/listable properties.
 * - SECURITY: Dashboard must not be public; require authenticated admin and redirect if not.
 */

export const MOCK_SUMMARY = {
  totalClients: 0,
  activeListings: 0,
  newLeadsThisMonth: 0,
  pendingInquiries: 0,
  closedDeals: 0,
  monthlySales: 0,
}

/** Monthly sales = deal amount (transaction amount) per month, Jan–Dec. */
export const MOCK_MONTHLY_SALES = [
  { month: 'Jan', total: 0 },
  { month: 'Feb', total: 0 },
  { month: 'Mar', total: 0 },
  { month: 'Apr', total: 0 },
  { month: 'May', total: 0 },
  { month: 'Jun', total: 0 },
  { month: 'Jul', total: 0 },
  { month: 'Aug', total: 0 },
  { month: 'Sep', total: 0 },
  { month: 'Oct', total: 0 },
  { month: 'Nov', total: 0 },
  { month: 'Dec', total: 0 },
]

export const MOCK_CLIENT_SOURCE = [
  { source: 'Facebook', count: 0 },
  { source: 'Website', count: 0 },
  { source: 'Walk-in', count: 0 },
  { source: 'Referral', count: 0 },
]

export const MOCK_PROPERTY_STATUS: { name: string; value: number; statusKey: string }[] = [
  { name: 'Available', value: 0, statusKey: 'available' },
  { name: 'Reserved', value: 0, statusKey: 'reserved' },
  { name: 'Under Negotiation', value: 0, statusKey: 'under_negotiation' },
  { name: 'Processing Docs', value: 0, statusKey: 'processing_docs' },
  { name: 'Sold', value: 0, statusKey: 'sold' },
  { name: 'Draft', value: 0, statusKey: 'draft' },
  { name: 'Cancelled', value: 0, statusKey: 'cancelled' },
]

/** Leads created per month, Jan–Dec. */
export const MOCK_INQUIRIES_PER_MONTH = [
  { month: 'Jan', count: 0 },
  { month: 'Feb', count: 0 },
  { month: 'Mar', count: 0 },
  { month: 'Apr', count: 0 },
  { month: 'May', count: 0 },
  { month: 'Jun', count: 0 },
  { month: 'Jul', count: 0 },
  { month: 'Aug', count: 0 },
  { month: 'Sep', count: 0 },
  { month: 'Oct', count: 0 },
  { month: 'Nov', count: 0 },
  { month: 'Dec', count: 0 },
]

export interface RecentActivityRow {
  activity: string
  date: string
  /** Icon key for activity type: property_added, lead_created, inquiry_received, deal_closed, property_saved, property_status_changed */
  activityType: 'property_added' | 'lead_created' | 'inquiry_received' | 'deal_closed' | 'property_saved' | 'property_status_changed'
}

/** Last 5 system activities — property added, lead created, saved, deal closed, status changed. */
export const MOCK_RECENT_ACTIVITY: RecentActivityRow[] = []

