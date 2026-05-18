import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Lock, Globe } from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import client from '../../api/client'
import s from '../shared.module.css'
import styles from './Profile.module.css'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Українська' },
]

export default function Profile() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!user) return <p className={s.loading}>{t('common.loading')}</p>

  const handleChangePassword = async (e) => {
    e.preventDefault()

    if (form.new_password !== form.confirm) {
      toast.error(t('profile.passwordMismatch'))
      return
    }

    setIsSubmitting(true)
    try {
      await client.put('/auth/change-password', {
        current_password: form.current_password,
        new_password: form.new_password,
      })
      toast.success(t('profile.passwordChanged'))
      // Force re-login for security
      setTimeout(() => {
        logout()
        navigate('/login')
      }, 1500)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLanguageChange = (e) => {
    i18n.changeLanguage(e.target.value)
  }

  return (
    <>
      <article className={styles.card}>
        <header className={styles.header}>
          <span className={styles.avatar} aria-hidden="true">
            {user.username?.charAt(0).toUpperCase()}
          </span>
          <section>
            <h2 className={styles.name}>{user.username}</h2>
            <p className={styles.role}>{user.role}</p>
          </section>
        </header>

        <section className={styles.infoGrid}>
          <article className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('profile.userId')}</span>
            <span className={styles.infoValue}><code>{user.id}</code></span>
          </article>
          <article className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('profile.role')}</span>
            <span className={styles.infoValue}>{user.role}</span>
          </article>
          <article className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('profile.tenant')}</span>
            <span className={styles.infoValue}>{user.tenant_id || t('profile.globalAdmin')}</span>
          </article>
          <article className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('profile.statusActive')}</span>
            <span className={styles.infoValue}>{user.is_active ? `✅ ${t('profile.statusActive')}` : `❌ ${t('profile.statusInactive')}`}</span>
          </article>
          <article className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('profile.created')}</span>
            <span className={styles.infoValue}>{new Date(user.created_at).toLocaleString()}</span>
          </article>
        </section>
      </article>

      {/* Language & Preferences */}
      <article className={styles.card} style={{ marginTop: 'var(--space-3)' }}>
        <header className={styles.passwordHeader}>
          <Globe size={20} aria-hidden="true" />
          <h2 className={styles.name}>{t('profile.preferences')}</h2>
        </header>
        <section className={styles.passwordForm}>
          <fieldset className={s.field}>
            <label className={s.fieldLabel} htmlFor="language-select">{t('profile.language')}</label>
            <select
              id="language-select"
              className={s.fieldInput}
              value={i18n.language?.startsWith('uk') ? 'uk' : 'en'}
              onChange={handleLanguageChange}
              style={{ height: 40 }}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </fieldset>
        </section>
      </article>

      <article className={styles.card} style={{ marginTop: 'var(--space-3)' }}>
        <header className={styles.passwordHeader}>
          <Lock size={20} aria-hidden="true" />
          <h2 className={styles.name}>{t('profile.changePassword')}</h2>
        </header>
        <form className={styles.passwordForm} onSubmit={handleChangePassword}>
          <fieldset className={s.field}>
            <label className={s.fieldLabel} htmlFor="current-password">{t('profile.currentPassword')}</label>
            <input
              id="current-password"
              className={s.fieldInput}
              type="password"
              autoComplete="current-password"
              required
              value={form.current_password}
              onChange={(e) => setForm((f) => ({ ...f, current_password: e.target.value }))}
            />
          </fieldset>
          <fieldset className={s.field}>
            <label className={s.fieldLabel} htmlFor="new-password">{t('profile.newPassword')}</label>
            <input
              id="new-password"
              className={s.fieldInput}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.new_password}
              onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
            />
          </fieldset>
          <fieldset className={s.field}>
            <label className={s.fieldLabel} htmlFor="confirm-password">{t('profile.confirmPassword')}</label>
            <input
              id="confirm-password"
              className={s.fieldInput}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
            />
          </fieldset>
          <button
            type="submit"
            className={`${s.btn} ${s.btnPrimary}`}
            disabled={isSubmitting}
            style={{ alignSelf: 'flex-start', marginTop: 'var(--space-1)' }}
          >
            {isSubmitting ? t('profile.changing') : t('profile.changePassword')}
          </button>
        </form>
      </article>
    </>
  )
}
