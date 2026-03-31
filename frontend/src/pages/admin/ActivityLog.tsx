import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  getActivityStore,
  getActivityActionLabel,
  getActivityEntityLabel,
  type ActivityLogEntry,
} from '../../data/activityLog'
import './admin-common.css'
import './ActivityLog.css'


/** Human-readable relative time for activity "When" column. */
function formatActivityWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const ms = now.getTime() - d.getTime()
  const min = Math.floor(ms / 60000)
  const hour = Math.floor(min / 60)

  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()

  if (min < 1) return 'Just now'
  if (min < 60 && sameDay) return `${min} minute${min === 1 ? '' : 's'} ago`
  if (hour < 24 && sameDay) return `${hour} hour${hour === 1 ? '' : 's'} ago`
  if (isYesterday) return 'Yesterday'
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ActivityLog() {
  const [searchQuery, setSearchQuery] = useState('')

  const entries = getActivityStore()

  const searchHaystack = (e: ActivityLogEntry): string => {
    return [
      e.actor,
      getActivityActionLabel(e.action),
      getActivityEntityLabel(e.entityType),
      e.entityLabel ?? '',
      e.details,
      formatActivityWhen(e.at),
    ]
      .join(' ')
      .toLowerCase()
  }

  const filtered = useMemo(() => {
    let list = [...entries]
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((e) => searchHaystack(e).includes(q))
    }
    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [entries, searchQuery])

  const entityLink = (e: ActivityLogEntry) => {
    if (e.entityType === 'property' && e.entityId) return `/admin/properties/${e.entityId}`
    if (e.entityType === 'client' && e.entityId) return `/admin/clients/${e.entityId}`
    return null
  }

  return (
    <div className="admin-activity-log">
      <h1 className="admin-page-title">Activity / Audit Log</h1>
      <p className="admin-page-subtitle">
        Track who changed what and when. Global search across all fields.
      </p>

      <div className="admin-search-wrapper">
        <input
          type="search"
          className="admin-input activity-log-search"
          placeholder="Search actor, action, type, entity, or details..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
        {searchQuery && (
          <button 
            type="button" 
            className="search-clear-btn" 
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table activity-log-table">
          <thead>
            <tr>
              <th className="col-when">When</th>
              <th className="col-actor">Who</th>
              <th className="col-action">Action</th>
              <th className="col-entity-type">Type</th>
              <th className="col-entity">Entity</th>
              <th className="col-details">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-empty-cell">
                  No activity matches your filters.
                </td>
              </tr>
            ) : (
              filtered.map((e) => {
                const link = entityLink(e)
                return (
                  <tr key={e.id}>
                    <td className="col-when">{formatActivityWhen(e.at)}</td>
                    <td className="col-actor">{e.actor}</td>
                    <td className="col-action">
                      <span className={`activity-log-action activity-log-action--${e.action}`}>
                        {getActivityActionLabel(e.action)}
                      </span>
                    </td>
                    <td className="col-entity-type">{getActivityEntityLabel(e.entityType)}</td>
                    <td className="col-entity">
                      {link ? (
                        <Link to={link} className="activity-log-entity-link">
                          {e.entityLabel || '—'}
                        </Link>
                      ) : (
                        e.entityLabel || '—'
                      )}
                    </td>
                    <td className="col-details">{e.details || '—'}</td>
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
