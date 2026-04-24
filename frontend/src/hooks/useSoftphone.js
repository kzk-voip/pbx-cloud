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

  // Create audio element for remote stream
  useEffect(() => {
    if (!audioRef.current) {
      const el = new Audio()
      el.autoplay = true
      audioRef.current = el
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
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
            pc.peerconnection.ontrack = (event) => {
              if (audioRef.current && event.streams[0]) {
                audioRef.current.srcObject = event.streams[0]
              }
            }
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
    if (!uaRef.current || state !== 'registered') return

    const options = {
      mediaConstraints: { audio: true, video: false },
      pcConfig: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      },
    }

    const session = uaRef.current.call(target, options)
    sessionRef.current = session
    setCallInfo({
      direction: 'outgoing',
      remoteUri: target,
    })
    setState('calling')

    session.on('connecting', () => {
      setState('calling')
    })

    session.on('accepted', () => {
      setState('in_call')
      startTimer()
    })

    session.on('ended', () => {
      sessionRef.current = null
      setCallInfo(null)
      stopTimer()
      setState('registered')
    })

    session.on('failed', (e) => {
      sessionRef.current = null
      setCallInfo(null)
      stopTimer()
      setState('registered')
      setError(e.cause || 'Call failed')
    })

    // Attach remote audio stream
    session.on('peerconnection', (pcEvent) => {
      pcEvent.peerconnection.ontrack = (event) => {
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0]
        }
      }
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
