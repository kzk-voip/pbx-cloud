import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Trash2, Settings } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import toast from 'react-hot-toast'
import client from '../../api/client'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import s from '../shared.module.css'

export default function Tenants() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    slug: '', domain: '', name: '',
    max_extensions: 10, max_concurrent_calls: 5,
    codecs: 'ulaw,alaw', allow_international: false,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => client.get('/tenants').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (payload) => client.post('/tenants', payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setDialogOpen(false)
      resetForm()
      toast.success(t('tenants.createdSuccess'))
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || t('tenants.createFailed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => client.delete(`/tenants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      toast.success(t('tenants.deletedSuccess'))
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || t('tenants.deleteFailed'))
    },
  })

  const resetForm = () => {
    setForm({
      slug: '', domain: '', name: '',
      max_extensions: 10, max_concurrent_calls: 5,
      codecs: 'ulaw,alaw', allow_international: false,
    })
  }

  const handleCreate = (e) => {
    e.preventDefault()
    createMutation.mutate(form)
  }

  const handleDelete = (id, name) => {
    if (window.confirm(t('tenants.confirmDelete', { name }))) {
      deleteMutation.mutate(id)
    }
  }

  const items = data?.items?.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase()) ||
    t.domain.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <>
      <section className={s.toolbar}>
        <fieldset className={s.searchGroup}>
          <Search size={16} aria-hidden="true" />
          <input
            className={s.searchInput}
            placeholder={t('tenants.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="tenant-search"
          />
        </fieldset>
        <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Trigger asChild>
            <button className={`${s.btn} ${s.btnPrimary}`} id="create-tenant-btn">
              <Plus size={16} aria-hidden="true" /> {t('tenants.addTenant')}
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className={s.dialogOverlay} />
            <Dialog.Content className={s.dialogContent}>
              <Dialog.Title className={s.dialogTitle}>{t('tenants.create')}</Dialog.Title>
              <form className={s.dialogForm} onSubmit={handleCreate}>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="tenant-slug">{t('tenants.slug')}</label>
                  <input id="tenant-slug" className={s.fieldInput} placeholder={t('tenants.placeholderSlug')} required
                    value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
                </fieldset>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="tenant-domain">{t('tenants.domain')}</label>
                  <input id="tenant-domain" className={s.fieldInput} placeholder={t('tenants.placeholderDomain')} required
                    value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} />
                </fieldset>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="tenant-name">{t('tenants.name')}</label>
                  <input id="tenant-name" className={s.fieldInput} placeholder={t('tenants.placeholderName')} required
                    value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </fieldset>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="tenant-max-ext">{t('settings.maxExtensions')}</label>
                  <input id="tenant-max-ext" className={s.fieldInput} type="number" min={1} max={1000}
                    value={form.max_extensions} onChange={(e) => setForm((f) => ({ ...f, max_extensions: +e.target.value }))} />
                </fieldset>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="tenant-max-calls">{t('settings.maxConcurrentCalls')}</label>
                  <input id="tenant-max-calls" className={s.fieldInput} type="number" min={1} max={500}
                    value={form.max_concurrent_calls} onChange={(e) => setForm((f) => ({ ...f, max_concurrent_calls: +e.target.value }))} />
                </fieldset>
                <footer className={s.dialogActions}>
                  <Dialog.Close asChild>
                    <button type="button" className={`${s.btn} ${s.btnSecondary}`}>{t('tenants.cancel')}</button>
                  </Dialog.Close>
                  <button type="submit" className={`${s.btn} ${s.btnPrimary}`}
                    disabled={createMutation.isPending}>
                    {createMutation.isPending ? t('tenants.creating') : t('tenants.createBtn')}
                  </button>
                </footer>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </section>

      {error && <p className={s.error} role="alert">{error.message}</p>}

      {isLoading ? (
        <p className={s.loading}>{t('tenants.loading')}</p>
      ) : (
        <article className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('tenants.name')}</th>
                <th>{t('tenants.slug')}</th>
                <th>{t('tenants.domain')}</th>
                <th>{t('tenants.extensions')}</th>
                <th>{t('tenants.maxCalls')}</th>
                <th>{t('tenants.status')}</th>
                <th>{t('tenants.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? items.map((t) => (
                <tr key={t.id} className={s.clickableRow}
                  onClick={() => navigate(`/tenants/${t.id}`)}>
                  <td>{t.name}</td>
                  <td>{t.slug}</td>
                  <td>{t.domain}</td>
                  <td>{t.extension_count || 0}</td>
                  <td>{t.max_concurrent_calls}</td>
                  <td><StatusBadge status={t.is_active ? 'active' : 'inactive'} /></td>
                  <td>
                    <section style={{ display: 'flex', gap: 'var(--space-1)' }}>
                      <button className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                        onClick={(e) => { e.stopPropagation(); navigate(`/tenants/${t.id}/settings`) }}
                        aria-label={t('tenants.settings')}>
                        <Settings size={14} aria-hidden="true" />
                      </button>
                      <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                        onClick={(e) => { e.stopPropagation(); handleDelete(t.id, t.name) }}
                        aria-label={t('tenants.deleteTenant')}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </section>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className={s.empty}>{t('tenants.noTenants')}</td></tr>
              )}
            </tbody>
          </table>
        </article>
      )}
    </>
  )
}
