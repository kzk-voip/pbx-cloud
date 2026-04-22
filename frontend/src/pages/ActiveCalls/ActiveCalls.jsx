import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import client from '../../api/client'
import s from '../shared.module.css'

export default function ActiveCalls() {
  const [selectedTenant, setSelectedTenant] = useState('')

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => client.get('/tenants').then((r) => r.data),
  })

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['active-calls', selectedTenant],
    queryFn: () => client.get(`/tenants/${selectedTenant}/active-calls`).then((r) => r.data),
    enabled: !!selectedTenant,
    refetchInterval: 5000,
  })

  if (!selectedTenant && tenants?.items?.length > 0) {
    setSelectedTenant(tenants.items[0].id)
  }

  return (
    <>
      <section className={s.toolbar}>
        <fieldset className={s.searchGroup}>
          <label htmlFor="calls-tenant-select" className="sr-only">Select Tenant</label>
          <select id="calls-tenant-select" className={s.fieldInput} style={{ height: 40 }}
            value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)}>
            <option value="">Select tenant...</option>
            {tenants?.items?.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
            ))}
          </select>
        </fieldset>

        <button className={`${s.btn} ${s.btnSecondary}`} onClick={() => refetch()}
          disabled={isFetching} id="refresh-calls-btn">
          <RefreshCw size={16} className={isFetching ? 'spin' : ''} aria-hidden="true" />
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </section>

      {!selectedTenant ? (
        <p className={s.empty}>Select a tenant to view active calls</p>
      ) : isLoading ? (
        <p className={s.loading}>Loading active calls...</p>
      ) : (
        <>
          <p style={{ marginBottom: 'var(--space-2)', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            {data?.count || 0} active channel(s) • Auto-refreshing every 5s
          </p>
          <article className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Caller ID</th>
                  <th>Connected</th>
                  <th>Duration</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {data?.active_channels?.length > 0 ? data.active_channels.map((ch, i) => (
                  <tr key={i}>
                    <td><code>{ch.channel || ch.Channel}</code></td>
                    <td>{ch.callerid || ch.CallerID || '—'}</td>
                    <td>{ch.connected_line || ch.ConnectedLine || '—'}</td>
                    <td>{ch.duration || ch.Duration || '—'}</td>
                    <td>{ch.state || ch.State || '—'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className={s.empty}>No active calls</td></tr>
                )}
              </tbody>
            </table>
          </article>
        </>
      )}
    </>
  )
}
