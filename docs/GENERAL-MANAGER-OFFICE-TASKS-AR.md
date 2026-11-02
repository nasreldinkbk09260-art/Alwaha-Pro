# General Manager Office — Executable Task Backlog

## Operating contract

Project: Alwaha-Pro 3.0.1. Keep this version string unchanged. Preserve the local WebRTC `disconnectTimer` fix and every existing safety backup. Never run `git clean`, `git reset --hard`, or blanket cache/storage deletion. Work on a feature branch, run checks, record a report, and open a PR rather than pushing directly to `main`.

The automation should not ask the owner about routine, reversible, low-risk code repairs. It must still stop before production data/security changes, destructive actions, authentication changes, shipping, or merging; those remain opt-in switches controlled from the General Manager Office. “Without asking” means the agent can do routine work and report it, not that it can irreversibly change production.

## Defaults after initial setup

| Control | Initial state | Rule |
|---|---|---|
| General Manager Office shell | Enabled after secure backend and owner identity are configured | Only an authenticated admin may access it |
| Daily security/performance review | ON | Read-only; report results |
| Audit-report cleanup | ON | Delete only this subsystem's expired report files/rows after retention policy is defined |
| Auto-fix low-risk source issues | ON, branch-only | Must pass tests and produce a diff/PR; no auto-merge |
| Marketplace auto-reply | OFF | User explicitly enables it and chooses templates/hours/rules |
| Account/admin actions | OFF | Require admin + enrolled device + recent OTP validation |
| Production database changes | OFF | Generate migration and test against a development branch first |
| Production Edge Function deployment | OFF | Require review and successful test result |
| Release publish/merge | OFF | Require release checks and owner enablement |
| New device trust | DENY by default | Verified OTP to configured owner channel, server-side allowlist, cryptographic device key |

## P0 — Immediate, low-risk corrections

1. Patch `renderInternalNotificationCenter()` so empty ordinary notification rows do not return before the admin verification queue is composed.
2. Add a client-side `profile.is_admin` guard to `reviewVerificationRequest()`; preserve the existing database RLS as the authoritative authorization boundary.
3. Add those checks to `scripts/release-preflight.mjs` and test `git diff --check`, `npm run audit:release`, `npm run audit:performance`, and JS syntax.
4. Keep the patch minimal, create timestamped external backups, inspect the final diff, and preserve all existing local modifications.

## P1 — Daily audit/report automation

1. Run daily and on manual dispatch: `npm ci`, `npm audit --audit-level=high`, `npm run audit:release`, `npm run audit:performance`, static secret scan, RLS/migration pattern scan, and syntax validation.
2. Generate Markdown + JSON containing ISO timestamp, commit SHA, PASS/WARN/FAIL, tool exit codes, dependency finding counts, and safe remediation links. Do not place tokens, OTPs, user records, or secrets in the report.
3. Upload the report as a GitHub Actions artifact. Scheduled GitHub Actions execute from the repository's default branch; the workflow must be present on that default branch before daily runs are assumed active.
4. In a later phase, deliver reports into the app through an authenticated server endpoint and private report table. Never expose service-role credentials to the browser. Until that endpoint is implemented and tested, do not claim reports are visible inside the app.
5. Auto-repair low-risk source formatting, static guard omissions, or obvious regression tests only on a feature branch. Open a PR, do not self-merge.

## P2 — Secure General Manager Office app

1. Add an Arabic-first, responsive dashboard with concise status chips and buttons for: daily reports, security, performance, device authorization, marketplace auto-reply, maintenance cleanup, feature controls, and audit history.
2. Create a dedicated Edge Function endpoint that validates the current JWT, reads `public.users.is_admin` using a server-side client, validates the enrolled device, and checks per-action capability flags. Do not trust frontend UI state.
3. Store feature flags, device registrations, short-lived hashed OTP challenges, and audit reports in protected tables. Revoke client-role table privileges; keep RLS enabled. Service-role keys remain only in Edge Function secrets.
4. Use owner contact settings as deployment secrets/config, not hardcoded literals. Provide email OTP via a configured transactional email provider and SMS OTP only if a provider is configured. If providers are not configured, device enrollment stays blocked and the UI says why.
5. Device enrollment: generate a cryptographic device key locally; send only the public key; verify an expiring, rate-limited OTP; bind that public key to the device record; verify signed one-time challenges on privileged requests; support revoke and re-enroll. Do not treat browser fingerprint/User-Agent/localStorage as security.
6. Use capability-scoped flags rather than a single “god mode” switch. Each endpoint re-checks authorization server-side.

## P3 — Marketplace auto-replies

1. Add per-seller opt-in, reply templates, schedule/business hours, cooldown, per-conversation deduplication, rate limits, maximum replies per conversation/day, and opt-out.
2. Exclude system-generated messages from triggering further auto-replies. Never reply to one's own messages or to an auto-reply. Store delivery outcome, reason, rule ID, timestamp and conversation ID in an audit record.
3. Default OFF. Preview and test a rule locally before enabling it. Enable for a specific seller only after that seller opts in; admin cannot silently speak as every seller.
4. Do not run auto-replies while offline/closed unless a server-side queue and its policy exist. Do not promise operation after app close based on browser timers.

## P4 — Security closure and testing

1. Enable Supabase leaked-password protection in Auth settings and test login/registration/recovery.
2. Review `username-auth` rate limits against trusted platform IP semantics; add throttling by IP and normalized username/account where possible, plus generic login errors.
3. Create server-side game-rule validation for chess/ludo/war before accepting client-submitted state; test out-of-turn, stale move, invalid turn, forged winner, oversized state and wrong game ID.
4. Review the two `SECURITY DEFINER` game RPCs with negative tests before altering grants or execution context. Review `search_path` and every authorization path.
5. Verify all tables in exposed schemas keep RLS enabled; do not add client grants/policies to locked archive/settings tables merely to silence advisor notices.
6. Run Supabase security/performance advisors after test migrations. Review unused indexes with query plans before removing or adding any.
7. Test admin/non-admin access, revoked device access, expired/replayed OTP, auto-reply loops, and two-device WebRTC/Realtime behavior.

## Acceptance gate

- All local release/performance/admin-office audits pass.
- No secrets or personally identifying owner contact values in source/reports.
- Every privileged API action validates user, role, device and capability server-side.
- Default-on features are read-only reporting/safe maintenance only; impactful features remain OFF.
- CI report artifacts are available; in-app reports are called complete only after backend integration is deployed and end-to-end verified.
- APK/AAB is called new only after a successful workflow run, artifacts exist, and signature verification passes.
