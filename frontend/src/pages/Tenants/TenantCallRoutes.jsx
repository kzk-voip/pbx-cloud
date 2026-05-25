import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Edit, Trash2 } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import client from '../../api/client'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import s from '../shared.module.css'
import styles from './TenantDetails.module.css'

export default function TenantCallRoutes({ tenantId }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState(null)
  
  const [form, setForm] = useState({
    name: '',
    pattern: '',
    trunk_id: '',
    prefix_strip: 0,
    prefix_add: '',
    priority: 10,
    enabled: true,
  })

  // List routes
  const { data: routesData, isLoading: routesLoading, error: routesError } = useQuery({
    queryKey: ['call-routes', tenantId],
    queryFn: () =>
      client.get(`/tenants/${tenantId}/call-routes`).then((r) => r.data),
    enabled: !!tenantId,
  })

  // List trunks (to select in the form)
  const { data: trunksData, isLoading: trunksLoading } = useQuery({
    queryKey: ['trunks', tenantId],
    queryFn: () =>
      client.get(`/tenants/${tenantId}/trunks`).then((r) => r.data),
    enabled: !!tenantId,
  })

  // Create route
  const createMutation = useMutation({
    mutationFn: (data) => client.post(`/tenants/${tenantId}/call-routes`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-routes', tenantId] })
      setDialogOpen(false)
      resetForm()
    },
  })

  // Update route
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) =>
      client.put(`/tenants/${tenantId}/call-routes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-routes', tenantId] })
      setDialogOpen(false)
      resetForm()
    },
  })

  // Delete route
  const deleteMutation = useMutation({
    mutationFn: (id) => client.delete(`/tenants/${tenantId}/call-routes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-routes', tenantId] })
    },
  })

  const resetForm = () => {
    setForm({
      name: '',
      pattern: '',
      trunk_id: '',
      prefix_strip: 0,
      prefix_add: '',
      priority: 10,
      enabled: true,
    })
    setEditingRoute(null)
  }

  const handleOpenAdd = () => {
    resetForm()
    // Pre-select first trunk if available
    const trunks = trunksData?.items || []
    if (trunks.length > 0) {
      setForm((f) => ({ ...f, trunk_id: trunks[0].id }))
    }
    setDialogOpen(true)
  }

  const handleOpenEdit = (route) => {
    setEditingRoute(route)
    setForm({
      name: route.name,
      pattern: route.pattern,
      trunk_id: route.trunk_id,
      prefix_strip: route.prefix_strip,
      prefix_add: route.prefix_add,
      priority: route.priority,
      enabled: route.enabled,
    })
    setDialogOpen(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.trunk_id) {
      alert(t('callRoutes.selectTrunkAlert', 'Please select a trunk'))
      return
    }
    if (editingRoute) {
      updateMutation.mutate({ id: editingRoute.id, data: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const handleDelete = (id, name) => {
    if (window.confirm(t('common.confirmDelete', { item: name }))) {
      deleteMutation.mutate(id)
    }
  }

  if (routesLoading || trunksLoading) return <p className={s.loading}>{t('common.loading')}</p>
  if (routesError) return <p className={s.error}>{t('common.error')}</p>

  const routes = routesData?.items || []
  const trunks = trunksData?.items || []

  // Create lookup map for trunk names
  const trunkMap = trunks.reduce((acc, trunk) => {
    acc[trunk.id] = trunk.name
    return acc
  }, {})

  return (
    <section>
      <header className={styles.tabToolbar}>
        <Dialog.Root open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
          <Dialog.Trigger asChild>
            <button className={`${s.btn} ${s.btnPrimary}`} onClick={handleOpenAdd} disabled={trunks.length === 0}>
              <Plus size={16} aria-hidden="true" /> {t('callRoutes.addRoute')}
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className={s.dialogOverlay} />
            <Dialog.Content className={s.dialogContent}>
              <Dialog.Title className={s.dialogTitle}>
                {editingRoute ? t('callRoutes.editRoute') : t('callRoutes.addRoute')}
              </Dialog.Title>

              <form className={s.dialogForm} onSubmit={handleSubmit}>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="route-name">{t('callRoutes.name')}</label>
                  <input
                    id="route-name"
                    className={s.fieldInput}
                    placeholder={t('callRoutes.placeholderName', 'Outbound via Trunk A')}
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </fieldset>

                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="route-pattern">{t('callRoutes.pattern')}</label>
                  <input
                    id="route-pattern"
                    className={s.fieldInput}
                    placeholder={t('callRoutes.placeholderPattern', '_9X.')}
                    required
                    value={form.pattern}
                    onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {t('callRoutes.patternHint')}
                  </span>
                </fieldset>

                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="route-trunk">{t('callRoutes.trunk')}</label>
                  <select
                    id="route-trunk"
                    className={s.fieldInput}
                    required
                    value={form.trunk_id}
                    onChange={(e) => setForm((f) => ({ ...f, trunk_id: e.target.value }))}
                  >
                    <option value="">{t('callRoutes.selectTrunk')}</option>
                    {trunks.map((trunk) => (
                      <option key={trunk.id} value={trunk.id}>{trunk.name} ({trunk.host})</option>
                    ))}
                  </select>
                </fieldset>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="route-strip">{t('callRoutes.strip')}</label>
                    <input
                      id="route-strip"
                      type="number"
                      min="0"
                      max="10"
                      className={s.fieldInput}
                      required
                      value={form.prefix_strip}
                      onChange={(e) => setForm((f) => ({ ...f, prefix_strip: parseInt(e.target.value) || 0 }))}
                    />
                  </fieldset>

                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="route-prepend">{t('callRoutes.prepend')}</label>
                    <input
                      id="route-prepend"
                      className={s.fieldInput}
                      placeholder={t('callRoutes.placeholderPrepend', '00')}
                      value={form.prefix_add}
                      onChange={(e) => setForm((f) => ({ ...f, prefix_add: e.target.value }))}
                    />
                  </fieldset>
                </div>

                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="route-priority">{t('callRoutes.priority')}</label>
                  <input
                    id="route-priority"
                    type="number"
                    min="1"
                    max="100"
                    className={s.fieldInput}
                    required
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 10 }))}
                  />
                </fieldset>

                <fieldset className={s.field} style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
                  <input
                    id="route-enabled"
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label className={s.fieldLabel} htmlFor="route-enabled" style={{ cursor: 'pointer' }}>
                    {t('callRoutes.enabled')}
                  </label>
                </fieldset>

                <footer className={s.dialogActions}>
                  <Dialog.Close asChild>
                    <button type="button" className={`${s.btn} ${s.btnSecondary}`}>{t('common.cancel')}</button>
                  </Dialog.Close>
                  <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? t('common.saving') : t('common.save')}
                  </button>
                </footer>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>

      <article className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('callRoutes.name')}</th>
              <th>{t('callRoutes.pattern')}</th>
              <th>{t('callRoutes.trunk')}</th>
              <th>{t('callRoutes.strip')}</th>
              <th>{t('callRoutes.prepend')}</th>
              <th>{t('callRoutes.priority')}</th>
              <th>{t('common.status')}</th>
              <th>{t('callRoutes.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {routes.length > 0 ? (
              routes.map((route) => (
                <tr key={route.id}>
                  <td><strong>{route.name}</strong></td>
                  <td style={{ fontFamily: 'var(--font-mono, monospace)' }}>{route.pattern}</td>
                  <td>{trunkMap[route.trunk_id] || t('callRoutes.unknownTrunk', 'Unknown Trunk')}</td>
                  <td>{route.prefix_strip}</td>
                  <td>{route.prefix_add || '—'}</td>
                  <td>{route.priority}</td>
                  <td>
                    <StatusBadge
                      status={route.enabled ? 'active' : 'inactive'}
                      label={route.enabled ? t('common.enabled') : t('common.disabled')}
                    />
                  </td>
                  <td>
                    <section className={s.actionBtns}>
                      <button
                        className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                        onClick={() => handleOpenEdit(route)}
                        aria-label={t('callRoutes.editRoute')}
                      >
                        <Edit size={14} aria-hidden="true" />
                      </button>
                      <button
                        className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                        onClick={() => handleDelete(route.id, route.name)}
                        aria-label={t('callRoutes.deleteRoute', 'Delete Route')}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </section>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className={s.empty}>
                  {trunks.length === 0 ? t('callRoutes.createTrunkFirst', 'Create a trunk first to manage outbound routing.') : t('callRoutes.noRoutes')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </section>
  )
}
