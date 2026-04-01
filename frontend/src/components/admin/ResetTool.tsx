import React, { useState } from 'react'
import { SIMULATION_STORAGE_KEY } from '../../data/simulationSnapshot'
import { MIGRATION_TO_API_KEY } from '../../services/apiBootstrap'

export const ResetTool: React.FC = () => {
  const [done, setDone] = useState(false)

  const handleReset = () => {
    if (!window.confirm('This will clear all local cached data. Your database data will NOT be affected, but the UI will refresh to show the current server state. Proceed?')) {
      return
    }
    
    localStorage.removeItem(SIMULATION_STORAGE_KEY)
    localStorage.removeItem(MIGRATION_TO_API_KEY)
    setDone(true)
    
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }

  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 mt-8">
      <h3 className="text-red-500 font-semibold mb-2">Performance & Data Reset</h3>
      <p className="text-sm text-gray-400 mb-4">
        If the UI shows data that was already deleted from the database, or if transitions feel laggy after many updates, 
        use this tool to clear the local simulation cache.
      </p>
      
      <button
        onClick={handleReset}
        disabled={done}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
      >
        {done ? 'Refreshing...' : 'Clear Local Cache'}
      </button>

      {done && (
        <p className="mt-2 text-xs text-red-400 animate-pulse">
          Cache cleared. Reloading page to resync with server...
        </p>
      )}
    </div>
  )
}
