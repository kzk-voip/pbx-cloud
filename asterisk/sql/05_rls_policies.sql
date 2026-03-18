-- Row-Level Security (RLS) policies for tenant isolation
-- These policies are PREPARED but NOT ENABLED yet.
-- They will be activated in Phase 3 when FastAPI uses per-tenant DB roles.
--
-- Why disabled now:
--   Asterisk's res_config_pgsql connects as a single user (pbx_user) with no
--   tenant context. RLS requires SET app.current_tenant_id = X per session,
--   which is only possible from the application layer (FastAPI).

-- Policy for ps_endpoints
-- ALTER TABLE ps_endpoints ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation_endpoints ON ps_endpoints
--     USING (tenant_id = current_setting('app.current_tenant_id')::INT);

-- Policy for ps_auths
-- ALTER TABLE ps_auths ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation_auths ON ps_auths
--     USING (tenant_id = current_setting('app.current_tenant_id')::INT);

-- Policy for ps_aors
-- ALTER TABLE ps_aors ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation_aors ON ps_aors
--     USING (tenant_id = current_setting('app.current_tenant_id')::INT);

-- Policy for extensions
-- ALTER TABLE extensions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation_extensions ON extensions
--     USING (tenant_id = current_setting('app.current_tenant_id')::INT);

-- Policy for trunks
-- ALTER TABLE trunks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation_trunks ON trunks
--     USING (tenant_id = current_setting('app.current_tenant_id')::INT);

-- Policy for cdr
-- ALTER TABLE cdr ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation_cdr ON cdr
--     USING (tenant_id = current_setting('app.current_tenant_id')::INT);
