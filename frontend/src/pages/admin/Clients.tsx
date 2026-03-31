import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Swal from 'sweetalert2'
import { HiOutlinePlus, HiOutlineDocumentDownload, HiOutlineEye, HiOutlinePencil, HiOutlineArchive, HiOutlineChat, HiOutlineChevronUp, HiOutlineChevronDown, HiOutlineMenu, HiOutlineClipboardList, HiOutlinePhone, HiOutlineMail, HiOutlineCalendar, HiOutlineCash, HiOutlineClock } from 'react-icons/hi'
import FormActions from '../../components/FormActions'
import StatusBadge from '../../components/StatusBadge'
import {
  fetchClients,
  saveClientStore,
  getClientStore,
  getStatusLabel,
  getStatusDescription,
  logClientActivity,
  type ClientRecord,
  type ClientStatus,
  type ClientSource,
  type LastActivityType,
} from '../../services/clientsService'
import { persistClientToApi, deleteClientFromApi } from '../../services/clientsApi'
import {
  BULACAN_PROVINCE,
  BULACAN_MUNICIPALITIES,
  formatBulacanAddressLine,
  getBarangaysForMunicipality,
  isValidPhMobile09,
} from '../../data/bulacanAddress'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import './admin-common.css'
import './Clients.css'

const SOURCES: ClientSource[] = ['Facebook', 'Website', 'Referral', 'Walk-in']
const STATUSES: ClientStatus[] = [
  'new',
  'contacted',
  'interested',
  'negotiating',
  'reserved',
  'closed',
  'lost',
  'inactive',
]

type SortCol = 'name' | 'email' | 'phone' | 'dealsCount' | 'lastActivity'

/** Status column filter — `pipeline` = contacted | interested | negotiating | reserved */
type ClientStatusFilter = ClientStatus | 'all' | '' | 'pipeline'

const PIPELINE_STATUSES: ClientStatus[] = ['contacted', 'interested', 'negotiating', 'reserved']

export default function AdminClients() {
  const { user } = useAdminAuth()
  const actor = user?.name ?? 'Unknown'
  const navigate = useNavigate()
  const location = useLocation()
  const [clients, setClients] = useState<ClientRecord[]>(() => fetchClients())
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortCol | ''>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [statusFilter, setStatusFilter] = useState<ClientStatusFilter>('')
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const [sourceFilter, setSourceFilter] = useState<ClientSource | 'all' | ''>('')
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false)
  const sourceDropdownRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [archiveModalClient, setArchiveModalClient] = useState<ClientRecord | null>(null)
  const [archiveReason, setArchiveReason] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [showBulkArchiveModal, setShowBulkArchiveModal] = useState(false)
  const [bulkStatusSelectValue, setBulkStatusSelectValue] = useState('')
  const [bulkArchiveReason, setBulkArchiveReason] = useState('')
  const [bulkArchiveError, setBulkArchiveError] = useState('')

  // Initialize: stop loading spinner on first mount if we haven't already
  const [hasInit, setHasInit] = useState(false)
  if (!hasInit) {
    setHasInit(true)
    setLoading(false)
  }

  // Sync: ensure editingClient state matches location state for external "Edit" triggers
  const [prevLocationKey, setPrevLocationKey] = useState(location.key)
  if (location.key !== prevLocationKey) {
    setPrevLocationKey(location.key)
    const editId = (location.state as { editId?: string } | null)?.editId
    if (editId) {
      const c = fetchClients().find((x) => x.id === editId)
      if (c) {
        setEditingClient(c)
        setShowForm(true)
      }
      navigate('/admin/clients', { replace: true, state: {} })
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(target)) setStatusDropdownOpen(false)
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(target)) setSourceDropdownOpen(false)
      if (addMenuRef.current && !addMenuRef.current.contains(target)) setAddMenuOpen(false)
    }
    if (statusDropdownOpen || sourceDropdownOpen || addMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [statusDropdownOpen, sourceDropdownOpen, addMenuOpen])

  const filteredByStatus = useMemo(() => {
    const active = clients.filter((c) => !c.archived)
    if (!statusFilter || statusFilter === 'all') return active
    if (statusFilter === 'pipeline') {
      return active.filter((c) => PIPELINE_STATUSES.includes(c.status))
    }
    return active.filter((c) => c.status === statusFilter)
  }, [clients, statusFilter])

  const filteredByStatusAndSource = useMemo(() => {
    if (!sourceFilter || sourceFilter === 'all') return filteredByStatus
    return filteredByStatus.filter((c) => c.source === sourceFilter)
  }, [filteredByStatus, sourceFilter])

  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) return filteredByStatusAndSource
    const q = searchQuery.trim().toLowerCase()
    return filteredByStatusAndSource.filter((c) => {
      const statusLabel = getStatusLabel(c.status).toLowerCase()
      const searchable = [
        c.name,
        c.email,
        c.phone,
        c.address,
        c.province,
        c.municipality,
        c.barangay,
        c.purokOrStreet,
        c.source,
        statusLabel,
        c.notes,
        c.adminNotes,
        c.createdAt,
        c.updatedAt,
        c.lastActivity,
        c.lastContact,
        c.nextFollowUp,
        c.archivedAt,
        c.archiveReason,
        String(c.dealsCount ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return searchable.includes(q)
    })
  }, [filteredByStatusAndSource, searchQuery])

  const sortedForDisplay = useMemo(() => {
    const list = [...filteredBySearch]
    /** Walang piniling column: pinakabagong client sa taas (createdAt desc). */
    if (!sortBy) {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      return list
    }
    const mult = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'email':
          cmp = a.email.localeCompare(b.email)
          break
        case 'phone':
          cmp = a.phone.localeCompare(b.phone)
          break
        case 'dealsCount':
          cmp = a.dealsCount - b.dealsCount
          break
        case 'lastActivity':
          cmp = a.lastActivity.localeCompare(b.lastActivity)
          break
        default:
          return 0
      }
      return mult * cmp
    })
    return list
  }, [filteredBySearch, sortBy, sortDir])

  const handleSort = (col: SortCol) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedForDisplay.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(sortedForDisplay.map((c) => c.id)))
  }

  const bulkStatus = (status: ClientStatus) => {
    const next = saveClientStore((prev) =>
      prev.map((c) => (selectedIds.has(c.id) ? { ...c, status } : c))
    )
    setClients(next)
    setSelectedIds(new Set())
  }

  const bulkDelete = () => {
    const selectedList = sortedForDisplay.filter((c) => selectedIds.has(c.id))
    const prioritySelected = selectedList.filter((c) => c.isPriority)
    if (prioritySelected.length > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Cannot archive priority clients',
        text: `${prioritySelected.length} selected client(s) are marked as priority. Please deselect them first.`,
      })
      return
    }
    setShowBulkArchiveModal(true)
    setBulkArchiveReason('')
    setBulkArchiveError('')
  }

  const confirmBulkArchive = () => {
    const reason = bulkArchiveReason.trim()
    if (!reason) {
      setBulkArchiveError('Please provide a reason for archiving.')
      return
    }
    const toArchive = fetchClients().filter((c) => selectedIds.has(c.id))
    
    // Asynchronously call API for each
    Promise.all(toArchive.map(c => deleteClientFromApi(c.id)))
      .catch(err => console.error('Bulk archive failed:', err))

    const next = saveClientStore((prev) =>
      prev.filter((c) => !selectedIds.has(c.id))
    )
    setClients(next)
    setSelectedIds(new Set())
    setShowBulkArchiveModal(false)
    setBulkArchiveReason('')
    setBulkArchiveError('')
    logClientActivity({
      actor,
      action: 'archived',
      entityType: 'client',
      entityId: null,
      entityLabel: `${toArchive.length} client(s)`,
      details: `Archived clients ${toArchive.map((c) => c.name).join(', ')} — Reason: ${reason}`,
    })
    Swal.fire({
      icon: 'success',
      title: 'Archived successfully',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    })
  }

  const exportCsv = () => {
    const headers = ['Name', 'Email', 'Phone', 'Source', 'Status', 'Deals', 'Last Activity']
    const rows = sortedForDisplay.map((c) =>
      [c.name, c.email, c.phone, c.source, c.status, c.dealsCount, c.lastActivity].join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clients.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportSelectedCsv = () => {
    const list = sortedForDisplay.filter((c) => selectedIds.has(c.id))
    if (list.length === 0) return
    const headers = ['Name', 'Email', 'Phone', 'Source', 'Status', 'Deals', 'Last Activity']
    const rows = list.map((c) =>
      [c.name, c.email, c.phone, c.source, c.status, c.dealsCount, c.lastActivity].join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clients-selected.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const openAdd = () => {
    setEditingClient(null)
    setShowForm(true)
  }

  const openEdit = (c: ClientRecord) => {
    setEditingClient(c)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingClient(null)
  }

  const deleteClient = (c: ClientRecord) => {
    if (c.isPriority) {
      Swal.fire({
        icon: 'warning',
        title: 'Cannot archive priority client',
        text: `${c.name} is marked as priority and cannot be archived.`,
      })
      return
    }
    setArchiveModalClient(c)
    setArchiveReason('')
    setArchiveError('')
  }

  const confirmArchive = () => {
    if (!archiveModalClient) return
    const reason = archiveReason.trim()
    if (!reason) {
      setArchiveError('Please provide a reason for archiving.')
      return
    }
    // Call API (asynchronous)
    deleteClientFromApi(archiveModalClient.id).catch(err => {
      console.error('Delete client failed:', err)
    })

    const next = saveClientStore((prev) =>
      prev.filter((x) => x.id !== archiveModalClient.id)
    )
    setClients(next)
    setArchiveModalClient(null)
    setArchiveReason('')
    setArchiveError('')
    logClientActivity({
      actor,
      action: 'archived',
      entityType: 'client',
      entityId: archiveModalClient.id,
      entityLabel: archiveModalClient.name,
      details: `Archived client ${archiveModalClient.name} — Reason: ${reason}`,
    })
    Swal.fire({
      icon: 'success',
      title: 'Archived successfully',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    })
  }

  const togglePriority = (c: ClientRecord) => {
    const next = saveClientStore((prev) =>
      prev.map((x) =>
      x.id === c.id ? { ...x, isPriority: !(x.isPriority ?? false) } : x
      )
    )
    setClients(next)
  }

  const lastActivityIcon = (type?: LastActivityType) => {
    switch (type) {
      case 'Inquiry': return <HiOutlineChat />
      case 'Call': return <HiOutlinePhone />
      case 'Email': return <HiOutlineMail />
      case 'Meeting': return <HiOutlineCalendar />
      case 'Reservation': return <HiOutlineCash />
      case 'Note': return <HiOutlineClipboardList />
      default: return <HiOutlineClock />
    }
  }

  const allClients = fetchClients().filter((c) => !c.archived)
  const totalClients = allClients.length
  const newLeads = allClients.filter((c) => c.status === 'new').length
  const inPipeline = allClients.filter((c) => PIPELINE_STATUSES.includes(c.status)).length
  const closedCount = allClients.filter((c) => c.status === 'closed').length
  const facebookLeads = allClients.filter((c) => c.source === 'Facebook').length
  const websiteLeads = allClients.filter((c) => c.source === 'Website').length

  return (
    <div className="admin-clients">
      <header className="clients-header">
        <h1 className="admin-page-title">Clients Management</h1>
        <div className="clients-header-actions">
          <input
            type="search"
            className="admin-input clients-search"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search clients"
          />
          <div className="add-client-dropdown" ref={addMenuRef}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAddMenuOpen((o) => !o)}
              aria-expanded={addMenuOpen}
              aria-haspopup="true"
            >
              <HiOutlinePlus className="btn-icon" /> Add Client
              <HiOutlineChevronDown className="add-client-chevron" />
            </button>
            {addMenuOpen && (
              <div className="add-client-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="add-client-menu-item"
                  onClick={() => { setAddMenuOpen(false); openAdd(); }}
                >
                  Add client
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="add-client-menu-item"
                  onClick={() => { setAddMenuOpen(false); setShowBulkUpload(true); }}
                >
                  Bulk upload
                </button>
              </div>
            )}
          </div>
          <button type="button" className="btn btn-outline" onClick={exportCsv}>
            <HiOutlineDocumentDownload className="btn-icon" /> Export CSV
          </button>
        </div>
      </header>

      <section className="clients-mini-stats">
        <button
          type="button"
          className={`mini-stat-card mini-stat-card--clickable ${!statusFilter || statusFilter === 'all' ? 'mini-stat-card--active' : ''}`}
          onClick={() => {
            if (!statusFilter || statusFilter === 'all') setSourceFilter('')
            else setStatusFilter('')
          }}
          title={!statusFilter || statusFilter === 'all' ? 'Clear source filter' : 'Show all clients (any status)'}
        >
          <span className="mini-stat-value">{totalClients}</span>
          <span className="mini-stat-label">Total Clients</span>
        </button>
        <button
          type="button"
          className={`mini-stat-card mini-stat-card--clickable ${statusFilter === 'new' ? 'mini-stat-card--active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'new' ? '' : 'new')}
          title={statusFilter === 'new' ? 'Clear status filter' : 'Filter by New leads'}
        >
          <span className="mini-stat-value">{newLeads}</span>
          <span className="mini-stat-label">New Leads</span>
        </button>
        <button
          type="button"
          className={`mini-stat-card mini-stat-card--clickable ${statusFilter === 'pipeline' ? 'mini-stat-card--active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'pipeline' ? '' : 'pipeline')}
          title={statusFilter === 'pipeline' ? 'Clear status filter' : 'Filter by In pipeline (contacted → reserved)'}
        >
          <span className="mini-stat-value">{inPipeline}</span>
          <span className="mini-stat-label">In Pipeline</span>
        </button>
        <button
          type="button"
          className={`mini-stat-card mini-stat-card--clickable ${statusFilter === 'closed' ? 'mini-stat-card--active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'closed' ? '' : 'closed')}
          title={statusFilter === 'closed' ? 'Clear status filter' : 'Filter by Closed'}
        >
          <span className="mini-stat-value">{closedCount}</span>
          <span className="mini-stat-label">Closed</span>
        </button>
        <button
          type="button"
          className={`mini-stat-card mini-stat-card--clickable ${sourceFilter === 'Facebook' ? 'mini-stat-card--active' : ''}`}
          onClick={() => setSourceFilter(sourceFilter === 'Facebook' ? '' : 'Facebook')}
          title={sourceFilter === 'Facebook' ? 'Clear filter' : 'Filter by Facebook leads'}
        >
          <span className="mini-stat-value">{facebookLeads}</span>
          <span className="mini-stat-label">Facebook Leads</span>
        </button>
        <button
          type="button"
          className={`mini-stat-card mini-stat-card--clickable ${sourceFilter === 'Website' ? 'mini-stat-card--active' : ''}`}
          onClick={() => setSourceFilter(sourceFilter === 'Website' ? '' : 'Website')}
          title={sourceFilter === 'Website' ? 'Clear filter' : 'Filter by Website leads'}
        >
          <span className="mini-stat-value">{websiteLeads}</span>
          <span className="mini-stat-label">Website Leads</span>
        </button>
      </section>

      {selectedIds.size > 0 && (
        <div className="clients-bulk-bar" role="toolbar" aria-label="Bulk actions">
          <span className="bulk-bar-count">{selectedIds.size} selected</span>
          <span className="bulk-bar-sep" aria-hidden="true">|</span>
          <div className="bulk-bar-actions">
            <label htmlFor="bulk-status-select" className="bulk-bar-action-label">Change Status</label>
            <select
              id="bulk-status-select"
              className="bulk-bar-select admin-input"
              value={bulkStatusSelectValue}
              onChange={(e) => {
                const v = e.target.value as ClientStatus
                if (!v) return
                const label = getStatusLabel(v)
                Swal.fire({
                  icon: 'question',
                  title: 'Change status?',
                  html: `Change status to <strong>${label}</strong> for <strong>${selectedIds.size}</strong> selected client(s)?`,
                  showCancelButton: true,
                  confirmButtonText: 'Yes, change status',
                  cancelButtonText: 'Cancel',
                }).then((result) => {
                  if (result.isConfirmed) bulkStatus(v)
                  setBulkStatusSelectValue('')
                })
              }}
            >
              <option value="">Choose...</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{getStatusLabel(s)}</option>
              ))}
            </select>
          </div>
          <span className="bulk-bar-sep" aria-hidden="true">|</span>
          <button type="button" className="btn btn-sm btn-outline bulk-bar-btn" onClick={exportSelectedCsv}>
            Export
          </button>
          <span className="bulk-bar-sep" aria-hidden="true">|</span>
          <button type="button" className="btn btn-sm btn-outline bulk-bar-btn bulk-bar-btn--archive" onClick={bulkDelete}>
            Archive
          </button>
        </div>
      )}

      <div className="admin-table-wrap clients-table-wrap">
        <table className="admin-table clients-table">
          <thead>
            <tr>
              <th className="col-checkbox">
                <input
                  type="checkbox"
                  checked={sortedForDisplay.length > 0 && selectedIds.size === sortedForDisplay.length}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className={`th-filter th-sortable ${sortBy === 'name' ? 'th--sorted' : ''}`}>
                <button type="button" className="th-sort-btn" onClick={() => handleSort('name')} aria-label="Sort by name">
                  <span className="th-label">Name</span>
                  <span className="th-sort-icon">
                    {sortBy === 'name' ? (sortDir === 'asc' ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />) : <><HiOutlineChevronUp /><HiOutlineChevronDown /></>}
                  </span>
                </button>
              </th>
              <th className={`th-filter th-sortable ${sortBy === 'email' ? 'th--sorted' : ''}`}>
                <button type="button" className="th-sort-btn" onClick={() => handleSort('email')} aria-label="Sort by email">
                  <span className="th-label">Email</span>
                  <span className="th-sort-icon">
                    {sortBy === 'email' ? (sortDir === 'asc' ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />) : <><HiOutlineChevronUp /><HiOutlineChevronDown /></>}
                  </span>
                </button>
              </th>
              <th className={`th-filter th-sortable ${sortBy === 'phone' ? 'th--sorted' : ''}`}>
                <button type="button" className="th-sort-btn" onClick={() => handleSort('phone')} aria-label="Sort by phone">
                  <span className="th-label">Phone</span>
                  <span className="th-sort-icon">
                    {sortBy === 'phone' ? (sortDir === 'asc' ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />) : <><HiOutlineChevronUp /><HiOutlineChevronDown /></>}
                  </span>
                </button>
              </th>
              <th className="th-filter col-source">
                <div className="th-status-wrap" ref={sourceDropdownRef}>
                  <button type="button" className="th-label-btn" onClick={() => setSourceDropdownOpen((o) => !o)} aria-label="Filter by source" aria-expanded={sourceDropdownOpen}>
                    <span className="th-label">Source</span>
                  </button>
                  <button
                    type="button"
                    className={`th-dropdown-trigger ${sourceDropdownOpen ? 'th-dropdown-trigger--open' : ''}`}
                    onClick={() => setSourceDropdownOpen((o) => !o)}
                    aria-label="Filter by source"
                    aria-expanded={sourceDropdownOpen}
                  >
                    <span className="th-dropdown-trigger-icon">
                      <HiOutlineMenu />
                      <HiOutlineChevronDown />
                    </span>
                  </button>
                  {sourceDropdownOpen && (
                    <div className="th-dropdown-menu" role="menu">
                      <button type="button" role="menuitem" className={`th-dropdown-item ${!sourceFilter || sourceFilter === 'all' ? 'th-dropdown-item--active' : ''}`} onClick={() => { setSourceFilter(''); setSourceDropdownOpen(false); }}>
                        All
                      </button>
                      {SOURCES.map((s) => (
                        <button key={s} type="button" role="menuitem" className={`th-dropdown-item ${sourceFilter === s ? 'th-dropdown-item--active' : ''}`} onClick={() => { setSourceFilter(s); setSourceDropdownOpen(false); }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </th>
              <th className="th-filter col-status">
                <div className="th-status-wrap" ref={statusDropdownRef}>
                  <button type="button" className="th-label-btn" onClick={() => setStatusDropdownOpen((o) => !o)} aria-label="Filter by status" aria-expanded={statusDropdownOpen}>
                    <span className="th-label">Status</span>
                  </button>
                  <button
                    type="button"
                    className={`th-dropdown-trigger ${statusDropdownOpen ? 'th-dropdown-trigger--open' : ''}`}
                    onClick={() => setStatusDropdownOpen((o) => !o)}
                    aria-label="Filter by status"
                    aria-expanded={statusDropdownOpen}
                  >
                    <span className="th-dropdown-trigger-icon">
                      <HiOutlineMenu />
                      <HiOutlineChevronDown />
                    </span>
                  </button>
                  {statusDropdownOpen && (
                    <div className="th-dropdown-menu" role="menu">
                      <button type="button" role="menuitem" className={`th-dropdown-item ${!statusFilter || statusFilter === 'all' ? 'th-dropdown-item--active' : ''}`} onClick={() => { setStatusFilter(''); setStatusDropdownOpen(false); }}>
                        All
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={`th-dropdown-item ${statusFilter === 'pipeline' ? 'th-dropdown-item--active' : ''}`}
                        onClick={() => {
                          setStatusFilter('pipeline')
                          setStatusDropdownOpen(false)
                        }}
                      >
                        In pipeline
                      </button>
                      {STATUSES.map((s) => (
                        <button key={s} type="button" role="menuitem" className={`th-dropdown-item ${statusFilter === s ? 'th-dropdown-item--active' : ''}`} onClick={() => { setStatusFilter(s); setStatusDropdownOpen(false); }}>
                          {getStatusLabel(s)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </th>
              <th className={`th-filter th-sortable ${sortBy === 'dealsCount' ? 'th--sorted' : ''}`}>
                <button type="button" className="th-sort-btn" onClick={() => handleSort('dealsCount')} aria-label="Sort by deals">
                  <span className="th-label">Deals</span>
                  <span className="th-sort-icon">
                    {sortBy === 'dealsCount' ? (sortDir === 'asc' ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />) : <><HiOutlineChevronUp /><HiOutlineChevronDown /></>}
                  </span>
                </button>
              </th>
              <th className={`th-filter th-sortable ${sortBy === 'lastActivity' ? 'th--sorted' : ''}`}>
                <button type="button" className="th-sort-btn" onClick={() => handleSort('lastActivity')} aria-label="Sort by last activity">
                  <span className="th-label">Last Activity</span>
                  <span className="th-sort-icon">
                    {sortBy === 'lastActivity' ? (sortDir === 'asc' ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />) : <><HiOutlineChevronUp /><HiOutlineChevronDown /></>}
                  </span>
                </button>
              </th>
              <th className="col-priority">Mark Priority</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="admin-empty-cell">
                  Loading clients...
                </td>
              </tr>
            ) : sortedForDisplay.length === 0 ? (
              <tr>
                <td colSpan={10} className="admin-empty-cell">
                  No clients match your search.
                </td>
              </tr>
            ) : (
              sortedForDisplay.map((c) => (
              <tr key={c.id}>
                <td className="col-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    aria-label={`Select ${c.name}`}
                  />
                </td>
                <td>{c.name}</td>
                <td>{c.email}</td>
                <td>{c.phone}</td>
                <td className="col-source">{c.source}</td>
                <td className="col-status">
                  <StatusBadge
                    className={`admin-badge admin-badge--${c.status}`}
                    title={getStatusDescription(c.status)}
                  >
                    {getStatusLabel(c.status)}
                  </StatusBadge>
                </td>
                <td className="col-deals">
                  <Link
                    to={`/admin/deals${c.dealsCount ? `?clientId=${c.id}` : ''}`}
                    className="deals-view-btn"
                    title={c.dealsCount ? `View deals for ${c.name}` : 'No deals'}
                  >
                    {c.dealsCount}
                  </Link>
                </td>
                <td className="col-last-activity">
                  <span className="last-activity-cell" title={c.lastActivityType ? `${c.lastActivity} (${c.lastActivityType})` : c.lastActivity}>
                    <span className="last-activity-icon">{lastActivityIcon(c.lastActivityType)}</span>
                    <span className="last-activity-text">{c.lastActivity}</span>
                  </span>
                </td>
                <td className="col-priority">
                  <button
                    type="button"
                    className={`priority-indicator ${c.isPriority ? 'priority-indicator--on' : ''}`}
                    onClick={() => togglePriority(c)}
                    title={c.isPriority ? 'Remove priority' : 'Mark as priority'}
                    aria-label={c.isPriority ? 'Remove priority' : 'Mark as priority'}
                  >
                    <span className="priority-dot" />
                  </button>
                </td>
                <td className="col-actions">
                  <Link
                    to={`/admin/deals?clientId=${c.id}&createDeal=1`}
                    className="btn-icon-btn"
                    data-tooltip="Create deal — opens Deals with this client selected so you can start a new transaction."
                    title="Create deal — new transaction for this client"
                    aria-label="Create a new deal for this client"
                  >
                    <HiOutlineCash />
                  </Link>
                  <Link
                    to={`/admin/clients/${c.id}`}
                    className="btn-icon-btn"
                    data-tooltip="View client — open full profile (contacts, deals, activity, notes)."
                    title="View client — full profile and history"
                    aria-label="View client profile"
                  >
                    <HiOutlineEye />
                  </Link>
                  <button
                    type="button"
                    className="btn-icon-btn"
                    data-tooltip="Edit client — update name, contact, source, and notes in the side panel."
                    title="Edit client — details and notes"
                    aria-label="Edit this client"
                    onClick={() => openEdit(c)}
                  >
                    <HiOutlinePencil />
                  </button>
                  <a
                    href={`mailto:${c.email}`}
                    className="btn-icon-btn"
                    data-tooltip={`Email client — opens your mail app to ${c.email}.`}
                    title={`Send email to ${c.email}`}
                    aria-label={`Send email to ${c.name}`}
                  >
                    <HiOutlineChat />
                  </a>
                  <button
                    type="button"
                    className="btn-icon-btn btn-icon-btn--archive"
                    data-tooltip={
                      c.isPriority
                        ? 'Archive unavailable — remove priority first; priority clients stay active.'
                        : 'Archive client — hides from the main list; related records stay linked.'
                    }
                    title={
                      c.isPriority
                        ? 'Cannot archive while marked priority'
                        : 'Archive client — soft-hide from list'
                    }
                    onClick={() => !c.isPriority && deleteClient(c)}
                    disabled={!!c.isPriority}
                    aria-label={
                      c.isPriority
                        ? 'Priority clients cannot be archived. Remove priority first.'
                        : 'Archive client'
                    }
                  >
                    <HiOutlineArchive />
                  </button>
                </td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>

      {showBulkUpload && (
        <BulkUploadModal
          onClose={() => setShowBulkUpload(false)}
          onUploaded={(newList) => {
            saveClientStore(() => newList)
            setClients(newList)
            setShowBulkUpload(false)
          }}
        />
      )}

      {archiveModalClient && (
        <div className="admin-modal-overlay" onClick={() => setArchiveModalClient(null)} role="dialog" aria-modal="true" aria-labelledby="archive-modal-title">
          <div className="admin-modal archive-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 id="archive-modal-title">Archive client</h2>
              <button type="button" className="admin-modal-close" onClick={() => setArchiveModalClient(null)} aria-label="Close">&times;</button>
            </div>
            <div className="admin-modal-body">
              <div className="archive-warning">
                <p className="archive-warning-title">⚠️ Confirmation</p>
                <p>You are about to archive <strong>{archiveModalClient.name}</strong>.</p>
              </div>
              <div className="admin-form-row">
                <label htmlFor="archive-reason">Reason for archiving <span className="required">*</span></label>
                <textarea
                  id="archive-reason"
                  className="admin-input"
                  value={archiveReason}
                  onChange={(e) => { setArchiveReason(e.target.value); setArchiveError(''); }}
                  placeholder="e.g. Client requested removal, duplicate, moved to competitor"
                  rows={3}
                  required
                />
              </div>
              {archiveError && <p className="form-error">{archiveError}</p>}
              <div className="archive-actions">
                <button type="button" className="btn btn-primary" onClick={confirmArchive}>
                  Archive client
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setArchiveModalClient(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkArchiveModal && (
        <div className="admin-modal-overlay" onClick={() => setShowBulkArchiveModal(false)} role="dialog" aria-modal="true" aria-labelledby="bulk-archive-modal-title">
          <div className="admin-modal archive-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 id="bulk-archive-modal-title">Archive selected clients</h2>
              <button type="button" className="admin-modal-close" onClick={() => setShowBulkArchiveModal(false)} aria-label="Close">&times;</button>
            </div>
            <div className="admin-modal-body">
              <div className="archive-warning">
                <p className="archive-warning-title">⚠️ Confirmation</p>
                <p>You are about to archive <strong>{selectedIds.size} client{selectedIds.size !== 1 ? 's' : ''}</strong>.</p>
              </div>
              <div className="admin-form-row">
                <label htmlFor="bulk-archive-reason">Reason for archiving <span className="required">*</span></label>
                <textarea
                  id="bulk-archive-reason"
                  className="admin-input"
                  value={bulkArchiveReason}
                  onChange={(e) => { setBulkArchiveReason(e.target.value); setBulkArchiveError(''); }}
                  placeholder="e.g. Batch cleanup, campaign ended"
                  rows={3}
                  required
                />
              </div>
              {bulkArchiveError && <p className="form-error">{bulkArchiveError}</p>}
              <div className="archive-actions">
                <button type="button" className="btn btn-primary" onClick={confirmBulkArchive}>
                  Archive {selectedIds.size} client{selectedIds.size !== 1 ? 's' : ''}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowBulkArchiveModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <ClientFormSidebar
          key={editingClient?.id ?? 'new'}
          client={editingClient}
          onClose={closeForm}
          onSave={(client) => {
            const wasEdit = !!editingClient
            if (wasEdit) {
              const next = saveClientStore((prev) =>
                prev.map((c) => (c.id === client.id ? client : c))
              )
              setClients(next)
              logClientActivity({
                actor,
                action: 'updated',
                entityType: 'client',
                entityId: client.id,
                entityLabel: client.name,
                details: 'Client details updated',
              })
            } else {
              const next = saveClientStore((prev) => [...prev, client])
              setClients(next)
              logClientActivity({
                actor,
                action: 'created',
                entityType: 'client',
                entityId: client.id,
                entityLabel: client.name,
                details: 'New client added',
              })
            }
            closeForm()
            // Defer toast until after sidebar unmounts so SweetAlert2 isn’t blocked by overlay/focus
            window.setTimeout(() => {
              void Swal.fire({
                icon: 'success',
                title: wasEdit ? 'Client updated' : 'Client added',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2500,
                timerProgressBar: true,
              })
            }, 0)
          }}
        />
      )}
    </div>
  )
}

function ClientFormSidebar({
  client,
  onClose,
  onSave,
}: {
  client: ClientRecord | null
  onClose: () => void
  onSave: (c: ClientRecord) => void
}) {
  const isEdit = !!client
  const [name, setName] = useState(client?.name ?? '')
  const [email, setEmail] = useState(client?.email ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [municipality, setMunicipality] = useState(client?.municipality ?? '')
  const [barangay, setBarangay] = useState(client?.barangay ?? '')
  const [purokOrStreet, setPurokOrStreet] = useState(client?.purokOrStreet ?? '')
  const [source, setSource] = useState<ClientSource>(client?.source ?? 'Website')
  const [status, setStatus] = useState<ClientStatus>(client?.status ?? 'new')
  const [notes, setNotes] = useState(client?.notes ?? '')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const barangayOptions = useMemo(() => {
    const base = getBarangaysForMunicipality(municipality)
    if (barangay && !base.includes(barangay)) {
      return [barangay, ...base]
    }
    return [...base]
  }, [municipality, barangay])

  const validate = (): boolean => {
    if (!name.trim()) {
      Swal.fire({ icon: 'warning', title: 'Name Required', text: 'Full name is required.' })
      return false
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(email)) {
      Swal.fire({ icon: 'error', title: 'Invalid Email', text: 'Please enter a valid email address.' })
      return false
    }
    const allClients = getClientStore()
    const emailDuplicate = allClients.find((c) => c.email.toLowerCase() === email.toLowerCase() && c.id !== client?.id)
    if (emailDuplicate) {
      Swal.fire({ 
        icon: 'error', 
        title: 'Email Already Used', 
        html: `The email <strong>${email}</strong> is already used by <strong>${emailDuplicate.name}</strong>.` 
      })
      return false
    }
    const phoneDigits = phone.replace(/\s/g, '')
    const phoneDuplicate = allClients.find((c) => c.phone.replace(/\s/g, '') === phoneDigits && c.id !== client?.id)
    if (phoneDuplicate) {
      Swal.fire({ 
        icon: 'error', 
        title: 'Phone Already Used', 
        html: `The phone number <strong>${phone}</strong> is already used by <strong>${phoneDuplicate.name}</strong>.` 
      })
      return false
    }
    if (!isValidPhMobile09(phoneDigits)) {
      Swal.fire({ icon: 'warning', title: 'Invalid Phone', text: 'Phone must be 11 digits starting with 09.' })
      return false
    }
    if (!municipality.trim()) {
      Swal.fire({ icon: 'warning', title: 'Location Required', text: 'Municipality / city is required.' })
      return false
    }
    if (!barangay.trim()) {
      Swal.fire({ icon: 'warning', title: 'Location Required', text: 'Barangay is required.' })
      return false
    }
    return true
  }

  const handleSave = async () => {
    if (!validate()) return
    const now = new Date().toISOString().slice(0, 10)
    const mun = municipality.trim()
    const brgy = barangay.trim()
    const purok = purokOrStreet.trim()
    const phoneDigits = phone.replace(/\s/g, '')
    const addressLine = formatBulacanAddressLine({
      purokOrStreet: purok || undefined,
      barangay: brgy,
      municipality: mun,
      province: BULACAN_PROVINCE,
    })

    const draft: ClientRecord =
      isEdit && client
        ? {
            ...client,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phoneDigits,
            province: BULACAN_PROVINCE,
            municipality: mun,
            barangay: brgy,
            purokOrStreet: purok || undefined,
            address: addressLine,
            source,
            status,
            notes: notes.trim(),
            updatedAt: now,
          }
        : {
            id: 'c' + Date.now(),
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phoneDigits,
            province: BULACAN_PROVINCE,
            municipality: mun,
            barangay: brgy,
            purokOrStreet: purok || undefined,
            address: addressLine,
            source,
            status,
            notes: notes.trim(),
            createdAt: now,
            updatedAt: now,
            dealsCount: 0,
            lastActivity: now,
            adminNotes: '',
          }

    setSaving(true)
    try {
      const saved = await persistClientToApi(draft)
      onSave(saved)
    } catch (e) {
      Swal.fire({ 
        icon: 'error', 
        title: 'Save Failed', 
        text: e instanceof Error ? e.message : 'Failed to save client.' 
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="client-sidebar-overlay" onClick={onClose} role="presentation">
      <div className="client-sidebar" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={isEdit ? 'Edit Client' : 'Add Client'}>
        <div className="client-sidebar-header">
          <h2>{isEdit ? 'Edit Client' : 'Add Client'}</h2>
          <button type="button" className="client-sidebar-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="client-sidebar-body">
          <div className="admin-form-row">
            <label>Full Name *</label>
            <input
              className="admin-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="admin-form-row">
            <label>Email *</label>
            <input
              type="email"
              className="admin-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <div className="admin-form-row">
            <label>Phone *</label>
            <input
              type="tel"
              className="admin-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09171234567 (11 digits, starts with 09)"
            />
          </div>
          <div className="admin-form-row">
            <label>Province / city *</label>
            <input className="admin-input" value={BULACAN_PROVINCE} readOnly disabled />
          </div>
          <div className="admin-form-row">
            <label>Municipality / city *</label>
            <select
              className="admin-input"
              value={municipality}
              onChange={(e) => {
                const m = e.target.value
                setMunicipality(m)
                const nextOpts = getBarangaysForMunicipality(m)
                setBarangay((prev) => (prev && nextOpts.includes(prev) ? prev : ''))
              }}
              required
            >
              <option value="">Select municipality…</option>
              {BULACAN_MUNICIPALITIES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form-row">
            <label>Barangay *</label>
            <select
              className="admin-input"
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              disabled={!municipality}
              required
            >
              <option value="">{municipality ? 'Select barangay…' : 'Select municipality first…'}</option>
              {barangayOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form-row">
            <label>Purok / street</label>
            <input
              className="admin-input"
              value={purokOrStreet}
              onChange={(e) => setPurokOrStreet(e.target.value)}
              placeholder="Optional (e.g. Purok 1, Rizal St.)"
            />
          </div>
          <div className="admin-form-row">
            <label>Source</label>
            <select className="admin-input" value={source} onChange={(e) => setSource(e.target.value as ClientSource)}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="admin-form-row">
            <label>Status</label>
            <select className="admin-input" value={status} onChange={(e) => setStatus(e.target.value as ClientStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{getStatusLabel(s)}</option>
              ))}
            </select>
          </div>
          <div className="admin-form-row">
            <label>Notes</label>
            <textarea
              className="admin-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              rows={2}
            />
          </div>
          {!isEdit && (
            <div className="admin-form-row">
              <label>Password (if login enabled)</label>
              <input
                type="password"
                className="admin-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Optional"
              />
            </div>
          )}
        </div>
        <FormActions
          primaryLabel={saving ? 'Saving…' : 'Save'}
          onPrimary={() => void handleSave()}
          onCancel={onClose}
          primaryDisabled={saving}
        />
      </div>
    </div>
  )
}

function BulkUploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void
  onUploaded: (newList: ClientRecord[]) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setFile(f ?? null)
    setError('')
  }

  const handleSubmit = () => {
    if (!file) {
      setError('Choose a CSV file.')
      return
    }
    setUploading(true)
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result)
        const lines = text.split(/\r?\n/).filter((line) => line.trim())
        if (lines.length < 2) {
          setError('CSV must have a header row and at least one data row.')
          setUploading(false)
          return
        }
        const headerLine = lines[0]
        const headers = headerLine.split(',').map((h) => h.trim().toLowerCase())
        const nameIdx = headers.indexOf('name') >= 0 ? headers.indexOf('name') : 0
        const emailIdx = headers.indexOf('email') >= 0 ? headers.indexOf('email') : 1
        const phoneIdx = headers.indexOf('phone') >= 0 ? headers.indexOf('phone') : 2
        const sourceIdx = headers.indexOf('source') >= 0 ? headers.indexOf('source') : 3
        const statusIdx = headers.indexOf('status') >= 0 ? headers.indexOf('status') : 4
        const today = new Date().toISOString().slice(0, 10)
        const existing = getClientStore()
        const newClients: ClientRecord[] = []
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
          const name = cols[nameIdx] ?? ''
          const email = cols[emailIdx] ?? ''
          const phone = cols[phoneIdx] ?? ''
          if (!name || !email) continue
          const source = SOURCES.includes((cols[sourceIdx] ?? '') as ClientSource) ? (cols[sourceIdx] as ClientSource) : 'Website'
          const status = STATUSES.includes((cols[statusIdx] ?? '') as ClientStatus) ? (cols[statusIdx] as ClientStatus) : 'new'
          const dealsCount = parseInt(cols[5] ?? '0', 10) || 0
          const lastActivity = cols[6] ?? today
          newClients.push({
            id: `bulk-${Date.now()}-${i}`,
            name,
            email,
            phone,
            province: BULACAN_PROVINCE,
            municipality: 'Malolos',
            barangay: 'POBLACION',
            address: formatBulacanAddressLine({
              barangay: 'POBLACION',
              municipality: 'Malolos',
              province: BULACAN_PROVINCE,
            }),
            source,
            status,
            notes: '',
            createdAt: today,
            updatedAt: today,
            dealsCount,
            lastActivity,
            adminNotes: '',
          })
        }
        if (newClients.length === 0) {
          setError('No valid rows found. CSV needs at least Name and Email.')
          setUploading(false)
          return
        }
        onUploaded([...existing, ...newClients])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse CSV.')
      }
      setUploading(false)
    }
    reader.onerror = () => {
      setError('Failed to read file.')
      setUploading(false)
    }
    reader.readAsText(file, 'UTF-8')
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="bulk-upload-title">
      <div className="admin-modal bulk-upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2 id="bulk-upload-title">Bulk upload clients</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="admin-modal-body">
          <p className="bulk-upload-hint">Upload a CSV with columns: Name, Email, Phone (optional: Source, Status, Deals, Last Activity).</p>
          <div className="file-input-wrap">
            <span className="file-input-btn">
              <span className="file-input-icon">📄</span>
              Choose CSV file…
            </span>
            <input
              type="file"
              accept=".csv"
              className="file-input-hidden"
              onChange={handleFileChange}
              aria-label="Choose CSV file"
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="admin-form-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
