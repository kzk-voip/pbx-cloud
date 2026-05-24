import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Trash2, KeyRound, Edit, Eye, EyeOff, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import * as Dialog from '@radix-ui/react-dialog'
import toast from 'react-hot-toast'
import client from '../../api/client'
import useAuthStore from '../../store/authStore'
import useTimezone from '../../hooks/useTimezone'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import TenantReports from './TenantReports'
import TenantInboundRules from './TenantInboundRules'
import TenantCallRoutes from './TenantCallRoutes'
import TenantIpAcl from './TenantIpAcl'
import s from '../shared.module.css'
import styles from './TenantDetails.module.css'

const EMPTY_EXT_FORM = { extension_number: '', display_name: '', email: '' }
const EMPTY_EXT_EDIT_FORM = { extension_number: '', display_name: '', email: '', enabled: true, password: '' }
const EMPTY_TRUNK_FORM = {
  name: '', provider: '', host: '', port: 5060,
  transport: 'udp', codecs: 'ulaw,alaw', max_channels: 10,
  username: '', password: '',
}
const EMPTY_USER_FORM = { username: '', password: '', role: 'user', extension_id: '', is_active: true }
const EMPTY_USER_EDIT_FORM = { username: '', password: '', role: 'user', extension_id: '', is_active: true }

export default function TenantDetails() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { formatDate } = useTimezone()
  const { user: currentUser } = useAuthStore()
  const isSuperAdmin = currentUser?.role === 'super_admin'

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

  // --- Users state ---
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM)
  const [userEditDialogOpen, setUserEditDialogOpen] = useState(false)
  const [userEditForm, setUserEditForm] = useState(EMPTY_USER_EDIT_FORM)
  const [editingUserId, setEditingUserId] = useState(null)

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

  const { data: users } = useQuery({
    queryKey: ['users', id],
    queryFn: () => client.get(`/tenants/${id}/users`).then((r) => r.data),
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
      toast.success(t('tenantDetails.extensions.createdSuccess'))
    },
    onError: (err) => toast.error(err.response?.data?.detail || t('tenantDetails.extensions.createdFailed')),
  })

  const deleteExtMutation = useMutation({
    mutationFn: (extId) => client.delete(`/tenants/${id}/extensions/${extId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions', id] })
      queryClient.invalidateQueries({ queryKey: ['events', id] })
      toast.success(t('tenantDetails.extensions.deletedSuccess'))
    },
    onError: (err) => toast.error(err.response?.data?.detail || t('tenantDetails.extensions.deletedFailed')),
  })

  const updateExtMutation = useMutation({
    mutationFn: ({ extId, payload }) =>
      client.put(`/tenants/${id}/extensions/${extId}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions', id] })
      queryClient.invalidateQueries({ queryKey: ['events', id] })
      closeExtEditDialog()
      toast.success(t('tenantDetails.extensions.updatedSuccess'))
    },
    onError: (err) => toast.error(err.response?.data?.detail || t('tenantDetails.extensions.updatedFailed')),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (extId) =>
      client.post(`/tenants/${id}/extensions/${extId}/reset-password`).then((r) => r.data),
    onSuccess: (data) => {
      setCredentials(data)
      setExtDialogOpen(true)
      toast.success(t('tenantDetails.extensions.resetSuccess'))
    },
    onError: (err) => toast.error(err.response?.data?.detail || t('tenantDetails.extensions.resetFailed')),
  })

  // ==================== Trunk Mutations ====================

  const createTrunkMutation = useMutation({
    mutationFn: (payload) =>
      client.post(`/tenants/${id}/trunks`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trunks', id] })
      queryClient.invalidateQueries({ queryKey: ['events', id] })
      closeTrunkDialog()
      toast.success(t('tenantDetails.trunks.createdSuccess'))
    },
    onError: (err) => toast.error(err.response?.data?.detail || t('tenantDetails.trunks.createdFailed')),
  })

  const updateTrunkMutation = useMutation({
    mutationFn: ({ trunkId, payload }) =>
      client.put(`/tenants/${id}/trunks/${trunkId}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trunks', id] })
      closeTrunkDialog()
      toast.success(t('tenantDetails.trunks.updatedSuccess'))
    },
    onError: (err) => toast.error(err.response?.data?.detail || t('tenantDetails.trunks.updatedFailed')),
  })

  const deleteTrunkMutation = useMutation({
    mutationFn: (trunkId) => client.delete(`/tenants/${id}/trunks/${trunkId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trunks', id] })
      queryClient.invalidateQueries({ queryKey: ['events', id] })
      toast.success(t('tenantDetails.trunks.deletedSuccess'))
    },
    onError: (err) => toast.error(err.response?.data?.detail || t('tenantDetails.trunks.deletedFailed')),
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

  // ==================== User Mutations ====================

  const createUserMutation = useMutation({
    mutationFn: (payload) =>
      client.post(`/tenants/${id}/users`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', id] })
      queryClient.invalidateQueries({ queryKey: ['events', id] })
      setUserForm(EMPTY_USER_FORM)
      setUserDialogOpen(false)
      toast.success(t('tenantDetails.users.createdSuccess'))
    },
    onError: (err) => toast.error(err.response?.data?.detail || t('tenantDetails.users.createdFailed')),
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }) =>
      client.put(`/tenants/${id}/users/${userId}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', id] })
      queryClient.invalidateQueries({ queryKey: ['events', id] })
      setUserEditDialogOpen(false)
      setEditingUserId(null)
      toast.success(t('tenantDetails.users.updatedSuccess'))
    },
    onError: (err) => toast.error(err.response?.data?.detail || t('tenantDetails.users.updatedFailed')),
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => client.delete(`/tenants/${id}/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', id] })
      queryClient.invalidateQueries({ queryKey: ['events', id] })
      toast.success(t('tenantDetails.users.deletedSuccess'))
    },
    onError: (err) => toast.error(err.response?.data?.detail || t('tenantDetails.users.deletedFailed')),
  })

  const handleCreateUser = (e) => {
    e.preventDefault()
    const payload = { ...userForm, extension_id: userForm.extension_id || null }
    createUserMutation.mutate(payload)
  }

  const handleUpdateUser = (e) => {
    e.preventDefault()
    const payload = { 
      ...userEditForm, 
      extension_id: userEditForm.extension_id || null,
      password: userEditForm.password || null 
    }
    updateUserMutation.mutate({ userId: editingUserId, payload })
  }

  const openEditUser = (u) => {
    setEditingUserId(u.id)
    setUserEditForm({
      username: u.username,
      password: '',
      role: u.role,
      extension_id: u.extension_id || '',
      is_active: u.is_active,
    })
    setUserEditDialogOpen(true)
  }

  // ==================== Render ====================

  if (isLoading) return <p className={s.loading}>{t('tenantDetails.loading')}</p>
  if (error) return <p className={s.error}>{error.message}</p>
  if (!tenant) return <p className={s.empty}>{t('tenantDetails.notFound')}</p>

  const isTrunkPending = createTrunkMutation.isPending || updateTrunkMutation.isPending

  return (
    <>
      <header className={styles.header}>
        <button className={`${s.btn} ${s.btnSecondary}`} onClick={() => navigate('/tenants')}>
          <ArrowLeft size={16} aria-hidden="true" /> {t('tenantDetails.back')}
        </button>
        <section>
          <h2 className={styles.tenantName}>{tenant.name}</h2>
          <p className={styles.tenantDomain}>{tenant.domain}</p>
        </section>
        <StatusBadge status={tenant.is_active ? 'active' : 'inactive'} />
        <button className={`${s.btn} ${s.btnSecondary}`}
          onClick={() => navigate(`/tenants/${id}/settings`)}
          style={{ marginLeft: 'auto' }}>
          <Settings size={16} aria-hidden="true" /> {t('tenantDetails.settings')}
        </button>
      </header>

      <Tabs.Root defaultValue="info" className={styles.tabs}>
        <Tabs.List className={styles.tabsList} aria-label={t('tenantDetails.tabs.title', 'Tenant details')}>
          <Tabs.Trigger className={styles.tabsTrigger} value="info" id="tab-info">
            {t('tenantDetails.tabs.info')}
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tabsTrigger} value="extensions" id="tab-extensions">
            {t('tenantDetails.tabs.extensions')} ({extensions?.items?.length || 0})
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tabsTrigger} value="trunks" id="tab-trunks">
            {t('tenantDetails.tabs.trunks')} ({trunks?.items?.length || 0})
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tabsTrigger} value="events" id="tab-events">
            {t('tenantDetails.tabs.events')}
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tabsTrigger} value="reports" id="tab-reports">
            {t('tenantDetails.tabs.reports')}
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tabsTrigger} value="inbound-rules" id="tab-inbound-rules">
            {t('tenantDetails.tabs.inboundRules')}
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tabsTrigger} value="call-routes" id="tab-call-routes">
            {t('tenantDetails.tabs.callRoutes')}
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tabsTrigger} value="users" id="tab-users">
            {t('tenantDetails.tabs.users')} ({users?.items?.length || 0})
          </Tabs.Trigger>
          {isSuperAdmin && (
            <Tabs.Trigger className={styles.tabsTrigger} value="ip-acl" id="tab-ip-acl">
              {t('tenantDetails.tabs.ipAcl')}
            </Tabs.Trigger>
          )}
        </Tabs.List>

        {/* ==================== INFO TAB ==================== */}
        <Tabs.Content className={styles.tabsContent} value="info">
          <article className={styles.infoGrid}>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('tenantDetails.info.slug')}</span>
              <span className={styles.infoValue}>{tenant.slug}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('tenantDetails.info.domain')}</span>
              <span className={styles.infoValue}>{tenant.domain}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('tenantDetails.info.maxExtensions')}</span>
              <span className={styles.infoValue}>{tenant.max_extensions}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('tenantDetails.info.maxConcurrentCalls')}</span>
              <span className={styles.infoValue}>{tenant.max_concurrent_calls}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('tenantDetails.info.codecs')}</span>
              <span className={styles.infoValue}>{tenant.codecs}</span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('tenantDetails.info.internationalCalls')}</span>
              <span className={styles.infoValue}>
                <StatusBadge status={tenant.allow_international ? 'active' : 'inactive'}
                  label={tenant.allow_international ? t('tenantDetails.info.allowed') : t('tenantDetails.info.blocked')} />
              </span>
            </section>
            <section className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('tenantDetails.info.created')}</span>
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
                  <Plus size={16} aria-hidden="true" /> {t('tenantDetails.extensions.addBtn')}
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className={s.dialogOverlay} />
                <Dialog.Content className={s.dialogContent}>
                  <Dialog.Title className={s.dialogTitle}>
                    {credentials ? t('tenantDetails.extensions.credentialsTitle') : t('tenantDetails.extensions.createTitle')}
                  </Dialog.Title>

                  {credentials ? (
                    <article className={s.credentialsBox}>
                      <p><strong>{t('tenantDetails.extensions.username')}:</strong> {credentials.sip_username}</p>
                      <p><strong>{t('tenantDetails.extensions.password')}:</strong> {credentials.sip_password}</p>
                      <p><strong>{t('tenantDetails.extensions.domain')}:</strong> {credentials.sip_domain}</p>
                      <p><strong>{t('tenantDetails.extensions.extension')}:</strong> {credentials.extension_number}</p>
                    </article>
                  ) : (
                    <form className={s.dialogForm} onSubmit={handleCreateExtension}>
                      <fieldset className={s.field}>
                        <label className={s.fieldLabel} htmlFor="ext-number">{t('tenantDetails.extensions.numberField')}</label>
                        <input id="ext-number" className={s.fieldInput} placeholder="101" required
                          pattern="^\d+$" value={extForm.extension_number}
                          onChange={(e) => setExtForm((f) => ({ ...f, extension_number: e.target.value }))} />
                      </fieldset>
                      <fieldset className={s.field}>
                        <label className={s.fieldLabel} htmlFor="ext-name">{t('tenantDetails.extensions.nameField')}</label>
                        <input id="ext-name" className={s.fieldInput} placeholder="John Doe" required
                          value={extForm.display_name}
                          onChange={(e) => setExtForm((f) => ({ ...f, display_name: e.target.value }))} />
                      </fieldset>
                      <fieldset className={s.field}>
                        <label className={s.fieldLabel} htmlFor="ext-email">{t('tenantDetails.extensions.emailField')}</label>
                        <input id="ext-email" className={s.fieldInput} type="email" placeholder="john@example.com"
                          value={extForm.email}
                          onChange={(e) => setExtForm((f) => ({ ...f, email: e.target.value }))} />
                      </fieldset>
                      <footer className={s.dialogActions}>
                        <Dialog.Close asChild>
                          <button type="button" className={`${s.btn} ${s.btnSecondary}`}>{t('common.cancel')}</button>
                        </Dialog.Close>
                        <button type="submit" className={`${s.btn} ${s.btnPrimary}`}
                          disabled={createExtMutation.isPending}>
                          {createExtMutation.isPending ? t('tenantDetails.extensions.creating') : t('common.create')}
                        </button>
                      </footer>
                    </form>
                  )}

                  {credentials && (
                    <footer className={s.dialogActions}>
                      <Dialog.Close asChild>
                        <button className={`${s.btn} ${s.btnPrimary}`}>{t('common.close')}</button>
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
                  <th>{t('tenantDetails.extensions.numberField')}</th>
                  <th>{t('tenantDetails.extensions.nameField')}</th>
                  <th>{t('tenantDetails.extensions.username')}</th>
                  <th>{t('extensions.email')}</th>
                  <th>{t('tenants.status')}</th>
                  <th>{t('tenants.actions')}</th>
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
                          aria-label={t('tenantDetails.extensions.editAria', { number: ext.extension_number })}>
                          <Edit size={14} aria-hidden="true" />
                        </button>
                        <button className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                          onClick={() => resetPasswordMutation.mutate(ext.id)}
                          aria-label={t('tenantDetails.extensions.resetPassAria', { number: ext.extension_number })}>
                          <KeyRound size={14} aria-hidden="true" />
                        </button>
                        <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                          onClick={() => {
                            if (window.confirm(t('tenantDetails.extensions.confirmDelete', { number: ext.extension_number }))) deleteExtMutation.mutate(ext.id)
                          }}
                          aria-label={t('tenantDetails.extensions.deleteAria', { number: ext.extension_number })}>
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </section>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className={s.empty}>{t('tenantDetails.extensions.noExtensions')}</td></tr>
                )}
              </tbody>
            </table>
          </article>

          {/* Edit Extension Dialog */}
          <Dialog.Root open={extEditDialogOpen} onOpenChange={(open) => { if (!open) closeExtEditDialog() }}>
            <Dialog.Portal>
              <Dialog.Overlay className={s.dialogOverlay} />
              <Dialog.Content className={s.dialogContent}>
                <Dialog.Title className={s.dialogTitle}>{t('tenantDetails.extensions.editTitle')}</Dialog.Title>
                <form className={s.dialogForm} onSubmit={handleUpdateExtension}>
                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="ext-edit-number">{t('tenantDetails.extensions.numberField')}</label>
                    <input id="ext-edit-number" className={s.fieldInput} required
                      pattern="^\d+$" value={extEditForm.extension_number}
                      onChange={(e) => setExtEditForm((f) => ({ ...f, extension_number: e.target.value }))} />
                  </fieldset>
                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="ext-edit-name">{t('tenantDetails.extensions.nameField')}</label>
                    <input id="ext-edit-name" className={s.fieldInput} required
                      value={extEditForm.display_name}
                      onChange={(e) => setExtEditForm((f) => ({ ...f, display_name: e.target.value }))} />
                  </fieldset>
                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="ext-edit-email">{t('tenantDetails.extensions.emailFieldRequired')}</label>
                    <input id="ext-edit-email" className={s.fieldInput} type="email"
                      value={extEditForm.email}
                      onChange={(e) => setExtEditForm((f) => ({ ...f, email: e.target.value }))} />
                  </fieldset>
                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="ext-edit-password">{t('tenantDetails.extensions.password')}</label>
                    <section className={styles.passwordField}>
                      <input id="ext-edit-password" className={s.fieldInput}
                        type={showExtPassword ? 'text' : 'password'}
                        minLength={8}
                        value={extEditForm.password}
                        onChange={(e) => setExtEditForm((f) => ({ ...f, password: e.target.value }))} />
                      <button type="button" className={styles.passwordToggle}
                        onClick={() => setShowExtPassword((v) => !v)}
                        aria-label={showExtPassword ? t('tenantDetails.extensions.hidePassword') : t('tenantDetails.extensions.showPassword')}>
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
                      <span>{t('extensions.enabled')}</span>
                    </label>
                  </fieldset>
                  <footer className={s.dialogActions}>
                    <Dialog.Close asChild>
                      <button type="button" className={`${s.btn} ${s.btnSecondary}`}>{t('common.cancel')}</button>
                    </Dialog.Close>
                    <button type="submit" className={`${s.btn} ${s.btnPrimary}`}
                      disabled={updateExtMutation.isPending}>
                      {updateExtMutation.isPending ? t('tenantDetails.extensions.saving') : t('common.save')}
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
                  <Plus size={16} aria-hidden="true" /> {t('tenantDetails.trunks.addBtn')}
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className={s.dialogOverlay} />
                <Dialog.Content className={s.dialogContent}>
                  <Dialog.Title className={s.dialogTitle}>
                    {editingTrunkId ? t('tenantDetails.trunks.editTitle') : t('tenantDetails.trunks.createTitle')}
                  </Dialog.Title>
                  <form className={s.dialogForm} onSubmit={handleSubmitTrunk}>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="trunk-name">{t('tenantDetails.trunks.name')}</label>
                      <input id="trunk-name" className={s.fieldInput} required value={trunkForm.name}
                        onChange={(e) => setTrunkForm((f) => ({ ...f, name: e.target.value }))} />
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="trunk-provider">{t('tenantDetails.trunks.provider')}</label>
                      <input id="trunk-provider" className={s.fieldInput} value={trunkForm.provider}
                        onChange={(e) => setTrunkForm((f) => ({ ...f, provider: e.target.value }))} />
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="trunk-host">{t('tenantDetails.trunks.host')}</label>
                      <input id="trunk-host" className={s.fieldInput} required value={trunkForm.host}
                        placeholder={t('tenantDetails.trunks.placeholderHost')}
                        onChange={(e) => setTrunkForm((f) => ({ ...f, host: e.target.value }))} />
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="trunk-port">{t('tenantDetails.trunks.port')}</label>
                      <input id="trunk-port" className={s.fieldInput} type="number" value={trunkForm.port}
                        onChange={(e) => setTrunkForm((f) => ({ ...f, port: +e.target.value }))} />
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="trunk-transport">{t('tenantDetails.trunks.transport')}</label>
                      <select id="trunk-transport" className={s.fieldInput} value={trunkForm.transport}
                        onChange={(e) => setTrunkForm((f) => ({ ...f, transport: e.target.value }))}>
                        <option value="udp">UDP</option>
                        <option value="tcp">TCP</option>
                        <option value="tls">TLS</option>
                      </select>
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="trunk-username">{t('tenantDetails.trunks.username')}</label>
                      <input id="trunk-username" className={s.fieldInput} value={trunkForm.username}
                        placeholder={t('tenantDetails.trunks.placeholderUsername')}
                        onChange={(e) => setTrunkForm((f) => ({ ...f, username: e.target.value }))} />
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="trunk-password">{t('tenantDetails.trunks.password')}</label>
                      <section className={styles.passwordField}>
                        <input id="trunk-password" className={s.fieldInput}
                          type={showPassword ? 'text' : 'password'}
                          value={trunkForm.password}
                          placeholder={editingTrunkId ? t('tenantDetails.trunks.placeholderPasswordEdit') : t('tenantDetails.trunks.placeholderPassword')}
                          onChange={(e) => setTrunkForm((f) => ({ ...f, password: e.target.value }))} />
                        <button type="button" className={styles.passwordToggle}
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? t('tenantDetails.trunks.hidePassword') : t('tenantDetails.trunks.showPassword')}>
                          {showPassword
                            ? <EyeOff size={16} aria-hidden="true" />
                            : <Eye size={16} aria-hidden="true" />}
                        </button>
                      </section>
                    </fieldset>
                    <footer className={s.dialogActions}>
                      <Dialog.Close asChild>
                        <button type="button" className={`${s.btn} ${s.btnSecondary}`}>{t('common.cancel')}</button>
                      </Dialog.Close>
                      <button type="submit" className={`${s.btn} ${s.btnPrimary}`}
                        disabled={isTrunkPending}>
                        {isTrunkPending ? t('tenantDetails.trunks.saving') : (editingTrunkId ? t('common.save') : t('common.create'))}
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
                  <th>{t('tenantDetails.trunks.name')}</th>
                  <th>{t('tenantDetails.trunks.provider')}</th>
                  <th>{t('tenantDetails.trunks.host')}</th>
                  <th>{t('tenantDetails.trunks.transport')}</th>
                  <th>{t('trunks.maxChannels')}</th>
                  <th>{t('tenantDetails.trunks.auth', 'Auth')}</th>
                  <th>{t('tenants.status')}</th>
                  <th>{t('tenants.actions')}</th>
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
                    <td>{trunk.username ? t('tenantDetails.trunks.authLoginPass') : t('tenantDetails.trunks.authIpBased')}</td>
                    <td><StatusBadge status={trunk.enabled ? 'active' : 'inactive'} /></td>
                    <td>
                      <section className={styles.actionBtns}>
                        <button className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                          onClick={() => openEditTrunk(trunk)}
                          aria-label={t('tenantDetails.trunks.editAria', { name: trunk.name })}>
                          <Edit size={14} aria-hidden="true" />
                        </button>
                        <button className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                          onClick={() => {
                            if (window.confirm(t('tenantDetails.trunks.confirmDelete', { name: trunk.name }))) deleteTrunkMutation.mutate(trunk.id)
                          }}
                          aria-label={t('tenantDetails.trunks.deleteAria', { name: trunk.name })}>
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </section>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} className={s.empty}>{t('tenantDetails.trunks.noTrunks')}</td></tr>
                )}
              </tbody>
            </table>
          </article>
        </Tabs.Content>

        {/* ==================== EVENTS TAB ==================== */}
        <Tabs.Content className={styles.tabsContent} value="events">
          <section className={styles.tabToolbar}>
            <fieldset className={s.searchGroup}>
              <label htmlFor="event-filter" className="sr-only">{t('tenantDetails.events.filterLabel')}</label>
              <select id="event-filter" className={s.fieldInput} style={{ height: 40, minWidth: 180 }}
                value={eventsFilter} onChange={(e) => { setEventsFilter(e.target.value); setEventsPage(1) }}>
                <option value="">{t('tenantDetails.events.allActions')}</option>
                <option value="extension_created">{t('tenantDetails.events.actions.extension_created')}</option>
                <option value="extension_deleted">{t('tenantDetails.events.actions.extension_deleted')}</option>
                <option value="trunk_created">{t('tenantDetails.events.actions.trunk_created')}</option>
                <option value="trunk_deleted">{t('tenantDetails.events.actions.trunk_deleted')}</option>
                <option value="config_change">{t('tenantDetails.events.actions.config_change')}</option>
              </select>
            </fieldset>
          </section>

          <article className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('tenantDetails.events.headers.date')}</th>
                  <th>{t('tenantDetails.events.headers.action')}</th>
                  <th>{t('tenantDetails.events.headers.source')}</th>
                  <th>{t('tenantDetails.events.headers.ip')}</th>
                  <th>{t('tenantDetails.events.headers.extension')}</th>
                  <th>{t('tenantDetails.events.headers.details')}</th>
                </tr>
              </thead>
              <tbody>
                {events?.items?.length > 0 ? events.items.map((evt) => (
                  <tr key={evt.id}>
                    <td>{formatDate(evt.created_at)}</td>
                    <td><code>{evt.action}</code></td>
                    <td>{evt.source || '—'}</td>
                    <td>{evt.ip || '—'}</td>
                    <td>{evt.extension || '—'}</td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {evt.details ? JSON.stringify(evt.details) : '—'}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className={s.empty}>{t('tenantDetails.events.noEvents')}</td></tr>
                )}
              </tbody>
            </table>

            {events && events.pages > 1 && (
              <footer className={s.pagination}>
                <span>{t('tenantDetails.events.pagination', { current: events.page, total: events.pages, count: events.total })}</span>
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

        {/* ==================== REPORTS TAB ==================== */}
        <Tabs.Content className={styles.tabsContent} value="reports">
          <TenantReports tenantId={id} />
        </Tabs.Content>

        {/* ==================== INBOUND RULES TAB ==================== */}
        <Tabs.Content className={styles.tabsContent} value="inbound-rules">
          <TenantInboundRules tenantId={id} />
        </Tabs.Content>

        {/* ==================== CALL ROUTES TAB ==================== */}
        <Tabs.Content className={styles.tabsContent} value="call-routes">
          <TenantCallRoutes tenantId={id} />
        </Tabs.Content>

        {/* ==================== USERS TAB ==================== */}
        <Tabs.Content className={styles.tabsContent} value="users">
          <section className={styles.tabToolbar}>
            <Dialog.Root open={userDialogOpen} onOpenChange={(open) => { setUserDialogOpen(open); if (!open) setUserForm(EMPTY_USER_FORM) }}>
              <Dialog.Trigger asChild>
                <button className={`${s.btn} ${s.btnPrimary}`} id="create-user-btn">
                  <Plus size={16} aria-hidden="true" /> {t('tenantDetails.users.addBtn')}
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className={s.dialogOverlay} />
                <Dialog.Content className={s.dialogContent}>
                  <Dialog.Title className={s.dialogTitle}>{t('tenantDetails.users.createTitle')}</Dialog.Title>
                  <form className={s.dialogForm} onSubmit={handleCreateUser}>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="user-username">{t('tenantDetails.users.username')}</label>
                      <input id="user-username" className={s.fieldInput} placeholder="john_doe" required
                        value={userForm.username}
                        onChange={(e) => setUserForm((f) => ({ ...f, username: e.target.value }))} />
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="user-password">{t('tenantDetails.users.password')}</label>
                      <input id="user-password" className={s.fieldInput} type="password" placeholder={t('tenantDetails.users.passwordPlaceholder')} required
                        value={userForm.password}
                        onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} />
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="user-role">{t('tenantDetails.users.role')}</label>
                      <select id="user-role" className={s.fieldInput}
                        value={userForm.role}
                        onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}>
                        <option value="user">{t('tenantDetails.users.roleUser')}</option>
                        <option value="tenant_admin">{t('tenantDetails.users.roleAdmin')}</option>
                      </select>
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="user-extension">{t('tenantDetails.users.linkedExtension')}</label>
                      <select id="user-extension" className={s.fieldInput}
                        value={userForm.extension_id}
                        onChange={(e) => setUserForm((f) => ({ ...f, extension_id: e.target.value }))}>
                        <option value="">{t('tenantDetails.users.linkedExtensionNone')}</option>
                        {extensions?.items?.map((ext) => (
                          <option key={ext.id} value={ext.id}>
                            {ext.extension_number} - {ext.display_name}
                          </option>
                        ))}
                      </select>
                    </fieldset>
                    <footer className={s.dialogActions}>
                      <Dialog.Close asChild>
                        <button type="button" className={`${s.btn} ${s.btnSecondary}`}>{t('common.cancel')}</button>
                      </Dialog.Close>
                      <button type="submit" className={`${s.btn} ${s.btnPrimary}`}
                        disabled={createUserMutation.isPending}>
                        {createUserMutation.isPending ? t('tenantDetails.users.creating') : t('common.create')}
                      </button>
                    </footer>
                  </form>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>

            <Dialog.Root open={userEditDialogOpen} onOpenChange={(open) => { if (!open) setUserEditDialogOpen(false) }}>
              <Dialog.Portal>
                <Dialog.Overlay className={s.dialogOverlay} />
                <Dialog.Content className={s.dialogContent}>
                  <Dialog.Title className={s.dialogTitle}>{t('tenantDetails.users.editTitle')}</Dialog.Title>
                  <form className={s.dialogForm} onSubmit={handleUpdateUser}>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="user-edit-username">{t('tenantDetails.users.username')}</label>
                      <input id="user-edit-username" className={s.fieldInput} placeholder="john_doe" required
                        value={userEditForm.username}
                        onChange={(e) => setUserEditForm((f) => ({ ...f, username: e.target.value }))} />
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="user-edit-password">{t('tenantDetails.users.passwordEditPlaceholder')}</label>
                      <input id="user-edit-password" className={s.fieldInput} type="password" placeholder={t('tenantDetails.users.passwordPlaceholder')}
                        value={userEditForm.password}
                        onChange={(e) => setUserEditForm((f) => ({ ...f, password: e.target.value }))} />
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="user-edit-role">{t('tenantDetails.users.role')}</label>
                      <select id="user-edit-role" className={s.fieldInput}
                        value={userEditForm.role}
                        onChange={(e) => setUserEditForm((f) => ({ ...f, role: e.target.value }))}>
                        <option value="user">{t('tenantDetails.users.roleUser')}</option>
                        <option value="tenant_admin">{t('tenantDetails.users.roleAdmin')}</option>
                      </select>
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={s.fieldLabel} htmlFor="user-edit-extension">{t('tenantDetails.users.linkedExtension')}</label>
                      <select id="user-edit-extension" className={s.fieldInput}
                        value={userEditForm.extension_id}
                        onChange={(e) => setUserEditForm((f) => ({ ...f, extension_id: e.target.value }))}>
                        <option value="">{t('tenantDetails.users.linkedExtensionNone')}</option>
                        {extensions?.items?.map((ext) => (
                          <option key={ext.id} value={ext.id}>
                            {ext.extension_number} - {ext.display_name}
                          </option>
                        ))}
                      </select>
                    </fieldset>
                    <fieldset className={s.field}>
                      <label className={styles.checkboxLabel} htmlFor="user-edit-active" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input id="user-edit-active" type="checkbox" checked={userEditForm.is_active}
                          onChange={(e) => setUserEditForm((f) => ({ ...f, is_active: e.target.checked }))} />
                        <span>{t('tenantDetails.users.activeAccount')}</span>
                      </label>
                    </fieldset>
                    <footer className={s.dialogActions}>
                      <Dialog.Close asChild>
                        <button type="button" className={`${s.btn} ${s.btnSecondary}`}>{t('common.cancel')}</button>
                      </Dialog.Close>
                      <button type="submit" className={`${s.btn} ${s.btnPrimary}`}
                        disabled={updateUserMutation.isPending}>
                        {updateUserMutation.isPending ? t('tenantDetails.users.saving') : t('common.save')}
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
                  <th>{t('tenantDetails.users.headers.username')}</th>
                  <th>{t('tenantDetails.users.headers.role')}</th>
                  <th>{t('tenantDetails.users.headers.linkedExt')}</th>
                  <th>{t('tenantDetails.users.headers.status')}</th>
                  <th>{t('tenantDetails.users.headers.created')}</th>
                  <th style={{ width: 100 }}>{t('tenantDetails.users.headers.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users?.items?.length ? users.items.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.username}</strong></td>
                    <td>{u.role === 'tenant_admin' ? t('tenantDetails.users.roleAdmin') : t('tenantDetails.users.roleUser')}</td>
                    <td>{u.extension_number ? `${u.extension_number}` : t('tenantDetails.users.linkedExtensionNone')}</td>
                    <td>
                      <StatusBadge status={u.is_active ? 'active' : 'inactive'} />
                    </td>
                    <td>{formatDate(u.created_at)}</td>
                    <td>
                      <section className={s.tableActions}>
                        <button className={`${s.btn} ${s.btnSecondary} ${s.btnIcon}`}
                          onClick={() => openEditUser(u)} title={t('tenantDetails.users.editAria')} aria-label={t('tenantDetails.users.editAria')}>
                          <Edit size={14} aria-hidden="true" />
                        </button>
                        <button className={`${s.btn} ${s.btnDanger} ${s.btnIcon}`}
                          onClick={() => {
                            if (window.confirm(t('tenantDetails.users.confirmDelete', { username: u.username }))) {
                              deleteUserMutation.mutate(u.id)
                            }
                          }} title={t('tenantDetails.users.deleteAria')} aria-label={t('tenantDetails.users.deleteAria')}>
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </section>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className={s.empty}>{t('tenantDetails.users.noUsers')}</td></tr>
                )}
              </tbody>
            </table>
          </article>
        </Tabs.Content>

        {/* ==================== IP ACL TAB ==================== */}
        {isSuperAdmin && (
          <Tabs.Content className={styles.tabsContent} value="ip-acl">
            <TenantIpAcl tenantId={id} />
          </Tabs.Content>
        )}
      </Tabs.Root>
    </>
  )
}
