import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

/**
 * useWebSocket — connects to the PBX real-time event stream.
 *
 * Authenticates via JWT query parameter, handles automatic reconnection
 * with exponential backoff, and invalidates TanStack Query caches on
 * relevant events.
 *
 * @param {object} options
 * @param {boolean} options.enabled - Whether the connection should be active.
 * @returns {{ isConnected, lastEvent, activeCalls }}
 */
export default function useWebSocket({ enabled = true } = {}) {
  const wsRef = useRef(null)
  const reconnectTimeout = useRef(null)
  const retryCount = useRef(0)
  const queryClient = useQueryClient()

  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState(null)
  const [activeCalls, setActiveCalls] = useState(null)

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token')
    if (!token || !enabled) return

    // Build WS URL — relative to current host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/events?token=${token}`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        retryCount.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setLastEvent(data)

          switch (data.type) {
            case 'active_calls_update':
              setActiveCalls(data.active_calls)
              break

            case 'call_start':
              queryClient.invalidateQueries({ queryKey: ['active-calls'] })
              toast('📞 New call started', { icon: '🟢' })
              break

            case 'call_end':
              queryClient.invalidateQueries({ queryKey: ['active-calls'] })
              queryClient.invalidateQueries({ queryKey: ['cdr'] })
              toast('📞 Call ended', { icon: '🔴' })
              break

            case 'sip_registered':
              queryClient.invalidateQueries({ queryKey: ['extensions'] })
              break

            case 'sip_unregistered':
              queryClient.invalidateQueries({ queryKey: ['extensions'] })
              break

            default:
              break
          }
        } catch {
          // Ignore non-JSON messages
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null

        // Exponential backoff reconnect (max 30s)
        if (enabled) {
          const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000)
          retryCount.current += 1
          reconnectTimeout.current = setTimeout(connect, delay)
        }
      }

      ws.onerror = () => {
        // onclose will fire after onerror
        ws.close()
      }
    } catch {
      // Connection creation failed — retry
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000)
      retryCount.current += 1
      reconnectTimeout.current = setTimeout(connect, delay)
    }
  }, [enabled, queryClient])

  useEffect(() => {
    if (enabled) {
      connect()
    }

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [enabled, connect])

  return { isConnected, lastEvent, activeCalls }
}
