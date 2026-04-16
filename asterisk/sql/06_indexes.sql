-- =============================================
-- Phase 5: Performance indexes
-- =============================================

-- ARA lookups (every REGISTER/INVITE triggers these)
CREATE INDEX IF NOT EXISTS idx_ps_endpoints_aors ON ps_endpoints(aors);
CREATE INDEX IF NOT EXISTS idx_ps_auths_username ON ps_auths(username);

-- CDR composite indexes for API queries
CREATE INDEX IF NOT EXISTS idx_cdr_accountcode_calldate ON cdr(accountcode, calldate);
CREATE INDEX IF NOT EXISTS idx_cdr_disposition ON cdr(disposition);

-- Tenant lookups (API + htable sync)
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active) WHERE is_active = true;

-- Extensions by tenant (API listing)
CREATE INDEX IF NOT EXISTS idx_extensions_tenant ON extensions(tenant_id);

-- pg_stat_statements for query analysis (Phase 5 optimization)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
