import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Building2,
  PhoneCall,
  FileText,
  User,
  Phone,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import useAuthStore from '../../store/authStore'
import SoftphoneWidget from '../SoftphoneWidget/SoftphoneWidget'
import styles from './Sidebar.module.css'

export default function Sidebar({ collapsed, onToggle }) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [softphoneOpen, setSoftphoneOpen] = useState(false)

  const role = user?.role
  const tenantId = user?.tenant_id

  // ── super_admin nav ──
  const superAdminMainNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('sidebar.dashboard') },
    { to: '/tenants', icon: Building2, label: t('sidebar.tenants') },
  ]
  const superAdminMonitorNav = [
    { to: '/active-calls', icon: PhoneCall, label: t('sidebar.activeCalls') },
    { to: '/cdr', icon: FileText, label: t('sidebar.cdr') },
    { to: '/ip-access', icon: Shield, label: t('sidebar.ipAccess') },
  ]

  // ── tenant_admin nav ──
  const tenantAdminMainNav = [
    { to: tenantId ? `/tenants/${tenantId}` : '/profile', icon: Building2, label: t('sidebar.myTenant') || 'My Tenant' },
  ]
  const tenantAdminMonitorNav = [
    { to: '/active-calls', icon: PhoneCall, label: t('sidebar.activeCalls') },
    { to: '/cdr', icon: FileText, label: t('sidebar.cdr') },
  ]

  // ── extension user nav ──
  const extMainNav = [
    { to: '/my-dashboard', icon: LayoutDashboard, label: t('sidebar.myDashboard') },
  ]
  const extMonitorNav = [
    { to: '/my-calls', icon: FileText, label: t('sidebar.myCalls') },
  ]

  // Pick correct nav set
  let mainNav, monitorNav
  if (role === 'super_admin') {
    mainNav = superAdminMainNav
    monitorNav = superAdminMonitorNav
  } else if (role === 'tenant_admin') {
    mainNav = tenantAdminMainNav
    monitorNav = tenantAdminMonitorNav
  } else {
    mainNav = extMainNav
    monitorNav = extMonitorNav
  }

  const accountNav = [
    { to: '/profile', icon: User, label: t('sidebar.profile') },
  ]

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
          <span className={styles.navLabel}>{t('sidebar.main')}</span>
          {mainNav.map(renderNavItem)}
        </section>

        <section className={styles.navSection}>
          <span className={styles.navLabel}>{t('sidebar.monitor')}</span>
          {monitorNav.map(renderNavItem)}
        </section>

        <section className={styles.navSection}>
          <span className={styles.navLabel}>{t('sidebar.account')}</span>
          {accountNav.map(renderNavItem)}
        </section>
      </nav>

      <footer className={styles.sidebarFooter}>
        <button
          className={`${styles.softphoneBtn} ${softphoneOpen ? styles.softphoneBtnActive : ''}`}
          onClick={() => setSoftphoneOpen((v) => !v)}
          aria-label={softphoneOpen ? 'Close softphone' : 'Open softphone'}
        >
          <Phone size={20} aria-hidden="true" />
          <span className={styles.navText}>{t('sidebar.softphone')}</span>
        </button>
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

      {softphoneOpen && (
        <section className={styles.softphonePanel}>
          <SoftphoneWidget embedded onClose={() => setSoftphoneOpen(false)} />
        </section>
      )}
    </aside>
  )
}


