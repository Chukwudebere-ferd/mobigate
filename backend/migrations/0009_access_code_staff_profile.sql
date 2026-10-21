-- Staff access codes can target either an application (a shortlisted applicant
-- who has not onboarded yet) or an existing staff profile (a manually created
-- staff record). Linking to the profile lets onboarding update that record
-- instead of inserting a duplicate and allocating a second Staff ID.
ALTER TABLE access_codes
    ADD COLUMN IF NOT EXISTS staff_profile_id UUID
        REFERENCES staff_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_access_codes_staff_profile
    ON access_codes(staff_profile_id);
