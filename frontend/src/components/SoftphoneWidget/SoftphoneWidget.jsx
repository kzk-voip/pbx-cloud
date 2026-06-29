import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  Pause,
  Play,
  ArrowRightLeft,
  X,
  Minus,
  ChevronUp,
} from 'lucide-react'
import useSoftphone from '../../hooks/useSoftphone'
import styles from './SoftphoneWidget.module.css'

const DIALPAD_KEYS = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  '*', '0', '#',
]

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function SoftphoneWidget({ embedded = false, onClose }) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(embedded)
  const [isMinimized, setIsMinimized] = useState(false)
  const [dialInput, setDialInput] = useState('')
  const [sipConfig, setSipConfig] = useState({
    wsUri: '',
    sipUri: '',
    password: '',
  })
  const [showConfig, setShowConfig] = useState(false)

  const {
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
  } = useSoftphone(sipConfig)

  const handleDial = () => {
    if (dialInput.trim() && state === 'registered') {
      // Extract domain from SIP URI (e.g. "sip:stark_402@stark.pbx.local" → "stark.pbx.local")
      const sipDomain = sipConfig.sipUri.replace(/^sip:/i, '').split('@')[1] || 'localhost'
      call(`sip:${dialInput}@${sipDomain}`)
    }
  }

  const handleKeyPress = (key) => {
    setDialInput((prev) => prev + key)
  }

  const isInCall = state === 'in_call' || state === 'on_hold' || state === 'calling'

  // Floating toggle button when widget is closed (only in non-embedded mode)
  if (!isOpen && !embedded) {
    return (
      <button
        className={styles.fab}
        onClick={() => setIsOpen(true)}
        aria-label={t('softphone.open')}
      >
        <Phone size={24} aria-hidden="true" />
        {state === 'registered' && <span className={styles.fabDot} />}
      </button>
    )
  }

  if (!isOpen && embedded) return null

  return (
    <aside
      className={`${styles.widget} ${isMinimized ? styles.minimized : ''} ${embedded ? styles.embedded : ''}`}
      aria-label={t('softphone.title')}
    >
      {/* Header */}
      <header className={styles.header}>
        <span className={styles.headerTitle}>
          <Phone size={16} aria-hidden="true" />
          {t('softphone.title')}
        </span>
        <section className={styles.headerActions}>
          <button
            className={styles.headerBtn}
            onClick={() => setIsMinimized((m) => !m)}
            aria-label={isMinimized ? t('softphone.expand') : t('softphone.minimize')}
          >
            {isMinimized ? <ChevronUp size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
          </button>
          <button
            className={styles.headerBtn}
            onClick={() => { setIsOpen(false); onClose?.() }}
            aria-label={t('softphone.close')}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </section>
      </header>

      {!isMinimized && (
        <section className={styles.body}>
          {/* Status indicator */}
          <section className={styles.status}>
            <span className={`${styles.statusDot} ${styles[`dot_${state}`]}`} />
            <span className={styles.statusText}>
              {state === 'idle' && t('softphone.notConnected')}
              {state === 'registering' && t('softphone.connecting')}
              {state === 'registered' && t('softphone.ready')}
              {state === 'calling' && (callInfo?.direction === 'incoming' ? t('softphone.incomingCall') : t('softphone.calling'))}
              {state === 'in_call' && formatTime(callDuration)}
              {state === 'on_hold' && t('softphone.onHold', { time: formatTime(callDuration) })}
              {state === 'error' && (error || t('softphone.error'))}
            </span>
          </section>

          {/* Incoming call banner */}
          {state === 'calling' && callInfo?.direction === 'incoming' && (
            <article className={styles.incomingBanner}>
              <p className={styles.callerId}>{callInfo.remoteUri}</p>
              <section className={styles.incomingActions}>
                <button className={`${styles.callBtn} ${styles.answerBtn}`} onClick={answer} aria-label={t('softphone.answer')}>
                  <PhoneIncoming size={18} aria-hidden="true" />
                </button>
                <button className={`${styles.callBtn} ${styles.hangupBtn}`} onClick={hangup} aria-label={t('softphone.reject')}>
                  <PhoneOff size={18} aria-hidden="true" />
                </button>
              </section>
            </article>
          )}

          {/* In-call controls */}
          {isInCall && callInfo?.direction !== 'incoming' && (
            <article className={styles.callControls}>
              <p className={styles.callerId}>{callInfo?.remoteUri || dialInput}</p>
              <section className={styles.callActions}>
                {state === 'in_call' && (
                  <button className={styles.controlBtn} onClick={hold} aria-label={t('softphone.hold')}>
                    <Pause size={16} aria-hidden="true" />
                  </button>
                )}
                {state === 'on_hold' && (
                  <button className={styles.controlBtn} onClick={unhold} aria-label={t('softphone.resume')}>
                    <Play size={16} aria-hidden="true" />
                  </button>
                )}
                <button className={`${styles.callBtn} ${styles.hangupBtn}`} onClick={hangup} aria-label={t('softphone.hangup')}>
                  <PhoneOff size={18} aria-hidden="true" />
                </button>
              </section>
            </article>
          )}

          {/* Dial pad (only when not in call) */}
          {!isInCall && state === 'registered' && (
            <>
              <input
                className={styles.dialInput}
                type="tel"
                placeholder={t('softphone.placeholderNumber')}
                value={dialInput}
                onChange={(e) => setDialInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDial()}
                id="softphone-dial-input"
              />
              <section className={styles.dialpad}>
                {DIALPAD_KEYS.map((key) => (
                  <button
                    key={key}
                    className={styles.dialKey}
                    onClick={() => handleKeyPress(key)}
                  >
                    {key}
                  </button>
                ))}
              </section>
              <button
                className={`${styles.callBtn} ${styles.dialBtn}`}
                onClick={handleDial}
                disabled={!dialInput.trim()}
                aria-label={t('softphone.makeCall')}
              >
                <Phone size={18} aria-hidden="true" />
              </button>
            </>
          )}

          {/* Connect / Disconnect controls */}
          {state === 'idle' || state === 'error' ? (
            <section className={styles.connectSection}>
              {showConfig ? (
                <form className={styles.configForm} onSubmit={(e) => { e.preventDefault(); register() }}>
                  <input
                    className={styles.configInput}
                    placeholder={t('softphone.placeholderWs')}
                    value={sipConfig.wsUri}
                    onChange={(e) => setSipConfig((c) => ({ ...c, wsUri: e.target.value }))}
                    id="softphone-ws-uri"
                  />
                  <input
                    className={styles.configInput}
                    placeholder={t('softphone.placeholderSip')}
                    value={sipConfig.sipUri}
                    onChange={(e) => setSipConfig((c) => ({ ...c, sipUri: e.target.value }))}
                    id="softphone-sip-uri"
                  />
                  <input
                    className={styles.configInput}
                    type="password"
                    placeholder={t('softphone.placeholderPass')}
                    value={sipConfig.password}
                    onChange={(e) => setSipConfig((c) => ({ ...c, password: e.target.value }))}
                    id="softphone-password"
                  />
                  <button type="submit" className={`${styles.callBtn} ${styles.connectBtn}`}>
                    {t('softphone.connect')}
                  </button>
                </form>
              ) : (
                <button
                  className={`${styles.callBtn} ${styles.connectBtn}`}
                  onClick={() => setShowConfig(true)}
                >
                  {t('softphone.configureConnect')}
                </button>
              )}
            </section>
          ) : null}

          {state === 'registered' && !isInCall && (
            <button className={styles.disconnectBtn} onClick={unregister}>
              {t('softphone.disconnect')}
            </button>
          )}
        </section>
      )}
    </aside>
  )
}
