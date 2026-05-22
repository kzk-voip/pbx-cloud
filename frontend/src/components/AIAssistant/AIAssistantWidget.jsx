import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, X, Send, Sparkles, Trash2 } from 'lucide-react'
import client from '../../api/client'
import styles from './AIAssistantWidget.module.css'

const SUGGESTIONS = {
  en: [
    'Where are extensions?',
    'How to view call logs?',
    'Where is CDR export?',
    'Show me tenant settings',
  ],
  uk: [
    'Де знайти екстеншени?',
    'Як переглянути історію дзвінків?',
    'Де експорт CDR?',
    'Де налаштування тенанта?',
  ],
}

export default function AIAssistantWidget() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [highlightedIds, setHighlightedIds] = useState([])
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const lang = i18n.language?.startsWith('uk') ? 'uk' : 'en'
  const suggestions = SUGGESTIONS[lang] || SUGGESTIONS.en

  // ── Scroll to bottom on new messages ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Focus input on open ──
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // ── Clear spotlight highlights ──
  const clearHighlights = useCallback(() => {
    highlightedIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) {
        el.classList.remove('ai-spotlight')
      }
    })
    setHighlightedIds([])
  }, [highlightedIds])

  // ── Apply spotlight highlights ──
  const applyHighlights = useCallback((highlights) => {
    clearHighlights()
    if (!highlights?.length) return

    const newIds = []
    highlights.forEach(({ element_id }) => {
      const el = document.getElementById(element_id)
      if (el) {
        el.classList.add('ai-spotlight')
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        newIds.push(element_id)
      }
    })
    setHighlightedIds(newIds)

    // Auto-remove after 6 seconds
    if (newIds.length > 0) {
      setTimeout(() => {
        newIds.forEach((id) => {
          const el = document.getElementById(id)
          if (el) el.classList.remove('ai-spotlight')
        })
        setHighlightedIds((prev) =>
          prev.filter((id) => !newIds.includes(id))
        )
      }, 6000)
    }
  }, [clearHighlights])

  // ── Clean up highlights on unmount ──
  useEffect(() => {
    return () => clearHighlights()
  }, [clearHighlights])

  // ── Send message ──
  const sendMessage = async (text) => {
    if (!text.trim() || loading) return

    const userMsg = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const { data } = await client.post('/assistant/chat', {
        messages: newMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      })

      const botMsg = { role: 'assistant', content: data.reply }
      setMessages((prev) => [...prev, botMsg])

      // Apply spotlight highlights
      if (data.highlights?.length) {
        applyHighlights(data.highlights)
      }
    } catch (err) {
      const errorMsg = {
        role: 'assistant',
        content:
          lang === 'uk'
            ? 'Вибачте, сталася помилка. Спробуйте ще раз.'
            : 'Sorry, something went wrong. Please try again.',
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleClear = () => {
    setMessages([])
    clearHighlights()
  }

  const handleSuggestion = (text) => {
    sendMessage(text)
  }

  const toggleOpen = () => {
    setOpen((v) => !v)
    if (open) clearHighlights()
  }

  return (
    <aside className={styles.wrapper} aria-label="AI Assistant">
      {/* Chat Window */}
      {open && (
        <section
          className={styles.chatWindow}
          role="complementary"
        >
          {/* Header */}
          <header className={styles.chatHeader}>
            <span className={styles.chatHeaderIcon}>
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <section className={styles.chatHeaderInfo}>
              <p className={styles.chatHeaderTitle}>PBX Assistant</p>
              <p className={styles.chatHeaderSubtitle}>
                {lang === 'uk'
                  ? 'Допоможу знайти потрібне'
                  : 'I\u2019ll help you navigate'}
              </p>
            </section>
            {messages.length > 0 && (
              <button
                className={styles.chatClearBtn}
                onClick={handleClear}
                aria-label="Clear chat history"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            )}
          </header>

          {/* Messages or Greeting */}
          {messages.length === 0 ? (
            <section className={styles.greeting}>
              <span className={styles.greetingIcon}>
                <Sparkles size={28} aria-hidden="true" />
              </span>
              <p className={styles.greetingTitle}>
                {lang === 'uk' ? 'Привіт! 👋' : 'Hello! 👋'}
              </p>
              <p className={styles.greetingText}>
                {lang === 'uk'
                  ? 'Запитайте мене де знайти потрібну інформацію в панелі керування'
                  : 'Ask me where to find anything in the admin panel'}
              </p>
              <nav className={styles.suggestions} aria-label="Suggested questions">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    className={styles.suggestion}
                    onClick={() => handleSuggestion(s)}
                  >
                    {s}
                  </button>
                ))}
              </nav>
            </section>
          ) : (
            <section className={styles.messages} aria-live="polite">
              {messages.map((msg, i) => (
                <article
                  key={i}
                  className={`${styles.message} ${
                    msg.role === 'user' ? styles.messageUser : styles.messageBot
                  }`}
                >
                  {msg.content}
                </article>
              ))}
              {loading && (
                <span className={styles.typing} aria-label="AI is typing">
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                </span>
              )}
              <span ref={messagesEndRef} />
            </section>
          )}

          {/* Input */}
          <form className={styles.inputArea} onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                lang === 'uk'
                  ? 'Запитайте щось...'
                  : 'Ask something...'
              }
              rows={1}
              disabled={loading}
              id="ai-assistant-input"
            />
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={!input.trim() || loading}
              aria-label="Send message"
              id="ai-assistant-send"
            >
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        </section>
      )}

      {/* Floating Action Button */}
      <button
        className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
        onClick={toggleOpen}
        aria-label={open ? 'Close AI Assistant' : 'Open AI Assistant'}
        id="ai-assistant-fab"
      >
        {open ? (
          <X size={24} aria-hidden="true" />
        ) : (
          <MessageCircle size={24} aria-hidden="true" />
        )}
      </button>
    </aside>
  )
}
