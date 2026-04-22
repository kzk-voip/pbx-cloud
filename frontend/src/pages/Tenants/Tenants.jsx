import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Edit } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import toast from 'react-hot-toast'
import client from '../../api/client'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import s from '../shared.module.css'

export default function Tenants() {
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
      toast.success('Tenant created successfully')
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to create tenant')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => client.delete(`/tenants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      toast.success('Tenant deleted')
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to delete tenant')
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
    if (window.confirm(`Delete tenant "${name}"? This cannot be undone.`)) {
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
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="tenant-search"
          />
        </fieldset>
        <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Trigger asChild>
            <button className={`${s.btn} ${s.btnPrimary}`} id="create-tenant-btn">
              <Plus size={16} aria-hidden="true" /> Add Tenant
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className={s.dialogOverlay} />
            <Dialog.Content className={s.dialogContent}>
              <Dialog.Title className={s.dialogTitle}>Create Tenant</Dialog.Title>
              <form className={s.dialogForm} onSubmit={handleCreate}>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="tenant-slug">Slug</label>
                  <input id="tenant-slug" className={s.fieldInput} placeholder="acme" required
                    value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
                </fieldset>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="tenant-domain">Domain</label>
                  <input id="tenant-domain" className={s.fieldInput} placeholder="acme.pbx.local" required
                    value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} />
                </fieldset>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="tenant-name">Name</label>
                  <input id="tenant-name" className={s.fieldInput} placeholder="Acme Corp" required
                    value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </fieldset>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="tenant-max-ext">Max Extensions</label>
                  <input id="tenant-max-ext" className={s.fieldInput} type="number" min={1} max={1000}
                    value={form.max_extensions} onChange={(e) => setForm((f) => ({ ...f, max_extensions: +e.target.value }))} />
                </fieldset>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="tenant-max-calls">Max Concurrent Calls</label>
                  <input id="tenant-max-calls" className={s.fieldInput} type="number" min={1} max={500}
                    value={form.max_concurrent_calls} onChange={(e) => setForm((f) => ({ ...f, max_concurrent_calls: +e.target.value }))} />
                </fieldset>
                <footer className={s.dialogActions}>
                  <Dialog.Close asChild>
                    <button type="button" className={`${s.btn} ${s.btnSecondary}`}>Cancel</button>
                  </Dialog.Close>
                  <button type="submit" className={`${s.btn} ${s.btnPrimary}`}
                    disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create'}
                  </button>
                </footer>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </section>

      {error && <p className={s.error} role="alert">{error.message}</p>}

      {isLoading ? (
        <p className={s.loading}>Loading tenants...</p>
      ) : (
        <article className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Domain</th>
                <th>Extensions</th>
                <th>Max Calls</th>
                <th>Status</th>
                <th>Actions</th>
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
                    <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                      onClick={(e) => { e.stopPropagation(); handleDelete(t.id, t.name) }}
                      aria-label={`Delete tenant ${t.name}`}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className={s.empty}>No tenants found</td></tr>
              )}
            </tbody>
          </table>
        </article>
      )}
    </>
  )
}
