-- Seed data for the MGM-Portal MVP.
--
-- The location tree is the backbone of the application form and of the
-- location filter. It is seeded here so a fresh database is immediately
-- usable.
--
-- Idempotent: safe to re-run.

INSERT INTO locations (id, type, name, code, slug, status)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'country', 'Nigeria', 'NG', 'nigeria', 'approved')
ON CONFLICT (slug) DO NOTHING;

-- States
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES
    ('10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000001', 'state', 'Lagos', 'LA', 'lagos', 'approved'),
    ('10000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000001', 'state', 'Abuja (FCT)', 'FC', 'abuja-fct', 'approved'),
    ('10000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-000000000001', 'state', 'Rivers', 'RI', 'rivers', 'approved'),
    ('10000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-000000000001', 'state', 'Oyo', 'OY', 'oyo', 'approved'),
    ('10000000-0000-0000-0000-000000000105', '10000000-0000-0000-0000-000000000001', 'state', 'Enugu', 'EN', 'enugu', 'approved')
ON CONFLICT (slug) DO NOTHING;

-- Lagos LGAs
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
    ('10000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000101', 'lga', 'Ikeja', 'ikeja', 'approved'),
    ('10000000-0000-0000-0000-000000000202', '10000000-0000-0000-0000-000000000101', 'lga', 'Eti-Osa', 'eti-osa', 'approved'),
    ('10000000-0000-0000-0000-000000000203', '10000000-0000-0000-0000-000000000101', 'lga', 'Surulere', 'surulere', 'approved'),
    ('10000000-0000-0000-0000-000000000204', '10000000-0000-0000-0000-000000000101', 'lga', 'Mushin', 'mushin', 'approved'),
    ('10000000-0000-0000-0000-000000000205', '10000000-0000-0000-0000-000000000101', 'lga', 'Lagos Island', 'lagos-island', 'approved'),
    ('10000000-0000-0000-0000-000000000206', '10000000-0000-0000-0000-000000000101', 'lga', 'Ojota', 'ojota', 'approved')
ON CONFLICT (slug) DO NOTHING;

-- FCT LGAs
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
    ('10000000-0000-0000-0000-000000000211', '10000000-0000-0000-0000-000000000102', 'lga', 'Bwari', 'bwari', 'approved'),
    ('10000000-0000-0000-0000-000000000212', '10000000-0000-0000-0000-000000000102', 'lga', 'Kuje', 'kuje', 'approved'),
    ('10000000-0000-0000-0000-000000000213', '10000000-0000-0000-0000-000000000102', 'lga', 'Municipal', 'municipal', 'approved')
ON CONFLICT (slug) DO NOTHING;

-- Rivers LGAs
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
    ('10000000-0000-0000-0000-000000000221', '10000000-0000-0000-0000-000000000103', 'lga', 'Port Harcourt', 'port-harcourt', 'approved'),
    ('10000000-0000-0000-0000-000000000222', '10000000-0000-0000-0000-000000000103', 'lga', 'Obio-Akpor', 'obio-akpor', 'approved')
ON CONFLICT (slug) DO NOTHING;

-- Oyo and Enugu LGAs
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
    ('10000000-0000-0000-0000-000000000231', '10000000-0000-0000-0000-000000000104', 'lga', 'Ibadin North', 'ibadan-north', 'approved'),
    ('10000000-0000-0000-0000-000000000232', '10000000-0000-0000-0000-000000000104', 'lga', 'Ibadan South-West', 'ibadan-south-west', 'approved'),
    ('10000000-0000-0000-0000-000000000241', '10000000-0000-0000-0000-000000000105', 'lga', 'Enugu North', 'enugu-north', 'approved'),
    ('10000000-0000-0000-0000-000000000242', '10000000-0000-0000-0000-000000000105', 'lga', 'Enugu South', 'enugu-south', 'approved')
ON CONFLICT (slug) DO NOTHING;

-- Cities and towns (children of an LGA)
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
    ('10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000201', 'city', 'Ikeja', 'ikeja-city', 'approved'),
    ('10000000-0000-0000-0000-000000000302', '10000000-0000-0000-0000-000000000201', 'city', 'Alausa', 'alausa', 'approved'),
    ('10000000-0000-0000-0000-000000000303', '10000000-0000-0000-0000-000000000202', 'city', 'Victoria Island', 'victoria-island', 'approved'),
    ('10000000-0000-0000-0000-000000000304', '10000000-0000-0000-0000-000000000202', 'city', 'Lekki', 'lekki', 'approved'),
    ('10000000-0000-0000-0000-000000000305', '10000000-0000-0000-0000-000000000202', 'town', 'Banana Island', 'banana-island', 'approved'),
    ('10000000-0000-0000-0000-000000000306', '10000000-0000-0000-0000-000000000203', 'city', 'Yaba', 'yaba', 'approved'),
    ('10000000-0000-0000-0000-000000000307', '10000000-0000-0000-0000-000000000203', 'town', 'Itire-Ikajiri', 'itire-ikajiri', 'approved'),
    ('10000000-0000-0000-0000-000000000308', '10000000-0000-0000-0000-000000000204', 'town', 'Oduduwa', 'oduduwa', 'approved'),
    ('10000000-0000-0000-0000-000000000309', '10000000-0000-0000-0000-000000000205', 'city', 'Lagos Island CBD', 'lagos-island-cbd', 'approved'),
    ('10000000-0000-0000-0000-000000000310', '10000000-0000-0000-0000-000000000206', 'town', 'Ojota', 'ojota-town', 'approved'),
    ('10000000-0000-0000-0000-000000000311', '10000000-0000-0000-0000-000000000211', 'town', 'Kuje', 'kuje-town', 'approved'),
    ('10000000-0000-0000-0000-000000000312', '10000000-0000-0000-0000-000000000212', 'town', 'Kuje rural', 'kuje-rural', 'approved'),
    ('10000000-0000-0000-0000-000000000313', '10000000-0000-0000-0000-000000000221', 'city', 'Port Harcourt', 'port-harcourt-city', 'approved'),
    ('10000000-0000-0000-0000-000000000314', '10000000-0000-0000-0000-000000000231', 'city', 'Ibadan', 'ibadan', 'approved'),
    ('10000000-0000-0000-0000-000000000315', '10000000-0000-0000-0000-000000000241', 'city', 'Enugu', 'enugu', 'approved')
ON CONFLICT (slug) DO NOTHING;

-- The default tenant is scoped to Lagos.
INSERT INTO tenants (id, name, state_location_id, status)
VALUES (
    '20000000-0000-0000-0000-000000000001',
    'Mobigate Group — Lagos',
    '10000000-0000-0000-0000-000000000101',
    'active'
)
ON CONFLICT (id) DO NOTHING;

-- Departments
INSERT INTO departments (id, tenant_id, name)
VALUES
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Operations'),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Engineering'),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Finance'),
    ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Human Resources'),
    ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'Marketing'),
    ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'Legal')
ON CONFLICT (id) DO NOTHING;

-- Message templates
INSERT INTO message_templates (tenant_id, key, channel, subject, body, variables)
VALUES
    ('20000000-0000-0000-0000-000000000001', 'shortlist_confirmation', 'email',
     'You have been shortlisted — {{job_title}}',
     E'Dear {{applicant_name}},\n\nCongratulations, you have been shortlisted for the {{job_title}} role at Mobigate Group.\n\n{{job_title}} interview: {{interview_date}}\nVenue: {{venue}}\n\nPlease bring a printed copy of your CV and a valid means of identification. We look forward to meeting you.\n\nWarm regards,\nThe Recruitment Team\nMobigate Group',
     '{"applicant_name":"Full name of the candidate","job_title":"Title of the role applied for","interview_date":"Scheduled interview date and time","venue":"Interview venue"}'),

    ('20000000-0000-0000-0000-000000000001', 'access_code_issued', 'email',
     'Your Mobigate access code',
     E'Dear {{applicant_name}},\n\nYour access code for the Mobigate Group Staff Portal is:\n\n{{access_code}}\n\nThis code expires on {{expiry_date}} and may only be used once. Use it to complete your staff profile and set up your account.\n\nIf you did not expect this, contact the HR department.\n\nMobigate Group',
     '{"applicant_name":"Full name of the candidate","access_code":"The generated access code","expiry_date":"Code expiry date"}'),

    ('20000000-0000-0000-0000-000000000001', 'application_received', 'email',
     'We received your application — {{application_number}}',
     E'Dear {{applicant_name}},\n\nThank you for applying for the {{job_title}} role. Your application has been received.\n\nApplication number: {{application_number}}\n\nYou can check your application status at any time using this number.\n\nMobigate Group',
     '{"applicant_name":"Full name of the candidate","job_title":"Title of the role applied for","application_number":"Generated application reference"}'),

    ('20000000-0000-0000-0000-000000000001', 'interview_announcement', 'sms',
     NULL,
     'Mobigate Group: Interview for {{job_title}} on {{interview_date}} at {{venue}}. Bring your CV and a valid ID. Ref {{application_number}}.',
     '{"job_title":"Title of the role","interview_date":"Scheduled date and time","venue":"Interview venue","application_number":"Application reference"}')
ON CONFLICT (tenant_id, key, channel) DO NOTHING;
