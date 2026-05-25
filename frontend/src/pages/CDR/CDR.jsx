import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, ChevronLeft, ChevronRight, X, Play, Square } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import toast from 'react-hot-toast'
import client from '../../api/client'
import useAuthStore from '../../store/authStore'
import useTimezone from '../../hooks/useTimezone'
import s from '../shared.module.css'
import styles from './CDR.module.css'

function formatDuration(seconds) {
  if (!seconds) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const sec = seconds % 60
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':')
}

function getRecordingFilename(record) {
  const dateObj = new Date(record.calldate)
  let formattedDate = ''
  
  if (isNaN(dateObj.getTime())) {
    formattedDate = String(record.calldate || '').replace(/[^a-zA-Z0-9]/g, '_')
  } else {
    const pad = (num) => String(num).padStart(2, '0')
    const yyyy = dateObj.getFullYear()
    const mm = pad(dateObj.getMonth() + 1)
    const dd = pad(dateObj.getDate())
    const hh = pad(dateObj.getHours())
    const min = pad(dateObj.getMinutes())
    const ss = pad(dateObj.getSeconds())
    formattedDate = `${yyyy}${mm}${dd}_${hh}${min}${ss}`
  }
  
  const src = record.src || 'unknown'
  const dst = record.dst || 'unknown'
  
  return `${formattedDate}_${src}_${dst}.wav`
}

function dispositionColor(disp) {
  switch (disp?.toUpperCase()) {
    case 'ANSWERED': return 'active'
    case 'NO ANSWER': return 'warning'
    case 'BUSY': return 'warning'
    case 'FAILED': return 'inactive'
    default: return 'unknown'
  }
}

function RecordingPlayer({ tenantId, cdrId, onClose }) {
  const { t } = useTranslation()
  const [blobUrl, setBlobUrl] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let revoke = null
    client
      .get(`/tenants/${tenantId}/cdr/${cdrId}/recording`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data)
        revoke = url
        setBlobUrl(url)
      })
      .catch(() => setError(true))

    return () => { if (revoke) URL.revokeObjectURL(revoke) }
  }, [tenantId, cdrId])

  if (error) {
    return (
      <div className={styles.playerError}>
        {t('cdr.recordingPlayer.unavailable')}
      </div>
    )
  }

  return (
    <div className={styles.playerWrapper}>
      {blobUrl ? (
        <audio controls autoPlay src={blobUrl} onEnded={onClose} />
      ) : (
        <span className={styles.noRecording}>{t('cdr.recordingPlayer.loading')}</span>
      )}
    </div>
  )
}

export default function CDR() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'

  const [selectedTenant, setSelectedTenant] = useState('')
  const [page, setPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [playingId, setPlayingId] = useState(null)
  const { formatDate } = useTimezone()
  const perPage = 20

  const handleDownloadRecording = (e, record) => {
    e.stopPropagation()
    const toastId = toast.loading(t('cdr.downloading', 'Downloading recording...'))
    client
      .get(`/tenants/${selectedTenant}/cdr/${record.id}/recording`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data)
        const a = document.createElement('a')
        a.href = url
        a.download = getRecordingFilename(record)
        a.click()
        URL.revokeObjectURL(url)
        toast.dismiss(toastId)
      })
      .catch(() => {
        toast.dismiss(toastId)
        toast.error(t('cdr.downloadFailed', 'Failed to download recording'))
      })
  }

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

  const { data, isLoading } = useQuery({
    queryKey: ['cdr', selectedTenant, page],
    queryFn: () =>
      client.get(`/tenants/${selectedTenant}/cdr`, {
        params: { page, per_page: perPage },
      }).then((r) => r.data),
    enabled: !!selectedTenant,
  })

  // For super_admin, auto-select first tenant if none selected
  if (isSuperAdmin && !selectedTenant && tenants?.items?.length > 0) {
    setSelectedTenant(tenants.items[0].id)
  }

  const handleExportCSV = () => {
    if (!data?.items?.length) return
    const escapeCSV = (val) => {
      const str = String(val ?? '')
      return `"${str.replace(/"/g, '""')}"`
    }
    const headers = [
      t('cdr.detailDialog.date'),
      t('cdr.detailDialog.source'),
      t('cdr.detailDialog.destination'),
      t('cdr.detailDialog.duration'),
      t('cdr.detailDialog.billableSeconds'),
      t('cdr.detailDialog.disposition'),
      t('cdr.detailDialog.callerId'),
      t('cdr.detailDialog.channel'),
      t('cdr.detailDialog.dstChannel'),
      t('cdr.detailDialog.uniqueId')
    ]
    const rows = data.items.map((r) => [
      new Date(r.calldate).toLocaleString(),
      r.src, r.dst, formatDuration(r.duration),
      formatDuration(r.billsec), r.disposition,
      r.clid, r.channel, r.dstchannel, r.uniqueid,
    ])
    const csv = [headers, ...rows].map((r) => r.map(escapeCSV).join(',')).join('\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cdr_export_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <section className={s.toolbar}>
        {isSuperAdmin && (
          <fieldset className={s.searchGroup}>
            <label htmlFor="cdr-tenant-select" className="sr-only">{t('activeCalls.labelTenant')}</label>
            <select id="cdr-tenant-select" className={s.fieldInput} style={{ height: 40 }}
              value={selectedTenant} onChange={(e) => { setSelectedTenant(e.target.value); setPage(1) }}>
              <option value="">{t('cdr.selectTenant')}</option>
              {tenants?.items?.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.slug})</option>
              ))}
            </select>
          </fieldset>
        )}

        <button className={`${s.btn} ${s.btnSecondary}`} onClick={handleExportCSV}
          disabled={!data?.items?.length} id="export-cdr-btn">
          <Download size={16} aria-hidden="true" /> {t('cdr.exportCsv')}
        </button>
      </section>

      {!selectedTenant ? (
        <p className={s.empty}>{t('cdr.selectToView')}</p>
      ) : isLoading ? (
        <p className={s.loading}>{t('cdr.loading')}</p>
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
                <th>{t('cdr.recording')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.items?.length > 0 ? data.items.map((r) => (
                <tr key={r.id} className={s.clickableRow}
                  onClick={() => setSelectedRecord(r)}>
                  <td>{formatDate(r.calldate)}</td>
                  <td>{r.src || '—'}</td>
                  <td>{r.dst || '—'}</td>
                  <td>{formatDuration(r.duration)}</td>
                  <td>{formatDuration(r.billsec)}</td>
                  <td>
                    <span className={`${styles.disposition} ${styles[dispositionColor(r.disposition)]}`}>
                      {r.disposition || '—'}
                    </span>
                  </td>
                  <td>
                    {r.has_recording ? (
                      <section className={styles.recordingActions}>
                        <button
                          className={`${styles.playBtn} ${playingId === r.id ? styles.playBtnActive : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setPlayingId(r.id)
                          }}
                          aria-label={t('cdr.playRecording')}
                        >
                          <Play size={14} aria-hidden="true" />
                        </button>
                        <button
                          className={styles.downloadBtn}
                          onClick={(e) => handleDownloadRecording(e, r)}
                          aria-label={t('cdr.downloadRecording', 'Download Recording')}
                        >
                          <Download size={14} aria-hidden="true" />
                        </button>
                      </section>
                    ) : (
                      <span className={styles.noRecording}>—</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className={s.empty}>{t('cdr.noRecords')}</td></tr>
              )}
            </tbody>
          </table>

          {data && data.pages > 1 && (
            <footer className={s.pagination}>
              <span>{t('common.page', { current: data.page, total: data.pages, count: data.total })}</span>
              <section className={s.paginationBtns}>
                <button className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                  disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  aria-label={t('tenantDetails.events.prevPageAria')}>
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <button className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                  disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}
                  aria-label={t('tenantDetails.events.nextPageAria')}>
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </section>
            </footer>
          )}
        </article>
      )}

      {/* CDR Detail Dialog */}
      <Dialog.Root open={!!selectedRecord} onOpenChange={(open) => { if (!open) setSelectedRecord(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className={s.dialogOverlay} />
          <Dialog.Content className={s.dialogContent} aria-describedby="cdr-detail-desc">
            <Dialog.Title className={s.dialogTitle}>{t('cdr.detailDialog.title')}</Dialog.Title>
            <p id="cdr-detail-desc" className="sr-only">{t('cdr.detailDialog.description')}</p>

            {selectedRecord && (
              <article className={styles.detailGrid}>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('cdr.detailDialog.date')}</span>
                  <span className={styles.detailValue}>
                    {formatDate(selectedRecord.calldate)}
                  </span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('cdr.detailDialog.callerId')}</span>
                  <span className={styles.detailValue}>{selectedRecord.clid || '—'}</span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('cdr.detailDialog.source')}</span>
                  <span className={styles.detailValue}>{selectedRecord.src || '—'}</span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('cdr.detailDialog.destination')}</span>
                  <span className={styles.detailValue}>{selectedRecord.dst || '—'}</span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('cdr.detailDialog.duration')}</span>
                  <span className={styles.detailValue}>{formatDuration(selectedRecord.duration)}</span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('cdr.detailDialog.billableSeconds')}</span>
                  <span className={styles.detailValue}>{formatDuration(selectedRecord.billsec)}</span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('cdr.detailDialog.disposition')}</span>
                  <span className={styles.detailValue}>
                    <span className={`${styles.disposition} ${styles[dispositionColor(selectedRecord.disposition)]}`}>
                      {selectedRecord.disposition || '—'}
                    </span>
                  </span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('cdr.detailDialog.context')}</span>
                  <span className={styles.detailValue}><code>{selectedRecord.dcontext || '—'}</code></span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('cdr.detailDialog.channel')}</span>
                  <span className={styles.detailValue}><code>{selectedRecord.channel || '—'}</code></span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('cdr.detailDialog.dstChannel')}</span>
                  <span className={styles.detailValue}><code>{selectedRecord.dstchannel || '—'}</code></span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('cdr.detailDialog.lastApp')}</span>
                  <span className={styles.detailValue}><code>{selectedRecord.lastapp || '—'}</code></span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('cdr.detailDialog.accountCode')}</span>
                  <span className={styles.detailValue}>{selectedRecord.accountcode || '—'}</span>
                </section>
                <section className={`${styles.detailItem} ${styles.fullWidth}`}>
                  <span className={styles.detailLabel}>{t('cdr.detailDialog.uniqueId')}</span>
                  <span className={styles.detailValue}><code>{selectedRecord.uniqueid || '—'}</code></span>
                </section>
              </article>
            )}

            <footer className={s.dialogActions}>
              <Dialog.Close asChild>
                <button className={`${s.btn} ${s.btnSecondary}`}>{t('cdr.detailDialog.close')}</button>
              </Dialog.Close>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Recording Player Dialog */}
      <Dialog.Root open={!!playingId} onOpenChange={(open) => { if (!open) setPlayingId(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className={s.dialogOverlay} />
          <Dialog.Content className={s.dialogContent} style={{ maxWidth: '400px' }} aria-describedby="audio-player-desc">
            <Dialog.Title className={s.dialogTitle}>{t('cdr.recording')}</Dialog.Title>
            <p id="audio-player-desc" className="sr-only">Listen to call recording</p>

            {playingId && (
              <RecordingPlayer
                tenantId={selectedTenant}
                cdrId={playingId}
                onClose={() => setPlayingId(null)}
              />
            )}

            <footer className={s.dialogActions} style={{ marginTop: 'var(--space-3)' }}>
              <Dialog.Close asChild>
                <button className={`${s.btn} ${s.btnSecondary}`}>{t('cdr.detailDialog.close')}</button>
              </Dialog.Close>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
