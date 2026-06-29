import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import client from '../../api/client'
import useTimezone from '../../hooks/useTimezone'
import s from '../shared.module.css'
import styles from './TenantReports.module.css'

function formatSeconds(sec) {
  if (!sec || sec <= 0) return '0:00'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const ss = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return `${m}:${String(ss).padStart(2, '0')}`
}

const PRESETS = [
  { key: 'today', days: 0 },
  { key: 'week', days: 7 },
  { key: 'month', days: 30 },
  { key: 'quarter', days: 90 },
]

function getPresetDates(days) {
  const now = new Date()
  const to = now.toISOString().slice(0, 16)
  if (days === 0) {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 16)
    return { from, to }
  }
  const past = new Date(now.getTime() - days * 86400000)
  return { from: past.toISOString().slice(0, 16), to }
}

export default function TenantReports({ tenantId }) {
  const { t } = useTranslation()
  const { formatDate } = useTimezone()

  const [activePreset, setActivePreset] = useState('month')
  const [dateFrom, setDateFrom] = useState(() => getPresetDates(30).from)
  const [dateTo, setDateTo] = useState(() => getPresetDates(30).to)

  const { data: report, isLoading } = useQuery({
    queryKey: ['agent-report', tenantId, dateFrom, dateTo],
    queryFn: () =>
      client.get(`/tenants/${tenantId}/reports/agent-summary`, {
        params: { date_from: dateFrom, date_to: dateTo },
      }).then((r) => r.data),
    enabled: !!tenantId,
  })

  const handlePreset = (key, days) => {
    setActivePreset(key)
    const { from, to } = getPresetDates(days)
    setDateFrom(from)
    setDateTo(to)
  }

  const handleCustomDate = (field, value) => {
    setActivePreset(null)
    if (field === 'from') setDateFrom(value)
    else setDateTo(value)
  }

  const exportCsv = () => {
    if (!report?.items?.length) return
    const headers = [
      t('reports.agent'), t('reports.name'), t('reports.calls'),
      t('reports.uniqueCalls'), t('reports.ringTime'), t('reports.talkTime'),
      t('reports.totalTime'), t('reports.answered'), t('reports.noAnswer'),
      t('reports.asr', 'ASR%'), t('reports.acd', 'ACD'),
    ]
    const rows = report.items.map((r) => [
      r.agent, r.display_name || '', r.calls,
      r.unique_calls, formatSeconds(r.ring_time), formatSeconds(r.talk_time),
      formatSeconds(r.total_time), r.answered, r.no_answer,
      r.asr.toFixed(1), formatSeconds(Math.round(r.acd)),
    ])
    const bom = '\uFEFF'
    const csv = bom + [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agent-report-${dateFrom.slice(0, 10)}-${dateTo.slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totals = useMemo(() => {
    if (!report) return { calls: 0, answered: 0, talkTime: 0 }
    return {
      calls: report.total_calls ?? 0,
      answered: report.total_answered ?? 0,
      talkTime: report.total_talk_time ?? 0,
    }
  }, [report])

  return (
    <>
      {/* Toolbar: date range + presets + export */}
      <section className={styles.toolbar}>
        <nav className={styles.presets} aria-label={t('reports.dateRange')}>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={`${styles.presetBtn} ${activePreset === p.key ? styles.presetBtnActive : ''}`}
              onClick={() => handlePreset(p.key, p.days)}
            >
              {t(`reports.preset_${p.key}`)}
            </button>
          ))}
        </nav>

        <fieldset className={styles.dateGroup}>
          <label htmlFor="report-date-from">{t('reports.from')}</label>
          <input
            id="report-date-from"
            type="datetime-local"
            className={styles.dateInput}
            value={dateFrom}
            onChange={(e) => handleCustomDate('from', e.target.value)}
          />
        </fieldset>
        <fieldset className={styles.dateGroup}>
          <label htmlFor="report-date-to">{t('reports.to')}</label>
          <input
            id="report-date-to"
            type="datetime-local"
            className={styles.dateInput}
            value={dateTo}
            onChange={(e) => handleCustomDate('to', e.target.value)}
          />
        </fieldset>

        <span className={styles.spacer} />

        <button
          className={`${s.btn} ${s.btnSecondary}`}
          onClick={exportCsv}
          disabled={!report?.items?.length}
          aria-label={t('reports.exportCsv')}
        >
          <Download size={16} aria-hidden="true" /> {t('reports.exportCsv')}
        </button>
      </section>

      {/* Summary cards */}
      <section className={styles.summaryCards}>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>{t('reports.totalCalls')}</span>
          <span className={styles.summaryValue}>{totals.calls}</span>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>{t('reports.totalAnswered')}</span>
          <span className={styles.summaryValue}>{totals.answered}</span>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>{t('reports.totalTalkTime')}</span>
          <span className={styles.summaryValue}>{formatSeconds(totals.talkTime)}</span>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>{t('reports.overallAsr')}</span>
          <span className={styles.summaryValue}>
            {totals.calls > 0 ? ((totals.answered / totals.calls) * 100).toFixed(1) : '0.0'}%
          </span>
        </article>
      </section>

      {/* Agent table */}
      {isLoading ? (
        <p className={s.loading}>{t('common.loading')}</p>
      ) : (
        <article className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('reports.agent')}</th>
                <th>{t('reports.name')}</th>
                <th>{t('reports.calls')}</th>
                <th>{t('reports.uniqueCalls')}</th>
                <th>{t('reports.ringTime')}</th>
                <th>{t('reports.talkTime')}</th>
                <th>{t('reports.totalTime')}</th>
                <th>{t('reports.answered')}</th>
                <th>{t('reports.noAnswer')}</th>
                <th>{t('reports.asr', 'ASR%')}</th>
                <th>{t('reports.acd', 'ACD')}</th>
              </tr>
            </thead>
            <tbody>
              {report?.items?.length > 0 ? report.items.map((row) => (
                <tr key={row.agent}>
                  <td><code>{row.agent}</code></td>
                  <td>{row.display_name || '—'}</td>
                  <td>{row.calls}</td>
                  <td>{row.unique_calls}</td>
                  <td>{formatSeconds(row.ring_time)}</td>
                  <td>{formatSeconds(row.talk_time)}</td>
                  <td>{formatSeconds(row.total_time)}</td>
                  <td>{row.answered}</td>
                  <td>{row.no_answer}</td>
                  <td>{row.asr.toFixed(1)}%</td>
                  <td>{formatSeconds(Math.round(row.acd))}</td>
                </tr>
              )) : (
                <tr><td colSpan={11} className={s.empty}>{t('reports.noData')}</td></tr>
              )}
            </tbody>
          </table>
        </article>
      )}
    </>
  )
}
