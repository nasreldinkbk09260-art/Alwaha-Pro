> أرشيف تدقيق 21 أكتوبر 2026. تحديث R5: توجد الآن لوحة أساسية مستقلة وEdge Function `admin-api` نشطة بالإصدار 5 وJWT verification؛ أما مكتب المدير العام الموسع (الأجهزة/OTP والتقارير والرد الآلي وإدارة البلاغات) فما زال غير مكتمل.

# Alwaha-Pro 3.0.1 — Security and Release Audit

**Audit date:** 2026-10-21
**Repository:** `nasreldinkbk09260-art/Alwaha-Pro`
**Reviewed branch:** `alwaha-social-3.0.1-mobile-performance-20261020`
**Reviewed commit:** `25e4eff321c84de7bf3568a85e36683a30d23016` (`Preserve current 3.0.1 maintenance updates`)
**Version:** 3.0.1 (preserved)

## Executive result

The available static checks and read-only Supabase inspection show that the application has meaningful access controls already in place, but the requested General Manager Office is not yet implemented. Two database advisor findings must not be “fixed” blindly: the tables reported as RLS-without-policy have client privileges revoked, and the two exposed `SECURITY DEFINER` game RPCs have authorization checks that require regression tests before any privilege change. The safest immediate code fixes are the empty-notification/admin-review UI defect and added repeatable audit reporting.

## Confirmed findings

### P0 — UI defect: admin requests disappear when ordinary notifications are empty

`index.html` → `renderInternalNotificationCenter()` returns before it queries pending verification requests when `notifications` returns an empty array. An administrator with no ordinary notifications therefore does not see the verification-review panel. The safe patch changes only the empty-state flow so admin review still renders.

### P1 — Admin review UI has no client-side role guard

`reviewVerificationRequest()` currently checks login and status, then sends a PATCH. Add a UI guard using `getCurrentProfile()` and `profile.is_admin`. This is defense in depth and better feedback only; RLS on `verification_requests` must remain the authoritative access control.

### P1 — Supabase Auth leaked-password protection disabled

The live Supabase security advisor returned `auth_leaked_password_protection` at WARN. This setting is controlled in Supabase Auth configuration and is not safely changeable through the read-only audit access available in this session. Enable it in the project Auth password-security settings and test sign-in/sign-up flows afterward.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### P1 — Game RPC functions are `SECURITY DEFINER`

The live advisor reports authenticated execution of:

- `public.join_game_room(p_room_code text, p_expected_game_id text)`
- `public.submit_game_move(p_room_id uuid, p_expected_move_no integer, p_next_state jsonb, p_next_turn uuid, p_next_status text, p_winner_id uuid)`

The source reviewed validates authentication, room/participant state, current turn and move sequence, and bounds the submitted JSON size. This mitigates broad unauthorized updates. However, `submit_game_move` accepts client-supplied game state and does not visibly run game-specific chess/ludo/war legality validation before storing it. Add server-side game-rule validation or explicitly document the trust model before changing grants or switching to `SECURITY INVOKER`.

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

### INFO — Five RLS-without-policy advisor findings are locked from client roles

The advisor names `public.app_settings`, plus the legacy `comments`, `messages`, `posts`, and `products` archive tables. Read-only database catalog inspection showed RLS enabled and no `anon`/`authenticated` table grants for those named tables (the application/service role retains server access). These findings are expected for locked private/archive tables. Do not add policies or client grants just to silence the lint.

### INFO — Unused indexes and legacy FK indexes

The performance advisor reported multiple currently unused indexes and three unindexed foreign keys on legacy archive tables. Usage counters can be low on a young/small application; do not delete indexes automatically. Review query plans and data volume first. For legacy tables with client access revoked, prioritize archive status and only add an index if it materially helps maintenance queries.

### P2 — Public username-auth Edge Function needs focused abuse testing

`username-auth` has `verify_jwt=false`, which is expected for unauthenticated sign-in/registration. The code includes input limits and per-IP attempt counting, but relies on forwarded IP headers. Test whether the platform normalizes trusted client IP headers and whether attempts can be bypassed; do not turn off public login or assume a client-provided forwarded header is trustworthy. Keep `call-config` JWT verification enabled.

### P2 — General Manager Office foundation does not exist yet

Live catalog inspection found no `admin_office_reports` or `admin_device_allowlist` tables. The app has no clear marketplace auto-reply implementation. A secure panel needs a server-validated admin API and a private reports/settings/device store, not localStorage-only “permissions”.

## What was and was not verified

- Read-only Supabase advisor results, public schema table ACL/RLS states, relevant RLS policies, and the source of the two game RPCs were inspected.
- `package.json`, release preflight, performance audit, Android release workflow, service worker, Capacitor config, key UI functions, and both deployed Edge Function configurations/source were inspected.
- The repository commit had no combined status entries returned in this inspection. The available commit-workflow endpoint lists pull-request-associated workflow runs only and returned none. Therefore, **a new signed APK/AAB build is not confirmed by this audit**.
- No production migration, permission change, function deployment, APK build, release, Git commit, push, or merge was performed.
- GitHub read access worked, but branch creation, file-write, and issue-create attempts returned HTTP 403 `Resource not accessible by integration`. The actual patch must be applied in the user's Termux worktree or through a properly authorized GitHub integration.

## Safety boundaries for automated remediation

Safe automatic work: static analysis, dependency audit, lint/test runs, report generation, backups, non-destructive cleanup of this audit's own reports, and opening a branch/PR for low-risk fixes.

Keep closed by default: production DB migrations, grants/RLS changes, deleting user data or uploaded files, revoking sessions/keys, changing Auth providers, deploying Edge Functions, sending marketplace replies to users, publishing APK/AAB, and merging to the release/default branch.

Do not store the owner's email, phone, OTP, secrets, signing credentials, or device private keys in Git. Device trust must use a server-side allowlist and verified OTP; a user-agent/fingerprint or localStorage flag alone is not authentication.
