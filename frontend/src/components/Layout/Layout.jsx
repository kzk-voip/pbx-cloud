import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import AIAssistantWidget from '../AIAssistant/AIAssistantWidget'
import useWebSocket from '../../hooks/useWebSocket'
import styles from './Layout.module.css'

const pageTitles = {
  '/dashboard': 'sidebar.dashboard',
  '/tenants': 'sidebar.tenants',
  '/active-calls': 'sidebar.activeCalls',
  '/cdr': 'sidebar.cdr',
  '/profile': 'sidebar.profile',
}

export default function Layout() {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  // WebSocket real-time connection
  useWebSocket({ enabled: true })

  // Resolve page title from pathname
  const titleKey = Object.entries(pageTitles).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1]
  const title = titleKey ? t(titleKey) : 'PBX Cloud'

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
      <AIAssistantWidget />
    </section>
  )
}

