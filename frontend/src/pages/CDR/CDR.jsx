import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'
import client from '../../api/client'
import s from '../shared.module.css'

function formatDuration(seconds) {
  if (!seconds) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const sec = seconds % 60
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':')
}

export default function CDR() {
  const [selectedTenant, setSelectedTenant] = useState('')
  const [page, setPage] = useState(1)
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
    const headers = ['Date', 'Source', 'Destination', 'Duration', 'Billsec', 'Disposition']
    const rows = data.items.map((r) => [
      new Date(r.calldate).toLocaleString(),
      r.src, r.dst, formatDuration(r.duration),
      formatDuration(r.billsec), r.disposition,
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
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
                <tr key={r.id}>
                  <td>{new Date(r.calldate).toLocaleString()}</td>
                  <td>{r.src || '—'}</td>
                  <td>{r.dst || '—'}</td>
                  <td>{formatDuration(r.duration)}</td>
                  <td>{formatDuration(r.billsec)}</td>
                  <td>{r.disposition || '—'}</td>
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
    </>
  )
}
