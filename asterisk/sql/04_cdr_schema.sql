-- =============================================
-- CDR (Call Detail Records) with tenant tracking
-- =============================================

CREATE TABLE cdr (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    calldate TIMESTAMPTZ NOT NULL DEFAULT now(),
    clid VARCHAR(80) DEFAULT '',
    src VARCHAR(80) DEFAULT '',
    dst VARCHAR(80) DEFAULT '',
    dcontext VARCHAR(80) DEFAULT '',
    channel VARCHAR(80) DEFAULT '',
    dstchannel VARCHAR(80) DEFAULT '',
    lastapp VARCHAR(80) DEFAULT '',
    lastdata VARCHAR(200) DEFAULT '',
    duration INT NOT NULL DEFAULT 0,
    billsec INT NOT NULL DEFAULT 0,
    disposition VARCHAR(45) DEFAULT '',
    amaflags INT NOT NULL DEFAULT 0,
    accountcode VARCHAR(20) DEFAULT '',
    uniqueid VARCHAR(150) DEFAULT '',
    userfield VARCHAR(255) DEFAULT '',
    peeraccount VARCHAR(80) DEFAULT '',
    linkedid VARCHAR(150) DEFAULT '',
    sequence INT DEFAULT 0
);

-- Performance indexes for CDR queries
CREATE INDEX idx_cdr_calldate ON cdr(calldate);
CREATE INDEX idx_cdr_accountcode ON cdr(accountcode);
CREATE INDEX idx_cdr_src ON cdr(src);
CREATE INDEX idx_cdr_dst ON cdr(dst);
CREATE INDEX idx_cdr_tenant_calldate ON cdr(tenant_id, calldate);

-- Enable RLS for tenant isolation (used by API in Phase 3)
ALTER TABLE cdr ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_cdr ON cdr
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Function + trigger: auto-set tenant_id from accountcode on INSERT
-- accountcode is set to tenant slug in dialplan (e.g., 'acme')
CREATE OR REPLACE FUNCTION cdr_set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.accountcode IS NOT NULL AND NEW.accountcode != '' THEN
        SELECT id INTO NEW.tenant_id
        FROM tenants
        WHERE slug = NEW.accountcode
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cdr_set_tenant_id
    BEFORE INSERT ON cdr
    FOR EACH ROW
    EXECUTE FUNCTION cdr_set_tenant_id();
