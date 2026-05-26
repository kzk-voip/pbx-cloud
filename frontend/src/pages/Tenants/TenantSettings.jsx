import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'
import useAuthStore from '../../store/authStore'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import s from '../shared.module.css'
import styles from './TenantSettings.module.css'

export default function TenantSettings() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'

  const [form, setForm] = useState(null)
  const [dirty, setDirty] = useState(false)

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => client.get(`/tenants/${id}`).then((r) => r.data),
    onSuccess: (data) => {
      if (!form) {
        setForm({
          name: data.name,
          max_extensions: data.max_extensions,
          max_concurrent_calls: data.max_concurrent_calls,
          codecs: data.codecs,
          is_active: data.is_active,
          allow_international: data.allow_international,
          recordings_cleanup_days: data.recordings_cleanup_days ?? 0,
          recordings_cleanup_pct: data.recordings_cleanup_pct ?? 0,
          recordings_storage_limit_mb: data.recordings_storage_limit_mb ?? 100,
        })
      }
    },
  })

  // Initialize form from tenant data when loaded
  if (tenant && !form) {
    setForm({
      name: tenant.name,
      max_extensions: tenant.max_extensions,
      max_concurrent_calls: tenant.max_concurrent_calls,
      codecs: tenant.codecs,
      is_active: tenant.is_active,
      allow_international: tenant.allow_international,
      recordings_cleanup_days: tenant.recordings_cleanup_days ?? 0,
      recordings_cleanup_pct: tenant.recordings_cleanup_pct ?? 0,
      recordings_storage_limit_mb: tenant.recordings_storage_limit_mb ?? 100,
    })
  }

  const updateMutation = useMutation({
    mutationFn: (payload) =>
      client.put(`/tenants/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setDirty(false)
      toast.success(t('settings.saved'))
    },
    onError: (err) => toast.error(err.response?.data?.detail || t('settings.saveFailed', 'Failed to save settings')),
  })

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }))
    setDirty(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    updateMutation.mutate(form)
  }

  if (isLoading) return <p className={s.loading}>{t('common.loading')}</p>
  if (error) return <p className={s.error} role="alert">{error.message}</p>
  if (!tenant || !form) return <p className={s.empty}>{t('tenantDetails.notFound')}</p>

  return (
    <>
      <header className={styles.header}>
        <button className={`${s.btn} ${s.btnSecondary}`} onClick={() => navigate(`/tenants/${id}`)}>
          <ArrowLeft size={16} aria-hidden="true" /> {t('settings.back')}
        </button>
        <section>
          <h2 className={styles.title}>{t('settings.title')} — {tenant.name}</h2>
          <p className={styles.subtitle}>{tenant.slug} · {tenant.domain}</p>
        </section>
      </header>

      <form className={styles.grid} onSubmit={handleSave}>
        {/* Overview (read-only) */}
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>{t('settings.overview')}</h3>
          <section className={styles.infoGrid}>
            <section className={styles.infoItem}>
              <span className={styles.label}>{t('tenants.slug')}</span>
              <span className={styles.value}>{tenant.slug}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.label}>{t('tenants.domain')}</span>
              <span className={styles.value}>{tenant.domain}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.label}>{t('tenantDetails.info.created')}</span>
              <span className={styles.value}>{new Date(tenant.created_at).toLocaleString()}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.label}>{t('tenantDetails.info.lastUpdated', 'Last Updated')}</span>
              <span className={styles.value}>{new Date(tenant.updated_at).toLocaleString()}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.label}>{t('tenants.extensions')}</span>
              <span className={styles.value}>{tenant.extension_count || 0} / {tenant.max_extensions}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.label}>{t('tenants.status')}</span>
              <span className={styles.value}>
                <StatusBadge status={tenant.is_active ? 'active' : 'inactive'} />
              </span>
            </section>
          </section>
        </article>

        {/* Editable Configuration */}
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>{t('settings.configuration')}</h3>
          <section className={styles.formGrid}>
            <fieldset className={s.field}>
              <label className={s.fieldLabel} htmlFor="settings-name">{t('extensions.displayName')}</label>
              <input id="settings-name" className={s.fieldInput} required
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)} />
            </fieldset>
            <fieldset className={s.field}>
              <label className={s.fieldLabel} htmlFor="settings-max-ext">{t('settings.maxExtensions')}</label>
              <input id="settings-max-ext" className={s.fieldInput} type="number"
                min={1} max={1000} value={form.max_extensions}
                onChange={(e) => handleChange('max_extensions', +e.target.value)} />
            </fieldset>
            <fieldset className={s.field}>
              <label className={s.fieldLabel} htmlFor="settings-max-calls">{t('settings.maxConcurrentCalls')}</label>
              <input id="settings-max-calls" className={s.fieldInput} type="number"
                min={1} max={500} value={form.max_concurrent_calls}
                onChange={(e) => handleChange('max_concurrent_calls', +e.target.value)} />
            </fieldset>
            <fieldset className={s.field}>
              <label className={s.fieldLabel} htmlFor="settings-codecs">{t('settings.codecs')}</label>
              <input id="settings-codecs" className={s.fieldInput}
                value={form.codecs} placeholder="ulaw,alaw"
                onChange={(e) => handleChange('codecs', e.target.value)} />
            </fieldset>
            <fieldset className={s.field}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={form.is_active}
                  onChange={(e) => handleChange('is_active', e.target.checked)} />
                <span>{t('settings.active')}</span>
              </label>
            </fieldset>
            <fieldset className={s.field}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={form.allow_international}
                  onChange={(e) => handleChange('allow_international', e.target.checked)} />
                <span>{t('settings.allowInternational')}</span>
              </label>
            </fieldset>
          </section>
        </article>

        {/* Recordings Storage Cleanup Configuration */}
        <article className={styles.card} style={{ gridColumn: 'span 2' }}>
          <h3 className={styles.cardTitle}>{t('settings.recordingsStorageTitle')}</h3>
          
          {/* Storage Quota Progress Indicator */}
          <section style={{ marginBottom: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>
              <span>{t('settings.storageUsed')}</span>
              <strong>
                {t('settings.storageUsedText', {
                  used: (tenant.recordings_storage_used_bytes / (1024 * 1024)).toFixed(2),
                  limit: form.recordings_storage_limit_mb,
                  pct: form.recordings_storage_limit_mb > 0 
                    ? ((tenant.recordings_storage_used_bytes / (1024 * 1024 * form.recordings_storage_limit_mb)) * 100).toFixed(1)
                    : 0
                })}
              </strong>
            </div>
            {/* Progress Bar */}
            <div style={{
              width: '100%',
              height: '8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
              display: 'flex'
            }}>
              <div style={{
                width: `${Math.min(100, form.recordings_storage_limit_mb > 0 
                  ? (tenant.recordings_storage_used_bytes / (1024 * 1024 * form.recordings_storage_limit_mb)) * 100
                  : 0)}%`,
                height: '100%',
                background: (() => {
                  const pct = form.recordings_storage_limit_mb > 0 
                    ? (tenant.recordings_storage_used_bytes / (1024 * 1024 * form.recordings_storage_limit_mb)) * 100
                    : 0
                  if (pct > 90) return '#ef4444' // red
                  if (pct > 75) return '#f59e0b' // orange
                  return 'var(--primary-color)'  // green
                })(),
                transition: 'width var(--transition-fast) ease-out, background var(--transition-fast)'
              }} />
            </div>
          </section>

          <section className={styles.formGrid}>
            {isSuperAdmin ? (
              <fieldset className={s.field}>
                <label className={s.fieldLabel} htmlFor="settings-rec-limit">{t('settings.recordingsStorageLimitMb')}</label>
                <input id="settings-rec-limit" className={s.fieldInput} type="number"
                  min={1} max={100000} value={form.recordings_storage_limit_mb}
                  onChange={(e) => handleChange('recordings_storage_limit_mb', +e.target.value)} />
              </fieldset>
            ) : (
              <fieldset className={s.field}>
                <label className={s.fieldLabel}>{t('settings.recordingsStorageLimitMb')}</label>
                <div className={s.fieldInput} style={{ background: 'var(--bg-input)', display: 'flex', alignItems: 'center', minHeight: '38px', color: 'var(--text-muted)' }}>
                  {form.recordings_storage_limit_mb} MB ({t('settings.readOnlyTenantAdmin')})
                </div>
              </fieldset>
            )}
            {isSuperAdmin ? (
              <fieldset className={s.field}>
                <label className={s.fieldLabel} htmlFor="settings-rec-days">{t('settings.recordingsCleanupDays')}</label>
                <input id="settings-rec-days" className={s.fieldInput} type="number"
                  min={0} max={3650} value={form.recordings_cleanup_days}
                  onChange={(e) => handleChange('recordings_cleanup_days', +e.target.value)} />
                <span style={{ marginTop: '4px', display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', lineHeight: 'var(--line-height-normal)' }}>
                  {t('settings.cleanupDaysHint')}
                </span>
              </fieldset>
            ) : (
              <fieldset className={s.field}>
                <label className={s.fieldLabel}>{t('settings.recordingsCleanupDays')}</label>
                <div className={s.fieldInput} style={{ background: 'var(--bg-input)', display: 'flex', alignItems: 'center', minHeight: '38px', color: 'var(--text-muted)' }}>
                  {form.recordings_cleanup_days} {t('settings.days')} ({t('settings.readOnlyTenantAdmin')})
                </div>
                <span style={{ marginTop: '4px', display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', lineHeight: 'var(--line-height-normal)' }}>
                  {t('settings.cleanupDaysHint')}
                </span>
              </fieldset>
            )}
            {isSuperAdmin ? (
              <fieldset className={s.field}>
                <label className={s.fieldLabel} htmlFor="settings-rec-pct">{t('settings.recordingsCleanupPct')}</label>
                <input id="settings-rec-pct" className={s.fieldInput} type="number"
                  min={0} max={100} value={form.recordings_cleanup_pct}
                  onChange={(e) => handleChange('recordings_cleanup_pct', +e.target.value)} />
                <span style={{ marginTop: '4px', display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', lineHeight: 'var(--line-height-normal)' }}>
                  {t('settings.cleanupPctHint')}
                </span>
              </fieldset>
            ) : (
              <fieldset className={s.field}>
                <label className={s.fieldLabel}>{t('settings.recordingsCleanupPct')}</label>
                <div className={s.fieldInput} style={{ background: 'var(--bg-input)', display: 'flex', alignItems: 'center', minHeight: '38px', color: 'var(--text-muted)' }}>
                  {form.recordings_cleanup_pct}% ({t('settings.readOnlyTenantAdmin')})
                </div>
                <span style={{ marginTop: '4px', display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', lineHeight: 'var(--line-height-normal)' }}>
                  {t('settings.cleanupPctHint')}
                </span>
              </fieldset>
            )}
          </section>
        </article>

        {/* Save Button */}
        <footer className={styles.actions}>
          <button type="submit" className={`${s.btn} ${s.btnPrimary}`}
            disabled={!dirty || updateMutation.isPending}>
            <Save size={16} aria-hidden="true" />
            {updateMutation.isPending ? t('settings.saving') : t('settings.save')}
          </button>
        </footer>
      </form>
    </>
  )
}
