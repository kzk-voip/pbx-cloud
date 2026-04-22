import useAuthStore from '../../store/authStore'
import s from '../shared.module.css'
import styles from './Profile.module.css'

export default function Profile() {
  const { user } = useAuthStore()

  if (!user) return <p className={s.loading}>Loading...</p>

  return (
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
  )
}
