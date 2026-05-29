import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, LogOut, Menu } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import styles from './TopBar.module.css'

export default function TopBar({ collapsed, onMenuClick, title }) {
  const { t } = useTranslation()
  const { user, logout, toggleTheme } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

  return (
    <header className={`${styles.topbar} ${collapsed ? styles.collapsed : ''}`}>
      <section className={styles.left}>
        <button
          className={styles.menuBtn}
          onClick={onMenuClick}
          aria-label={t('topBar.toggleMenu')}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <h1 className={styles.pageTitle}>{title}</h1>
      </section>

      <section className={styles.right}>
        <button
          className={styles.themeBtn}
          onClick={toggleTheme}
          aria-label={isDark ? t('topBar.themeLight') : t('topBar.themeDark')}
        >
          {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>

        {user && (
          <article className={styles.userInfo}>
            <span className={styles.avatar} aria-hidden="true">
              {user.username?.charAt(0).toUpperCase()}
            </span>
            <aside>
              <p className={styles.userName}>{user.username}</p>
              <p className={styles.userRole}>{user.role}</p>
            </aside>
          </article>
        )}

        <button
          className={styles.logoutBtn}
          onClick={handleLogout}
          aria-label={t('topBar.logout')}
        >
          <LogOut size={18} aria-hidden="true" />
        </button>
      </section>
    </header>
  )
}
