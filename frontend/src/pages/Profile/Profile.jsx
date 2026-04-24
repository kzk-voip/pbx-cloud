import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import client from '../../api/client'
import s from '../shared.module.css'
import styles from './Profile.module.css'

export default function Profile() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!user) return <p className={s.loading}>Loading...</p>

  const handleChangePassword = async (e) => {
    e.preventDefault()

    if (form.new_password !== form.confirm) {
      toast.error('New passwords do not match')
      return
    }

    setIsSubmitting(true)
    try {
      await client.put('/auth/change-password', {
        current_password: form.current_password,
        new_password: form.new_password,
      })
      toast.success('Password changed! Please log in again.')
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
            <span className={styles.infoLabel}>User ID</span>
            <span className={styles.infoValue}><code>{user.id}</code></span>
          </article>
          <article className={styles.infoItem}>
            <span className={styles.infoLabel}>Role</span>
            <span className={styles.infoValue}>{user.role}</span>
          </article>
          <article className={styles.infoItem}>
            <span className={styles.infoLabel}>Tenant</span>
            <span className={styles.infoValue}>{user.tenant_id || 'Global (Super Admin)'}</span>
          </article>
          <article className={styles.infoItem}>
            <span className={styles.infoLabel}>Status</span>
            <span className={styles.infoValue}>{user.is_active ? '✅ Active' : '❌ Inactive'}</span>
          </article>
          <article className={styles.infoItem}>
            <span className={styles.infoLabel}>Created</span>
            <span className={styles.infoValue}>{new Date(user.created_at).toLocaleString()}</span>
          </article>
        </section>
      </article>

      <article className={styles.card} style={{ marginTop: 'var(--space-3)' }}>
        <header className={styles.passwordHeader}>
          <Lock size={20} aria-hidden="true" />
          <h2 className={styles.name}>Change Password</h2>
        </header>
        <form className={styles.passwordForm} onSubmit={handleChangePassword}>
          <fieldset className={s.field}>
            <label className={s.fieldLabel} htmlFor="current-password">Current Password</label>
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
            <label className={s.fieldLabel} htmlFor="new-password">New Password</label>
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
            <label className={s.fieldLabel} htmlFor="confirm-password">Confirm New Password</label>
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
            {isSubmitting ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </article>
    </>
  )
}
