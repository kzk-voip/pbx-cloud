-- ============================================================
-- 02_tenant_schema.sql
-- Multi-tenant data model: tenants, extensions, CDR
-- + seed data for demo environment
-- ============================================================

-- ---- Tenants table ----
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    max_extensions INT NOT NULL DEFAULT 10,
    max_concurrent_calls INT NOT NULL DEFAULT 5,
    codecs VARCHAR(200) NOT NULL DEFAULT 'ulaw,alaw',
    plan VARCHAR(40) NOT NULL DEFAULT 'basic',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Extensions table (our app-level view of SIP extensions) ----
CREATE TABLE extensions (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    extension VARCHAR(20) NOT NULL,
    display_name VARCHAR(100),
    email VARCHAR(255),
    voicemail_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, extension)
);

-- ---- CDR table ----
CREATE TABLE cdr (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    src VARCHAR(80) NOT NULL,
    dst VARCHAR(80) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    answer_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration INT NOT NULL DEFAULT 0,
    billsec INT NOT NULL DEFAULT 0,
    disposition VARCHAR(40) NOT NULL DEFAULT 'NO ANSWER',
    uniqueid VARCHAR(150)
);

-- ---- Foreign keys on ARA tables (deferred, since 01_ara creates them first) ----
ALTER TABLE ps_endpoints ADD CONSTRAINT fk_endpoints_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;

ALTER TABLE ps_auths ADD CONSTRAINT fk_auths_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;

ALTER TABLE ps_aors ADD CONSTRAINT fk_aors_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;

-- ---- Indexes ----
CREATE INDEX idx_ps_endpoints_tenant ON ps_endpoints(tenant_id);
CREATE INDEX idx_ps_auths_tenant ON ps_auths(tenant_id);
CREATE INDEX idx_ps_aors_tenant ON ps_aors(tenant_id);
CREATE INDEX idx_extensions_tenant ON extensions(tenant_id);
CREATE INDEX idx_cdr_tenant_start ON cdr(tenant_id, start_time);
CREATE INDEX idx_cdr_uniqueid ON cdr(uniqueid);

-- ============================================================
-- SEED DATA: 2 demo tenants, 2 extensions each
-- ============================================================

-- Tenant 1: Acme Corp
INSERT INTO tenants (id, domain, name, max_extensions, max_concurrent_calls, codecs, plan)
VALUES (1, 'acme.pbx.local', 'Acme Corp', 10, 5, 'ulaw,alaw', 'basic');

-- Tenant 2: Globex Inc
INSERT INTO tenants (id, domain, name, max_extensions, max_concurrent_calls, codecs, plan)
VALUES (2, 'globex.pbx.local', 'Globex Inc', 10, 5, 'ulaw,alaw', 'basic');

-- Reset sequence after explicit IDs
SELECT setval('tenants_id_seq', 2);

-- ---- App-level extension records ----
INSERT INTO extensions (tenant_id, extension, display_name, voicemail_enabled)
VALUES
    (1, '101', 'Acme User 101', TRUE),
    (1, '102', 'Acme User 102', TRUE),
    (2, '201', 'Globex User 201', TRUE),
    (2, '202', 'Globex User 202', TRUE);

-- ---- ARA: PJSIP Endpoints ----
-- Acme endpoints (context = tenant-internal, set_var passes tenant info)
INSERT INTO ps_endpoints (id, transport, aors, auth, context, disallow, allow,
    direct_media, force_rport, rewrite_contact, rtp_symmetric, callerid, tenant_id, set_var)
VALUES
    ('101', 'transport-udp', '101', '101', 'tenant-internal', 'all', 'ulaw',
     FALSE, TRUE, TRUE, TRUE, '"Acme 101" <101>', 1, 'TENANT_ID=1'),
    ('102', 'transport-udp', '102', '102', 'tenant-internal', 'all', 'ulaw',
     FALSE, TRUE, TRUE, TRUE, '"Acme 102" <102>', 1, 'TENANT_ID=1');

-- Globex endpoints
INSERT INTO ps_endpoints (id, transport, aors, auth, context, disallow, allow,
    direct_media, force_rport, rewrite_contact, rtp_symmetric, callerid, tenant_id, set_var)
VALUES
    ('201', 'transport-udp', '201', '201', 'tenant-internal', 'all', 'ulaw',
     FALSE, TRUE, TRUE, TRUE, '"Globex 201" <201>', 2, 'TENANT_ID=2'),
    ('202', 'transport-udp', '202', '202', 'tenant-internal', 'all', 'ulaw',
     FALSE, TRUE, TRUE, TRUE, '"Globex 202" <202>', 2, 'TENANT_ID=2');

-- ---- ARA: PJSIP Auth ----
INSERT INTO ps_auths (id, auth_type, username, password, tenant_id)
VALUES
    ('101', 'userpass', '101', '101pass', 1),
    ('102', 'userpass', '102', '102pass', 1),
    ('201', 'userpass', '201', '201pass', 2),
    ('202', 'userpass', '202', '202pass', 2);

-- ---- ARA: PJSIP AORs ----
INSERT INTO ps_aors (id, max_contacts, remove_existing, qualify_frequency, tenant_id)
VALUES
    ('101', 1, true, 60, 1),
    ('102', 1, true, 60, 1),
    ('201', 1, true, 60, 2),
    ('202', 1, true, 60, 2);

-- ---- Domain aliases for multi-tenant ----
INSERT INTO ps_domain_aliases (id, domain)
VALUES
    ('acme.pbx.local', 'acme.pbx.local'),
    ('globex.pbx.local', 'globex.pbx.local');
