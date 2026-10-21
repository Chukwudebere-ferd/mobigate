-- A department name is unique within a tenant (case-insensitive, trimmed).
-- This lets the staff form reuse an existing department when an admin types
-- a name instead of creating duplicate rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_tenant_name
    ON departments (tenant_id, lower(btrim(name)));
