import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import s from '../shared.module.css'
import styles from './TenantSettings.module.css'

export default function TenantSettings() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
    })
  }

  const updateMutation = useMutation({
    mutationFn: (payload) =>
      client.put(`/tenants/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setDirty(false)
      toast.success('Settings saved')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to save settings'),
  })

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }))
    setDirty(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    updateMutation.mutate(form)
  }

  if (isLoading) return <p className={s.loading}>Loading settings...</p>
  if (error) return <p className={s.error} role="alert">{error.message}</p>
  if (!tenant || !form) return <p className={s.empty}>Tenant not found</p>

  return (
    <>
      <header className={styles.header}>
        <button className={`${s.btn} ${s.btnSecondary}`} onClick={() => navigate(`/tenants/${id}`)}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to Tenant
        </button>
        <section>
          <h2 className={styles.title}>Settings — {tenant.name}</h2>
          <p className={styles.subtitle}>{tenant.slug} · {tenant.domain}</p>
        </section>
      </header>

      <form className={styles.grid} onSubmit={handleSave}>
        {/* Overview (read-only) */}
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Overview</h3>
          <section className={styles.infoGrid}>
            <section className={styles.infoItem}>
              <span className={styles.label}>Slug</span>
              <span className={styles.value}>{tenant.slug}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.label}>Domain</span>
              <span className={styles.value}>{tenant.domain}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.label}>Created</span>
              <span className={styles.value}>{new Date(tenant.created_at).toLocaleString()}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.label}>Last Updated</span>
              <span className={styles.value}>{new Date(tenant.updated_at).toLocaleString()}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.label}>Extensions</span>
              <span className={styles.value}>{tenant.extension_count || 0} / {tenant.max_extensions}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.label}>Status</span>
              <span className={styles.value}>
                <StatusBadge status={tenant.is_active ? 'active' : 'inactive'} />
              </span>
            </section>
          </section>
        </article>

        {/* Editable Configuration */}
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Configuration</h3>
          <section className={styles.formGrid}>
            <fieldset className={s.field}>
              <label className={s.fieldLabel} htmlFor="settings-name">Display Name</label>
              <input id="settings-name" className={s.fieldInput} required
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)} />
            </fieldset>
            <fieldset className={s.field}>
              <label className={s.fieldLabel} htmlFor="settings-max-ext">Max Extensions</label>
              <input id="settings-max-ext" className={s.fieldInput} type="number"
                min={1} max={1000} value={form.max_extensions}
                onChange={(e) => handleChange('max_extensions', +e.target.value)} />
            </fieldset>
            <fieldset className={s.field}>
              <label className={s.fieldLabel} htmlFor="settings-max-calls">Max Concurrent Calls</label>
              <input id="settings-max-calls" className={s.fieldInput} type="number"
                min={1} max={500} value={form.max_concurrent_calls}
                onChange={(e) => handleChange('max_concurrent_calls', +e.target.value)} />
            </fieldset>
            <fieldset className={s.field}>
              <label className={s.fieldLabel} htmlFor="settings-codecs">Codecs</label>
              <input id="settings-codecs" className={s.fieldInput}
                value={form.codecs} placeholder="ulaw,alaw"
                onChange={(e) => handleChange('codecs', e.target.value)} />
            </fieldset>
            <fieldset className={s.field}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={form.is_active}
                  onChange={(e) => handleChange('is_active', e.target.checked)} />
                <span>Tenant Active</span>
              </label>
            </fieldset>
            <fieldset className={s.field}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={form.allow_international}
                  onChange={(e) => handleChange('allow_international', e.target.checked)} />
                <span>Allow International Calls</span>
              </label>
            </fieldset>
          </section>
        </article>

        {/* Save Button */}
        <footer className={styles.actions}>
          <button type="submit" className={`${s.btn} ${s.btnPrimary}`}
            disabled={!dirty || updateMutation.isPending}>
            <Save size={16} aria-hidden="true" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </footer>
      </form>
    </>
  )
}
