-- 07_tenant_events.sql — Tenant event log table

CREATE TABLE IF NOT EXISTS tenant_events (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    action      VARCHAR(50) NOT NULL,
    source      VARCHAR(20),            -- sip / web / api
    ip          VARCHAR(45),
    extension   VARCHAR(40),
    details     JSONB
);

-- Indexes for typical queries
CREATE INDEX IF NOT EXISTS idx_tenant_events_tenant_id ON tenant_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_events_created_at ON tenant_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_events_action ON tenant_events(action);
