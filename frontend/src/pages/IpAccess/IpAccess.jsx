import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, ShieldBan, Plus, Trash2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'
import s from '../shared.module.css'
import styles from './IpAccess.module.css'

export default function IpAccess() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // ── Whitelist state ──
  const [wlIp, setWlIp] = useState('')
  const [wlDesc, setWlDesc] = useState('')

  // ── Blacklist state ──
  const [blIp, setBlIp] = useState('')

  // ── Queries ──
  const { data: whitelist, isLoading: wlLoading } = useQuery({
    queryKey: ['ip-whitelist'],
    queryFn: () => client.get('/admin/ip-whitelist').then((r) => r.data),
  })

  const { data: blacklist, isLoading: blLoading } = useQuery({
    queryKey: ['ip-blacklist'],
    queryFn: () => client.get('/admin/ip-blacklist').then((r) => r.data),
  })

  // ── Whitelist mutations ──
  const addWhitelist = useMutation({
    mutationFn: (data) => client.post('/admin/ip-whitelist', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] })
      setWlIp('')
      setWlDesc('')
      toast.success(t('ipAccess.toastWhitelistAdded'))
    },
    onError: (err) => toast.error(err.response?.data?.detail || t('ipAccess.toastWhitelistFailed')),
  })

  const removeWhitelist = useMutation({
    mutationFn: (id) => client.delete(`/admin/ip-whitelist/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] })
      toast.success(t('ipAccess.toastWhitelistRemoved'))
    },
    onError: () => toast.error(t('ipAccess.toastWhitelistRemoveFailed')),
  })

  // ── Blacklist mutations ──
  const addBlacklist = useMutation({
    mutationFn: (data) => client.post('/admin/ip-blacklist', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ip-blacklist'] })
      setBlIp('')
      toast.success(t('ipAccess.toastBlacklistAdded'))
    },
    onError: (err) => toast.error(err.response?.data?.detail || t('ipAccess.toastBlacklistFailed')),
  })

  const removeBlacklist = useMutation({
    mutationFn: (ip) => client.delete(`/admin/ip-blacklist/${ip}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ip-blacklist'] })
      toast.success(t('ipAccess.toastBlacklistRemoved'))
    },
    onError: () => toast.error(t('ipAccess.toastBlacklistRemoveFailed')),
  })

  const handleAddWhitelist = (e) => {
    e.preventDefault()
    if (!wlIp.trim()) return
    addWhitelist.mutate({ ip_address: wlIp.trim(), description: wlDesc.trim() || null })
  }

  const handleAddBlacklist = (e) => {
    e.preventDefault()
    if (!blIp.trim()) return
    addBlacklist.mutate({ ip_address: blIp.trim() })
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('ipAccess.title')}</h1>
        <p className={styles.subtitle}>
          {t('ipAccess.subtitle')}
        </p>
      </header>

      <section className={styles.sections}>
        {/* ── Global Whitelist ── */}
        <article className={styles.section}>
          <header className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <ShieldCheck size={20} className={styles.sectionIcon} aria-hidden="true" />
              {t('ipAccess.whitelistTitle')}
              {whitelist?.total > 0 && (
                <span className={styles.sectionBadge}>{whitelist.total}</span>
              )}
            </h2>
          </header>

          <aside className={styles.warningBanner}>
            <AlertTriangle size={16} className={styles.warningIcon} aria-hidden="true" />
            {t('ipAccess.whitelistWarning')}
          </aside>

          <form className={styles.addForm} onSubmit={handleAddWhitelist}>
            <label className={styles.formField}>
              <span className={styles.formLabel}>{t('ipAccess.ipAddress')}</span>
              <input
                className={styles.formInput}
                type="text"
                placeholder={t('ipAccess.placeholderIp')}
                value={wlIp}
                onChange={(e) => setWlIp(e.target.value)}
                autoComplete="off"
                id="whitelist-ip-input"
              />
            </label>
            <label className={styles.formField}>
              <span className={styles.formLabel}>{t('ipAccess.description')}</span>
              <input
                className={styles.formInput}
                type="text"
                placeholder={t('ipAccess.placeholderDesc')}
                value={wlDesc}
                onChange={(e) => setWlDesc(e.target.value)}
                autoComplete="off"
                id="whitelist-desc-input"
              />
            </label>
            <button
              type="submit"
              className={`${s.btn} ${s.btnPrimary}`}
              disabled={addWhitelist.isPending || !wlIp.trim()}
              id="add-whitelist-btn"
            >
              <Plus size={16} aria-hidden="true" />
              {t('ipAccess.addBtn')}
            </button>
          </form>

          {wlLoading ? (
            <p className={s.loading}>{t('ipAccess.loading')}</p>
          ) : !whitelist?.items?.length ? (
            <p className={s.empty}>{t('ipAccess.emptyWhitelist')}</p>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('ipAccess.ipAddress')}</th>
                  <th>{t('ipAccess.description')}</th>
                  <th>{t('ipAccess.added')}</th>
                  <th style={{ width: 48 }}>{t('ipAccess.action')}</th>
                </tr>
              </thead>
              <tbody>
                {whitelist.items.map((item) => (
                  <tr key={item.id}>
                    <td className={styles.ipCell}>{item.ip_address}</td>
                    <td>{item.description || '—'}</td>
                    <td>{new Date(item.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                        onClick={() => removeWhitelist.mutate(item.id)}
                        aria-label={t('ipAccess.removeAria', { ip: item.ip_address })}
                        id={`remove-wl-${item.id}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        {/* ── Global Blacklist ── */}
        <article className={styles.section}>
          <header className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <ShieldBan size={20} className={`${styles.sectionIcon}`} style={{ color: 'var(--color-error)' }} aria-hidden="true" />
              {t('ipAccess.blacklistTitle')}
              {blacklist?.total > 0 && (
                <span className={`${styles.sectionBadge} ${styles.dangerBadge}`}>{blacklist.total}</span>
              )}
            </h2>
          </header>

          <aside className={styles.warningBanner}>
            <AlertTriangle size={16} className={styles.warningIcon} aria-hidden="true" />
            {t('ipAccess.blacklistWarning')}
          </aside>

          <form className={styles.addForm} onSubmit={handleAddBlacklist}>
            <label className={styles.formField}>
              <span className={styles.formLabel}>{t('ipAccess.ipAddress')}</span>
              <input
                className={styles.formInput}
                type="text"
                placeholder={t('ipAccess.placeholderIpBlacklist')}
                value={blIp}
                onChange={(e) => setBlIp(e.target.value)}
                autoComplete="off"
                id="blacklist-ip-input"
              />
            </label>
            <button
              type="submit"
              className={`${s.btn} ${s.btnDanger}`}
              disabled={addBlacklist.isPending || !blIp.trim()}
              id="add-blacklist-btn"
            >
              <ShieldBan size={16} aria-hidden="true" />
              {t('ipAccess.blockIpBtn')}
            </button>
          </form>

          {blLoading ? (
            <p className={s.loading}>{t('ipAccess.loading')}</p>
          ) : !blacklist?.entries?.length ? (
            <p className={s.empty}>{t('ipAccess.emptyBlacklist')}</p>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('ipAccess.ipAddress')}</th>
                  <th>{t('common.status')}</th>
                  <th style={{ width: 48 }}>{t('ipAccess.action')}</th>
                </tr>
              </thead>
              <tbody>
                {blacklist.entries.map((entry) => (
                  <tr key={entry.ip}>
                    <td className={styles.ipCell}>{entry.ip}</td>
                    <td>{t('ipAccess.blockedStatus')}</td>
                    <td>
                      <button
                        className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                        onClick={() => removeBlacklist.mutate(entry.ip)}
                        aria-label={t('ipAccess.unblockAria', { ip: entry.ip })}
                        id={`unblock-${entry.ip}`}
                      >
                        {t('ipAccess.unblockBtn')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>
    </main>
  )
}
