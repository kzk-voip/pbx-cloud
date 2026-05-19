import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, ChevronLeft, ChevronRight, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import client from '../../api/client'
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

function dispositionColor(disp) {
  switch (disp?.toUpperCase()) {
    case 'ANSWERED': return 'active'
    case 'NO ANSWER': return 'warning'
    case 'BUSY': return 'warning'
    case 'FAILED': return 'inactive'
    default: return 'unknown'
  }
}

export default function CDR() {
  const [selectedTenant, setSelectedTenant] = useState('')
  const [page, setPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const { formatDate } = useTimezone()
  const perPage = 20

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => client.get('/tenants').then((r) => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['cdr', selectedTenant, page],
    queryFn: () =>
      client.get(`/tenants/${selectedTenant}/cdr`, {
        params: { page, per_page: perPage },
      }).then((r) => r.data),
    enabled: !!selectedTenant,
  })

  if (!selectedTenant && tenants?.items?.length > 0) {
    setSelectedTenant(tenants.items[0].id)
  }

  const handleExportCSV = () => {
    if (!data?.items?.length) return
    const escapeCSV = (val) => {
      const str = String(val ?? '')
      return `"${str.replace(/"/g, '""')}"`
    }
    const headers = ['Date', 'Source', 'Destination', 'Duration', 'Billsec', 'Disposition', 'CallerID', 'Channel', 'DstChannel', 'UniqueID']
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
        <fieldset className={s.searchGroup}>
          <label htmlFor="cdr-tenant-select" className="sr-only">Select Tenant</label>
          <select id="cdr-tenant-select" className={s.fieldInput} style={{ height: 40 }}
            value={selectedTenant} onChange={(e) => { setSelectedTenant(e.target.value); setPage(1) }}>
            <option value="">Select tenant...</option>
            {tenants?.items?.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
            ))}
          </select>
        </fieldset>

        <button className={`${s.btn} ${s.btnSecondary}`} onClick={handleExportCSV}
          disabled={!data?.items?.length} id="export-cdr-btn">
          <Download size={16} aria-hidden="true" /> Export CSV
        </button>
      </section>

      {!selectedTenant ? (
        <p className={s.empty}>Select a tenant to view CDR history</p>
      ) : isLoading ? (
        <p className={s.loading}>Loading CDR...</p>
      ) : (
        <article className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Destination</th>
                <th>Duration</th>
                <th>Billsec</th>
                <th>Disposition</th>
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
                </tr>
              )) : (
                <tr><td colSpan={6} className={s.empty}>No CDR records</td></tr>
              )}
            </tbody>
          </table>

          {data && data.pages > 1 && (
            <footer className={s.pagination}>
              <span>Page {data.page} of {data.pages} ({data.total} records)</span>
              <section className={s.paginationBtns}>
                <button className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                  disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page">
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <button className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                  disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page">
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
            <Dialog.Title className={s.dialogTitle}>Call Detail Record</Dialog.Title>
            <p id="cdr-detail-desc" className="sr-only">Detailed information about the selected call</p>

            {selectedRecord && (
              <article className={styles.detailGrid}>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>Date & Time</span>
                  <span className={styles.detailValue}>
                    {formatDate(selectedRecord.calldate)}
                  </span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>Caller ID</span>
                  <span className={styles.detailValue}>{selectedRecord.clid || '—'}</span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>Source</span>
                  <span className={styles.detailValue}>{selectedRecord.src || '—'}</span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>Destination</span>
                  <span className={styles.detailValue}>{selectedRecord.dst || '—'}</span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>Duration</span>
                  <span className={styles.detailValue}>{formatDuration(selectedRecord.duration)}</span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>Billable Seconds</span>
                  <span className={styles.detailValue}>{formatDuration(selectedRecord.billsec)}</span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>Disposition</span>
                  <span className={styles.detailValue}>
                    <span className={`${styles.disposition} ${styles[dispositionColor(selectedRecord.disposition)]}`}>
                      {selectedRecord.disposition || '—'}
                    </span>
                  </span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>Context</span>
                  <span className={styles.detailValue}><code>{selectedRecord.dcontext || '—'}</code></span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>Channel</span>
                  <span className={styles.detailValue}><code>{selectedRecord.channel || '—'}</code></span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>Destination Channel</span>
                  <span className={styles.detailValue}><code>{selectedRecord.dstchannel || '—'}</code></span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>Last Application</span>
                  <span className={styles.detailValue}><code>{selectedRecord.lastapp || '—'}</code></span>
                </section>
                <section className={styles.detailItem}>
                  <span className={styles.detailLabel}>Account Code</span>
                  <span className={styles.detailValue}>{selectedRecord.accountcode || '—'}</span>
                </section>
                <section className={`${styles.detailItem} ${styles.fullWidth}`}>
                  <span className={styles.detailLabel}>Unique ID</span>
                  <span className={styles.detailValue}><code>{selectedRecord.uniqueid || '—'}</code></span>
                </section>
              </article>
            )}

            <footer className={s.dialogActions}>
              <Dialog.Close asChild>
                <button className={`${s.btn} ${s.btnSecondary}`}>Close</button>
              </Dialog.Close>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
