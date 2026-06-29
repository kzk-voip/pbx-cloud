import { useSyncExternalStore, useCallback } from 'react'

const STORAGE_KEY = 'pbx-timezone'

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone
}

function subscribe(callback) {
  window.addEventListener('storage', callback)
  window.addEventListener('pbx-tz-change', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('pbx-tz-change', callback)
  }
}

/**
 * Hook to get/set the user's preferred timezone.
 * Persists in localStorage. Falls back to browser default.
 *
 * Returns: { timezone, setTimezone, formatDate }
 */
export default function useTimezone() {
  const timezone = useSyncExternalStore(subscribe, getSnapshot)

  const setTimezone = useCallback((tz) => {
    localStorage.setItem(STORAGE_KEY, tz)
    window.dispatchEvent(new Event('pbx-tz-change'))
  }, [])

  const formatDate = useCallback((dateStr, options = {}) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        ...options,
      })
    } catch {
      return new Date(dateStr).toLocaleString()
    }
  }, [timezone])

  return { timezone, setTimezone, formatDate }
}
