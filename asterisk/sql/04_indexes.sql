-- Performance indexes for multi-tenant queries

-- ARA table indexes
CREATE INDEX idx_ps_endpoints_tenant ON ps_endpoints(tenant_id);
CREATE INDEX idx_ps_auths_tenant ON ps_auths(tenant_id);
CREATE INDEX idx_ps_aors_tenant ON ps_aors(tenant_id);
CREATE INDEX idx_ps_contacts_endpoint ON ps_contacts(endpoint);

-- Application table indexes
CREATE INDEX idx_extensions_tenant ON extensions(tenant_id);
CREATE INDEX idx_trunks_tenant ON trunks(tenant_id);

-- CDR indexes (most queried table)
CREATE INDEX idx_cdr_tenant_date ON cdr(tenant_id, calldate);
CREATE INDEX idx_cdr_src ON cdr(src);
CREATE INDEX idx_cdr_dst ON cdr(dst);
CREATE INDEX idx_cdr_disposition ON cdr(disposition);
