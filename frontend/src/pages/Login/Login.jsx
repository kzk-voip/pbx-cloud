import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore'
import styles from './Login.module.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const result = await login(username, password)
    if (result.success) {
      const role = useAuthStore.getState().user?.role
      navigate(role === 'user' ? '/my-dashboard' : '/dashboard')
    } else {
      setError(result.error)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <article className={styles.card}>
          <header className={styles.header}>
            <span className={styles.logoIcon} aria-hidden="true">P</span>
            <h1 className={styles.title}>{t('login.title')}</h1>
            <p className={styles.subtitle}>{t('login.subtitle')}</p>
          </header>

          <form className={styles.form} onSubmit={handleSubmit}>
            {error && (
              <p className={styles.error} role="alert">{error}</p>
            )}

            <fieldset className={styles.field}>
              <label className={styles.label} htmlFor="login-username">
                {t('login.username')}
              </label>
              <input
                id="login-username"
                className={styles.input}
                type="text"
                placeholder="Enter your username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </fieldset>

            <fieldset className={styles.field}>
              <label className={styles.label} htmlFor="login-password">
                {t('login.password')}
              </label>
              <input
                id="login-password"
                className={styles.input}
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </fieldset>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isLoading}
            >
              {isLoading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>
        </article>
      </section>
    </main>
  )
}
