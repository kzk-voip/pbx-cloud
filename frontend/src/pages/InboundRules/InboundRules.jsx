import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore'
import TenantInboundRules from '../Tenants/TenantInboundRules'
import client from '../../api/client'
import s from '../shared.module.css'

export default function InboundRules() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [selectedTenantId, setSelectedTenantId] = useState('')

  // If super_admin, fetch list of tenants to select
  const isSuperAdmin = user?.role === 'super_admin'

  const { data: tenantsData } = useQuery({
    queryKey: ['tenants-list'],
    queryFn: () => client.get('/tenants').then((r) => r.data),
    enabled: isSuperAdmin,
  })

  const tenantId = isSuperAdmin ? selectedTenantId : user?.tenant_id

  return (
    <>
      <header style={{ marginBottom: 'var(--space-3)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
          {t('inboundRules.title')}
        </h1>
      </header>

      {isSuperAdmin && (
        <fieldset className={s.field} style={{ maxWidth: '300px', marginBottom: 'var(--space-3)' }}>
          <label className={s.fieldLabel} htmlFor="tenant-select">Select Tenant</label>
          <select
            id="tenant-select"
            className={s.fieldInput}
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
          >
            <option value="">-- Choose a Tenant --</option>
            {tenantsData?.items?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.domain})
              </option>
            ))}
          </select>
        </fieldset>
      )}

      {tenantId ? (
        <TenantInboundRules tenantId={tenantId} />
      ) : (
        <p className={s.empty}>
          {isSuperAdmin ? 'Please select a tenant to manage inbound rules.' : 'No tenant association found.'}
        </p>
      )}
    </>
  )
}
