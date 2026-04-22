import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Phone,
  GitBranch,
  PhoneCall,
  FileText,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import styles from './Sidebar.module.css'

const mainNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tenants', icon: Building2, label: 'Tenants' },
  { to: '/extensions', icon: Phone, label: 'Extensions' },
  { to: '/trunks', icon: GitBranch, label: 'SIP Trunks' },
]

const monitorNav = [
  { to: '/active-calls', icon: PhoneCall, label: 'Active Calls' },
  { to: '/cdr', icon: FileText, label: 'CDR History' },
]

const accountNav = [
  { to: '/profile', icon: User, label: 'Profile' },
]

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation()

  const renderNavItem = ({ to, icon: Icon, label }) => (
    <NavLink
      key={to}
      to={to}
      className={({ isActive }) =>
        `${styles.navItem} ${isActive ? styles.active : ''}`
      }
    >
      <Icon className={styles.navIcon} aria-hidden="true" />
      <span className={styles.navText}>{label}</span>
    </NavLink>
  )

  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}
      aria-label="Main navigation"
    >
      <header className={styles.logo}>
        <span className={styles.logoIcon} aria-hidden="true">P</span>
        <span className={styles.logoText}>PBX Cloud</span>
      </header>

      <nav className={styles.nav}>
        <section className={styles.navSection}>
          <span className={styles.navLabel}>Main</span>
          {mainNav.map(renderNavItem)}
        </section>

        <section className={styles.navSection}>
          <span className={styles.navLabel}>Monitor</span>
          {monitorNav.map(renderNavItem)}
        </section>

        <section className={styles.navSection}>
          <span className={styles.navLabel}>Account</span>
          {accountNav.map(renderNavItem)}
        </section>
      </nav>

      <footer className={styles.sidebarFooter}>
        <button
          className={styles.collapseBtn}
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen size={20} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={20} aria-hidden="true" />
          )}
        </button>
      </footer>
    </aside>
  )
}
