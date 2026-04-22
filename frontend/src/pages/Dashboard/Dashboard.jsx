import { useQuery } from '@tanstack/react-query'
import { Building2, Phone, PhoneCall, Activity } from 'lucide-react'
import client from '../../api/client'
import MetricCard from '../../components/MetricCard/MetricCard'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => client.get('/tenants').then((r) => r.data),
  })

  const { data: systemStatus } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => client.get('/admin/system-status').then((r) => r.data),
    refetchInterval: 10000,
  })

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
