import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ShieldAlert, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'
import s from '../shared.module.css'
import styles from '../IpAccess/IpAccess.module.css'

export default function TenantIpAcl({ tenantId }) {
  const queryClient = useQueryClient()
  const [ip, setIp] = useState('')
  const [desc, setDesc] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-ip-acl', tenantId],
    queryFn: () => client.get(`/tenants/${tenantId}/ip-acl`).then((r) => r.data),
    enabled: !!tenantId,
  })

  const addEntry = useMutation({
    mutationFn: (body) => client.post(`/tenants/${tenantId}/ip-acl`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-ip-acl', tenantId] })
      setIp('')
      setDesc('')
      toast.success('IP added to tenant ACL')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to add'),
  })

  const removeEntry = useMutation({
    mutationFn: (entryId) => client.delete(`/tenants/${tenantId}/ip-acl/${entryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-ip-acl', tenantId] })
      toast.success('IP removed from tenant ACL')
    },
    onError: () => toast.error('Failed to remove'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!ip.trim()) return
    addEntry.mutate({ ip_address: ip.trim(), description: desc.trim() || null })
  }

  const aclEnabled = data?.total > 0

  return (
    <section>
      {/* Warning about strict mode */}
      <aside className={styles.warningBanner} style={{ borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)' }}>
        <AlertTriangle size={16} className={styles.warningIcon} aria-hidden="true" />
        <span>
          {aclEnabled
            ? 'IP ACL is ACTIVE — only listed IPs can register SIP endpoints and access this tenant'
            : 'IP ACL is disabled — all IPs are allowed. Adding the first IP enables strict mode.'
          }
        </span>
      </aside>

      <article className={styles.section}>
        <header className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            <ShieldAlert size={20} className={styles.sectionIcon} aria-hidden="true" />
            Allowed IP Addresses
            {data?.total > 0 && (
              <span className={styles.sectionBadge}>{data.total}</span>
            )}
          </h3>
        </header>

        <form className={styles.addForm} onSubmit={handleSubmit}>
          <label className={styles.formField}>
            <span className={styles.formLabel}>IP Address</span>
            <input
              className={styles.formInput}
              type="text"
              placeholder="10.0.1.50"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              autoComplete="off"
              id="tenant-acl-ip-input"
            />
          </label>
          <label className={styles.formField}>
            <span className={styles.formLabel}>Description</span>
            <input
              className={styles.formInput}
              type="text"
              placeholder="Office, VPN server..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              autoComplete="off"
              id="tenant-acl-desc-input"
            />
          </label>
          <button
            type="submit"
            className={`${s.btn} ${s.btnPrimary}`}
            disabled={addEntry.isPending || !ip.trim()}
            id="add-tenant-acl-btn"
          >
            <Plus size={16} aria-hidden="true" />
            Add
          </button>
        </form>

        {isLoading ? (
          <p className={s.loading}>Loading…</p>
        ) : !data?.items?.length ? (
          <p className={s.empty}>No IP restrictions — all IPs are allowed</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>IP Address</th>
                <th>Description</th>
                <th>Added</th>
                <th style={{ width: 48 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td className={styles.ipCell}>{item.ip_address}</td>
                  <td>{item.description || '—'}</td>
                  <td>{new Date(item.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      className={`${s.btn} ${s.btnDanger} ${s.btnSmall}`}
                      onClick={() => removeEntry.mutate(item.id)}
                      aria-label={`Remove ${item.ip_address}`}
                      id={`remove-acl-${item.id}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
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
