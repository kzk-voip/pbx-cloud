import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import client from '../../api/client'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import s from '../shared.module.css'
import styles from './TenantDetails.module.css'

export default function TenantDetails() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => client.get(`/tenants/${id}`).then((r) => r.data),
  })

  const { data: extensions } = useQuery({
    queryKey: ['extensions', id],
    queryFn: () => client.get(`/tenants/${id}/extensions`).then((r) => r.data),
    enabled: !!id,
  })

  const { data: trunks } = useQuery({
    queryKey: ['trunks', id],
    queryFn: () => client.get(`/tenants/${id}/trunks`).then((r) => r.data),
    enabled: !!id,
  })

  if (isLoading) return <p className={s.loading}>Loading tenant...</p>
  if (error) return <p className={s.error}>{error.message}</p>
  if (!tenant) return <p className={s.empty}>Tenant not found</p>

  return (
    <>
      <header className={styles.header}>
        <button className={`${s.btn} ${s.btnSecondary}`} onClick={() => navigate('/tenants')}>
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </button>
        <section>
          <h2 className={styles.tenantName}>{tenant.name}</h2>
          <p className={styles.tenantDomain}>{tenant.domain}</p>
        </section>
        <StatusBadge status={tenant.is_active ? 'active' : 'inactive'} />
      </header>

      <Tabs.Root defaultValue="info" className={styles.tabs}>
        <Tabs.List className={styles.tabsList} aria-label="Tenant details">
          <Tabs.Trigger className={styles.tabsTrigger} value="info">Info</Tabs.Trigger>
          <Tabs.Trigger className={styles.tabsTrigger} value="extensions">
            Extensions ({extensions?.items?.length || 0})
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tabsTrigger} value="trunks">
            Trunks ({trunks?.items?.length || 0})
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content className={styles.tabsContent} value="info">
          <article className={styles.infoGrid}>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>Slug</span>
              <span className={styles.infoValue}>{tenant.slug}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>Domain</span>
              <span className={styles.infoValue}>{tenant.domain}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>Max Extensions</span>
              <span className={styles.infoValue}>{tenant.max_extensions}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>Max Concurrent Calls</span>
              <span className={styles.infoValue}>{tenant.max_concurrent_calls}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>Codecs</span>
              <span className={styles.infoValue}>{tenant.codecs}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>International Calls</span>
              <span className={styles.infoValue}>
                <StatusBadge status={tenant.allow_international ? 'active' : 'inactive'}
                  label={tenant.allow_international ? 'Allowed' : 'Blocked'} />
              </span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>Created</span>
              <span className={styles.infoValue}>{new Date(tenant.created_at).toLocaleString()}</span>
            </section>
          </article>
        </Tabs.Content>

        <Tabs.Content className={styles.tabsContent} value="extensions">
          <article className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Extension</th>
                  <th>Display Name</th>
                  <th>SIP Username</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {extensions?.items?.length > 0 ? extensions.items.map((ext) => (
                  <tr key={ext.id}>
                    <td>{ext.extension_number}</td>
                    <td>{ext.display_name || '—'}</td>
                    <td><code>{ext.sip_username}</code></td>
                    <td><StatusBadge status={ext.enabled ? 'active' : 'inactive'} /></td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className={s.empty}>No extensions</td></tr>
                )}
              </tbody>
            </table>
          </article>
        </Tabs.Content>

        <Tabs.Content className={styles.tabsContent} value="trunks">
          <article className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Provider</th>
                  <th>Host</th>
                  <th>Transport</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {trunks?.items?.length > 0 ? trunks.items.map((trunk) => (
                  <tr key={trunk.id}>
                    <td>{trunk.name}</td>
                    <td>{trunk.provider || '—'}</td>
                    <td>{trunk.host}:{trunk.port}</td>
                    <td>{trunk.transport.toUpperCase()}</td>
                    <td><StatusBadge status={trunk.enabled ? 'active' : 'inactive'} /></td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className={s.empty}>No trunks</td></tr>
                )}
              </tbody>
            </table>
          </article>
        </Tabs.Content>
      </Tabs.Root>
    </>
  )
}
