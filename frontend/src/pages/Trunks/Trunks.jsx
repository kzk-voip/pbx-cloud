import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import toast from 'react-hot-toast'
import client from '../../api/client'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import s from '../shared.module.css'

export default function Trunks() {
  const queryClient = useQueryClient()
  const [selectedTenant, setSelectedTenant] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    name: '', provider: '', host: '', port: 5060,
    transport: 'udp', codecs: 'ulaw,alaw', max_channels: 10,
  })

  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => client.get('/tenants').then((r) => r.data),
  })

  const { data: trunks, isLoading } = useQuery({
    queryKey: ['trunks', selectedTenant],
    queryFn: () => client.get(`/tenants/${selectedTenant}/trunks`).then((r) => r.data),
    enabled: !!selectedTenant,
  })

  const createMutation = useMutation({
    mutationFn: (payload) =>
      client.post(`/tenants/${selectedTenant}/trunks`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trunks', selectedTenant] })
      setDialogOpen(false)
      toast.success('Trunk created')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (trunkId) => client.delete(`/tenants/${selectedTenant}/trunks/${trunkId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trunks', selectedTenant] })
      toast.success('Trunk deleted')
    },
  })

  if (!selectedTenant && tenants?.items?.length > 0) {
    setSelectedTenant(tenants.items[0].id)
  }

  const handleCreate = (e) => {
    e.preventDefault()
    createMutation.mutate(form)
  }

  return (
    <>
      <section className={s.toolbar}>
        <fieldset className={s.searchGroup}>
          <label htmlFor="trunk-tenant-select" className="sr-only">Select Tenant</label>
          <select id="trunk-tenant-select" className={s.fieldInput} style={{ height: 40 }}
            value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)}>
            <option value="">Select tenant...</option>
            {tenants?.items?.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
            ))}
          </select>
        </fieldset>

        <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Trigger asChild>
            <button className={`${s.btn} ${s.btnPrimary}`} disabled={!selectedTenant}
              id="create-trunk-btn">
              <Plus size={16} aria-hidden="true" /> Add Trunk
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className={s.dialogOverlay} />
            <Dialog.Content className={s.dialogContent}>
              <Dialog.Title className={s.dialogTitle}>Create SIP Trunk</Dialog.Title>
              <form className={s.dialogForm} onSubmit={handleCreate}>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="trunk-name">Name</label>
                  <input id="trunk-name" className={s.fieldInput} required value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </fieldset>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="trunk-provider">Provider</label>
                  <input id="trunk-provider" className={s.fieldInput} value={form.provider}
                    onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} />
                </fieldset>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="trunk-host">Host</label>
                  <input id="trunk-host" className={s.fieldInput} required value={form.host}
                    placeholder="sip.provider.com"
                    onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} />
                </fieldset>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="trunk-port">Port</label>
                  <input id="trunk-port" className={s.fieldInput} type="number" value={form.port}
                    onChange={(e) => setForm((f) => ({ ...f, port: +e.target.value }))} />
                </fieldset>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="trunk-transport">Transport</label>
                  <select id="trunk-transport" className={s.fieldInput} value={form.transport}
                    onChange={(e) => setForm((f) => ({ ...f, transport: e.target.value }))}>
                    <option value="udp">UDP</option>
                    <option value="tcp">TCP</option>
                    <option value="tls">TLS</option>
                  </select>
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

      {!selectedTenant ? (
        <p className={s.empty}>Select a tenant to view trunks</p>
      ) : isLoading ? (
        <p className={s.loading}>Loading trunks...</p>
      ) : (
        <article className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Provider</th>
                <th>Host</th>
                <th>Transport</th>
                <th>Channels</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trunks?.items?.length > 0 ? trunks.items.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.provider || '—'}</td>
                  <td>{t.host}:{t.port}</td>
                  <td>{t.transport.toUpperCase()}</td>
                  <td>{t.max_channels}</td>
                  <td><StatusBadge status={t.enabled ? 'active' : 'inactive'} /></td>
                  <td>
                    <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                      onClick={() => { if (confirm(`Delete trunk "${t.name}"?`)) deleteMutation.mutate(t.id) }}
                      aria-label={`Delete trunk ${t.name}`}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className={s.empty}>No trunks found</td></tr>
              )}
            </tbody>
          </table>
        </article>
      )}
    </>
  )
}
