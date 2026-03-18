-- Application-level tables for multi-tenant PBX management

-- Extensions: application-level extension metadata (linked to ARA endpoints)
CREATE TABLE extensions (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    extension VARCHAR(20) NOT NULL,           -- e.g. 101, 102
    display_name VARCHAR(100),
    email VARCHAR(100),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, extension)
);

-- Trunks: SIP trunk configuration per tenant
CREATE TABLE trunks (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    provider VARCHAR(100),
    host VARCHAR(255) NOT NULL,
    port INT DEFAULT 5060,
    transport VARCHAR(10) DEFAULT 'udp',
    username VARCHAR(100),
    password VARCHAR(100),
    codecs VARCHAR(200) DEFAULT 'ulaw,alaw',
    max_channels INT DEFAULT 10,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- CDR: Call Detail Records per tenant
CREATE TABLE cdr (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INT NOT NULL REFERENCES tenants(id),
    src VARCHAR(80),
    dst VARCHAR(80),
    calldate TIMESTAMP DEFAULT NOW(),
    duration INT DEFAULT 0,
    billsec INT DEFAULT 0,
    disposition VARCHAR(45) DEFAULT 'NO ANSWER',
    uniqueid VARCHAR(150),
    channel VARCHAR(200),
    dstchannel VARCHAR(200),
    userfield VARCHAR(255),
    accountcode VARCHAR(20)
);
