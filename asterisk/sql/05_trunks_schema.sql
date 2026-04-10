-- =============================================
-- Trunks: SIP trunk configuration per tenant
-- =============================================
-- Actual SIP trunk provisioning (ps_endpoints for trunks)
-- will be handled by the API layer in Phase 3.

CREATE TABLE trunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    provider VARCHAR(80),
    host VARCHAR(255) NOT NULL,
    port INT NOT NULL DEFAULT 5060,
    transport VARCHAR(10) NOT NULL DEFAULT 'udp',
    username VARCHAR(80),
    password VARCHAR(80),
    codecs VARCHAR(200) NOT NULL DEFAULT 'ulaw,alaw',
    max_channels INT NOT NULL DEFAULT 10,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_trunks_tenant_id ON trunks(tenant_id);

-- RLS for tenant isolation
ALTER TABLE trunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_trunks ON trunks
    USING (tenant_id::text = current_setting('app.tenant_id', true));
