-- ============================================================
-- Epic 2.1: Tenant Data Model
-- ============================================================

-- TENANTS: Core tenant configuration
CREATE TABLE tenants (
    id VARCHAR(20) PRIMARY KEY,
    domain VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    max_extensions INT DEFAULT 50,
    max_concurrent_calls INT DEFAULT 10,
    codecs VARCHAR(100) DEFAULT 'ulaw,alaw',
    plan VARCHAR(20) DEFAULT 'basic',
    created_at TIMESTAMP DEFAULT NOW(),
    active BOOLEAN DEFAULT true
);

-- Add tenant_id to ARA tables
ALTER TABLE ps_endpoints ADD COLUMN tenant_id VARCHAR(20) REFERENCES tenants(id);
ALTER TABLE ps_auths ADD COLUMN tenant_id VARCHAR(20) REFERENCES tenants(id);
ALTER TABLE ps_aors ADD COLUMN tenant_id VARCHAR(20) REFERENCES tenants(id);

CREATE INDEX idx_ps_endpoints_tenant ON ps_endpoints(tenant_id);
CREATE INDEX idx_ps_auths_tenant ON ps_auths(tenant_id);
CREATE INDEX idx_ps_aors_tenant ON ps_aors(tenant_id);

-- CDR: Call Detail Records per tenant
CREATE TABLE cdr (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(20) REFERENCES tenants(id),
    calldate TIMESTAMP NOT NULL DEFAULT NOW(),
    src VARCHAR(80),
    dst VARCHAR(80),
    duration INT,
    billsec INT,
    disposition VARCHAR(45),
    uniqueid VARCHAR(150),
    channel VARCHAR(200),
    dstchannel VARCHAR(200)
);

CREATE INDEX idx_cdr_tenant ON cdr(tenant_id);
CREATE INDEX idx_cdr_calldate ON cdr(calldate);

-- TRUNKS: SIP trunks per tenant
CREATE TABLE trunks (
    id VARCHAR(40) PRIMARY KEY,
    tenant_id VARCHAR(20) REFERENCES tenants(id),
    name VARCHAR(80) NOT NULL,
    trunk_type VARCHAR(20) DEFAULT 'sip',
    host VARCHAR(80),
    port INT DEFAULT 5060,
    username VARCHAR(40),
    password VARCHAR(80),
    codecs VARCHAR(100),
    active BOOLEAN DEFAULT true
);

-- ============================================================
-- Row-Level Security (RLS)
-- NOTE: RLS does not apply to table owners (pbx_user).
-- A separate role (pbx_api) should be used for API access.
-- ============================================================

ALTER TABLE ps_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE ps_auths ENABLE ROW LEVEL SECURITY;
ALTER TABLE ps_aors ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdr ENABLE ROW LEVEL SECURITY;
ALTER TABLE trunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_endpoints ON ps_endpoints
    USING (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation_auths ON ps_auths
    USING (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation_aors ON ps_aors
    USING (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation_cdr ON cdr
    USING (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation_trunks ON trunks
    USING (tenant_id = current_setting('app.current_tenant', true));

-- ============================================================
-- Seed Data: two test tenants
-- ============================================================

-- Clean up old single-tenant test data
DELETE FROM ps_contacts;
DELETE FROM ps_endpoints;
DELETE FROM ps_auths;
DELETE FROM ps_aors;

-- Tenants
INSERT INTO tenants (id, domain, name) VALUES
    ('t1', 'alpha.pbx.local', 'Alpha Corp'),
    ('t2', 'beta.pbx.local', 'Beta Inc');

-- Alpha Corp (t1): endpoints t1_101, t1_102
INSERT INTO ps_aors (id, max_contacts, tenant_id) VALUES
    ('t1_101', 1, 't1'), ('t1_102', 1, 't1');
INSERT INTO ps_auths (id, auth_type, username, password, tenant_id) VALUES
    ('t1_101', 'userpass', 't1_101', 'pass101', 't1'),
    ('t1_102', 'userpass', 't1_102', 'pass102', 't1');
INSERT INTO ps_endpoints (id, aors, auth, context, disallow, allow, direct_media, force_rport, rewrite_contact, rtp_symmetric, transport, tenant_id) VALUES
    ('t1_101', 't1_101', 't1_101', 'from-kamailio', 'all', 'ulaw', false, true, true, true, 'transport-udp', 't1'),
    ('t1_102', 't1_102', 't1_102', 'from-kamailio', 'all', 'ulaw', false, true, true, true, 'transport-udp', 't1');

-- Beta Inc (t2): endpoints t2_101, t2_102
INSERT INTO ps_aors (id, max_contacts, tenant_id) VALUES
    ('t2_101', 1, 't2'), ('t2_102', 1, 't2');
INSERT INTO ps_auths (id, auth_type, username, password, tenant_id) VALUES
    ('t2_101', 'userpass', 't2_101', 'pass101', 't2'),
    ('t2_102', 'userpass', 't2_102', 'pass102', 't2');
INSERT INTO ps_endpoints (id, aors, auth, context, disallow, allow, direct_media, force_rport, rewrite_contact, rtp_symmetric, transport, tenant_id) VALUES
    ('t2_101', 't2_101', 't2_101', 'from-kamailio', 'all', 'ulaw', false, true, true, true, 'transport-udp', 't2'),
    ('t2_102', 't2_102', 't2_102', 'from-kamailio', 'all', 'ulaw', false, true, true, true, 'transport-udp', 't2');
