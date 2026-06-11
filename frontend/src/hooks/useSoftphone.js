import { useState, useRef, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'


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

  /**
   * Unlock Chrome's autoplay restriction by playing a short silent buffer.
   * Must be called from a user gesture context (click handler).
   */
  const ensureAudioUnlocked = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      if (ctx.state === 'suspended') {
        ctx.resume()
      }
      // Play a tiny silent buffer to unlock the audio output
      const buf = ctx.createBuffer(1, 1, 22050)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start(0)
      console.log('[Softphone] Audio context unlocked, state:', ctx.state)
    } catch (e) {
      console.warn('[Softphone] Failed to unlock audio context:', e)
    }
  }, [])

  /** Attach remote audio stream from an RTCPeerConnection */
  const attachRemoteAudio = useCallback((pc) => {
    if (!pc) return

    const handleTrack = (event) => {
      console.log('[Softphone] Remote track received:', event.track.kind, 'streams:', event.streams.length)
      if (audioRef.current && event.streams[0]) {
        audioRef.current.srcObject = event.streams[0]
        audioRef.current.play().catch((err) => {
          console.error('[Softphone] Audio play() blocked:', err.name, err.message)
        })
      }
    }

    // Listen for track events
    pc.addEventListener('track', handleTrack)

    // Also check if receivers already have tracks (late attachment)
    const receivers = pc.getReceivers()
    if (receivers.length > 0) {
      const stream = new MediaStream()
      receivers.forEach(r => {
        if (r.track) stream.addTrack(r.track)
      })
      if (stream.getTracks().length > 0 && audioRef.current) {
        audioRef.current.srcObject = stream
        audioRef.current.play().catch(() => {})
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

          session.on('failed', (e) => {
            console.error('[Softphone] Session FAILED:', e?.cause)
            sessionRef.current = null
            setCallInfo(null)
            stopTimer()
            setState('registered')
            if (e?.cause) {
              setError(e.cause)
              const errorMsg = e.cause === 'User Denied Media Access'
                ? 'Доступ до мікрофона заблоковано в браузері!'
                : `Дзвінок завершився збоєм: ${e.cause}`;
              toast.error(errorMsg)
            }
          })

          session.on('accepted', () => {
            setState('in_call')
            startTimer()
            attachRemoteAudio(session.connection)
          })

          // Also try early attachment via peerconnection event
          session.on('peerconnection', (pc) => {
            pc.peerconnection.addEventListener('track', (event) => {
              if (audioRef.current && event.streams[0]) {
                audioRef.current.srcObject = event.streams[0]
                audioRef.current.play().catch(() => {})
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
  }, [wsUri, sipUri, password, startTimer, stopTimer, attachRemoteAudio])

  const unregister = useCallback(() => {
    if (uaRef.current) {
      uaRef.current.stop()
      uaRef.current = null
      setState('idle')
    }
  }, [])

  const call = useCallback((target) => {
    // Unlock audio playback during user gesture
    ensureAudioUnlocked()

    if (!uaRef.current || state !== 'registered') {
      console.warn('[Softphone] call() skipped — UA:', !!uaRef.current, 'state:', state)
      return
    }

    const options = {
      mediaConstraints: { audio: true, video: false },
      pcConfig: {
        iceServers: [],
      },
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
      setState('calling')
    })

    session.on('accepted', () => {
      setState('in_call')
      startTimer()
      attachRemoteAudio(session.connection)
    })

    session.on('ended', () => {
      sessionRef.current = null
      setCallInfo(null)
      stopTimer()
      setState('registered')
    })

    session.on('failed', (e) => {
      console.error('[Softphone] Session FAILED:', e.cause)
      sessionRef.current = null
      setCallInfo(null)
      stopTimer()
      setState('registered')
      setError(e.cause || 'Call failed')

      const errorMsg = e.cause === 'User Denied Media Access'
        ? 'Доступ до мікрофона заблоковано в браузері!'
        : `Дзвінок завершився збоєм: ${e.cause || 'Unknown error'}`;
      toast.error(errorMsg)
    })

    // Early track attachment via peerconnection event
    session.on('peerconnection', (pcEvent) => {
      pcEvent.peerconnection.addEventListener('track', (event) => {
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0]
          audioRef.current.play().catch(() => {})
        }
      })
    })
  }, [state, startTimer, stopTimer, attachRemoteAudio, ensureAudioUnlocked])

  const hangup = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.terminate()
    }
  }, [])

  const answer = useCallback(() => {
    // Unlock audio playback during user gesture
    ensureAudioUnlocked()

    if (sessionRef.current && state === 'calling' && callInfo?.direction === 'incoming') {
      sessionRef.current.answer({
        mediaConstraints: { audio: true, video: false },
      })
    }
  }, [state, callInfo, ensureAudioUnlocked])

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
