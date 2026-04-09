-- =============================================
-- Row-Level Security Policies for Tenant Isolation
-- =============================================
-- NOTE: RLS enforcement requires per-tenant DB roles or
-- setting current_setting('app.tenant_id') before queries.
-- This will be fully utilized when FastAPI (Phase 3) connects
-- with tenant-scoped sessions. For now, this establishes
-- the security foundation.

-- Enable RLS on tenant-scoped tables
ALTER TABLE ps_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE ps_auths ENABLE ROW LEVEL SECURITY;
ALTER TABLE ps_aors ENABLE ROW LEVEL SECURITY;
ALTER TABLE extensions ENABLE ROW LEVEL SECURITY;

-- Policy: restrict access to rows matching current tenant
-- Uses session variable 'app.tenant_id' set by the API layer
CREATE POLICY tenant_isolation_endpoints ON ps_endpoints
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_auths ON ps_auths
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_aors ON ps_aors
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_extensions ON extensions
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- The superuser / table owner bypasses RLS by default.
-- Asterisk (connecting as pbx_user who owns the tables) bypasses RLS,
-- which is correct — Asterisk needs to see ALL endpoints.
-- The API layer (Phase 3) will use a restricted role.
