-- Seed data: 2 demo tenants with 2 extensions each
-- Tenant prefixes: t1, t2
-- Endpoint naming: {prefix}_{extension}, e.g. t1_101

-- ============================================================
-- Tenants
-- ============================================================
INSERT INTO tenants (name, domain, prefix, max_extensions, max_concurrent_calls, codecs)
VALUES
    ('Acme Corp',   'tenant1.pbx.local', 't1', 10, 5, 'ulaw,alaw'),
    ('Globex Inc',  'tenant2.pbx.local', 't2', 10, 5, 'ulaw,alaw');

-- ============================================================
-- Tenant 1 (Acme Corp) — extensions 101, 102
-- ============================================================

-- AOR (support_path=TRUE so Asterisk routes outbound calls via Kamailio Path)
INSERT INTO ps_aors (id, max_contacts, qualify_frequency, support_path, tenant_id)
VALUES
    ('t1_101', 1, 30, TRUE, 1),
    ('t1_102', 1, 30, TRUE, 1);

-- AUTH
INSERT INTO ps_auths (id, auth_type, username, password, tenant_id)
VALUES
    ('t1_101', 'userpass', '101', 't1_101pass', 1),
    ('t1_102', 'userpass', '102', 't1_102pass', 1);

-- ENDPOINTS (no auth — Asterisk trusts Kamailio on internal Docker network)
-- Auth records in ps_auths are kept for future Kamailio-level authentication (Phase 4)
INSERT INTO ps_endpoints (id, transport, aors, context, disallow, allow,
    direct_media, force_rport, rewrite_contact, rtp_symmetric, callerid, tenant_id)
VALUES
    ('t1_101', 'transport-udp', 't1_101', 'from-kamailio', 'all', 'ulaw',
     FALSE, TRUE, FALSE, TRUE, '"Acme 101" <101>', 1),
    ('t1_102', 'transport-udp', 't1_102', 'from-kamailio', 'all', 'ulaw',
     FALSE, TRUE, FALSE, TRUE, '"Acme 102" <102>', 1);

-- Application-level extension metadata
INSERT INTO extensions (tenant_id, extension, display_name)
VALUES
    (1, '101', 'Acme Reception'),
    (1, '102', 'Acme Sales');

-- ============================================================
-- Tenant 2 (Globex Inc) — extensions 101, 102
-- ============================================================

-- AOR
INSERT INTO ps_aors (id, max_contacts, qualify_frequency, support_path, tenant_id)
VALUES
    ('t2_101', 1, 30, TRUE, 2),
    ('t2_102', 1, 30, TRUE, 2);

-- AUTH
INSERT INTO ps_auths (id, auth_type, username, password, tenant_id)
VALUES
    ('t2_101', 'userpass', '101', 't2_101pass', 2),
    ('t2_102', 'userpass', '102', 't2_102pass', 2);

-- ENDPOINTS (no auth — trusted proxy)
INSERT INTO ps_endpoints (id, transport, aors, context, disallow, allow,
    direct_media, force_rport, rewrite_contact, rtp_symmetric, callerid, tenant_id)
VALUES
    ('t2_101', 'transport-udp', 't2_101', 'from-kamailio', 'all', 'ulaw',
     FALSE, TRUE, FALSE, TRUE, '"Globex 101" <101>', 2),
    ('t2_102', 'transport-udp', 't2_102', 'from-kamailio', 'all', 'ulaw',
     FALSE, TRUE, FALSE, TRUE, '"Globex 102" <102>', 2);

-- Application-level extension metadata
INSERT INTO extensions (tenant_id, extension, display_name)
VALUES
    (2, '101', 'Globex Reception'),
    (2, '102', 'Globex Support');
