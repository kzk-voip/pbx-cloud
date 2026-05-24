import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Building2, Phone, PhoneCall, Activity, Clock, TrendingUp } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import client from '../../api/client'
import useAuthStore from '../../store/authStore'
import MetricCard from '../../components/MetricCard/MetricCard'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import styles from './Dashboard.module.css'

const MAX_CHART_POINTS = 60

const DISPOSITION_COLORS = {
  ANSWERED: 'var(--color-success)',
  'NO ANSWER': '#94a3b8',
  BUSY: '#f59e0b',
  FAILED: 'var(--color-danger)',
  UNKNOWN: 'var(--text-muted)',
}

function formatDuration(seconds) {
  if (!seconds) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const chartTooltipStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--text-primary)',
}

export default function Dashboard() {
  const [callHistory, setCallHistory] = useState([])
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const isSuperAdmin = user?.role === 'super_admin'

  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => client.get('/tenants').then((r) => r.data),
    enabled: isSuperAdmin,
  })

  const { data: systemStatus, dataUpdatedAt } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => client.get('/admin/system-status').then((r) => r.data),
    refetchInterval: 5000,
    enabled: isSuperAdmin,
  })

  const { data: cdrStats } = useQuery({
    queryKey: ['cdr-stats'],
    queryFn: () => client.get('/admin/cdr-stats').then((r) => r.data),
    refetchInterval: 60000,
    enabled: isSuperAdmin,
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

  // Fill peak hours with 0s for missing hours
  const peakHoursData = (() => {
    const hoursMap = {}
    for (let i = 0; i < 24; i++) hoursMap[i] = 0
    cdrStats?.peak_hours?.forEach((h) => { hoursMap[h.hour] = h.calls })
    return Object.entries(hoursMap).map(([hour, calls]) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      calls,
    }))
  })()

  return (
    <>
      {/* Top metric cards */}
      <section className={styles.grid}>
        <MetricCard
          icon={Building2}
          label={t('dashboard.totalTenants')}
          value={totalTenants}
          subtitle={`${activeTenants} ${t('dashboard.active')}`}
          variant="primary"
        />
        <MetricCard
          icon={Phone}
          label={t('dashboard.totalExtensions')}
          value={totalExtensions}
          variant="info"
        />
        <MetricCard
          icon={PhoneCall}
          label={t('dashboard.activeCalls')}
          value={systemStatus?.active_calls ?? '—'}
          variant="success"
        />
        <MetricCard
          icon={TrendingUp}
          label={t('dashboard.totalCalls30d')}
          value={cdrStats?.totals?.total_calls ?? '—'}
          subtitle={cdrStats?.totals ? `Avg: ${formatDuration(cdrStats.totals.avg_duration)}` : ''}
          variant="warning"
        />
      </section>

      {/* Active Calls — Live chart */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('dashboard.liveChart')}</h2>
          <span className={styles.badge}>{t('dashboard.autoRefresh')}</span>
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
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="calls"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#callGradient)"
                  name={t('dashboard.activeCalls')}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className={styles.chartPlaceholder}>{t('dashboard.collecting')}</p>
          )}
        </article>
      </section>

      {/* CDR Analytics row */}
      <section className={styles.chartsRow}>
        {/* Call Volume (last 30 days) */}
        <article className={styles.chartHalf}>
          <header className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('dashboard.callVolume')}</h2>
          </header>
          <section className={styles.chartCard}>
            {cdrStats?.call_volume?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={cdrStats.call_volume} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border-color)' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border-color)' }}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="calls" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name={t('reports.calls')} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className={styles.chartPlaceholder}>{t('dashboard.noData')}</p>
            )}
          </section>
        </article>

        {/* Disposition Breakdown */}
        <article className={styles.chartHalf}>
          <header className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('dashboard.dispositions')}</h2>
          </header>
          <section className={styles.chartCard}>
            {cdrStats?.disposition_breakdown?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={cdrStats.disposition_breakdown}
                    dataKey="count"
                    nameKey="disposition"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    strokeWidth={2}
                    stroke="var(--bg-card)"
                    label={({ disposition, count }) => `${disposition}: ${count}`}
                    isAnimationActive={false}
                  >
                    {cdrStats.disposition_breakdown.map((entry, i) => (
                      <Cell
                        key={entry.disposition}
                        fill={DISPOSITION_COLORS[entry.disposition] || `hsl(${i * 90}, 60%, 55%)`}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className={styles.chartPlaceholder}>{t('dashboard.noData')}</p>
            )}
          </section>
        </article>
      </section>

      {/* Peak Hours */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('dashboard.peakHours')}</h2>
        </header>
        <article className={styles.chartCard}>
          {cdrStats?.peak_hours?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={peakHoursData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="hourGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-info)" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-color)' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-color)' }}
                />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="calls" fill="url(#hourGradient)" radius={[4, 4, 0, 0]} name={t('reports.calls')} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className={styles.chartPlaceholder}>{t('dashboard.noData')}</p>
          )}
        </article>
      </section>

      {/* Tenants Overview table */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('dashboard.tenantsOverview')}</h2>
        </header>

        {tenantsLoading ? (
          <p className={styles.loading}>{t('dashboard.loading')}</p>
        ) : (
          <article className={styles.table}>
            <table>
              <thead>
                <tr>
                  <th>{t('tenants.name')}</th>
                  <th>{t('tenants.domain')}</th>
                  <th>{t('tenants.extensions')}</th>
                  <th>{t('tenants.maxCalls')}</th>
                  <th>{t('tenants.status')}</th>
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
                    <td colSpan={5} className={styles.empty}>{t('tenants.noTenants')}</td>
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
