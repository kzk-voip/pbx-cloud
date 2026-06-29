import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Phone } from 'lucide-react'
import client from '../../api/client'
import useAuthStore from '../../store/authStore'
import useTimezone from '../../hooks/useTimezone'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import s from '../shared.module.css'
import styles from './ExtensionDashboard.module.css'

function formatDuration(sec) {
  if (!sec || sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const ss = sec % 60
  return `${m}:${String(ss).padStart(2, '0')}`
}

export default function ExtensionDashboard() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { formatDate } = useTimezone()

  const tenantId = user?.tenant_id

  const { data: cdrData, isLoading } = useQuery({
    queryKey: ['my-cdr', tenantId],
    queryFn: () =>
      client.get(`/tenants/${tenantId}/cdr`, {
        params: { per_page: 10, page: 1 },
      }).then((r) => r.data),
    enabled: !!tenantId,
  })

  const stats = useMemo(() => {
    if (!cdrData?.items) return { total: 0, answered: 0, totalTalk: 0 }
    const items = cdrData.items
    return {
      total: cdrData.total ?? items.length,
      answered: items.filter((c) => c.disposition === 'ANSWERED').length,
      totalTalk: items.reduce((sum, c) => sum + (c.billsec || 0), 0),
    }
  }, [cdrData])

  const dispositionStatus = (d) => {
    if (d === 'ANSWERED') return 'active'
    if (d === 'BUSY' || d === 'NO ANSWER') return 'warning'
    return 'inactive'
  }

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.greeting}>
          {t('extDashboard.welcome', { name: user?.username || '' })}
        </h1>
        {user?.extension_number && (
          <p className={styles.extNumber}>
            <span className={styles.extBadge}>
              <Phone size={12} aria-hidden="true" />
              {user.extension_number}
            </span>
          </p>
        )}
      </header>

      <section className={styles.cards}>
        <article className={styles.card}>
          <span className={styles.cardLabel}>{t('extDashboard.totalCalls')}</span>
          <span className={styles.cardValue}>{stats.total}</span>
        </article>
        <article className={styles.card}>
          <span className={styles.cardLabel}>{t('extDashboard.answeredCalls')}</span>
          <span className={styles.cardValue}>{stats.answered}</span>
        </article>
        <article className={styles.card}>
          <span className={styles.cardLabel}>{t('extDashboard.talkTime')}</span>
          <span className={styles.cardValue}>{formatDuration(stats.totalTalk)}</span>
        </article>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('extDashboard.recentCalls')}</h2>

        {isLoading ? (
          <p className={s.loading}>{t('common.loading')}</p>
        ) : (
          <article className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('cdr.date')}</th>
                  <th>{t('cdr.source')}</th>
                  <th>{t('cdr.destination')}</th>
                  <th>{t('cdr.duration')}</th>
                  <th>{t('cdr.billsec')}</th>
                  <th>{t('cdr.disposition')}</th>
                </tr>
              </thead>
              <tbody>
                {cdrData?.items?.length > 0 ? cdrData.items.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.calldate)}</td>
                    <td>{row.src || '—'}</td>
                    <td>{row.dst || '—'}</td>
                    <td>{formatDuration(row.duration)}</td>
                    <td>{formatDuration(row.billsec)}</td>
                    <td>
                      <StatusBadge
                        status={dispositionStatus(row.disposition)}
                        label={row.disposition}
                      />
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className={s.empty}>{t('extDashboard.noCalls')}</td></tr>
                )}
              </tbody>
            </table>
          </article>
        )}
      </section>
    </>
  )
}
