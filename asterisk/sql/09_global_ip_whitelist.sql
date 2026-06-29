-- 09_global_ip_whitelist.sql — Global IP whitelist (immune to fail2ban)

CREATE TABLE IF NOT EXISTS global_ip_whitelist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address  VARCHAR(45) UNIQUE NOT NULL,
    description VARCHAR(255),
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_whitelist_ip ON global_ip_whitelist(ip_address);
