import { useMemo, memo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  HiOutlineHome,
  HiOutlineUser,
  HiOutlineChat,
  HiOutlineCurrencyDollar,
  HiOutlineStar,
  HiOutlineRefresh,
  HiOutlineUsers,
  HiOutlineChatAlt2,
  HiOutlineClipboardList,
  HiOutlineTrendingUp,
  HiOutlineChartBar,
  HiOutlineCheckCircle
} from 'react-icons/hi'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { ResetTool } from '../../components/admin/ResetTool'
import type { InquiryStatus } from '../../data/mockAdmin'
import { fetchClients } from '../../services/clientsService'
import { fetchInquiries } from '../../services/inquiriesService'
import { followUpTagLabel, getFollowUpUiKind, getLeadsNeedingAttention } from '../../utils/inquiryFollowUp'
import { fetchProperties, PROPERTY_STATUS_LABELS, type PropertyStatus } from '../../services/propertiesService'
import { fetchDeals } from '../../services/dealsService'
import { getActivityStore, type ActivityLogEntry } from '../../data/activityLog'
import './admin-common.css'
import './Dashboard.css'

type ActivityTypeKey =
  | 'property_added'
  | 'lead_created'
  | 'inquiry_received'
  | 'deal_closed'
  | 'property_saved'
  | 'property_status_changed'

const ACTIVITY_ICONS: Record<ActivityTypeKey, React.ComponentType<{ className?: string }>> = {
  property_added: HiOutlineHome,
  lead_created: HiOutlineUser,
  inquiry_received: HiOutlineChat,
  deal_closed: HiOutlineCurrencyDollar,
  property_saved: HiOutlineStar,
  property_status_changed: HiOutlineRefresh,
}

/* Property status colors — match admin badges / PropertyCard */
const PIE_COLORS = [
  '#059669', /* available (green) */
  '#3b82f6', /* reserved */
  '#ea580c', /* under_negotiation */
  '#4f46e5', /* processing_docs */
  '#6b7280', /* sold */
  '#9ca3af', /* draft */
  '#b91c1c', /* cancelled */
]

function formatPeso(n: number) {
  return '₱' + (n / 1_000_000).toFixed(2) + 'M'
}

function parsePesoToNumber(s: string | null | undefined): number {
  if (!s) return 0
  const cleaned = String(s).replace(/[₱,\s]/g, '')
  const n = Number(cleaned)
  return Number.isNaN(n) ? 0 : n
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function mapActivityType(entry: ActivityLogEntry): ActivityTypeKey {
  if (entry.entityType === 'property' && entry.action === 'created') return 'property_added'
  if (entry.entityType === 'property' && entry.action === 'status_changed') return 'property_status_changed'
  if (entry.entityType === 'property' && entry.action === 'updated') return 'property_saved'
  if (entry.entityType === 'client' && (entry.action === 'created' || entry.action === 'updated')) return 'lead_created'
  if (entry.action === 'other') return 'inquiry_received'
  return 'inquiry_received'
}

const INQUIRY_STATUS_LABELS_DASH: Record<InquiryStatus, string> = {
  new: 'Pending',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  lost: 'Lost',
}

const PROPERTY_STATUS_ORDER: PropertyStatus[] = [
  'available',
  'reserved',
  'under_negotiation',
  'processing_docs',
  'sold',
  'draft',
  'cancelled',
]

export default memo(function AdminDashboard() {
  const navigate = useNavigate()

  // 1. Data Fetching & Memoized Calculation
  const data = useMemo(() => {
    const clients = fetchClients()
    const inquiries = fetchInquiries()
    const properties = fetchProperties()
    const deals = fetchDeals()
    const activities = getActivityStore()

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const activeListings = properties.filter((p) => !p.archived && ['available', 'under_negotiation'].includes(p.status)).length
    const totalClients = clients.filter((c) => !c.archived).length

    const newLeadsThisMonth = inquiries.filter((lead) => {
      if (!lead.createdAt) return false
      const d = new Date(lead.createdAt)
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth
    }).length

    const pendingInquiries = inquiries.filter((i) =>
      ['new', 'contacted', 'qualified'].includes(i.status)
    ).length

    const monthlySalesData = MONTH_LABELS.map((label, monthIndex) => {
      const total = deals.reduce((sum, deal) => {
        if (deal.status !== 'Closed') return sum
        const dateStr = deal.closingDate || deal.date
        if (!dateStr) return sum
        const d = new Date(dateStr)
        if (d.getFullYear() !== currentYear || d.getMonth() !== monthIndex) return sum
        return sum + parsePesoToNumber(deal.price)
      }, 0)
      return { month: label, total }
    })

    const monthlySales = monthlySalesData[currentMonth]?.total ?? 0
    const closedDeals = deals.filter((d) => d.status === 'Closed').length
    const totalClosedSales = deals.reduce((sum, deal) => {
      if (deal.status !== 'Closed') return sum
      return sum + parsePesoToNumber(deal.price)
    }, 0)
    const averageDealValue = closedDeals === 0 ? null : totalClosedSales / closedDeals
    const averageDealValueText = averageDealValue == null ? '—' : formatPeso(averageDealValue)
    const totalLeads = totalClients
    const conversionRatePercent = totalLeads === 0 ? 0 : (closedDeals / totalLeads) * 100
    const conversionRateText = conversionRatePercent.toFixed(1) + '%'

    const clientSourceData = Object.values(
      clients.reduce<Record<string, { source: string; count: number }>>((acc, c) => {
        const key = c.source || 'Other'
        if (!acc[key]) acc[key] = { source: key, count: 0 }
        acc[key].count += 1
        return acc
      }, {})
    )

    const propertyStatusData = PROPERTY_STATUS_ORDER.map((statusKey) => {
      const count = properties.filter((p) => {
        const normalizedStatus: PropertyStatus = p.archived ? 'archived' : p.status
        return normalizedStatus === statusKey
      }).length
      return {
        name: PROPERTY_STATUS_LABELS[statusKey],
        value: count,
        statusKey,
      }
    })

    const inquiriesPerMonth = MONTH_LABELS.map((label, monthIndex) => {
      const count = inquiries.reduce((sum, lead) => {
        if (!lead.createdAt) return sum
        const d = new Date(lead.createdAt)
        if (d.getFullYear() !== currentYear || d.getMonth() !== monthIndex) return sum
        return sum + 1
      }, 0)
      return { month: label, count }
    })

    const dealsPipelineCounts = deals.reduce(
      (acc, deal) => {
        switch (deal.status) {
          case 'Inquiry': acc.inquiry += 1; break
          case 'Negotiation': acc.negotiating += 1; break
          case 'Reserved': acc.reserved += 1; break
          case 'Processing Documents': acc.processing += 1; break
          case 'Closed': acc.closed += 1; break
          case 'Cancelled': acc.cancelled += 1; break
        }
        return acc
      },
      { inquiry: 0, negotiating: 0, reserved: 0, processing: 0, closed: 0, cancelled: 0 }
    )

    const leadsNeedingAttention = getLeadsNeedingAttention(inquiries, 5)
    
    return {
      activeListings,
      totalClients,
      newLeadsThisMonth,
      pendingInquiries,
      monthlySalesData,
      monthlySales,
      closedDeals,
      averageDealValueText,
      conversionRateText,
      clientSourceData,
      propertyStatusData,
      inquiriesPerMonth,
      dealsPipelineData: [{
        stage: 'Pipeline',
        ...dealsPipelineCounts
      }],
      recentActivityRows: activities.slice(0, 5),
      leadsNeedingAttention,
      hasData: {
        dealsPipeline: Object.values(dealsPipelineCounts).some(v => v > 0),
        monthlySales: monthlySalesData.some(row => row.total > 0),
        leadsPerMonth: inquiriesPerMonth.some(row => row.count > 0),
        clientSource: clientSourceData.some(row => row.count > 0),
        propertyStatus: propertyStatusData.some(row => row.value > 0),
      }
    }
  }, []) // Empty deps for static local storage data, or could add [clients.length, inquiries.length, etc] if they were external

  const handlePropertyStatusClick = (data: { statusKey?: string }) => {
    if (data?.statusKey) navigate(`/admin/properties?status=${data.statusKey}`)
  }

  const handleDealsPipelineClick = (
    dataKey: 'inquiry' | 'negotiating' | 'reserved' | 'processing' | 'closed' | 'cancelled'
  ) => {
    const status =
      dataKey === 'inquiry' ? 'Inquiry' :
      dataKey === 'reserved' ? 'Reserved' :
      dataKey === 'negotiating' ? 'Negotiation' :
      dataKey === 'processing' ? 'Processing Documents' :
      dataKey === 'cancelled' ? 'Cancelled' : 'Closed'
    navigate(`/admin/deals?status=${encodeURIComponent(status)}`)
  }

  const handleAttentionLeadClick = (id: string) => {
    navigate(`/admin/inquiries?focus=${encodeURIComponent(id)}`)
  }

  const handleActivityRowClick = (row: ActivityLogEntry) => {
    if (!row.entityId) return
    const id = encodeURIComponent(row.entityId)
    if (row.entityType === 'deal') navigate(`/admin/deals?dealId=${id}`)
    else if (row.entityType === 'property') navigate(`/admin/properties?propertyId=${id}`)
    else if (row.entityType === 'client') navigate(`/admin/clients?clientId=${id}`)
  }

  return (
    <div className="admin-dashboard">
      <h1 className="admin-page-title">Dashboard</h1>

      {/* Summary cards */}
      <section className="dashboard-section dashboard-cards">
        <Link to="/admin/clients" className="admin-stat-card dashboard-card dashboard-card--blue">
          <div className="dashboard-card-icon"><HiOutlineUsers /></div>
          <div className="dashboard-card-content">
            <span className="admin-stat-value">{data.totalClients}</span>
            <span className="admin-stat-label">Total Clients</span>
          </div>
        </Link>
        <Link to="/admin/properties?status=available" className="admin-stat-card dashboard-card dashboard-card--green">
          <div className="dashboard-card-icon"><HiOutlineHome /></div>
          <div className="dashboard-card-content">
            <span className="admin-stat-value">{data.activeListings}</span>
            <span className="admin-stat-label">Active Listings</span>
          </div>
        </Link>
        <Link to="/admin/inquiries" className="admin-stat-card dashboard-card dashboard-card--teal">
          <div className="dashboard-card-icon"><HiOutlineChatAlt2 /></div>
          <div className="dashboard-card-content">
            <span className="admin-stat-value">{data.newLeadsThisMonth}</span>
            <span className="admin-stat-label">New Leads (This Month)</span>
          </div>
        </Link>
        <Link to="/admin/inquiries" className="admin-stat-card dashboard-card dashboard-card--red">
          <div className="dashboard-card-icon"><HiOutlineClipboardList /></div>
          <div className="dashboard-card-content">
            <span className="admin-stat-value">{data.pendingInquiries}</span>
            <span className="admin-stat-label">Pending Inquiries</span>
          </div>
        </Link>
        <Link to="/admin/deals?status=Closed" className="admin-stat-card dashboard-card dashboard-card--yellow">
          <div className="dashboard-card-icon"><HiOutlineCurrencyDollar /></div>
          <div className="dashboard-card-content">
            <span className="admin-stat-value">{formatPeso(data.monthlySales)}</span>
            <span className="admin-stat-label">Monthly Sales</span>
          </div>
        </Link>
        <Link to="/admin/deals?status=Closed" className="admin-stat-card dashboard-card dashboard-card--purple">
          <div className="dashboard-card-icon"><HiOutlineCheckCircle /></div>
          <div className="dashboard-card-content">
            <span className="admin-stat-value">{data.closedDeals}</span>
            <span className="admin-stat-label">Closed Deals</span>
          </div>
        </Link>
        <Link to="/admin/deals" className="admin-stat-card dashboard-card dashboard-card--blue">
          <div className="dashboard-card-icon"><HiOutlineTrendingUp /></div>
          <div className="dashboard-card-content">
            <span className="admin-stat-value">{data.conversionRateText}</span>
            <span className="admin-stat-label">Deal Conversion</span>
          </div>
        </Link>
        <Link to="/admin/deals?status=Closed" className="admin-stat-card dashboard-card dashboard-card--teal">
          <div className="dashboard-card-icon"><HiOutlineChartBar /></div>
          <div className="dashboard-card-content">
            <span className="admin-stat-value">{data.averageDealValueText}</span>
            <span className="admin-stat-label">Avg Deal Value</span>
          </div>
        </Link>
      </section>

      {/* Pipeline + Leads Month */}
      <section className="dashboard-section dashboard-charts-row">
        <div className="dashboard-chart-block dashboard-chart-block--half">
          <h2 className="dashboard-chart-title">Deals Pipeline</h2>
          <div className="dashboard-chart-wrap dashboard-chart-wrap--bar-inline dashboard-chart-wrap--pipeline">
            {data.hasData.dealsPipeline ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.dealsPipelineData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 13 }} stroke="var(--color-text-muted)" />
                  <YAxis type="category" dataKey="stage" width={72} tick={{ fontSize: 13 }} stroke="var(--color-text-muted)" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="inquiry" stackId="pipeline" fill="#3b82f6" name="Inquiry" onClick={() => handleDealsPipelineClick('inquiry')} />
                  <Bar dataKey="negotiating" stackId="pipeline" fill="#f97316" name="Negotiation" onClick={() => handleDealsPipelineClick('negotiating')} />
                  <Bar dataKey="reserved" stackId="pipeline" fill="#8b5cf6" name="Reserved" onClick={() => handleDealsPipelineClick('reserved')} />
                  <Bar dataKey="processing" stackId="pipeline" fill="#6366f1" name="Processing Documents" onClick={() => handleDealsPipelineClick('processing')} />
                  <Bar dataKey="closed" stackId="pipeline" fill="#16a34a" name="Closed" onClick={() => handleDealsPipelineClick('closed')} />
                  <Bar dataKey="cancelled" stackId="pipeline" fill="#ef4444" name="Cancelled" onClick={() => handleDealsPipelineClick('cancelled')} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="dashboard-empty-chart">No data available</div>}
          </div>
        </div>
        <div className="dashboard-chart-block dashboard-chart-block--half">
          <h2 className="dashboard-chart-title">Leads Created per Month</h2>
          <div className="dashboard-chart-wrap dashboard-chart-wrap--bar-inline dashboard-chart-wrap--leads-month">
            {data.hasData.leadsPerMonth ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.inquiriesPerMonth} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 13 }} stroke="var(--color-text-muted)" />
                  <YAxis tick={{ fontSize: 13 }} stroke="var(--color-text-muted)" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4a6b7a" radius={[4, 4, 0, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="dashboard-empty-chart">No data available</div>}
          </div>
        </div>
      </section>

      {/* Sales trend */}
      <section className="dashboard-section dashboard-chart-block">
        <h2 className="dashboard-chart-title">Monthly Sales (Deal Amount)</h2>
        <div className="dashboard-chart-wrap dashboard-chart-wrap--line">
          {data.hasData.monthlySales ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.monthlySalesData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="salesAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c19b6c" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#c19b6c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 13, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatPeso(v)} tick={{ fontSize: 13, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={70} />
                <Tooltip formatter={(v: number | undefined) => [v != null ? formatPeso(v) : '0.00', 'Sales']} />
                <Area type="monotone" dataKey="total" stroke="#c19b6c" strokeWidth={2.5} fill="url(#salesAreaGradient)" name="Sales" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="dashboard-empty-chart">No data available</div>}
        </div>
      </section>

      {/* Client Source + Prop Status */}
      <section className="dashboard-section dashboard-charts-row">
        <div className="dashboard-chart-block dashboard-chart-block--half">
          <h2 className="dashboard-chart-title">Client Source</h2>
          <div className="dashboard-chart-wrap dashboard-chart-wrap--bar">
            {data.hasData.clientSource ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.clientSourceData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 13 }} stroke="var(--color-text-muted)" />
                  <YAxis type="category" dataKey="source" width={72} tick={{ fontSize: 13 }} stroke="var(--color-text-muted)" />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--color-accent)" radius={[0, 4, 4, 0]} name="Clients" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="dashboard-empty-chart">No data available</div>}
          </div>
        </div>
        <div className="dashboard-chart-block dashboard-chart-block--half">
          <h2 className="dashboard-chart-title">Property Status</h2>
          <div className="dashboard-chart-wrap dashboard-chart-wrap--pie">
            {data.hasData.propertyStatus ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.propertyStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    onClick={handlePropertyStatusClick}
                    style={{ cursor: 'pointer' }}
                  >
                    {data.propertyStatusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '13px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="dashboard-empty-chart">No data available</div>}
          </div>
        </div>
      </section>

      {/* Attention Leads + Recent Activity */}
      <section className="dashboard-section dashboard-leads-activity-row">
        <div className="dashboard-leads-activity-panel dashboard-leads-attention">
          <h2 className="dashboard-chart-title">Leads Needing Attention</h2>
          <div className="admin-table-wrap dashboard-leads-attention-table">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Property</th>
                  <th>Status</th>
                  <th>Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {data.leadsNeedingAttention.length === 0 ? (
                  <tr><td colSpan={4} className="dashboard-leads-attention-empty">No overdue leads.</td></tr>
                ) : data.leadsNeedingAttention.map((row) => {
                  const kind = getFollowUpUiKind(row)
                  return (
                    <tr key={row.id} className={`dashboard-leads-attention-row ${kind ? `admin-inquiry-row--followup-${kind}` : ''}`} onClick={() => handleAttentionLeadClick(row.id)} role="button" tabIndex={0}>
                      <td>{row.name}</td>
                      <td>{row.propertyTitle}</td>
                      <td>{INQUIRY_STATUS_LABELS_DASH[row.status]}</td>
                      <td>{kind ? <span className={`admin-inquiry-followup-tag admin-inquiry-followup-tag--${kind} dashboard-leads-attention-tag`}>{followUpTagLabel(kind)}</span> : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="dashboard-leads-activity-panel">
          <h2 className="dashboard-chart-title">Recent Activity</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Activity</th><th>Date</th></tr></thead>
              <tbody>
                {data.recentActivityRows.map((row, i) => {
                  const Icon = ACTIVITY_ICONS[mapActivityType(row)]
                  return (
                    <tr key={i} onClick={() => handleActivityRowClick(row)}>
                      <td>
                        <span className="dashboard-activity-cell">
                          {Icon && <Icon className="dashboard-activity-icon" />}
                          <span>{row.details || row.entityLabel || '—'}</span>
                        </span>
                      </td>
                      <td>{row.at.slice(0, 10)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      
      {/* 
        This tool helps clean up local simulation cache if data looks out of sync.
        It has no effect on the database, only the UI state.
      */}
      <div className="dashboard-footer-tools mt-12 pb-8">
        <ResetTool />
      </div>
    </div>
  )
})
