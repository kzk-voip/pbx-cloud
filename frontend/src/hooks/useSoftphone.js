import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * useSoftphone — JsSIP-based WebRTC softphone hook.
 *
 * States: idle → registering → registered → calling → in_call → on_hold
 *
 * @param {object} options
 * @param {string} options.wsUri - WSS URI (e.g. wss://host:8443)
 * @param {string} options.sipUri - SIP URI (e.g. sip:user@domain)
 * @param {string} options.password - SIP password
 * @param {boolean} options.autoRegister - Whether to register on mount
 * @returns softphone controls and state
 */
export default function useSoftphone({
  wsUri = '',
  sipUri = '',
  password = '',
  autoRegister = false,
} = {}) {
  const [state, setState] = useState('idle') // idle | registering | registered | calling | in_call | on_hold | error
  const [error, setError] = useState(null)
  const [callInfo, setCallInfo] = useState(null)
  const [callDuration, setCallDuration] = useState(0)

  const uaRef = useRef(null)
  const sessionRef = useRef(null)
  const timerRef = useRef(null)
  const audioRef = useRef(null)

  // Create audio element for remote stream — must be in DOM for Chrome to allow playback
  useEffect(() => {
    if (!audioRef.current) {
      const el = document.createElement('audio')
      el.id = 'softphone-remote-audio'
      el.autoplay = true
      el.playsInline = true
      el.style.display = 'none'
      document.body.appendChild(el)
      audioRef.current = el
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioRef.current && audioRef.current.parentNode) {
        audioRef.current.parentNode.removeChild(audioRef.current)
        audioRef.current = null
      }
    }
  }, [])

  const startTimer = useCallback(() => {
    setCallDuration(0)
    timerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1)
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setCallDuration(0)
  }, [])

  const register = useCallback(async () => {
    if (!wsUri || !sipUri || !password) {
      setError('Missing SIP credentials')
      setState('error')
      return
    }

    try {
      // Dynamically import JsSIP
      const JsSIP = await import('jssip')

      const socket = new JsSIP.WebSocketInterface(wsUri)
      const config = {
        sockets: [socket],
        uri: sipUri,
        password: password,
        register: true,
        session_timers: false,
        connection_recovery_min_interval: 2,
        connection_recovery_max_interval: 30,
      }

      const ua = new JsSIP.UA(config)
      uaRef.current = ua

      ua.on('registered', () => {
        setState('registered')
        setError(null)
      })

      ua.on('unregistered', () => {
        setState('idle')
      })

      ua.on('registrationFailed', (e) => {
        setState('error')
        setError(e.cause || 'Registration failed')
      })

      ua.on('newRTCSession', (data) => {
        const session = data.session

        if (data.originator === 'remote') {
          // Incoming call
          sessionRef.current = session
          setCallInfo({
            direction: 'incoming',
            remoteUri: session.remote_identity?.uri?.toString() || 'Unknown',
          })
          setState('calling')

          session.on('ended', () => {
            sessionRef.current = null
            setCallInfo(null)
            stopTimer()
            setState('registered')
          })

          session.on('failed', () => {
            sessionRef.current = null
            setCallInfo(null)
            stopTimer()
            setState('registered')
          })

          session.on('accepted', () => {
            setState('in_call')
            startTimer()
          })

          // Attach remote audio
          session.on('peerconnection', (pc) => {
            pc.peerconnection.addEventListener('track', (event) => {
              console.log('[Softphone] Incoming: remote track received', event.track.kind)
              if (audioRef.current && event.streams[0]) {
                audioRef.current.srcObject = event.streams[0]
                audioRef.current.play().catch(e => console.warn('[Softphone] audio play blocked:', e))
              }
            })
          })
        }
      })

      setState('registering')
      ua.start()
    } catch (err) {
      setState('error')
      setError(err.message || 'Failed to initialize')
    }
  }, [wsUri, sipUri, password, startTimer, stopTimer])

  const unregister = useCallback(() => {
    if (uaRef.current) {
      uaRef.current.stop()
      uaRef.current = null
      setState('idle')
    }
  }, [])

  const call = useCallback((target) => {
    if (!uaRef.current || state !== 'registered') {
      console.warn('[Softphone] call() skipped — UA:', !!uaRef.current, 'state:', state)
      return
    }

    console.log('[Softphone] Calling:', target)

    const options = {
      mediaConstraints: { audio: true, video: false },
      pcConfig: {
        iceServers: [],
      },
      sessionTimersExpires: 120,
    }

    let session
    try {
      session = uaRef.current.call(target, options)
    } catch (err) {
      console.error('[Softphone] call() threw:', err)
      setError(err.message || 'Call failed')
      return
    }

    sessionRef.current = session
    setCallInfo({
      direction: 'outgoing',
      remoteUri: target,
    })
    setState('calling')

    session.on('connecting', () => {
      console.log('[Softphone] Session connecting...')
      setState('calling')
    })

    session.on('accepted', () => {
      console.log('[Softphone] Session accepted')
      setState('in_call')
      startTimer()
      // Try to attach remote audio from session.connection
      try {
        const pc = session.connection
        if (pc) {
          // Expose for console debugging
          window.__opc = pc
          console.log('[Softphone] PC state:', pc.connectionState, 'ICE:', pc.iceConnectionState, 'receivers:', pc.getReceivers().length)
          pc.addEventListener('iceconnectionstatechange', () => {
            console.log('[Softphone] ICE state changed:', pc.iceConnectionState)
          })
          pc.addEventListener('connectionstatechange', () => {
            console.log('[Softphone] Connection state changed:', pc.connectionState)
          })
          const remoteStream = new MediaStream()
          pc.getReceivers().forEach(receiver => {
            if (receiver.track) {
              console.log('[Softphone] Adding receiver track:', receiver.track.kind, receiver.track.readyState)
              remoteStream.addTrack(receiver.track)
            }
          })
          if (remoteStream.getTracks().length > 0 && audioRef.current) {
            audioRef.current.srcObject = remoteStream
            audioRef.current.play().catch(e => console.warn('[Softphone] audio play blocked:', e))
            console.log('[Softphone] Remote audio attached via receivers')
          }
          // Also listen for future tracks
          pc.addEventListener('track', (event) => {
            console.log('[Softphone] Late track event:', event.track.kind)
            if (audioRef.current && event.streams[0]) {
              audioRef.current.srcObject = event.streams[0]
              audioRef.current.play().catch(e => console.warn('[Softphone] audio play blocked:', e))
            }
          })
        }
      } catch (err) {
        console.error('[Softphone] Error attaching remote audio:', err)
      }
    })

    session.on('ended', () => {
      console.log('[Softphone] Session ended')
      sessionRef.current = null
      setCallInfo(null)
      stopTimer()
      setState('registered')
    })

    session.on('failed', (e) => {
      console.error('[Softphone] Session FAILED:', e.cause, e.message, e)
      sessionRef.current = null
      setCallInfo(null)
      stopTimer()
      setState('registered')
      setError(e.cause || 'Call failed')
    })

    // Also try early track attachment via peerconnection event
    session.on('peerconnection', (pcEvent) => {
      console.log('[Softphone] peerconnection event fired')
      pcEvent.peerconnection.addEventListener('track', (event) => {
        console.log('[Softphone] Outgoing: remote track received', event.track.kind)
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0]
          audioRef.current.play().catch(e => console.warn('[Softphone] audio play blocked:', e))
        }
      })
    })
  }, [state, startTimer, stopTimer])

  const hangup = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.terminate()
    }
  }, [])

  const answer = useCallback(() => {
    if (sessionRef.current && state === 'calling' && callInfo?.direction === 'incoming') {
      sessionRef.current.answer({
        mediaConstraints: { audio: true, video: false },
      })
    }
  }, [state, callInfo])

  const hold = useCallback(() => {
    if (sessionRef.current && state === 'in_call') {
      sessionRef.current.hold()
      setState('on_hold')
    }
  }, [state])

  const unhold = useCallback(() => {
    if (sessionRef.current && state === 'on_hold') {
      sessionRef.current.unhold()
      setState('in_call')
    }
  }, [state])

  const transfer = useCallback((target) => {
    if (sessionRef.current && (state === 'in_call' || state === 'on_hold')) {
      sessionRef.current.refer(target)
    }
  }, [state])

  // Auto-register if requested
  useEffect(() => {
    if (autoRegister && wsUri && sipUri && password) {
      register()
    }
    return () => {
      if (uaRef.current) {
        uaRef.current.stop()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    state,
    error,
    callInfo,
    callDuration,
    register,
    unregister,
    call,
    hangup,
    answer,
    hold,
    unhold,
    transfer,
  }
}
