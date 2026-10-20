-- Demo data for local development and dashboard review.
--
-- NOT a migration: this file is never applied automatically. Run it with
--   pnpm seed:dev
--
-- It is idempotent: every row has a fixed UUID and ON CONFLICT DO NOTHING.
-- Demo accounts use @example.test addresses and cannot sign in (they have no
-- Better Auth credential).

BEGIN;

-- 24 applicants so application numbers, names and emails are distinct.
INSERT INTO users (
    id, tenant_id, role, email, first_name, last_name, status, email_verified_at
)
SELECT
    ('40000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
    '20000000-0000-0000-0000-000000000001',
    'applicant',
    'demo.applicant' || n || '@example.test',
    (ARRAY[
        'Ngozi', 'Tunde', 'Amaka', 'Chinedu', 'Aisha', 'Emeka',
        'Zainab', 'Segun', 'Ifeoma', 'Kelechi', 'Bisi', 'Yusuf'
    ])[((n - 1) % 12) + 1],
    (ARRAY[
        'Obi', 'Adebisi', 'Eze', 'Okafor', 'Bello', 'Nwosu',
        'Sani', 'Akin', 'Nnamdi', 'Uche', 'Adeyemi', 'Lawal'
    ])[((n - 1) % 12) + 1],
    'active',
    now()
FROM generate_series(1, 24) AS n
ON CONFLICT (id) DO NOTHING;

-- Six roles: four published, one closed, one draft.
INSERT INTO jobs (
    id, tenant_id, title, slug, description, requirements, location_id,
    employment_category, openings, publish_at, deadline_at, status
)
VALUES
    (
        '50000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        'Senior Backend Engineer',
        'senior-backend-engineer',
        'Own the Go services that power recruitment and staff onboarding.',
        'Five years building production APIs; PostgreSQL and Go preferred.',
        '10000000-0000-0000-0000-000000000303',
        'employee', 2, now() - interval '35 days', now() + interval '14 days',
        'published'
    ),
    (
        '50000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000001',
        'People Operations Partner',
        'people-operations-partner',
        'Support hiring managers and keep the employee lifecycle running.',
        'HR generalist experience in a multi-site organisation.',
        '10000000-0000-0000-0000-000000000301',
        'employee', 1, now() - interval '28 days', now() + interval '10 days',
        'published'
    ),
    (
        '50000000-0000-0000-0000-000000000003',
        '20000000-0000-0000-0000-000000000001',
        'Finance Analyst',
        'finance-analyst',
        'Management reporting, payroll reconciliation and cost analysis.',
        'Accounting degree, Excel fluency and attention to detail.',
        '10000000-0000-0000-0000-000000000306',
        'employee', 1, now() - interval '21 days', now() + interval '7 days',
        'published'
    ),
    (
        '50000000-0000-0000-0000-000000000004',
        '20000000-0000-0000-0000-000000000001',
        'Operations Coordinator',
        'operations-coordinator',
        'Coordinate field operations across Lagos service points.',
        'Two years of logistics or operations coordination experience.',
        '10000000-0000-0000-0000-000000000304',
        'contractor', 3, now() - interval '14 days', now() + interval '21 days',
        'published'
    ),
    (
        '50000000-0000-0000-0000-000000000005',
        '20000000-0000-0000-0000-000000000001',
        'Legal Counsel',
        'legal-counsel',
        'Commercial contracts and regulatory compliance.',
        'Called to the Nigerian Bar with commercial experience.',
        '10000000-0000-0000-0000-000000000309',
        'employee', 1, now() - interval '60 days', now() - interval '7 days',
        'closed'
    ),
    (
        '50000000-0000-0000-0000-000000000006',
        '20000000-0000-0000-0000-000000000001',
        'Marketing Manager',
        'marketing-manager',
        'Brand, content and campaign planning.',
        'Consumer marketing experience in a services business.',
        '10000000-0000-0000-0000-000000000302',
        'employee', 1, NULL, NULL,
        'draft'
    )
ON CONFLICT (id) DO NOTHING;

-- 24 applications spread across the last 58 days so the trend and the
-- 30-day delta both show movement.
WITH demo AS (
    SELECT
        n,
        ('60000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid AS id,
        ('40000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid AS applicant_id,
        (
            '50000000-0000-0000-0000-'
            || lpad((((n - 1) % 4) + 1)::text, 12, '0')
        )::uuid AS job_id,
        CASE
            WHEN n % 7 = 0 THEN 'appointed'
            WHEN n % 5 = 0 THEN 'shortlisted'
            WHEN n % 4 = 0 THEN 'rejected'
            ELSE 'pending'
        END AS status,
        now() - ((n * 3) % 58) * interval '1 day' AS submitted_at
    FROM generate_series(1, 24) AS n
)
INSERT INTO applications (
    id, application_number, tenant_id, job_id, applicant_id,
    first_name, last_name, email, phone, gender, location_id,
    address_line, qualification, status, submitted_at, updated_at
)
SELECT
    d.id,
    'APP/LA/2026/' || lpad(d.n::text, 4, '0'),
    '20000000-0000-0000-0000-000000000001',
    d.job_id,
    d.applicant_id,
    u.first_name,
    u.last_name,
    u.email,
    '+234803000' || lpad(d.n::text, 4, '0'),
    CASE WHEN d.n % 2 = 0 THEN 'female' ELSE 'male' END,
    (ARRAY[
        '10000000-0000-0000-0000-000000000301',
        '10000000-0000-0000-0000-000000000303',
        '10000000-0000-0000-0000-000000000304',
        '10000000-0000-0000-0000-000000000306'
    ]::uuid[])[((d.n - 1) % 4) + 1],
    (12 + d.n) || ' Demo Close, Lagos',
    'B.Sc / HND',
    d.status,
    d.submitted_at,
    d.submitted_at
FROM demo d
JOIN users u ON u.id = d.applicant_id
ON CONFLICT (id) DO NOTHING;

-- Eight staff records: six active, one suspended, one exited.
INSERT INTO staff_profiles (
    id, tenant_id, staff_id, employment_category, first_name, last_name,
    email, phone, department_id, position, appointment_date, status
)
VALUES
    ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
     'STA/LA/2026/0001', 'employee', 'Adaeze', 'Nwankwo', 'adaeze.nwankwo@mobigate.example',
     '+2348030000001', '30000000-0000-0000-0000-000000000002', 'Engineering Lead',
     current_date - 300, 'active'),
    ('70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
     'STA/LA/2026/0002', 'employee', 'Femi', 'Ogunleye', 'femi.ogunleye@mobigate.example',
     '+2348030000002', '30000000-0000-0000-0000-000000000001', 'Operations Manager',
     current_date - 260, 'active'),
    ('70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
     'STA/LA/2026/0003', 'employee', 'Halima', 'Yusuf', 'halima.yusuf@mobigate.example',
     '+2348030000003', '30000000-0000-0000-0000-000000000004', 'People Partner',
     current_date - 210, 'active'),
    ('70000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
     'STA/LA/2026/0004', 'employee', 'Ikenna', 'Obi', 'ikenna.obi@mobigate.example',
     '+2348030000004', '30000000-0000-0000-0000-000000000003', 'Finance Analyst',
     current_date - 180, 'active'),
    ('70000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001',
     'STA/LA/2026/0005', 'contractor', 'Bola', 'Ajayi', 'bola.ajayi@mobigate.example',
     '+2348030000005', '30000000-0000-0000-0000-000000000005', 'Campaign Manager',
     current_date - 120, 'active'),
    ('70000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001',
     'STA/LA/2026/0006', 'partner', 'Musa', 'Danjuma', 'musa.danjuma@mobigate.example',
     '+2348030000006', '30000000-0000-0000-0000-000000000006', 'External Counsel',
     current_date - 90, 'active'),
    ('70000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001',
     'STA/LA/2026/0007', 'employee', 'Chiamaka', 'Eze', 'chiamaka.eze@mobigate.example',
     '+2348030000007', '30000000-0000-0000-0000-000000000001', 'Field Supervisor',
     current_date - 75, 'suspended'),
    ('70000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001',
     'STA/LA/2026/0008', 'contractor', 'Sola', 'Akindele', 'sola.akindele@mobigate.example',
     '+2348030000008', '30000000-0000-0000-0000-000000000005', 'Content Producer',
     current_date - 400, 'exited')
ON CONFLICT (id) DO NOTHING;

-- Access codes: four active (two expiring inside 7 days), one used, one expired.
INSERT INTO access_codes (
    id, tenant_id, code_hash, code_hint, type, status, expires_at, failed_attempts
)
VALUES
    ('80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
     encode(digest('demo-code-1', 'sha256'), 'hex'), 'M2Q9', 'staff', 'active',
     now() + interval '2 days', 0),
    ('80000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
     encode(digest('demo-code-2', 'sha256'), 'hex'), 'R7L4', 'staff', 'active',
     now() + interval '6 days', 0),
    ('80000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
     encode(digest('demo-code-3', 'sha256'), 'hex'), 'T3K8', 'applicant', 'active',
     now() + interval '20 days', 0),
    ('80000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
     encode(digest('demo-code-4', 'sha256'), 'hex'), 'B6V2', 'staff', 'active',
     now() + interval '60 days', 0),
    ('80000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001',
     encode(digest('demo-code-5', 'sha256'), 'hex'), 'H9P1', 'staff', 'used',
     now() - interval '5 days', 0),
    ('80000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001',
     encode(digest('demo-code-6', 'sha256'), 'hex'), 'N4C7', 'applicant', 'expired',
     now() - interval '12 days', 0)
ON CONFLICT (id) DO NOTHING;

-- Interview announcements. Three future published sessions count on the
-- dashboard; the draft does not.
INSERT INTO interview_announcements (
    id, tenant_id, job_id, interview_at, venue, instructions, audience,
    status, created_by
)
VALUES
    ('a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000001', now() + interval '3 days',
     'Mobigate House, Victoria Island',
     'Bring a printed CV and a valid means of identification.',
     'shortlisted_only', 'published',
     (SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1)),
    ('a0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000002', now() + interval '9 days',
     'Mobigate House, Ikeja',
     'Panel interview; arrive 15 minutes early.',
     'job_applicants', 'published',
     (SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1)),
    ('a0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000003', now() + interval '21 days',
     'Virtual — Microsoft Teams',
     'A meeting link will be sent the day before.',
     'all_applicants', 'published',
     (SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1)),
    ('a0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000004', now() + interval '30 days',
     'Mobigate House, Lekki',
     'Draft — venue not confirmed.',
     'job_applicants', 'draft',
     (SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1))
ON CONFLICT (id) DO NOTHING;

-- Audit entries for the recent-activity panel.
INSERT INTO audit_logs (
    id, tenant_id, actor_id, action, entity_type, entity_id,
    before_data, after_data, created_at
)
VALUES
    ('b0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
     (SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1),
     'application.status_changed', 'application',
     '60000000-0000-0000-0000-000000000005',
     '{"status":"pending"}'::jsonb, '{"status":"shortlisted"}'::jsonb,
     now() - interval '2 hours'),
    ('b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
     (SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1),
     'access_code.issued', 'access_code',
     '80000000-0000-0000-0000-000000000001',
     NULL, '{"type":"staff","expires_in_days":2}'::jsonb,
     now() - interval '5 hours'),
    ('b0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
     (SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1),
     'interview.published', 'interview',
     'a0000000-0000-0000-0000-000000000001',
     '{"status":"draft"}'::jsonb, '{"status":"published"}'::jsonb,
     now() - interval '1 day'),
    ('b0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
     (SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1),
     'application.status_changed', 'application',
     '60000000-0000-0000-0000-000000000007',
     '{"status":"pending"}'::jsonb, '{"status":"appointed"}'::jsonb,
     now() - interval '2 days'),
    ('b0000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001',
     (SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1),
     'job.created', 'job',
     '50000000-0000-0000-0000-000000000001',
     NULL, '{"title":"Senior Backend Engineer"}'::jsonb,
     now() - interval '3 days'),
    ('b0000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001',
     (SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1),
     'staff.created', 'staff',
     '70000000-0000-0000-0000-000000000001',
     NULL, '{"staff_id":"STA/LA/2026/0001"}'::jsonb,
     now() - interval '4 days'),
    ('b0000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001',
     (SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1),
     'application.status_changed', 'application',
     '60000000-0000-0000-0000-000000000012',
     '{"status":"shortlisted"}'::jsonb, '{"status":"rejected"}'::jsonb,
     now() - interval '5 days'),
    ('b0000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001',
     (SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1),
     'user.approved', 'user',
     (SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1),
     '{"status":"pending"}'::jsonb, '{"status":"active"}'::jsonb,
     now() - interval '6 days')
ON CONFLICT (id) DO NOTHING;

COMMIT;
