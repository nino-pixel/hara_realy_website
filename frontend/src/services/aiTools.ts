import { SchemaType, type FunctionDeclaration, type Tool } from '@google/generative-ai'
import { fetchClients, saveClientStore } from './clientsService'
import { fetchProperties, savePropertyStore } from './propertiesService'
import { fetchInquiries, saveInquiryStore } from './inquiriesService'
import { fetchDeals, createDealTransaction, updateDealTransaction } from './dealsService'
import { logActivity } from '../data/activityLog'
import type { ClientStatus, ClientSource } from '../data/clientsData'
import type { PropertyStatus, PropertyType } from '../data/properties'
import { getNextPropertyCode } from '../data/properties'
import { getNextDealId } from '../data/deals'

// ──────────────────────────────────────────────
//   FUNCTION / TOOL DEFINITIONS for Gemini
// ──────────────────────────────────────────────
export const TOOLS: Tool[] = [
  {
    functionDeclarations: [
      // ── SYSTEM STATS ──────────────────────────
      {
        name: 'getSystemStats',
        description: 'Get overall statistics about the real estate system: total clients, properties, leads, deals, and breakdowns.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            category: {
              type: SchemaType.STRING,
              description: 'Which category to get stats for: "clients", "properties", "leads", "deals", or "all"',
            },
          },
          required: ['category'],
        },
      },

      // ── CLIENTS ───────────────────────────────
      {
        name: 'listClients',
        description: 'List all clients, optionally filtered by status or source, or search by name or email.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            status: { type: SchemaType.STRING, description: 'Filter by status: new, contacted, interested, negotiating, reserved, closed, lost, inactive' },
            search: { type: SchemaType.STRING, description: 'Search by name or email (partial match)' },
            limit: { type: SchemaType.NUMBER, description: 'Max number of results to return (default 10)' },
          },
        },
      },
      {
        name: 'addClient',
        description: 'Add a new client to the system. You MUST gather all required fields (*) first.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            name: { type: SchemaType.STRING, description: 'Full name of the client (*Required)' },
            email: { type: SchemaType.STRING, description: 'Email address (*Required)' },
            phone: { type: SchemaType.STRING, description: '11-digit phone number starting with 09 (*Required)' },
            province: { type: SchemaType.STRING, description: 'Province/City, usually Bulacan (*Required)' },
            municipality: { type: SchemaType.STRING, description: 'Municipality or City (*Required)' },
            barangay: { type: SchemaType.STRING, description: 'Barangay name (*Required)' },
            purokStreet: { type: SchemaType.STRING, description: 'Purok or Street address (Optional)' },
            source: { type: SchemaType.STRING, description: 'Source: Facebook, Website, Referral, or Walk-in' },
            status: { type: SchemaType.STRING, description: 'Initial status: new (default), contacted, etc.' },
            notes: { type: SchemaType.STRING, description: 'Initial notes about the client' },
          },
          required: ['name', 'email', 'phone', 'province', 'municipality', 'barangay'],
        },
      },
      {
        name: 'updateClient',
        description: 'Update an existing client\'s information by searching for their name.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            searchName: { type: SchemaType.STRING, description: 'Name to search for to identify the client' },
            name: { type: SchemaType.STRING, description: 'New name for the client (rename)' },
            phone: { type: SchemaType.STRING, description: 'New phone number' },
            email: { type: SchemaType.STRING, description: 'New email address' },
            status: { type: SchemaType.STRING, description: 'New status: new, contacted, interested, negotiating, reserved, closed, lost, inactive' },
            notes: { type: SchemaType.STRING, description: 'New notes' },
            adminNotes: { type: SchemaType.STRING, description: 'New admin notes' },
          },
          required: ['searchName'],
        },
      },

      // ── PROPERTIES ────────────────────────────
      {
        name: 'listProperties',
        description: 'List all properties, optionally filtered by status or type, or search by title.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            status: { type: SchemaType.STRING, description: 'Filter by property status: available, reserved, under_negotiation, processing_docs, sold, draft, cancelled' },
            type: { type: SchemaType.STRING, description: 'Filter by type: Condo, House, House & Lot, Lot, Commercial' },
            search: { type: SchemaType.STRING, description: 'Search by property title (partial match)' },
            limit: { type: SchemaType.NUMBER, description: 'Max results to return (default 10)' },
          },
        },
      },
      {
        name: 'addProperty',
        description: 'Add a new property listing. You MUST gather core fields (*) first.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING, description: 'Property title (*Required)' },
            type: { type: SchemaType.STRING, description: 'Property type: Condo, House, House & Lot, Lot, Commercial (*Required)' },
            location: { type: SchemaType.STRING, description: 'Display location (e.g. "Angeles City, Pampanga") (*Required)' },
            price: { type: SchemaType.STRING, description: 'Listing price (e.g. "₱3,500,000") (*Required)' },
            status: { type: SchemaType.STRING, description: 'Initial status: draft (default), available' },
            developer: { type: SchemaType.STRING, description: 'Developer or Subdivision name' },
            yearBuilt: { type: SchemaType.STRING, description: 'Year built (e.g. "2020")' },
            beds: { type: SchemaType.NUMBER, description: 'Number of bedrooms' },
            baths: { type: SchemaType.NUMBER, description: 'Number of bathrooms' },
            parking: { type: SchemaType.NUMBER, description: 'Number of parking slots' },
            lotArea: { type: SchemaType.STRING, description: 'Lot area (e.g. "120 sqm")' },
            floorArea: { type: SchemaType.STRING, description: 'Floor area (e.g. "95 sqm")' },
            notes: { type: SchemaType.STRING, description: 'Internal admin notes' },
          },
          required: ['title', 'type', 'location', 'price'],
        },
      },
      {
        name: 'updateProperty',
        description: 'Update a property\'s status, price, or notes by searching for its title.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            searchTitle: { type: SchemaType.STRING, description: 'Title to search for to identify the property' },
            status: { type: SchemaType.STRING, description: 'New status: available, reserved, under_negotiation, processing_docs, sold, draft, cancelled' },
            price: { type: SchemaType.STRING, description: 'New price (e.g. "₱4,200,000")' },
            location: { type: SchemaType.STRING, description: 'New location' },
            notes: { type: SchemaType.STRING, description: 'Updated internal notes' },
          },
          required: ['searchTitle'],
        },
      },

      // ── INQUIRIES / LEADS ─────────────────────
      {
        name: 'listLeads',
        description: 'List all leads/inquiries, optionally filtered by status or search by name.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            status: { type: SchemaType.STRING, description: 'Filter by status: new, contacted, qualified, converted, lost' },
            search: { type: SchemaType.STRING, description: 'Search by name or email' },
            limit: { type: SchemaType.NUMBER, description: 'Max results (default 10)' },
          },
        },
      },
      {
        name: 'addInquiry',
        description: 'Create a new lead/inquiry. You MUST gather all required fields (*) first.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            name: { type: SchemaType.STRING, description: 'Lead\'s full name (*Required)' },
            email: { type: SchemaType.STRING, description: 'Lead\'s email address (*Required)' },
            phone: { type: SchemaType.STRING, description: 'Lead\'s phone number (*Required)' },
            source: { type: SchemaType.STRING, description: 'Where the lead came from, usually "website" (*Required)' },
            propertyTitle: { type: SchemaType.STRING, description: 'Property they are interested in' },
            message: { type: SchemaType.STRING, description: 'Inquiry message or notes' },
            budgetRange: { type: SchemaType.STRING, description: 'Budget range (e.g. "₱3M-₱5M")' },
            buyingTimeline: { type: SchemaType.STRING, description: 'When they plan to buy (e.g. "within 3 months")' },
            financingMethod: { type: SchemaType.STRING, description: 'Payment method: cash, bank_loan, in_house, installment' },
          },
          required: ['name', 'email', 'phone', 'source'],
        },
      },
      {
        name: 'updateLead',
        description: 'Update a lead\'s status, notes, or priority by searching for their name.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            searchName: { type: SchemaType.STRING, description: 'Name to search for to identify the lead' },
            status: { type: SchemaType.STRING, description: 'New status: new, contacted, qualified, converted, lost' },
            notes: { type: SchemaType.STRING, description: 'New notes about the lead' },
            priority: { type: SchemaType.STRING, description: 'Priority level: low, medium, high, urgent' },
          },
          required: ['searchName'],
        },
      },

      // ── DEALS ─────────────────────────────────
      {
        name: 'listDeals',
        description: 'List all deals, optionally filtered by status.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            status: { type: SchemaType.STRING, description: 'Filter by deal status: Inquiry, Negotiation, Reserved, Processing Documents, Closed, Cancelled' },
            limit: { type: SchemaType.NUMBER, description: 'Max results (default 10)' },
          },
        },
      },
      {
        name: 'addDeal',
        description: 'Link a client to a property to start a deal. Required fields are (*) Client and Property.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            clientName: { type: SchemaType.STRING, description: 'Name of the client (*Required)' },
            propertyTitle: { type: SchemaType.STRING, description: 'Title of the property (*Required)' },
            status: { type: SchemaType.STRING, description: 'Deal status: Inquiry (default), Negotiation, Reserved, etc.' },
            price: { type: SchemaType.STRING, description: 'Prop price or agreed deal price' },
            paymentMethod: { type: SchemaType.STRING, description: 'Payment method (e.g. Cash, Bank Transfer)' },
            date: { type: SchemaType.STRING, description: 'Deal created date (YYYY-MM-DD)' },
            expectedClosingDate: { type: SchemaType.STRING, description: 'Expected closing date (YYYY-MM-DD)' },
            adminNotes: { type: SchemaType.STRING, description: 'Admin notes' },
          },
          required: ['clientName', 'propertyTitle'],
        },
      },
      {
        name: 'updateDeal',
        description: 'Update an existing deal\'s status, notes, or closing date by searching for the deal ID or client+property combo.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            searchDealId: { type: SchemaType.STRING, description: 'Deal ID to search for (e.g. "DL-001") or partial client/property name' },
            status: { type: SchemaType.STRING, description: 'New deal status: Inquiry, Negotiation, Reserved, Processing Documents, Closed, Cancelled' },
            adminNotes: { type: SchemaType.STRING, description: 'Updated admin notes' },
            closingDate: { type: SchemaType.STRING, description: 'Closing date in YYYY-MM-DD format' },
            finalSalePrice: { type: SchemaType.STRING, description: 'Final agreed sale price (e.g. "₱5,200,000")' },
          },
          required: ['searchDealId'],
        },
      },
    ] as FunctionDeclaration[],
  },
]

// ──────────────────────────────────────────────
//   FUNCTION EXECUTORS
// ──────────────────────────────────────────────
export function executeTool(name: string, args: Record<string, unknown>): unknown {
  switch (name) {

    // ── SYSTEM STATS ────────────────────────────
    case 'getSystemStats': {
      const cat = (args.category as string | undefined) ?? 'all'
      const clients = fetchClients()
      const props = fetchProperties()
      const leads = fetchInquiries()
      const deals = fetchDeals()

      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonthIndex = now.getMonth()
      const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

      const parsePeso = (s: string | null | undefined) => Number(String(s || '').replace(/[₱,\s]/g, '')) || 0

      // Calculate monthly sales & leads for the whole year
      const salesByMonth: Record<string, number> = {}
      const leadsByMonth: Record<string, number> = {}

      MONTH_LABELS.forEach((label, i) => {
        // Sales
        const monthTotalSales = deals.reduce((sum, d) => {
          if (d.status !== 'Closed') return sum
          const dateStr = d.closingDate || d.date
          if (!dateStr) return sum
          const dDate = new Date(dateStr)
          if (dDate.getFullYear() === currentYear && dDate.getMonth() === i) {
            return sum + parsePeso(d.finalSalePrice || d.price)
          }
          return sum
        }, 0)
        if (monthTotalSales > 0 || i <= currentMonthIndex) salesByMonth[label] = monthTotalSales

        // Leads
        const monthLeads = leads.filter(l => {
          if (!l.createdAt) return false
          const lDate = new Date(l.createdAt)
          return lDate.getFullYear() === currentYear && lDate.getMonth() === i
        }).length
        if (monthLeads > 0 || i <= currentMonthIndex) leadsByMonth[label] = monthLeads
      })

      const monthlySalesValue = salesByMonth[MONTH_LABELS[currentMonthIndex]] || 0
      const leadsThisMonth = leadsByMonth[MONTH_LABELS[currentMonthIndex]] || 0

      // Conversion Rate (Matching Dashboard: Closed Deals / Total Registered Clients)
      const totalRegisteredClients = clients.filter(c => !c.archived).length
      const closedDealsCount = deals.filter(d => d.status === 'Closed').length
      const conversionRate = totalRegisteredClients === 0 ? 0 : (closedDealsCount / totalRegisteredClients) * 100

      if (cat === 'clients') {
        const statuses: Record<string, number> = {}
        clients.forEach(c => { statuses[c.status] = (statuses[c.status] ?? 0) + 1 })
        return { total: clients.length, active: totalRegisteredClients, byStatus: statuses }
      }
      if (cat === 'properties') {
        const statuses: Record<string, number> = {}
        props.forEach(p => { statuses[p.status] = (statuses[p.status] ?? 0) + 1 })
        return { 
          total: props.length, 
          activeListings: props.filter(p => ['available', 'under_negotiation'].includes(p.status)).length,
          byStatus: statuses 
        }
      }
      if (cat === 'leads') {
        const statuses: Record<string, number> = {}
        leads.forEach(l => { statuses[l.status] = (statuses[l.status] ?? 0) + 1 })
        return { total: leads.length, leadsThisMonth, monthlyLeads: leadsByMonth, byStatus: statuses }
      }
      if (cat === 'deals') {
        const statuses: Record<string, number> = {}
        deals.forEach(d => { statuses[d.status] = (statuses[d.status] ?? 0) + 1 })
        return { 
          total: deals.length, 
          byStatus: statuses, 
          closedDeals: closedDealsCount,
          monthlySalesSummary: salesByMonth,
          currentMonthSales: `₱${monthlySalesValue.toLocaleString('en-PH')}`,
          conversionRate: `${conversionRate.toFixed(1)}%`
        }
      }
      return {
        clients: totalRegisteredClients,
        properties: props.length,
        activeListings: props.filter(p => ['available', 'under_negotiation'].includes(p.status)).length,
        leads: leads.length,
        leadsThisMonth,
        monthlyLeads: leadsByMonth,
        deals: deals.length,
        closedDeals: closedDealsCount,
        monthlySalesSummary: salesByMonth,
        conversionRate: `${conversionRate.toFixed(1)}%`
      }
    }

    // ── CLIENTS ─────────────────────────────────
    case 'listClients': {
      let clients = fetchClients()
      if (args.status) clients = clients.filter(c => c.status === args.status)
      if (args.search) {
        const s = (args.search as string).toLowerCase()
        clients = clients.filter(c => c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s))
      }
      const limit = (args.limit as number | undefined) ?? 10
      return clients.slice(0, limit).map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        status: c.status,
        source: c.source,
        dealsCount: c.dealsCount,
        lastActivity: c.lastActivity,
      }))
    }

    case 'addClient': {
      const id = `c${Date.now()}`
      const today = new Date().toISOString().slice(0, 10)
      const name = args.name as string
      // Duplicate check
      const existing = fetchClients().find(c => c.name.toLowerCase() === name.toLowerCase())
      if (existing) return { success: false, reason: `Client "${existing.name}" already exists (ID: ${existing.id})` }
      
      const source = (args.source as ClientSource | undefined) ?? 'Website'
      const province = (args.province as string) ?? 'Bulacan'
      const municipality = (args.municipality as string) ?? ''
      const barangay = (args.barangay as string) ?? ''
      const purok = (args.purokStreet as string) ?? ''
      const fullAddress = [purok, barangay, municipality, province].filter(Boolean).join(', ')

      saveClientStore(prev => [
        ...prev,
        {
          id,
          name,
          email: (args.email as string) ?? '',
          phone: (args.phone as string) ?? '',
          address: fullAddress,
          province,
          municipality,
          barangay,
          purokOrStreet: purok,
          source,
          status: (args.status as ClientStatus) ?? 'new',
          notes: (args.notes as string | undefined) ?? '',
          createdAt: today,
          updatedAt: today,
          dealsCount: 0,
          lastActivity: today,
          lastActivityType: 'Note' as const,
          adminNotes: '',
        },
      ])
      logActivity({ actor: 'AI Assistant', action: 'created', entityType: 'client', entityId: id, entityLabel: name, details: 'Added via AI chat' })
      return { success: true, id, name }
    }

    case 'updateClient': {
      const q = (args.searchName as string).toLowerCase()
      const clients = fetchClients()
      const client = clients.find(c => c.name.toLowerCase().includes(q))
      if (!client) return { success: false, reason: 'Client not found' }
      const today = new Date().toISOString().slice(0, 10)
      const updates: Record<string, unknown> = { updatedAt: today }
      if (args.name) updates.name = args.name
      if (args.phone) updates.phone = args.phone
      if (args.email) updates.email = args.email
      if (args.status) updates.status = args.status
      if (args.notes) updates.notes = args.notes
      if (args.adminNotes) updates.adminNotes = args.adminNotes
      saveClientStore(prev => prev.map(c => c.id === client.id ? { ...c, ...updates } : c))
      logActivity({ actor: 'AI Assistant', action: 'updated', entityType: 'client', entityId: client.id, entityLabel: client.name, details: `Updated via AI: ${Object.keys(updates).filter(k => k !== 'updatedAt').join(', ')}` })
      return { success: true, clientName: client.name, updated: Object.keys(updates).filter(k => k !== 'updatedAt') }
    }

    // ── PROPERTIES ──────────────────────────────
    case 'listProperties': {
      let props = fetchProperties()
      if (args.status) props = props.filter(p => p.status === args.status)
      if (args.type) props = props.filter(p => p.type === args.type)
      if (args.search) {
        const s = (args.search as string).toLowerCase()
        props = props.filter(p => p.title.toLowerCase().includes(s))
      }
      const limit = (args.limit as number | undefined) ?? 10
      return props.slice(0, limit).map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        price: p.price,
        type: p.type,
        location: p.location ?? '',
        beds: p.beds,
        baths: p.baths,
        area: p.area,
      }))
    }

    case 'addProperty': {
      const today = new Date().toISOString().slice(0, 10)
      const id = `prop${Date.now()}`
      const title = args.title as string
      // Duplicate check
      const existing = fetchProperties().find(p => p.title.toLowerCase() === title.toLowerCase())
      if (existing) return { success: false, reason: `Property "${existing.title}" already exists` }

      const rawPrice = args.price as string
      const price = rawPrice.startsWith('₱') ? rawPrice : `₱${parseInt(rawPrice.replace(/[,\s]/g,''), 10).toLocaleString('en-PH')}`

      const newProp = {
        id,
        title,
        type: (args.type as PropertyType) ?? 'House',
        location: (args.location as string) ?? '',
        price,
        status: (args.status as PropertyStatus) ?? 'draft',
        beds: (args.beds as number) ?? 0,
        baths: (args.baths as number) ?? 0,
        parking: (args.parking as number) ?? 0,
        lotArea: (args.lotArea as string) ?? '',
        floorArea: (args.floorArea as string) ?? '',
        area: (args.lotArea as string) || (args.floorArea as string) || '',
        developer: (args.developer as string) ?? '',
        yearBuilt: (args.yearBuilt as string) ?? '',
        image: '',
        leads: 0,
        updatedAt: today,
        propertyCode: getNextPropertyCode(),
        internalNotes: (args.notes as string) ?? '',
        showOnWebsite: false,
      }
      savePropertyStore(prev => [...prev, newProp])
      logActivity({ actor: 'AI Assistant', action: 'created', entityType: 'property', entityId: id, entityLabel: title, details: `Property added via AI: ${price}, ${newProp.status}` })
      return { success: true, id, title, propertyCode: newProp.propertyCode, status: newProp.status }
    }

    case 'updateProperty': {
      const q = (args.searchTitle as string).toLowerCase()
      const props = fetchProperties()
      const prop = props.find(p => p.title.toLowerCase().includes(q))
      if (!prop) return { success: false, reason: 'Property not found' }
      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString().slice(0, 10) }
      if (args.status) updates.status = args.status
      if (args.price) updates.price = args.price as string
      if (args.location) updates.location = args.location as string
      if (args.notes) updates.internalNotes = args.notes as string
      savePropertyStore(prev => prev.map(p => p.id === prop.id ? { ...p, ...updates } : p))
      const changed = Object.keys(updates).filter(k => k !== 'updatedAt')
      logActivity({ actor: 'AI Assistant', action: 'updated', entityType: 'property', entityId: prop.id, entityLabel: prop.title, details: `Updated via AI: ${changed.join(', ')}` })
      return { success: true, propertyTitle: prop.title, updated: changed }
    }

    // ── INQUIRIES / LEADS ───────────────────────
    case 'listLeads': {
      let leads = fetchInquiries()
      if (args.status) leads = leads.filter(l => l.status === args.status)
      if (args.search) {
        const s = (args.search as string).toLowerCase()
        leads = leads.filter(l => l.name.toLowerCase().includes(s) || l.email.toLowerCase().includes(s))
      }
      const limit = (args.limit as number | undefined) ?? 10
      return leads.slice(0, limit).map(l => ({
        id: l.id,
        name: l.name,
        email: l.email,
        phone: l.phone,
        status: l.status,
        priority: l.priority,
        propertyTitle: l.propertyTitle,
        createdAt: l.createdAt, // Full ISO string for AI date parsing
      }))
    }

    case 'addInquiry': {
      const id = `i${Date.now()}`
      const now = new Date()
      const name = args.name as string
      const propertyTitle = args.propertyTitle as string | undefined

      // Try to link to existing property
      const props = fetchProperties()
      const matchedProp = propertyTitle ? props.find(p => p.title.toLowerCase().includes(propertyTitle.toLowerCase())) : null

      const lead = {
        id,
        name,
        email: (args.email as string) ?? '',
        phone: (args.phone as string) ?? '',
        propertyId: matchedProp?.id ?? null,
        propertyTitle: matchedProp?.title ?? propertyTitle ?? 'General Inquiry',
        message: (args.message as string) ?? '',
        notes: '',
        status: 'new' as const,
        priority: 'medium' as const,
        createdAt: now.toISOString(),
        lastContactedAt: null,
        nextFollowUpAt: null,
        lostReason: null,
        source_auto: null,
        source_manual: (args.source as string) ?? 'website',
        utm_campaign: null,
        utm_medium: null,
        linkedClientId: null,
        budgetRange: (args.budgetRange as string) ?? null,
        buyingTimeline: (args.buyingTimeline as string) ?? null,
        financingMethod: (args.financingMethod as string) ?? null,
        employmentStatus: null,
        estimatedMonthly: null,
        downpayment: null,
        loanTerm: null,
        interestRate: null,
        downpaymentPercent: null,
        highBuyingIntent: false,
      }
      saveInquiryStore(prev => [lead, ...prev])
      logActivity({ actor: 'AI Assistant', action: 'created', entityType: 'inquiry', entityId: id, entityLabel: name, details: `Inquiry added via AI for: ${lead.propertyTitle}` })
      return { success: true, id, name, propertyTitle: lead.propertyTitle, linkedProperty: !!matchedProp }
    }

    case 'updateLead': {
      const q = (args.searchName as string).toLowerCase()
      const leads = fetchInquiries()
      const lead = leads.find(l => l.name.toLowerCase().includes(q))
      if (!lead) return { success: false, reason: 'Lead not found' }
      const updates: Record<string, unknown> = {}
      if (args.status) updates.status = args.status
      if (args.notes) updates.notes = args.notes
      if (args.priority) updates.priority = args.priority
      saveInquiryStore(prev => prev.map(l => l.id === lead.id ? { ...l, ...updates } : l))
      logActivity({ actor: 'AI Assistant', action: 'updated', entityType: 'inquiry', entityId: lead.id, entityLabel: lead.name, details: `Updated via AI: ${Object.keys(updates).join(', ')}` })
      return { success: true, leadName: lead.name, updated: Object.keys(updates) }
    }

    // ── DEALS ────────────────────────────────────
    case 'listDeals': {
      let deals = fetchDeals()
      if (args.status) deals = deals.filter(d => d.status === args.status)
      const limit = (args.limit as number | undefined) ?? 10
      return deals.slice(0, limit).map(d => ({
        dealId: d.dealId,
        clientName: d.clientName,
        propertyTitle: d.propertyTitle,
        status: d.status,
        price: d.price,
        finalSalePrice: d.finalSalePrice || d.price,
        date: d.date,
        closingDate: d.closingDate,
        createdAt: d.createdAt,
      }))
    }

    case 'addDeal': {
      const clientQ = (args.clientName as string).toLowerCase()
      const clients = fetchClients()
      const client = clients.find(c => c.name.toLowerCase().includes(clientQ))
      if (!client) return { success: false, reason: `Client "${args.clientName}" not found. Please add them first.` }

      const propQ = (args.propertyTitle as string).toLowerCase()
      const props = fetchProperties()
      const prop = props.find(p => p.title.toLowerCase().includes(propQ))

      const today = new Date().toISOString().slice(0, 10)
      const dealId = getNextDealId()
      const id = `deal${Date.now()}`

      const rawPrice = (args.price as string) ?? prop?.price ?? '₱0'
      const price = rawPrice.startsWith('₱') ? rawPrice : `₱${parseInt(rawPrice.replace(/[,\s]/g, ''), 10).toLocaleString('en-PH')}`

      const row = {
        id,
        dealId,
        propertyId: prop?.id ?? null,
        propertyTitle: prop?.title ?? (args.propertyTitle as string),
        status: (args.status as string) ?? 'Inquiry',
        amount: price,
        date: (args.date as string) ?? today,
        paymentMethod: (args.paymentMethod as string) ?? null,
        adminNotes: (args.adminNotes as string) ?? '',
        createdAt: today,
        updatedAt: today,
        closingDate: null,
        expectedClosingDate: (args.expectedClosingDate as string) ?? null,
        finalSalePrice: null,
        propertyPrice: prop?.price ?? null,
        cancelledReason: null,
      }

      createDealTransaction(client.id, row)
      return { success: true, dealId, clientName: client.name, propertyTitle: row.propertyTitle, status: row.status, price }
    }

    case 'updateDeal': {
      const q = (args.searchDealId as string).toLowerCase()
      const deals = fetchDeals()
      const deal = deals.find(d =>
        d.dealId.toLowerCase().includes(q) ||
        d.clientName.toLowerCase().includes(q) ||
        d.propertyTitle.toLowerCase().includes(q)
      )
      if (!deal) return { success: false, reason: `Deal not found matching "${args.searchDealId}"` }

      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString().slice(0, 10) }
      if (args.status) updates.status = args.status
      if (args.adminNotes) updates.adminNotes = args.adminNotes
      if (args.closingDate) updates.closingDate = args.closingDate
      if (args.finalSalePrice) updates.finalSalePrice = args.finalSalePrice

      updateDealTransaction(deal.id, updates)
      logActivity({
        actor: 'AI Assistant',
        action: 'updated',
        entityType: 'deal',
        entityId: deal.dealId,
        entityLabel: deal.propertyTitle,
        details: `Deal ${deal.dealId} updated via AI: ${Object.keys(updates).filter(k => k !== 'updatedAt').join(', ')}`,
      })
      return { success: true, dealId: deal.dealId, clientName: deal.clientName, updated: Object.keys(updates).filter(k => k !== 'updatedAt') }
    }

    default:
      return { error: `Unknown function: ${name}` }
  }
}
