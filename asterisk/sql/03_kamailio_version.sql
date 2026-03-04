-- ============================================================
-- Kamailio version table (required by auth_db module)
-- ============================================================

CREATE TABLE IF NOT EXISTS version (
    table_name VARCHAR(32) NOT NULL,
    table_version INT NOT NULL DEFAULT 0,
    CONSTRAINT version_table_name_idx UNIQUE (table_name)
);

-- auth_db expects subscriber-like table version
INSERT INTO version (table_name, table_version) VALUES ('ps_auths', 7);
