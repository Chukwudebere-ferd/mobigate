-- Candidate portal support (README §M9 draft/resume, §M12 delivery retry).

-- Onboarding drafts: an opaque form snapshot for the redeemed code. JSONB is
-- right here because the values are never queried by field; staff_profiles
-- keeps the structured columns for the submitted record (README §9.4).
CREATE TABLE staff_drafts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_code_id UUID NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
    tenant_id      UUID NOT NULL REFERENCES tenants(id),
    data           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, access_code_id)
);

-- Notification delivery retry (BR-16): the worker claims pending rows and
-- backs off exponentially before marking a delivery permanently failed.
ALTER TABLE notifications
    ADD COLUMN attempts      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN next_attempt_at TIMESTAMPTZ;

-- BR-17: the access code must never be rendered into an email. The template
-- previously carried {{access_code}}; it now tells the candidate how the
-- code reaches them instead.
UPDATE message_templates
SET body = E'Dear {{applicant_name}},\n\nYou have been appointed. Your access code for the Mobigate Group Staff Portal has been generated and will reach you through your recruitment contact.\n\nIf you did not expect this, or if you have not received your code, contact the HR department.\n\nMobigate Group',
    variables = '{"applicant_name":"Full name of the candidate"}'
WHERE key = 'access_code_issued' AND channel = 'email';

-- M12: staff profile created notification.
INSERT INTO message_templates (tenant_id, key, channel, subject, body, variables)
SELECT NULL, 'staff_created', 'email',
       'Welcome to Mobigate Group — your Staff ID',
       E'Dear {{staff_name}},\n\nYour staff profile has been created. Welcome to Mobigate Group.\n\nYour Staff ID is: {{staff_id}}\n\nKeep this ID safe; you will need it whenever you contact the HR department.\n\nMobigate Group',
       '{"staff_name":"Full name of the staff member","staff_id":"Generated Staff ID"}'
WHERE NOT EXISTS (
    SELECT 1 FROM message_templates WHERE key = 'staff_created' AND channel = 'email'
);

-- M12: rejection notice.
INSERT INTO message_templates (tenant_id, key, channel, subject, body, variables)
SELECT NULL, 'application_rejected', 'email',
       'An update on your application — {{job_title}}',
       E'Dear {{applicant_name}},\n\nThank you for applying for the {{job_title}} role at Mobigate Group and for the time you invested in the process.\n\nAfter careful review, we will not be moving forward with your application at this time. We encourage you to apply for future openings that match your profile.\n\nWe wish you every success.\n\nMobigate Group',
       '{"applicant_name":"Full name of the candidate","job_title":"Title of the role applied for"}'
WHERE NOT EXISTS (
    SELECT 1 FROM message_templates WHERE key = 'application_rejected' AND channel = 'email'
);
