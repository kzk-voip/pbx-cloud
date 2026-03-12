-- ============================================================
-- 03_trunks_and_rls.sql
-- Epic 2.1: Trunks table + Row-Level Security (RLS)
-- ============================================================

-- ---- Trunks table (SIP trunk config per tenant) ----
CREATE TABLE trunks (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INT NOT NULL DEFAULT 5060,
    transport VARCHAR(10) NOT NULL DEFAULT 'udp',
    username VARCHAR(80),
    password VARCHAR(80),
    codecs VARCHAR(200) NOT NULL DEFAULT 'ulaw,alaw',
    max_channels INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_trunks_tenant ON trunks(tenant_id);

-- ============================================================
-- API user role (used by FastAPI in Phase 3)
-- pbx_user is the table owner and bypasses RLS by default.
-- api_user will have tenant-scoped access enforced via RLS.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'api_user') THEN
        CREATE ROLE api_user LOGIN PASSWORD 'changeme';
    END IF;
END$$;

-- Grant permissions to api_user
GRANT USAGE ON SCHEMA public TO api_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON
    tenants, extensions, cdr, trunks TO api_user;
GRANT SELECT ON
    ps_endpoints, ps_auths, ps_aors, ps_contacts, ps_domain_aliases TO api_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO api_user;

-- ============================================================
-- Row-Level Security policies
-- ============================================================
-- Convention: FastAPI sets `SET app.tenant_id = X` on each request.
-- super_admin sets app.tenant_id = 0 to bypass (policy allows all when 0).

-- ---- extensions ----
ALTER TABLE extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_extensions ON extensions
    USING (
        current_setting('app.tenant_id', true)::int = 0
        OR tenant_id = current_setting('app.tenant_id', true)::int
    );

-- ---- cdr ----
ALTER TABLE cdr ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cdr ON cdr
    USING (
        current_setting('app.tenant_id', true)::int = 0
        OR tenant_id = current_setting('app.tenant_id', true)::int
    );

-- ---- trunks ----
ALTER TABLE trunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_trunks ON trunks
    USING (
        current_setting('app.tenant_id', true)::int = 0
        OR tenant_id = current_setting('app.tenant_id', true)::int
    );

-- ---- tenants (tenant_admin can only see own tenant) ----
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tenants ON tenants
    USING (
        current_setting('app.tenant_id', true)::int = 0
        OR id = current_setting('app.tenant_id', true)::int
    );
