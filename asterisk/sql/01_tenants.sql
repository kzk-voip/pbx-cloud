-- Tenants: core multi-tenant entity
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    domain VARCHAR(100) NOT NULL UNIQUE,      -- SIP domain, e.g. tenant1.pbx.local
    prefix VARCHAR(10) NOT NULL UNIQUE,       -- short prefix for endpoint IDs, e.g. t1
    max_extensions INT DEFAULT 10,
    max_concurrent_calls INT DEFAULT 5,
    codecs VARCHAR(200) DEFAULT 'ulaw,alaw',
    plan VARCHAR(20) DEFAULT 'basic',         -- basic, pro, enterprise
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
