import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Phone, PhoneCall, Activity } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import client from '../../api/client'
import MetricCard from '../../components/MetricCard/MetricCard'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import styles from './Dashboard.module.css'

const MAX_CHART_POINTS = 60

export default function Dashboard() {
  const [callHistory, setCallHistory] = useState([])

  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => client.get('/tenants').then((r) => r.data),
  })

  const { data: systemStatus, dataUpdatedAt } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => client.get('/admin/system-status').then((r) => r.data),
    refetchInterval: 5000,
  })

  // Build CPS chart data from periodic system-status polls
  useEffect(() => {
    if (systemStatus?.active_calls !== undefined) {
      setCallHistory((prev) => {
        const now = new Date()
        const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const next = [...prev, { time: timeLabel, calls: systemStatus.active_calls }]
        return next.length > MAX_CHART_POINTS ? next.slice(-MAX_CHART_POINTS) : next
      })
    }
  }, [dataUpdatedAt])

  const totalTenants = tenants?.items?.length ?? tenants?.total ?? 0
  const activeTenants = tenants?.items?.filter?.((t) => t.is_active)?.length ?? 0
  const totalExtensions = tenants?.items?.reduce?.((sum, t) => sum + (t.extension_count || 0), 0) ?? 0

  return (
    <>
      <section className={styles.grid}>
        <MetricCard
          icon={Building2}
          label="Total Tenants"
          value={totalTenants}
          subtitle={`${activeTenants} active`}
          variant="primary"
        />
        <MetricCard
          icon={Phone}
          label="Total Extensions"
          value={totalExtensions}
          variant="info"
        />
        <MetricCard
          icon={PhoneCall}
          label="Active Calls"
          value={systemStatus?.active_calls ?? '—'}
          variant="success"
        />
        <MetricCard
          icon={Activity}
          label="System Status"
          value={systemStatus?.status === 'ok' ? 'Healthy' : 'Unknown'}
          variant={systemStatus?.status === 'ok' ? 'success' : 'warning'}
        />
      </section>

      {/* Active Calls Chart */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Active Calls — Live</h2>
          <span className={styles.badge}>Auto-refresh 5s</span>
        </header>
        <article className={styles.chartCard}>
          {callHistory.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={callHistory} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-color)' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-color)' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-primary)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="calls"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#callGradient)"
                  name="Active Calls"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className={styles.chartPlaceholder}>Collecting data points...</p>
          )}
        </article>
      </section>

      {/* Tenants Overview */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Tenants Overview</h2>
        </header>

        {tenantsLoading ? (
          <p className={styles.loading}>Loading...</p>
        ) : (
          <article className={styles.table}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Domain</th>
                  <th>Extensions</th>
                  <th>Max Calls</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tenants?.items?.length > 0 ? (
                  tenants.items.map((tenant) => (
                    <tr key={tenant.id}>
                      <td>{tenant.name}</td>
                      <td>{tenant.domain}</td>
                      <td>{tenant.extension_count || 0}</td>
                      <td>{tenant.max_concurrent_calls}</td>
                      <td>
                        <StatusBadge status={tenant.is_active ? 'active' : 'inactive'} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className={styles.empty}>No tenants found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </article>
        )}
      </section>
    </>
  )
}
