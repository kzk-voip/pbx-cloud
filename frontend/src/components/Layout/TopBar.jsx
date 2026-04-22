import { useNavigate } from 'react-router-dom'
import { Sun, Moon, LogOut, Menu } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import styles from './TopBar.module.css'

export default function TopBar({ collapsed, onMenuClick, title }) {
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
          aria-label="Toggle menu"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <h1 className={styles.pageTitle}>{title || 'Dashboard'}</h1>
      </section>

      <section className={styles.right}>
        <button
          className={styles.themeBtn}
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
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
          aria-label="Logout"
        >
          <LogOut size={18} aria-hidden="true" />
        </button>
      </section>
    </header>
  )
}
