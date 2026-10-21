-- Group-wide administrative settings.
--
-- A single row holds the access-code policy used by the Go API when issuing
-- codes. Keeping it in the database makes the Settings screen authoritative
-- instead of a browser-only preference.

CREATE TABLE IF NOT EXISTS admin_settings (
    id                      SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    access_code_length      INTEGER NOT NULL DEFAULT 6
                            CHECK (access_code_length BETWEEN 4 AND 12),
    access_code_ttl_days    INTEGER NOT NULL DEFAULT 14
                            CHECK (access_code_ttl_days BETWEEN 1 AND 90),
    access_code_max_attempts INTEGER NOT NULL DEFAULT 3
                            CHECK (access_code_max_attempts BETWEEN 1 AND 10),
    updated_by              UUID REFERENCES users(id),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO admin_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
