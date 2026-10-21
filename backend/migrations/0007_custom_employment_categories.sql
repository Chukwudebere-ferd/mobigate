-- Jobs may carry an admin-defined employment category when none of the
-- suggested categories fit. Keep a defensive length check so custom values
-- stay display-friendly.
ALTER TABLE jobs
    DROP CONSTRAINT IF EXISTS jobs_employment_category_check;

ALTER TABLE jobs
    ADD CONSTRAINT jobs_employment_category_length
    CHECK (
        employment_category IS NULL
        OR char_length(btrim(employment_category)) BETWEEN 1 AND 80
    );
