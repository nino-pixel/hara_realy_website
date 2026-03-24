import { useState, useEffect, useMemo } from 'react'
import { 
  HiOutlineRefresh, 
  HiOutlineTrash, 
  HiOutlineUser, 
  HiOutlineHome, 
  HiOutlineDocumentText, 
  HiOutlineChatAlt,
  HiOutlineSearch,
  HiOutlineCheckCircle
} from 'react-icons/hi'
import Swal from 'sweetalert2'
import { apiGet, apiPost, apiDelete } from '../../services/api'
import './admin-common.css'
import './AdminArchives.css'

interface ArchiveItem {
  id: string
  type: 'client' | 'property' | 'deal' | 'inquiry'
  title: string
  subtitle: string
  archived_at: string
}

export default function AdminArchives() {
  const [items, setItems] = useState<ArchiveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const fetchArchives = async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ data: ArchiveItem[] }>('archives')
      setItems(res.data)
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Fetch failed', text: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArchives()
  }, [])

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.subtitle.toLowerCase().includes(q) || 
      item.type.toLowerCase().includes(q)
    )
  }, [items, searchQuery])

  const toggleSelectAll = () => {
    if (filteredItems.length === 0) return
    if (selectedKeys.size === filteredItems.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(filteredItems.map(item => `${item.type}-${item.id}`)))
    }
  }

  const toggleSelectItem = (key: string) => {
    const next = new Set(selectedKeys)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    setSelectedKeys(next)
  }

  const handleRestore = async (item: ArchiveItem | ArchiveItem[]) => {
    const isBulk = Array.isArray(item)
    const itemsToProcess = isBulk ? item : [item]
    
    const result = await Swal.fire({
      title: isBulk ? `Restore ${itemsToProcess.length} items?` : 'Restore item?',
      text: `Are you sure you want to restore ${isBulk ? 'these items' : 'this ' + itemsToProcess[0].type}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, restore',
      confirmButtonColor: 'var(--color-accent)',
      background: 'var(--color-surface)',
      color: 'var(--color-text)',
    })

    if (result.isConfirmed) {
      try {
        const payload = isBulk 
          ? { items: itemsToProcess.map(i => ({ id: i.id, type: i.type })) }
          : { id: itemsToProcess[0].id, type: itemsToProcess[0].type }

        await apiPost('archives/restore', payload)
        Swal.fire({
          icon: 'success',
          title: 'Restored',
          toast: true,
          position: 'top-end',
          timer: 3000,
          showConfirmButton: false,
          timerProgressBar: true
        })
        setSelectedKeys(new Set())
        fetchArchives()
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Restore failed', text: err instanceof Error ? err.message : 'Unknown error' })
      }
    }
  }

  const handleDelete = async (item: ArchiveItem | ArchiveItem[]) => {
    const isBulk = Array.isArray(item)
    const itemsToProcess = isBulk ? item : [item]

    const result = await Swal.fire({
      title: isBulk ? `Permanently delete ${itemsToProcess.length} items?` : 'Permanently delete?',
      text: 'This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete forever',
      confirmButtonColor: '#dc2626',
      background: 'var(--color-surface)',
      color: 'var(--color-text)',
    })

    if (result.isConfirmed) {
      try {
        const payload = isBulk 
          ? { items: itemsToProcess.map(i => ({ id: i.id, type: i.type })) }
          : { id: itemsToProcess[0].id, type: itemsToProcess[0].type }

        await apiDelete('archives', {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        Swal.fire({
          icon: 'success',
          title: 'Deleted permanently',
          toast: true,
          position: 'top-end',
          timer: 3000,
          showConfirmButton: false,
          timerProgressBar: true
        })
        setSelectedKeys(new Set())
        fetchArchives()
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Deletion failed', text: err instanceof Error ? err.message : 'Unknown error' })
      }
    }
  }

  const getSelectedItemsArray = () => {
    return items.filter(item => selectedKeys.has(`${item.type}-${item.id}`))
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'client': return <HiOutlineUser />
      case 'property': return <HiOutlineHome />
      case 'deal': return <HiOutlineDocumentText />
      case 'inquiry': return <HiOutlineChatAlt />
      default: return null
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return '—'
    }
  }

  return (
    <div className="admin-archives">
      <div className="admin-archives-header">
        <div>
          <h1 className="admin-page-title">Archives</h1>
          <p className="admin-page-subtitle">Manage soft-deleted records and restore them if needed.</p>
        </div>
        
        <div className="admin-archives-controls">
          <div className="admin-search-input-wrap">
            <HiOutlineSearch className="search-icon" />
            <input 
              type="text" 
              className="admin-input" 
              placeholder="Search archives..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {selectedKeys.size > 0 && (
        <div className="admin-archives-bulk-bar">
          <div className="bulk-selection-info">
            <HiOutlineCheckCircle className="bulk-icon" />
            <span>{selectedKeys.size} items selected</span>
          </div>
          <div className="bulk-actions">
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => handleRestore(getSelectedItemsArray())}
            >
              <HiOutlineRefresh className="btn-icon" /> Restore Selected
            </button>
            <button 
              className="btn btn-danger btn-sm"
              onClick={() => handleDelete(getSelectedItemsArray())}
            >
              <HiOutlineTrash className="btn-icon" /> Delete Permanently
            </button>
          </div>
        </div>
      )}

      <div className="admin-archives-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="col-check">
                <input 
                  type="checkbox" 
                  checked={filteredItems.length > 0 && selectedKeys.size === filteredItems.length}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="col-type">Type</th>
              <th className="col-info">Record Details</th>
              <th className="col-date">Archived At</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="admin-empty-cell">Loading archives...</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td colSpan={5} className="admin-empty-cell">No archived items found.</td></tr>
            ) : (
              filteredItems.map(item => {
                const key = `${item.type}-${item.id}`
                return (
                  <tr key={key} className={selectedKeys.has(key) ? 'row-selected' : ''}>
                    <td className="col-check">
                      <input 
                        type="checkbox" 
                        checked={selectedKeys.has(key)}
                        onChange={() => toggleSelectItem(key)}
                        aria-label={`Select ${item.title}`}
                      />
                    </td>
                    <td className="col-type">
                      <span className={`archive-type-tag archive-type-tag--${item.type}`}>
                        {getTypeIcon(item.type)}
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </span>
                    </td>
                    <td className="col-info">
                      <div className="archive-item-title">{item.title}</div>
                      <div className="archive-item-subtitle">{item.subtitle}</div>
                    </td>
                    <td className="col-date">{formatDate(item.archived_at)}</td>
                    <td className="col-actions">
                      <button 
                        className="btn-icon-btn" 
                        onClick={() => handleRestore(item)}
                        title="Restore"
                        aria-label="Restore"
                      >
                        <HiOutlineRefresh />
                      </button>
                      <button 
                        className="btn-icon-btn btn-icon-btn--danger" 
                        onClick={() => handleDelete(item)}
                        title="Delete Permanently"
                        aria-label="Delete Permanently"
                      >
                        <HiOutlineTrash />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
