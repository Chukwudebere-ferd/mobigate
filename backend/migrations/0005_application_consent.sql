-- NDPA consent captured at application time.
--
-- The accepting server writes the timestamp itself; it is never supplied by
-- the browser. The notice version records which privacy wording the applicant
-- agreed to. Existing applications remain NULL rather than being backfilled
-- with consent they never gave.

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS consent_version TEXT;
