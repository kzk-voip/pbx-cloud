-- 08_tenant_ip_acl.sql — Per-tenant IP whitelist (ACL)

CREATE TABLE IF NOT EXISTS tenant_ip_acl (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ip_address  VARCHAR(45) NOT NULL,
    description VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_ip_acl UNIQUE (tenant_id, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_tenant_ip_acl_tenant ON tenant_ip_acl(tenant_id);
