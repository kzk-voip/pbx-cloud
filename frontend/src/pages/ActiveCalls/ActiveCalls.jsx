import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import client from '../../api/client'
import useAuthStore from '../../store/authStore'
import s from '../shared.module.css'

export default function ActiveCalls() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'

  const [selectedTenant, setSelectedTenant] = useState('')

  // For non-super_admin, auto-set tenant to their own
  useEffect(() => {
    if (!isSuperAdmin && user?.tenant_id) {
      setSelectedTenant(user.tenant_id)
    }
  }, [isSuperAdmin, user?.tenant_id])

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => client.get('/tenants').then((r) => r.data),
    enabled: isSuperAdmin,
  })

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['active-calls', selectedTenant],
    queryFn: () => client.get(`/tenants/${selectedTenant}/active-calls`).then((r) => r.data),
    enabled: !!selectedTenant,
    refetchInterval: 5000,
  })

  // For super_admin, auto-select first tenant if none selected
  if (isSuperAdmin && !selectedTenant && tenants?.items?.length > 0) {
    setSelectedTenant(tenants.items[0].id)
  }

  return (
    <>
      <section className={s.toolbar}>
        {isSuperAdmin && (
          <fieldset className={s.searchGroup}>
            <label htmlFor="calls-tenant-select" className="sr-only">{t('activeCalls.labelTenant')}</label>
            <select id="calls-tenant-select" className={s.fieldInput} style={{ height: 40 }}
              value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)}>
              <option value="">{t('activeCalls.selectTenant')}</option>
              {tenants?.items?.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
              ))}
            </select>
          </fieldset>
        )}

        <button className={`${s.btn} ${s.btnSecondary}`} onClick={() => refetch()}
          disabled={isFetching} id="refresh-calls-btn">
          <RefreshCw size={16} className={isFetching ? 'spin' : ''} aria-hidden="true" />
          {isFetching ? t('activeCalls.refreshing') : t('activeCalls.refresh')}
        </button>
      </section>

      {!selectedTenant ? (
        <p className={s.empty}>{t('activeCalls.empty')}</p>
      ) : isLoading ? (
        <p className={s.loading}>{t('activeCalls.loading')}</p>
      ) : (
        <>
          <p style={{ marginBottom: 'var(--space-2)', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            {t('activeCalls.activeCount', { count: data?.count || 0 })}
          </p>
          <article className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('activeCalls.table.channel')}</th>
                  <th>{t('activeCalls.table.callerId')}</th>
                  <th>{t('activeCalls.table.connected')}</th>
                  <th>{t('activeCalls.table.duration')}</th>
                  <th>{t('activeCalls.table.state')}</th>
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
                  <tr><td colSpan={5} className={s.empty}>{t('activeCalls.noCalls')}</td></tr>
                )}
              </tbody>
            </table>
          </article>
        </>
      )}
    </>
  )
}
