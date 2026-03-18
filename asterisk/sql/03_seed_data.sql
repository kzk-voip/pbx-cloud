-- =============================================
-- Seed Data: 2 Tenants with Extensions
-- =============================================

-- Tenant: Acme Corp
INSERT INTO tenants (id, slug, domain, name, max_extensions, max_concurrent_calls, codecs)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'acme',
    'acme.pbx.local',
    'Acme Corporation',
    10,
    5,
    'ulaw,alaw'
);

-- Tenant: Globex Inc
INSERT INTO tenants (id, slug, domain, name, max_extensions, max_concurrent_calls, codecs)
VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'globex',
    'globex.pbx.local',
    'Globex Inc',
    10,
    5,
    'ulaw,alaw'
);

-- =============================================
-- Acme Extensions (101, 102)
-- =============================================

-- Extension metadata
INSERT INTO extensions (tenant_id, extension_number, display_name)
VALUES
    ('a0000000-0000-0000-0000-000000000001', '101', 'Acme User 101'),
    ('a0000000-0000-0000-0000-000000000001', '102', 'Acme User 102');

-- PJSIP Endpoints (composite ID: {slug}_{ext})
INSERT INTO ps_endpoints (id, tenant_id, transport, aors, auth, context, disallow, allow, direct_media, force_rport, rewrite_contact, rtp_symmetric, dtmf_mode, callerid)
VALUES
    ('acme_101', 'a0000000-0000-0000-0000-000000000001', 'transport-udp', 'acme_101', 'acme_101', 'from-kamailio', 'all', 'ulaw', false, true, true, true, 'rfc4733', '"Acme 101" <101>'),
    ('acme_102', 'a0000000-0000-0000-0000-000000000001', 'transport-udp', 'acme_102', 'acme_102', 'from-kamailio', 'all', 'ulaw', false, true, true, true, 'rfc4733', '"Acme 102" <102>');

-- PJSIP Auth
INSERT INTO ps_auths (id, tenant_id, auth_type, username, password)
VALUES
    ('acme_101', 'a0000000-0000-0000-0000-000000000001', 'userpass', 'acme_101', 'acme101pass'),
    ('acme_102', 'a0000000-0000-0000-0000-000000000001', 'userpass', 'acme_102', 'acme102pass');

-- PJSIP AOR
INSERT INTO ps_aors (id, tenant_id, max_contacts, support_path, qualify_frequency)
VALUES
    ('acme_101', 'a0000000-0000-0000-0000-000000000001', 1, true, 30),
    ('acme_102', 'a0000000-0000-0000-0000-000000000001', 1, true, 30);

-- =============================================
-- Globex Extensions (201, 202)
-- =============================================

-- Extension metadata
INSERT INTO extensions (tenant_id, extension_number, display_name)
VALUES
    ('b0000000-0000-0000-0000-000000000002', '201', 'Globex User 201'),
    ('b0000000-0000-0000-0000-000000000002', '202', 'Globex User 202');

-- PJSIP Endpoints
INSERT INTO ps_endpoints (id, tenant_id, transport, aors, auth, context, disallow, allow, direct_media, force_rport, rewrite_contact, rtp_symmetric, dtmf_mode, callerid)
VALUES
    ('globex_201', 'b0000000-0000-0000-0000-000000000002', 'transport-udp', 'globex_201', 'globex_201', 'from-kamailio', 'all', 'ulaw', false, true, true, true, 'rfc4733', '"Globex 201" <201>'),
    ('globex_202', 'b0000000-0000-0000-0000-000000000002', 'transport-udp', 'globex_202', 'globex_202', 'from-kamailio', 'all', 'ulaw', false, true, true, true, 'rfc4733', '"Globex 202" <202>');

-- PJSIP Auth
INSERT INTO ps_auths (id, tenant_id, auth_type, username, password)
VALUES
    ('globex_201', 'b0000000-0000-0000-0000-000000000002', 'userpass', 'globex_201', 'globex201pass'),
    ('globex_202', 'b0000000-0000-0000-0000-000000000002', 'userpass', 'globex_202', 'globex202pass');

-- PJSIP AOR
INSERT INTO ps_aors (id, tenant_id, max_contacts, support_path, qualify_frequency)
VALUES
    ('globex_201', 'b0000000-0000-0000-0000-000000000002', 1, true, 30),
    ('globex_202', 'b0000000-0000-0000-0000-000000000002', 1, true, 30);
