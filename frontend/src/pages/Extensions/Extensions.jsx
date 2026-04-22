import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Trash2, KeyRound } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import toast from 'react-hot-toast'
import client from '../../api/client'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import s from '../shared.module.css'

export default function Extensions() {
  const queryClient = useQueryClient()
  const [selectedTenant, setSelectedTenant] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [credentials, setCredentials] = useState(null)
  const [form, setForm] = useState({ extension_number: '', display_name: '', email: '' })

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => client.get('/tenants').then((r) => r.data),
  })

  const { data: extensions, isLoading } = useQuery({
    queryKey: ['extensions', selectedTenant],
    queryFn: () => client.get(`/tenants/${selectedTenant}/extensions`).then((r) => r.data),
    enabled: !!selectedTenant,
  })

  const createMutation = useMutation({
    mutationFn: (payload) =>
      client.post(`/tenants/${selectedTenant}/extensions`, payload).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['extensions', selectedTenant] })
      setCredentials(data)
      setForm({ extension_number: '', display_name: '', email: '' })
      toast.success('Extension created')
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to create extension')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (extId) => client.delete(`/tenants/${selectedTenant}/extensions/${extId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions', selectedTenant] })
      toast.success('Extension deleted')
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (extId) =>
      client.post(`/tenants/${selectedTenant}/extensions/${extId}/reset-password`).then((r) => r.data),
    onSuccess: (data) => {
      setCredentials(data)
      setDialogOpen(true)
      toast.success('Password reset')
    },
  })

  const handleCreate = (e) => {
    e.preventDefault()
    setCredentials(null)
    createMutation.mutate(form)
  }

  // Auto-select first tenant
  if (!selectedTenant && tenants?.items?.length > 0) {
    setSelectedTenant(tenants.items[0].id)
  }

  return (
    <>
      <section className={s.toolbar}>
        <fieldset className={s.searchGroup}>
          <label htmlFor="ext-tenant-select" className="sr-only">Select Tenant</label>
          <select
            id="ext-tenant-select"
            className={s.fieldInput}
            style={{ height: 40 }}
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
          >
            <option value="">Select tenant...</option>
            {tenants?.items?.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
            ))}
          </select>
        </fieldset>

        <Dialog.Root open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setCredentials(null) }}>
          <Dialog.Trigger asChild>
            <button className={`${s.btn} ${s.btnPrimary}`} disabled={!selectedTenant}
              id="create-extension-btn">
              <Plus size={16} aria-hidden="true" /> Add Extension
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className={s.dialogOverlay} />
            <Dialog.Content className={s.dialogContent}>
              <Dialog.Title className={s.dialogTitle}>
                {credentials ? 'SIP Credentials' : 'Create Extension'}
              </Dialog.Title>

              {credentials ? (
                <article className={s.credentialsBox}>
                  <p><strong>SIP Username:</strong> {credentials.sip_username}</p>
                  <p><strong>SIP Password:</strong> {credentials.sip_password}</p>
                  <p><strong>SIP Domain:</strong> {credentials.sip_domain}</p>
                  <p><strong>Extension:</strong> {credentials.extension_number}</p>
                </article>
              ) : (
                <form className={s.dialogForm} onSubmit={handleCreate}>
                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="ext-number">Extension Number</label>
                    <input id="ext-number" className={s.fieldInput} placeholder="101" required
                      pattern="^\d+$" value={form.extension_number}
                      onChange={(e) => setForm((f) => ({ ...f, extension_number: e.target.value }))} />
                  </fieldset>
                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="ext-name">Display Name</label>
                    <input id="ext-name" className={s.fieldInput} placeholder="John Doe" required
                      value={form.display_name}
                      onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
                  </fieldset>
                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="ext-email">Email (optional)</label>
                    <input id="ext-email" className={s.fieldInput} type="email" placeholder="john@example.com"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
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
              )}

              {credentials && (
                <footer className={s.dialogActions}>
                  <Dialog.Close asChild>
                    <button className={`${s.btn} ${s.btnPrimary}`}>Close</button>
                  </Dialog.Close>
                </footer>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </section>

      {!selectedTenant ? (
        <p className={s.empty}>Select a tenant to view extensions</p>
      ) : isLoading ? (
        <p className={s.loading}>Loading extensions...</p>
      ) : (
        <article className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Extension</th>
                <th>Display Name</th>
                <th>SIP Username</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {extensions?.items?.length > 0 ? extensions.items.map((ext) => (
                <tr key={ext.id}>
                  <td>{ext.extension_number}</td>
                  <td>{ext.display_name || '—'}</td>
                  <td><code>{ext.sip_username}</code></td>
                  <td>{ext.email || '—'}</td>
                  <td><StatusBadge status={ext.enabled ? 'active' : 'inactive'} /></td>
                  <td style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <button className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                      onClick={() => resetPasswordMutation.mutate(ext.id)}
                      aria-label={`Reset password for ${ext.extension_number}`}>
                      <KeyRound size={14} aria-hidden="true" />
                    </button>
                    <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                      onClick={() => {
                        if (confirm(`Delete extension ${ext.extension_number}?`)) deleteMutation.mutate(ext.id)
                      }}
                      aria-label={`Delete extension ${ext.extension_number}`}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className={s.empty}>No extensions found</td></tr>
              )}
            </tbody>
          </table>
        </article>
      )}
    </>
  )
}
