# Staff Attendance: Photo Clock-In/Out from a Paired Office Kiosk

## Why / Problem

Staff must record arrival and departure (time, date, day) with a photograph as
evidence, and administrators must be able to track attendance and correct
mistakes. Clocking must only be possible from the office laptop — staff may
*view* their own history from anywhere, but may only *clock* from the office.

A web page cannot tell which physical device opened it: any browser can open
its own webcam. So "office laptop only" is only real if the server refuses
clock requests that do not carry a credential issued to that laptop. This plan
makes that credential a signed kiosk token, so the rule is **enforced**, not
merely requested.

### Confirmed decisions (from the user)

| Area | Decision |
|---|---|
| Verification | Photo captured as **evidence** only — no face matching, no third-party API |
| Capture device | Office laptop webcam only (`getUserMedia` → canvas → JPEG) |
| ID entry | Staff ID → show **name + department** → camera opens |
| Sites | One office |
| Work hours | Configurable in **Settings** (no deploy needed) |
| Forgotten clock-out | Record stays open; admin closes it manually with a note. Never auto-closed |
| Kiosk pairing | **Included** — it is what makes "office laptop only" enforceable |

### Non-goals (out of scope)

- Face matching / biometric comparison. The photo is an audit record only.
- Multiple office sites, geofencing, GPS, QR codes, NFC/cards, PINs.
- Automatic clock-out at end of shift. Explicitly rejected by the user.
- Breaks, overtime, shift scheduling, leave, payroll integration, exports.
- Any commit, push, or deploy.

---

## Current state

- **No attendance code exists.** Verified: `git grep -i "attendance|clockin|kiosk"`
  over `*.go`/`*.ts`/`*.tsx` returns nothing.
- **Already written this session:** `backend/migrations/0012_attendance.sql`
  (untracked). Everything else in this plan remains to be built.
- The prior session's staff-portal restructure was **committed** as
  `bd3f72b finished the mvp remaining clockin, closed for monday` — its own
  message confirms clock-in is the remaining item.
- Migrations are applied **manually**; `mgm-api` does not auto-migrate.
- **Dev servers are down** (killed by an earlier restart): Go API `:8080`,
  Better Auth `:3000`, Vite `:5173`, Chrome CDP `:9222`. They must be
  restarted for the live verification step.

### Verified integration points (confirmed on disk, not assumed)

- Ticket HMAC to mirror: `signTicket` / `verifyTicket`,
  `backend/internal/httpapi/staff.go:564,577` — body `a|b|expiry`,
  `hmac.Equal`, `h.TicketSecret`, `ticketTTL` at `staff.go:32`.
- Per-IP throttle to reuse: `attemptLimiter` (`staff.go:677`, `newAttemptLimiter`,
  `allow`), wired via `InitRedeemLimiter` (`staff.go:735`); used as
  `h.redeemAttempts.allow(clientIP(r))` at `staff.go:69`.
- Photo helpers: `maxPhotoBytes` / `photoTypes` / `photoUploadAttempts` /
  `photoUploadAttemptTimeout` at `public.go:32-35`; `singleUpload`
  (`staff.go:534`, returns `nil,nil,nil` when the field is absent);
  `uploadPhoto` (`public.go:363`, retries 3× with backoff);
  `isAllowedPhotoType` (`public.go:769`); `redirectToSignedURL` (`public.go:724`).
- Admin scoping: `adminScope` (`handlers.go:237`), `adminActorID` /
  `adminTenantID` / `writeStoreError` (`recruitment.go:458,470,482`),
  `uuidParam` (`public.go:714`), `requireStore` (`public.go:706`).
- Store conventions: `ErrNotFound`/`ErrConflict`/`ErrValidation`/
  `ErrInvalidTransition` (`store/store.go:15-27`); `insertAudit`
  (`recruitment.go:874`); `mapWriteError` (23505 → `ErrConflict`,
  `recruitment.go:908`); `StaffByUserID` already returns `ErrNotFound` for any
  non-active status (`store/staff.go:773`).
- Settings precedent: `GetAccessCodeSettings` / `UpdateAccessCodeSettings`
  (`store/admin_ops.go`, `FOR UPDATE` + `insertAudit`); handlers
  `getAccessCodeSettings` / `updateAccessCodeSettings` (`admin_ops.go:520,532`).
  Settings UI is a `Tabs` list, triggers at `admin/settings.tsx:132-140`, with
  `AccessCodeSettings` (`settings.tsx:889`) as the component template.
- Frontend seams: staff nav array + `pageLabel` in `pages/staff/layout.tsx`;
  admin `primaryNav` in `components/layout/admin-shell.tsx:35`; route table
  `src/routes.tsx`; render harness route list `frontend/scripts/render-check.mjs`;
  HTTP client `src/lib/api/client.ts` (already sends `FormData` bodies and
  per-request headers); API objects `staffApi` / `adminApi` in
  `src/lib/api/index.ts:285,358`; types in `src/types/domain.ts`; format
  helpers in `src/lib/format.ts`; UI kit: `badge`, `button`, `card`, `dialog`,
  `empty-state`, `input`, `page-header`, `table`, `tabs`, `status-badges`.

### Deliberate deviations from the first-drafted plan (and why)

1. **Work hours live on `work_sites`, not `admin_settings` columns.** Hours
   are a property of a site. Adding them to `admin_settings` too would create
   two sources of truth. The Attendance tab edits the tenant's work site in
   place (singleton, like the settings row). Already reflected in `0012`.
2. **`status` is only `open` | `closed`.** "Needs attention" is *derived* from
   the record's age (an `open` record from a previous day). Storing
   `flagged`/`auto_closed` would either be dead schema or — worse — a
   flagged-but-still-open record would escape the partial unique index and
   permit a double clock-in. `0012` uses the two-value CHECK.
3. **Kiosk token TTL is 90 days, not 7.** An always-on office laptop should
   not need weekly re-pairing; the admin screen shows the expiry and can
   revoke or re-pair at any time. Revocation is server-side and takes effect
   on the next request.
4. **Pairing is two-step, mirroring access codes.** The admin issues a short
   (10-minute) pairing code; the laptop redeems it for the long-lived signed
   token. The admin never handles the long-lived secret.
5. **Attendance photos reuse `uploadPhoto`** (retry/backoff already tested)
   rather than duplicating the loop. Keys land under
   `users/{staffProfileID}/photos/…`; they are storage objects, not
   `documents` rows, so they cannot collide with the staff document list.

---

## Design

### Authorisation model

```
/admin/settings (Attendance tab)
    └─ "Pair office laptop" → POST /admin/kiosk {label}
         → kiosk_devices row (pairing_hash, 10-min expiry)
         → plaintext pairing code shown ONCE

/ kiosk  (public route, no session)
    └─ enter pairing code → POST /kiosk/pair
         → validates hash + not expired + not revoked + unused
         → marks row paired, returns HMAC token (90 days) → localStorage

clock request from the laptop
    └─ X-Kiosk-Token header → verify HMAC → device row must exist,
       not revoked, not expired → update last_seen_at
```

Every clock-in/out **requires** the token. An unpaired phone or laptop is
rejected before its photo is accepted.

### Data flow (clock-in)

1. Staff ID entered → `POST /kiosk/staff/{id}` → active staff only → returns
   name + department + current clock state (so the laptop knows whether to
   offer clock-in or clock-out).
2. Camera opens (`getUserMedia`, rear/default) → canvas → `toBlob('image/jpeg')`.
3. `POST /kiosk/clock-in` (multipart: `staff_profile_id`, `photo`, consent
   flag) with `X-Kiosk-Token`.
4. Server: rate-limit by IP → verify token → resolve device → resolve **active**
   staff in the device's tenant → parse multipart → upload photo (3 retries)
   → `INSERT` (server `time.Now()`; DB backstop on the partial unique index)
   → on failure, delete the just-uploaded photo and return the error.
5. Result screen; staff ID cleared after every use.

`clock-out` mirrors this: closes the open record, `404` if none open.

### Server-side rules

- **Server clock is authoritative.** No client-supplied timestamp is trusted.
- **UTC in the DB** (`TIMESTAMPTZ`); rendered in the site timezone
  (`Africa/Lagos`, no DST). Weekday is derived at render, never stored.
- `late_minutes` / `early_minutes` computed in SQL from the site's hours at
  write time, so the figure cannot drift with a viewer's clock.
- **One open record per staff**, enforced by the partial unique index.
- A suspended/exited staff member is rejected (`StaffByUserID` already does
  this; the kiosk path resolves through tenant + active status too).
- Every clock action is audit-logged; admin corrections record
  `corrected_by`/`corrected_at` and a required note.

### NDPA (Nigeria Data Protection Act 2023)

Photographs are sensitive personal data. Included by design:

- Explicit consent captured on first clock-in (`consent_at`), with a visible
  notice on the kiosk screen.
- Admin-only photo access, delivered as short-lived signed URLs.
- Configurable photo-retention purge that deletes images while **keeping** the
  attendance row (so the record survives, the biometric evidence does not).

---

## Work breakdown

### 1. Migration — `backend/migrations/0012_attendance.sql` ✅ written

`work_sites` (name, address, timezone, `work_start`, `work_end`,
`late_grace_minutes`, `early_leave_minutes`; `tenant_id` UNIQUE → one office),
seeded for every existing tenant. `kiosk_devices` (`pairing_hash`,
`pairing_expires_at`, `paired_at`, `paired_by`, `expires_at`, `revoked_at`,
`last_seen_at`). `attendance_records` (staff, site, clock-in/out timestamps +
photo keys + IPs + device IDs, `status IN ('open','closed')`, `late_minutes`,
`early_minutes`, `note`, `corrected_by`, `corrected_at`, `consent_at`) with
**partial unique index** `ON (staff_profile_id) WHERE status='open'`.

### 2. Models — `backend/internal/models/attendance.go` (new)

`AttendanceStatus` (`open`/`closed`), `AttendanceRecord`, `WorkSite`,
`KioskDevice`, `KioskStaff` (ID, staff number, names, department,
current state). Follow the struct/tag style of `models/payroll.go`.

### 3. Store — `backend/internal/store/attendance.go` (new)

- `WorkSite` / `UpdateWorkSite` — singleton per tenant, get-or-create, audit.
- `KioskStaff` — by staff number, **active only**, returns name + department.
- `ClockIn` — active staff + no open record + late-minutes computation.
- `ClockOut` — close the open record + early-minutes computation.
- `StaffAttendance` — own history, current state, monthly summary.
- `ListAttendanceAdmin` — filters (date range, staff, status, exceptions).
- `CorrectAttendance` — set clock-out, close, required note, audit.
- `PairKiosk` / `RedeemKioskPairing` / `ListKioskDevices` / `RevokeKiosk` /
  `ActiveKiosk` — device lifecycle; token validity is decided by the **row**.
- Reuse `insertAudit`, `mapWriteError`, `Err*` sentinels.

### 4. HTTP — `backend/internal/httpapi/attendance.go` (new)

| Route | Auth | Notes |
|---|---|---|
| `POST /kiosk/pair` | public, IP-limited | code → token |
| `POST /kiosk/staff/{id}` | public, IP-limited | active staff → name + department + state |
| `POST /kiosk/clock-in` | public, IP-limited, **token** | multipart `staff_profile_id` + `photo`; reuse `singleUpload`/`uploadPhoto`/`photoTypes`/`maxPhotoBytes`/`isAllowedPhotoType` |
| `POST /kiosk/clock-out` | public, IP-limited, **token** | closes open record; `404` if none |
| `GET /staff/attendance` | staff session | own records only |
| `GET /admin/attendance` | admin | filters + exceptions queue |
| `PATCH /admin/attendance/{id}` | admin | correction, required note, audited |
| `GET /admin/attendance/{id}/photos/{in\|out}` | admin | signed URLs, short-lived |
| `GET`/`POST /admin/kiosk`, `DELETE /admin/kiosk/{id}` | admin | list, pair, revoke |
| `GET`/`PATCH /admin/settings/work-site` | admin | hours, grace, site name |

`signKioskToken` / `verifyKioskToken` mirror `signTicket`'s HMAC construction
with a 90-day TTL and carry only the device UUID.

### 5. Route registration — `backend/internal/httpapi/handlers.go`

Add a **public, session-free** `/kiosk` group (throttled by a new
`kioskAttempts` limiter), `GET /staff/attendance` inside the existing
staff-only workspace group (`handlers.go:96-102`), and the `/admin/...`
attendance + kiosk + work-site routes inside `registerAdminRoutes`
(`handlers.go:170`).

### 6. Frontend

- **`pages/kiosk/`** — public route `/kiosk`, no session. Pair screen →
  staff-ID entry → name/department confirm → camera → snap → submit → result.
  Clears the ID after each use; consent notice shown on first clock-in.
  Handles camera-denied and storage-not-configured with actionable messages.
- **`pages/staff/attendance.tsx`** — own records + hours summary, behind
  `RequireActiveStaff`. Read-only; explains that clocking happens on the
  office laptop.
- **`pages/admin/attendance.tsx`** — daily roster, filters, exceptions queue
  (open records past the shift), photo viewer, correction dialog with a
  required note.
- **`pages/admin/settings.tsx`** — new **Attendance** tab: site name, hours,
  grace, pairing button (code shown once), device list with expiry + revoke.
- **`types/domain.ts`** — attendance/kiosk/work-site types.
- **`lib/api/index.ts`** — `staffApi.attendance()`; `adminApi` attendance,
  kiosk, and work-site methods; a `kioskApi` for the token-carrying calls.
- **`routes.tsx`** — `/kiosk` (public, no session), `/staff/attendance`
  (inside the guarded staff group), `/admin/attendance`.
- **Nav** — "Attendance" in `pages/staff/layout.tsx` and
  `components/layout/admin-shell.tsx` `primaryNav`.
- **`scripts/render-check.mjs`** — add `/kiosk`, `/staff/attendance`,
  `/admin/attendance`.

### 7. Verification

**Automated:** `go test ./...`, `go vet ./...`, `pnpm typecheck`,
`pnpm lint`, `pnpm render-check`, `pnpm build`.

**Live (manual, after restarting the dev servers and applying `0012`):**

1. Apply `0012` to the configured database.
2. Restart Go API `:8080`, Better Auth `:3000`, Vite `:5173`, Chrome `:9222`.
3. Settings → Attendance → pair the laptop; confirm the code shows once.
4. `/kiosk`: pair → enter staff ID → confirm name/department → snap → clock in.
5. Repeat clock-in → **rejected** (no second open record).
6. Clock out → success; repeat clock-out → **rejected** (nothing open).
7. From a second, unpaired browser profile (or with the token cleared) →
   **rejected** — proves "office laptop only" is enforced server-side.
8. Clock in as a suspended/exited staff member → **rejected**.
9. Admin: view today's roster, open the photo, run the exceptions queue.
10. Leave a record open past the shift; confirm it surfaces as needing
    attention; close it with a note; confirm it is **not** auto-closed.
11. Admin: edit work hours in Settings, confirm late/early flags recompute.
12. Admin: revoke the device, confirm the laptop is refused immediately.

**No commit, push, or deploy.**

---

## Risks & notes for review

- **Migration is a manual step** — nothing applies it automatically. If `0012`
  has not been applied when the code lands, every attendance route fails
  closed with a table error. Apply it before restarting the API.
- **`clientIP` reads `RemoteAddr` only** (`staff.go`) — behind Zeabur's proxy
  that is the proxy's address, so per-IP throttling may collapse to one bucket.
  Fine for an office kiosk; worth revisiting if kiosk requests ever come from
  distinct public IPs through a proxy.
- **The kiosk page is public by design.** Its only protection is the pairing
  token plus IP throttling. It reveals a name + department for a *valid, active*
  staff number only — that is the accepted privacy trade-off on a shared
  screen, confirmed by the user.
- **Storage-not-configured fails closed:** without Byteship the clock routes
  return 503 rather than recording attendance with no evidence photo. That is
  deliberate — evidence is the point of the feature.
- **`WorkSite` get-or-create** races are handled by `ON CONFLICT (tenant_id)`;
  concurrency is negligible (one office) but the code should not assume it.
