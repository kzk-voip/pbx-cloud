import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Edit, Trash2, Users, ArrowUp, ArrowDown, HelpCircle, Check } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import toast from 'react-hot-toast'
import client from '../../api/client'
import s from '../shared.module.css'
import styles from './TenantRingGroups.module.css'

const EMPTY_FORM = {
  name: '',
  number: '',
  strategy: 'ringall',
  timeout: 30,
  member_ids: [],
}

export default function TenantRingGroups({ tenantId }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [searchQuery, setSearchQuery] = useState('')

  // Queries
  const { data: ringGroupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['ring-groups', tenantId],
    queryFn: () => client.get(`/tenants/${tenantId}/ring-groups`).then((r) => r.data),
    enabled: !!tenantId,
  })

  const { data: extensionsData, isLoading: extensionsLoading } = useQuery({
    queryKey: ['extensions', tenantId],
    queryFn: () => client.get(`/tenants/${tenantId}/extensions`).then((r) => r.data),
    enabled: !!tenantId,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (body) => client.post(`/tenants/${tenantId}/ring-groups`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ring-groups', tenantId] })
      setDialogOpen(false)
      setForm(EMPTY_FORM)
      toast.success(t('tenantDetails.ringGroups.createdSuccess'))
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || t('tenantDetails.ringGroups.createdFailed'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => client.put(`/tenants/${tenantId}/ring-groups/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ring-groups', tenantId] })
      setDialogOpen(false)
      setEditingGroupId(null)
      setForm(EMPTY_FORM)
      toast.success(t('tenantDetails.ringGroups.updatedSuccess'))
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || t('tenantDetails.ringGroups.updatedFailed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => client.delete(`/tenants/${tenantId}/ring-groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ring-groups', tenantId] })
      toast.success(t('tenantDetails.ringGroups.deletedSuccess'))
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || t('tenantDetails.ringGroups.deletedFailed'))
    },
  })

  // Handlers
  const handleOpenCreate = () => {
    setEditingGroupId(null)
    setForm(EMPTY_FORM)
    setSearchQuery('')
    setDialogOpen(true)
  }

  const handleOpenEdit = (group) => {
    setEditingGroupId(group.id)
    setForm({
      name: group.name,
      number: group.number,
      strategy: group.strategy,
      timeout: group.timeout,
      member_ids: group.members.map((m) => m.extension_id),
    })
    setSearchQuery('')
    setDialogOpen(true)
  }

  const handleDelete = (group) => {
    if (window.confirm(t('tenantDetails.ringGroups.confirmDelete', { number: group.number }))) {
      deleteMutation.mutate(group.id)
    }
  }

  const handleToggleExtension = (extId) => {
    setForm((f) => {
      const ids = [...f.member_ids]
      const idx = ids.indexOf(extId)
      if (idx > -1) {
        ids.splice(idx, 1)
      } else {
        ids.push(extId)
      }
      return { ...f, member_ids: ids }
    })
  }

  const handleMoveUp = (index) => {
    if (index === 0) return
    setForm((f) => {
      const ids = [...f.member_ids]
      const temp = ids[index]
      ids[index] = ids[index - 1]
      ids[index - 1] = temp
      return { ...f, member_ids: ids }
    })
  }

  const handleMoveDown = (index) => {
    setForm((f) => {
      const ids = [...f.member_ids]
      if (index === ids.length - 1) return f
      const temp = ids[index]
      ids[index] = ids[index + 1]
      ids[index + 1] = temp
      return { ...f, member_ids: ids }
    })
  }

  const handleSetPriority = (currentIndex, newIndex) => {
    if (newIndex < 0 || newIndex >= form.member_ids.length) return
    setForm((f) => {
      const ids = [...f.member_ids]
      const item = ids.splice(currentIndex, 1)[0]
      ids.splice(newIndex, 0, item)
      return { ...f, member_ids: ids }
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.number.trim()) return

    const body = {
      name: form.name.trim(),
      number: form.number.trim(),
      strategy: form.strategy,
      timeout: Number(form.timeout),
      member_ids: form.member_ids,
    }

    if (editingGroupId) {
      updateMutation.mutate({ id: editingGroupId, body })
    } else {
      createMutation.mutate(body)
    }
  }

  // Extensions Filter
  const filteredExtensions = extensionsData?.items?.filter(
    (ext) =>
      ext.extension_number.includes(searchQuery) ||
      (ext.display_name && ext.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || []

  // Helpers
  const getStrategyBadgeClass = (strategy) => {
    switch (strategy) {
      case 'ringall':
        return `${styles.strategyBadge} ${styles.badgeRingall}`
      case 'roundrobin':
        return `${styles.strategyBadge} ${styles.badgeRoundrobin}`
      case 'random':
        return `${styles.strategyBadge} ${styles.badgeRandom}`
      default:
        return styles.strategyBadge
    }
  }

  const getStrategyName = (strategy) => {
    switch (strategy) {
      case 'ringall':
        return t('tenantDetails.ringGroups.strategyRingall')
      case 'roundrobin':
        return t('tenantDetails.ringGroups.strategyRoundrobin')
      case 'random':
        return t('tenantDetails.ringGroups.strategyRandom')
      default:
        return strategy
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <section>
      <header className={styles.tabToolbar}>
        <Dialog.Root open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setForm(EMPTY_FORM) }}>
          <Dialog.Trigger asChild>
            <button className={`${s.btn} ${s.btnPrimary}`} onClick={handleOpenCreate} id="create-ring-group-btn">
              <Plus size={16} aria-hidden="true" /> {t('tenantDetails.ringGroups.addBtn')}
            </button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay className={s.dialogOverlay} />
            <Dialog.Content className={s.dialogContent} style={{ maxWidth: 750 }}>
              <Dialog.Title className={s.dialogTitle}>
                {editingGroupId ? t('tenantDetails.ringGroups.editTitle') : t('tenantDetails.ringGroups.createTitle')}
              </Dialog.Title>

              <form onSubmit={handleSubmit} className={s.dialogForm}>
                <section className={styles.formGrid}>
                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="rg-name">{t('tenantDetails.ringGroups.name')}</label>
                    <input
                      id="rg-name"
                      className={s.fieldInput}
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </fieldset>

                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="rg-number">{t('tenantDetails.ringGroups.number')}</label>
                    <input
                      id="rg-number"
                      className={s.fieldInput}
                      type="text"
                      pattern="^\d+$"
                      value={form.number}
                      onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                      required
                    />
                  </fieldset>

                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="rg-strategy">{t('tenantDetails.ringGroups.strategy')}</label>
                    <select
                      id="rg-strategy"
                      className={s.fieldInput}
                      value={form.strategy}
                      onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value }))}
                    >
                      <option value="ringall">{t('tenantDetails.ringGroups.strategyRingall')}</option>
                      <option value="roundrobin">{t('tenantDetails.ringGroups.strategyRoundrobin')}</option>
                      <option value="random">{t('tenantDetails.ringGroups.strategyRandom')}</option>
                    </select>
                  </fieldset>

                  <fieldset className={s.field}>
                    <label className={s.fieldLabel} htmlFor="rg-timeout">{t('tenantDetails.ringGroups.timeout')}</label>
                    <input
                      id="rg-timeout"
                      className={s.fieldInput}
                      type="number"
                      min={5}
                      max={120}
                      value={form.timeout}
                      onChange={(e) => setForm((f) => ({ ...f, timeout: Number(e.target.value) }))}
                      required
                    />
                  </fieldset>

                  {/* Dynamic members layout */}
                  <fieldset className={`${s.field} ${styles.fullWidth}`}>
                    <label className={s.fieldLabel}>{t('tenantDetails.ringGroups.membersList')}</label>
                    <article className={styles.membersLayout}>
                      
                      {/* Left: Extensions checklist */}
                      <section className={styles.membersPane}>
                        <header className={styles.paneTitle}>
                          <Users size={14} aria-hidden="true" />
                          <span>{t('tenantDetails.tabs.extensions')}</span>
                          <input
                            type="text"
                            placeholder={t('tenantDetails.ringGroups.searchExtensions')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={s.fieldInput}
                            style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)', marginLeft: 'auto', width: '150px' }}
                          />
                        </header>
                        <div className={styles.paneList}>
                          {extensionsLoading ? (
                            <p style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-1)' }}>{t('common.loading')}</p>
                          ) : !filteredExtensions.length ? (
                            <p style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-1)', color: 'var(--text-muted)' }}>{t('common.noData')}</p>
                          ) : (
                            filteredExtensions.map((ext) => {
                              const checked = form.member_ids.includes(ext.id)
                              return (
                                <div
                                  key={ext.id}
                                  className={styles.extensionItem}
                                  onClick={() => handleToggleExtension(ext.id)}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {}} // handled by click
                                    className={styles.checkboxInput}
                                  />
                                  <span>{ext.extension_number} - {ext.display_name}</span>
                                  {checked && <Check size={12} style={{ marginLeft: 'auto', color: 'var(--primary-color)' }} />}
                                </div>
                              )
                            })
                          )}
                        </div>
                      </section>

                      {/* Right: Ordered selection */}
                      <section className={styles.membersPane}>
                        <header className={styles.paneTitle}>
                          <HelpCircle size={14} aria-hidden="true" />
                          <span>{t('tenantDetails.ringGroups.members')} ({form.member_ids.length})</span>
                        </header>
                        <div className={styles.paneList}>
                          {!form.member_ids.length ? (
                            <p style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-1)', color: 'var(--text-muted)' }}>
                              {t('tenantDetails.ringGroups.noMembers')}
                            </p>
                          ) : (
                            form.member_ids.map((extId, idx) => {
                              const ext = extensionsData?.items?.find((e) => e.id === extId)
                              return (
                                <div key={extId} className={styles.memberCard}>
                                  <section className={styles.memberInfo}>
                                    <input
                                      type="number"
                                      min={1}
                                      max={form.member_ids.length}
                                      value={idx + 1}
                                      onChange={(e) => handleSetPriority(idx, Number(e.target.value) - 1)}
                                      className={styles.priorityInput}
                                      title={t('tenantDetails.ringGroups.changePriority', 'Change priority')}
                                    />
                                    <span className={styles.memberText}>
                                      {ext ? `${ext.extension_number} - ${ext.display_name}` : 'Extension'}
                                    </span>
                                  </section>
                                  <section className={styles.reorderBtns}>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveUp(idx)}
                                      disabled={idx === 0}
                                      className={styles.reorderBtn}
                                      title="Move Up"
                                      aria-label="Move Up"
                                    >
                                      <ArrowUp size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveDown(idx)}
                                      disabled={idx === form.member_ids.length - 1}
                                      className={styles.reorderBtn}
                                      title="Move Down"
                                      aria-label="Move Down"
                                    >
                                      <ArrowDown size={12} />
                                    </button>
                                  </section>
                                </div>
                              )
                            })
                          )}
                        </div>
                        {form.strategy !== 'ringall' && (
                          <footer className={styles.helpText}>
                            * {t('tenantDetails.ringGroups.strategy')} <strong>{getStrategyName(form.strategy)}</strong> uses priority sequence (#1 first).
                          </footer>
                        )}
                      </section>

                    </article>
                  </fieldset>

                </section>

                <footer className={s.dialogFooter}>
                  <Dialog.Close asChild>
                    <button type="button" className={`${s.btn} ${s.btnSecondary}`}>{t('common.cancel')}</button>
                  </Dialog.Close>
                  <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={isSaving}>
                    {isSaving ? t('tenantDetails.ringGroups.saving') : editingGroupId ? t('common.save') : t('common.create')}
                  </button>
                </footer>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>

      {/* Main List */}
      <article className={s.tableWrap}>
        {groupsLoading ? (
          <p className={s.loading}>{t('common.loading')}</p>
        ) : !ringGroupsData?.items?.length ? (
          <p className={s.empty}>{t('tenantDetails.ringGroups.noGroups')}</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('tenantDetails.ringGroups.headers.name')}</th>
                <th>{t('tenantDetails.ringGroups.headers.number')}</th>
                <th>{t('tenantDetails.ringGroups.headers.strategy')}</th>
                <th>{t('tenantDetails.ringGroups.headers.timeout')}</th>
                <th>{t('tenantDetails.ringGroups.headers.memberCount')}</th>
                <th style={{ width: 100 }}>{t('tenantDetails.ringGroups.headers.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {ringGroupsData.items.map((g) => (
                <tr key={g.id}>
                  <td><strong>{g.name}</strong></td>
                  <td>{g.number}</td>
                  <td>
                    <span className={getStrategyBadgeClass(g.strategy)}>
                      {getStrategyName(g.strategy)}
                    </span>
                  </td>
                  <td>{g.timeout}s</td>
                  <td>{g.members?.length || 0}</td>
                  <td>
                    <section className={s.actionBtns}>
                      <button
                        className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                        onClick={() => handleOpenEdit(g)}
                        title={t('tenantDetails.ringGroups.editAria', { number: g.number })}
                        aria-label={t('tenantDetails.ringGroups.editAria', { number: g.number })}
                      >
                        <Edit size={14} aria-hidden="true" />
                      </button>
                      <button
                        className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                        onClick={() => handleDelete(g)}
                        title={t('tenantDetails.ringGroups.deleteAria', { number: g.number })}
                        aria-label={t('tenantDetails.ringGroups.deleteAria', { number: g.number })}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </section>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  )
}
