import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import styles from './Layout.module.css'

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/tenants': 'Tenants',
  '/extensions': 'Extensions',
  '/trunks': 'SIP Trunks',
  '/active-calls': 'Active Calls',
  '/cdr': 'CDR History',
  '/profile': 'Profile',
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  // Resolve page title from pathname
  const title = Object.entries(pageTitles).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] || 'PBX Cloud'

  return (
    <section className={styles.layout}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <main className={`${styles.main} ${collapsed ? styles.collapsed : ''}`}>
        <TopBar
          collapsed={collapsed}
          title={title}
          onMenuClick={() => setCollapsed((c) => !c)}
        />
        <section className={styles.content}>
          <Outlet />
        </section>
      </main>
    </section>
  )
}
