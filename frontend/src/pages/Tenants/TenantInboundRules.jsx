import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import client from '../../api/client'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import s from '../shared.module.css'
import styles from './TenantDetails.module.css'

export default function TenantInboundRules({ tenantId }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  
  const [form, setForm] = useState({
    did_number: '',
    destination_type: 'extension',
    destination_value: '',
    priority: 10,
    enabled: true,
  })

  // List rules
  const { data: rulesData, isLoading, error } = useQuery({
    queryKey: ['inbound-rules', tenantId],
    queryFn: () =>
      client.get(`/tenants/${tenantId}/inbound-rules`).then((r) => r.data),
    enabled: !!tenantId,
  })

  // Create rule
  const createMutation = useMutation({
    mutationFn: (data) => client.post(`/tenants/${tenantId}/inbound-rules`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-rules', tenantId] })
      setDialogOpen(false)
      resetForm()
    },
  })

  // Update rule
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) =>
      client.put(`/tenants/${tenantId}/inbound-rules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-rules', tenantId] })
      setDialogOpen(false)
      resetForm()
    },
  })

  // Delete rule
  const deleteMutation = useMutation({
    mutationFn: (id) => client.delete(`/tenants/${tenantId}/inbound-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-rules', tenantId] })
    },
  })

  const resetForm = () => {
    setForm({
      did_number: '',
      destination_type: 'extension',
      destination_value: '',
      priority: 10,
      enabled: true,
    })
    setEditingRule(null)
  }

  const handleOpenAdd = () => {
    resetForm()
    setDialogOpen(true)
  }

  const handleOpenEdit = (rule) => {
    setEditingRule(rule)
    setForm({
      did_number: rule.did_number,
      destination_type: rule.destination_type,
      destination_value: rule.destination_value,
      priority: rule.priority,
      enabled: rule.enabled,
    })
    setDialogOpen(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const handleDelete = (id, did) => {
    if (window.confirm(t('common.confirmDelete', { item: did }))) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) return <p className={s.loading}>{t('common.loading')}</p>
  if (error) return <p className={s.error}>{t('common.error')}</p>

  const rules = rulesData?.items || []

  return (
    <section>
      <header className={styles.tabToolbar}>
        <Dialog.Root open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
          <Dialog.Trigger asChild>
            <button className={`${s.btn} ${s.btnPrimary}`} onClick={handleOpenAdd}>
              <Plus size={16} aria-hidden="true" /> {t('inboundRules.addRule')}
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className={s.dialogOverlay} />
            <Dialog.Content className={s.dialogContent}>
              <Dialog.Title className={s.dialogTitle}>
                {editingRule ? t('inboundRules.editRule') : t('inboundRules.addRule')}
              </Dialog.Title>

              <form className={s.dialogForm} onSubmit={handleSubmit}>
                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="rule-did">{t('inboundRules.didNumber')}</label>
                  <input
                    id="rule-did"
                    className={s.fieldInput}
                    placeholder={t('inboundRules.placeholderDid', '+14155551234')}
                    required
                    value={form.did_number}
                    onChange={(e) => setForm((f) => ({ ...f, did_number: e.target.value }))}
                  />
                </fieldset>

                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="rule-dest-type">{t('inboundRules.destType')}</label>
                  <select
                    id="rule-dest-type"
                    className={s.fieldInput}
                    value={form.destination_type}
                    onChange={(e) => setForm((f) => ({ ...f, destination_type: e.target.value }))}
                  >
                    <option value="extension">{t('inboundRules.typeExtension')}</option>
                    <option value="ring_group">{t('inboundRules.typeRingGroup')}</option>
                    <option value="voicemail">{t('inboundRules.typeVoicemail')}</option>
                    <option value="ivr_menu">{t('inboundRules.typeIvr')}</option>
                  </select>
                </fieldset>

                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="rule-dest-value">{t('inboundRules.destValue')}</label>
                  <input
                    id="rule-dest-value"
                    className={s.fieldInput}
                    placeholder={t('inboundRules.placeholderDest', '101')}
                    required
                    value={form.destination_value}
                    onChange={(e) => setForm((f) => ({ ...f, destination_value: e.target.value }))}
                  />
                </fieldset>

                <fieldset className={s.field}>
                  <label className={s.fieldLabel} htmlFor="rule-priority">{t('inboundRules.priority')}</label>
                  <input
                    id="rule-priority"
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
                    id="rule-enabled"
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label className={s.fieldLabel} htmlFor="rule-enabled" style={{ cursor: 'pointer' }}>
                    {t('inboundRules.enabled')}
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
              <th>{t('inboundRules.didNumber')}</th>
              <th>{t('inboundRules.destType')}</th>
              <th>{t('inboundRules.destValue')}</th>
              <th>{t('inboundRules.priority')}</th>
              <th>{t('common.status')}</th>
              <th>{t('inboundRules.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rules.length > 0 ? (
              rules.map((rule) => (
                <tr key={rule.id}>
                  <td style={{ fontFamily: 'var(--font-mono, monospace)' }}>{rule.did_number}</td>
                  <td>
                    <span style={{ textTransform: 'capitalize' }}>
                      {rule.destination_type === 'ivr_menu' 
                        ? t('inboundRules.typeIvr') 
                        : t(`inboundRules.type${rule.destination_type.replace(/_./g, x => x[1].toUpperCase()).replace(/^[a-z]/, c => c.toUpperCase())}`)}
                    </span>
                  </td>
                  <td>{rule.destination_value}</td>
                  <td>{rule.priority}</td>
                  <td>
                    <StatusBadge
                      status={rule.enabled ? 'active' : 'inactive'}
                      label={rule.enabled ? t('common.enabled') : t('common.disabled')}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`}
                        onClick={() => handleOpenEdit(rule)}
                        aria-label={t('inboundRules.editRule')}
                      >
                        <Edit2 size={14} aria-hidden="true" />
                      </button>
                      <button
                        className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                        onClick={() => handleDelete(rule.id, rule.did_number)}
                        aria-label={t('inboundRules.deleteRule', 'Delete Rule')}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className={s.empty}>
                  {t('inboundRules.noRules')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </section>
  )
}
