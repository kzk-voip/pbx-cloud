import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, KeyRound, Edit, Eye, EyeOff, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import * as Dialog from '@radix-ui/react-dialog'
import toast from 'react-hot-toast'
import client from '../../api/client'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import s from '../shared.module.css'
import styles from './TenantDetails.module.css'

const EMPTY_EXT_FORM = { extension_number: '', display_name: '', email: '' }
const EMPTY_EXT_EDIT_FORM = { extension_number: '', display_name: '', email: '', enabled: true, password: '' }
const EMPTY_TRUNK_FORM = {
  name: '', provider: '', host: '', port: 5060,
  transport: 'udp', codecs: 'ulaw,alaw', max_channels: 10,
  username: '', password: '',
}

export default function TenantDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // --- Extension state ---
  const [extDialogOpen, setExtDialogOpen] = useState(false)
  const [extForm, setExtForm] = useState(EMPTY_EXT_FORM)
  const [credentials, setCredentials] = useState(null)
  const [extEditDialogOpen, setExtEditDialogOpen] = useState(false)
  const [extEditForm, setExtEditForm] = useState(EMPTY_EXT_EDIT_FORM)
  const [editingExtId, setEditingExtId] = useState(null)
  const [showExtPassword, setShowExtPassword] = useState(false)
  const [originalExtPassword, setOriginalExtPassword] = useState('')

  // --- Trunk state ---
  const [trunkDialogOpen, setTrunkDialogOpen] = useState(false)
  const [trunkForm, setTrunkForm] = useState(EMPTY_TRUNK_FORM)
  const [editingTrunkId, setEditingTrunkId] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  // --- Events state ---
  const [eventsPage, setEventsPage] = useState(1)
  const [eventsFilter, setEventsFilter] = useState('')

  // ==================== Queries ====================

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => client.get(`/tenants/${id}`).then((r) => r.data),
  })

  const { data: extensions } = useQuery({
    queryKey: ['extensions', id],
    queryFn: () => client.get(`/tenants/${id}/extensions`).then((r) => r.data),
    enabled: !!id,
  })

  const { data: trunks } = useQuery({
    queryKey: ['trunks', id],
    queryFn: () => client.get(`/tenants/${id}/trunks`).then((r) => r.data),
    enabled: !!id,
  })

  const { data: events } = useQuery({
    queryKey: ['events', id, eventsPage, eventsFilter],
    queryFn: () => client.get(`/tenants/${id}/events`, {
      params: { page: eventsPage, per_page: 20, ...(eventsFilter ? { action: eventsFilter } : {}) },
    }).then((r) => r.data),
    enabled: !!id,
  })

  // ==================== Extension Mutations ====================

  const createExtMutation = useMutation({
    mutationFn: (payload) =>
      client.post(`/tenants/${id}/extensions`, payload).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['extensions', id] })
      queryClient.invalidateQueries({ queryKey: ['events', id] })
      setCredentials(data)
      setExtForm(EMPTY_EXT_FORM)
      toast.success('Extension created')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to create extension'),
  })

  const deleteExtMutation = useMutation({
    mutationFn: (extId) => client.delete(`/tenants/${id}/extensions/${extId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions', id] })
      queryClient.invalidateQueries({ queryKey: ['events', id] })
      toast.success('Extension deleted')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to delete extension'),
  })

  const updateExtMutation = useMutation({
    mutationFn: ({ extId, payload }) =>
      client.put(`/tenants/${id}/extensions/${extId}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions', id] })
      queryClient.invalidateQueries({ queryKey: ['events', id] })
      closeExtEditDialog()
      toast.success('Extension updated')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to update extension'),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (extId) =>
      client.post(`/tenants/${id}/extensions/${extId}/reset-password`).then((r) => r.data),
    onSuccess: (data) => {
      setCredentials(data)
      setExtDialogOpen(true)
      toast.success('Password reset')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to reset password'),
  })

  // ==================== Trunk Mutations ====================

  const createTrunkMutation = useMutation({
    mutationFn: (payload) =>
      client.post(`/tenants/${id}/trunks`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trunks', id] })
      queryClient.invalidateQueries({ queryKey: ['events', id] })
      closeTrunkDialog()
      toast.success('Trunk created')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to create trunk'),
  })

  const updateTrunkMutation = useMutation({
    mutationFn: ({ trunkId, payload }) =>
      client.put(`/tenants/${id}/trunks/${trunkId}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trunks', id] })
      closeTrunkDialog()
      toast.success('Trunk updated')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to update trunk'),
  })

  const deleteTrunkMutation = useMutation({
    mutationFn: (trunkId) => client.delete(`/tenants/${id}/trunks/${trunkId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trunks', id] })
      queryClient.invalidateQueries({ queryKey: ['events', id] })
      toast.success('Trunk deleted')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to delete trunk'),
  })

  // ==================== Handlers ====================

  const handleCreateExtension = (e) => {
    e.preventDefault()
    setCredentials(null)
    createExtMutation.mutate(extForm)
  }

  const handleUpdateExtension = (e) => {
    e.preventDefault()
    const payload = { ...extEditForm }
    // Only send password if it was actually changed
    if (payload.password === originalExtPassword) delete payload.password
    if (!payload.password) delete payload.password
    updateExtMutation.mutate({ extId: editingExtId, payload })
  }

  const openEditExtension = (ext) => {
    setEditingExtId(ext.id)
    const pw = ext.sip_password || ''
    setOriginalExtPassword(pw)
    setExtEditForm({
      extension_number: ext.extension_number,
      display_name: ext.display_name || '',
      email: ext.email || '',
      enabled: ext.enabled,
      password: pw,
    })
    setShowExtPassword(false)
    setExtEditDialogOpen(true)
  }

  const closeExtEditDialog = () => {
    setExtEditDialogOpen(false)
    setEditingExtId(null)
    setExtEditForm(EMPTY_EXT_EDIT_FORM)
    setShowExtPassword(false)
  }

  const handleSubmitTrunk = (e) => {
    e.preventDefault()
    const payload = {
      ...trunkForm,
      username: trunkForm.username || null,
      password: trunkForm.password || null,
    }
    if (editingTrunkId) {
      updateTrunkMutation.mutate({ trunkId: editingTrunkId, payload })
    } else {
      createTrunkMutation.mutate(payload)
    }
  }

  const openEditTrunk = (trunk) => {
    setEditingTrunkId(trunk.id)
    setTrunkForm({
      name: trunk.name,
      provider: trunk.provider || '',
      host: trunk.host,
      port: trunk.port,
      transport: trunk.transport,
      codecs: trunk.codecs,
      max_channels: trunk.max_channels,
      username: trunk.username || '',
      password: '',
    })
    setShowPassword(false)
    setTrunkDialogOpen(true)
  }

  const openCreateTrunk = () => {
    setEditingTrunkId(null)
    setTrunkForm(EMPTY_TRUNK_FORM)
    setShowPassword(false)
    setTrunkDialogOpen(true)
  }

  const closeTrunkDialog = () => {
    setTrunkDialogOpen(false)
    setEditingTrunkId(null)
    setTrunkForm(EMPTY_TRUNK_FORM)
  }

  // ==================== Render ====================

  if (isLoading) return <p className={s.loading}>Loading tenant...</p>
  if (error) return <p className={s.error}>{error.message}</p>
  if (!tenant) return <p className={s.empty}>Tenant not found</p>

  const isTrunkPending = createTrunkMutation.isPending || updateTrunkMutation.isPending

  return (
    <>
      <header className={styles.header}>
        <button className={`${s.btn} ${s.btnSecondary}`} onClick={() => navigate('/tenants')}>
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </button>
        <section>
          <h2 className={styles.tenantName}>{tenant.name}</h2>
          <p className={styles.tenantDomain}>{tenant.domain}</p>
        </section>
        <StatusBadge status={tenant.is_active ? 'active' : 'inactive'} />
        <button className={`${s.btn} ${s.btnSecondary}`}
          onClick={() => navigate(`/tenants/${id}/settings`)}
          style={{ marginLeft: 'auto' }}>
          <Settings size={16} aria-hidden="true" /> Settings
        </button>
      </header>

      <Tabs.Root defaultValue="info" className={styles.tabs}>
        <Tabs.List className={styles.tabsList} aria-label="Tenant details">
          <Tabs.Trigger className={styles.tabsTrigger} value="info">Info</Tabs.Trigger>
          <Tabs.Trigger className={styles.tabsTrigger} value="extensions">
            Extensions ({extensions?.items?.length || 0})
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tabsTrigger} value="trunks">
            Trunks ({trunks?.items?.length || 0})
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tabsTrigger} value="events">
            Events
          </Tabs.Trigger>
        </Tabs.List>

        {/* ==================== INFO TAB ==================== */}
        <Tabs.Content className={styles.tabsContent} value="info">
          <article className={styles.infoGrid}>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>Slug</span>
              <span className={styles.infoValue}>{tenant.slug}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>Domain</span>
              <span className={styles.infoValue}>{tenant.domain}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>Max Extensions</span>
              <span className={styles.infoValue}>{tenant.max_extensions}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>Max Concurrent Calls</span>
              <span className={styles.infoValue}>{tenant.max_concurrent_calls}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>Codecs</span>
              <span className={styles.infoValue}>{tenant.codecs}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>International Calls</span>
              <span className={styles.infoValue}>
                <StatusBadge status={tenant.allow_international ? 'active' : 'inactive'}
                  label={tenant.allow_international ? 'Allowed' : 'Blocked'} />
              </span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>Created</span>
              <span className={styles.infoValue}>{new Date(tenant.created_at).toLocaleString()}</span>
            </section>
          </article>
        </Tabs.Content>

        {/* ==================== EXTENSIONS TAB ==================== */}
        <Tabs.Content className={styles.tabsContent} value="extensions">
          <section className={styles.tabToolbar}>
            <Dialog.Root open={extDialogOpen} onOpenChange={(open) => { setExtDialogOpen(open); if (!open) setCredentials(null) }}>
              <Dialog.Trigger asChild>
                <button className={`${s.btn} ${s.btnPrimary}`} id="create-extension-btn">
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
                    <form className={s.dialogForm} onSubmit={handleCreateExtension}>
                      <fieldset className={s.field}>
                        <label className={s.fieldLabel} htmlFor="ext-number">Extension Number</label>
                        <input id="ext-number" className={s.fieldInput} placeholder="101" required
                          pattern="^\d+$" value={extForm.extension_number}
                          onChange={(e) => setExtForm((f) => ({ ...f, extension_number: e.target.value }))} />
                      </fieldset>
                      <fieldset className={s.field}>
                        <label className={s.fieldLabel} htmlFor="ext-name">Display Name</label>
                        <input id="ext-name" className={s.fieldInput} placeholder="John Doe" required
                          value={extForm.display_name}
                          onChange={(e) => setExtForm((f) => ({ ...f, display_name: e.target.value }))} />
                      </fieldset>
                      <fieldset className={s.field}>
                        <label className={s.fieldLabel} htmlFor="ext-email">Email (optional)</label>
                        <input id="ext-email" className={s.fieldInput} type="email" placeholder="john@example.com"
                          value={extForm.email}
                          onChange={(e) => setExtForm((f) => ({ ...f, email: e.target.value }))} />
                      </fieldset>
                      <footer className={s.dialogActions}>
                        <Dialog.Close asChild>
                          <button type="button" className={`${s.btn} ${s.btnSecondary}`}>Cancel</button>
                        </Dialog.Close>
                        <button type="submit" className={`${s.btn} ${s.btnPrimary}`}
                          disabled={createExtMutation.isPending}>
                          {createExtMutation.isPending ? 'Creating...' : 'Create'}
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
                    <td>
                      <section className={styles.actionBtns}>
                        <button className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                          onClick={() => openEditExtension(ext)}
                          aria-label={`Edit extension ${ext.extension_number}`}>
                          <Edit size={14} aria-hidden="true" />
                        </button>
                        <button className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                          onClick={() => resetPasswordMutation.mutate(ext.id)}
                          aria-label={`Reset password for ${ext.extension_number}`}>
                          <KeyRound size={14} aria-hidden="true" />
                        </button>
                        <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                          onClick={() => {
                            if (window.confirm(`Delete extension ${ext.extension_number}?`)) deleteExtMutation.mutate(ext.id)
                          }}
                          aria-label={`Delete extension ${ext.extension_number}`}>
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </section>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className={s.empty}>No extensions</td></tr>
                )}
              </tbody>
            </table>
          </article>

          {/* Edit Extension Dialog */}
          <Dialog.Root open={extEditDialogOpen} onOpenChange={(open) => { if (!open) closeExtEditDialog() }}>
            <Dialog.Portal>
              <Dialog.Overlay className={s.dialogOverlay} />
              <Dialog.Content className={s.dialogContent}>
                <Dialog.Title className={s.dialogTitle}>Edit Extension</Dialog.Title>
                <form className={s.dialogForm} onSubmit={handleUpdateExtension}>
                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="ext-edit-number">Extension Number</label>
                    <input id="ext-edit-number" className={s.fieldInput} required
                      pattern="^\d+$" value={extEditForm.extension_number}
                      onChange={(e) => setExtEditForm((f) => ({ ...f, extension_number: e.target.value }))} />
                  </fieldset>
                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="ext-edit-name">Display Name</label>
                    <input id="ext-edit-name" className={s.fieldInput} required
                      value={extEditForm.display_name}
                      onChange={(e) => setExtEditForm((f) => ({ ...f, display_name: e.target.value }))} />
                  </fieldset>
                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="ext-edit-email">Email</label>
                    <input id="ext-edit-email" className={s.fieldInput} type="email"
                      value={extEditForm.email}
                      onChange={(e) => setExtEditForm((f) => ({ ...f, email: e.target.value }))} />
                  </fieldset>
                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="ext-edit-password">SIP Password</label>
                    <section className={styles.passwordField}>
                      <input id="ext-edit-password" className={s.fieldInput}
                        type={showExtPassword ? 'text' : 'password'}
                        minLength={8}
                        value={extEditForm.password}
                        onChange={(e) => setExtEditForm((f) => ({ ...f, password: e.target.value }))} />
                      <button type="button" className={styles.passwordToggle}
                        onClick={() => setShowExtPassword((v) => !v)}
                        aria-label={showExtPassword ? 'Hide password' : 'Show password'}>
                        {showExtPassword
                          ? <EyeOff size={16} aria-hidden="true" />
                          : <Eye size={16} aria-hidden="true" />}
                      </button>
                    </section>
                  </fieldset>
                  <fieldset className={s.field}>
                    <label className={styles.checkboxLabel}>
                      <input type="checkbox" checked={extEditForm.enabled}
                        onChange={(e) => setExtEditForm((f) => ({ ...f, enabled: e.target.checked }))} />
                      <span>Enabled</span>
                    </label>
                  </fieldset>
                  <footer className={s.dialogActions}>
                    <Dialog.Close asChild>
                      <button type="button" className={`${s.btn} ${s.btnSecondary}`}>Cancel</button>
                    </Dialog.Close>
                    <button type="submit" className={`${s.btn} ${s.btnPrimary}`}
                      disabled={updateExtMutation.isPending}>
                      {updateExtMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                  </footer>
                </form>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </Tabs.Content>

        {/* ==================== TRUNKS TAB ==================== */}
        <Tabs.Content className={styles.tabsContent} value="trunks">
          <section className={styles.tabToolbar}>
            <Dialog.Root open={trunkDialogOpen} onOpenChange={(open) => { if (!open) closeTrunkDialog(); else setTrunkDialogOpen(true) }}>
              <Dialog.Trigger asChild>
                <button className={`${s.btn} ${s.btnPrimary}`} onClick={openCreateTrunk}
                  id="create-trunk-btn">
                  <Plus size={16} aria-hidden="true" /> Add Trunk
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className={s.dialogOverlay} />
                <Dialog.Content className={s.dialogContent}>
                  <Dialog.Title className={s.dialogTitle}>
                    {editingTrunkId ? 'Edit SIP Trunk' : 'Create SIP Trunk'}
                  </Dialog.Title>
                  <form className={s.dialogForm} onSubmit={handleSubmitTrunk}>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="trunk-name">Name</label>
                      <input id="trunk-name" className={s.fieldInput} required value={trunkForm.name}
                        onChange={(e) => setTrunkForm((f) => ({ ...f, name: e.target.value }))} />
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="trunk-provider">Provider</label>
                      <input id="trunk-provider" className={s.fieldInput} value={trunkForm.provider}
                        onChange={(e) => setTrunkForm((f) => ({ ...f, provider: e.target.value }))} />
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="trunk-host">Host</label>
                      <input id="trunk-host" className={s.fieldInput} required value={trunkForm.host}
                        placeholder="sip.provider.com"
                        onChange={(e) => setTrunkForm((f) => ({ ...f, host: e.target.value }))} />
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="trunk-port">Port</label>
                      <input id="trunk-port" className={s.fieldInput} type="number" value={trunkForm.port}
                        onChange={(e) => setTrunkForm((f) => ({ ...f, port: +e.target.value }))} />
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="trunk-transport">Transport</label>
                      <select id="trunk-transport" className={s.fieldInput} value={trunkForm.transport}
                        onChange={(e) => setTrunkForm((f) => ({ ...f, transport: e.target.value }))}>
                        <option value="udp">UDP</option>
                        <option value="tcp">TCP</option>
                        <option value="tls">TLS</option>
                      </select>
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="trunk-username">Username (optional)</label>
                      <input id="trunk-username" className={s.fieldInput} value={trunkForm.username}
                        placeholder="SIP auth username"
                        onChange={(e) => setTrunkForm((f) => ({ ...f, username: e.target.value }))} />
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="trunk-password">Password (optional)</label>
                      <section className={styles.passwordField}>
                        <input id="trunk-password" className={s.fieldInput}
                          type={showPassword ? 'text' : 'password'}
                          value={trunkForm.password}
                          placeholder={editingTrunkId ? 'Leave empty to keep current' : 'SIP auth password'}
                          onChange={(e) => setTrunkForm((f) => ({ ...f, password: e.target.value }))} />
                        <button type="button" className={styles.passwordToggle}
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}>
                          {showPassword
                            ? <EyeOff size={16} aria-hidden="true" />
                            : <Eye size={16} aria-hidden="true" />}
                        </button>
                      </section>
                    </fieldset>
                    <footer className={s.dialogActions}>
                      <Dialog.Close asChild>
                        <button type="button" className={`${s.btn} ${s.btnSecondary}`}>Cancel</button>
                      </Dialog.Close>
                      <button type="submit" className={`${s.btn} ${s.btnPrimary}`}
                        disabled={isTrunkPending}>
                        {isTrunkPending ? 'Saving...' : (editingTrunkId ? 'Save' : 'Create')}
                      </button>
                    </footer>
                  </form>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </section>

          <article className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Provider</th>
                  <th>Host</th>
                  <th>Transport</th>
                  <th>Channels</th>
                  <th>Auth</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {trunks?.items?.length > 0 ? trunks.items.map((trunk) => (
                  <tr key={trunk.id}>
                    <td>{trunk.name}</td>
                    <td>{trunk.provider || '—'}</td>
                    <td>{trunk.host}:{trunk.port}</td>
                    <td>{trunk.transport.toUpperCase()}</td>
                    <td>{trunk.max_channels}</td>
                    <td>{trunk.username ? 'Login/Pass' : 'IP-based'}</td>
                    <td><StatusBadge status={trunk.enabled ? 'active' : 'inactive'} /></td>
                    <td>
                      <section className={styles.actionBtns}>
                        <button className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                          onClick={() => openEditTrunk(trunk)}
                          aria-label={`Edit trunk ${trunk.name}`}>
                          <Edit size={14} aria-hidden="true" />
                        </button>
                        <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                          onClick={() => {
                            if (window.confirm(`Delete trunk "${trunk.name}"?`)) deleteTrunkMutation.mutate(trunk.id)
                          }}
                          aria-label={`Delete trunk ${trunk.name}`}>
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </section>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} className={s.empty}>No trunks</td></tr>
                )}
              </tbody>
            </table>
          </article>
        </Tabs.Content>

        {/* ==================== EVENTS TAB ==================== */}
        <Tabs.Content className={styles.tabsContent} value="events">
          <section className={styles.tabToolbar}>
            <fieldset className={s.searchGroup}>
              <label htmlFor="event-filter" className="sr-only">Filter by action</label>
              <select id="event-filter" className={s.fieldInput} style={{ height: 40, minWidth: 180 }}
                value={eventsFilter} onChange={(e) => { setEventsFilter(e.target.value); setEventsPage(1) }}>
                <option value="">All actions</option>
                <option value="extension_created">Extension Created</option>
                <option value="extension_deleted">Extension Deleted</option>
                <option value="trunk_created">Trunk Created</option>
                <option value="trunk_deleted">Trunk Deleted</option>
                <option value="config_change">Config Change</option>
              </select>
            </fieldset>
          </section>

          <article className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Source</th>
                  <th>IP</th>
                  <th>Extension</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {events?.items?.length > 0 ? events.items.map((evt) => (
                  <tr key={evt.id}>
                    <td>{new Date(evt.created_at).toLocaleString()}</td>
                    <td><code>{evt.action}</code></td>
                    <td>{evt.source || '—'}</td>
                    <td>{evt.ip || '—'}</td>
                    <td>{evt.extension || '—'}</td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {evt.details ? JSON.stringify(evt.details) : '—'}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className={s.empty}>No events recorded</td></tr>
                )}
              </tbody>
            </table>

            {events && events.pages > 1 && (
              <footer className={s.pagination}>
                <span>Page {events.page} of {events.pages} ({events.total} events)</span>
                <section className={s.paginationBtns}>
                  <button className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                    disabled={eventsPage <= 1} onClick={() => setEventsPage((p) => p - 1)}
                    aria-label="Previous page">
                    <ChevronLeft size={14} aria-hidden="true" />
                  </button>
                  <button className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                    disabled={eventsPage >= events.pages} onClick={() => setEventsPage((p) => p + 1)}
                    aria-label="Next page">
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </section>
              </footer>
            )}
          </article>
        </Tabs.Content>
      </Tabs.Root>
    </>
  )
}
