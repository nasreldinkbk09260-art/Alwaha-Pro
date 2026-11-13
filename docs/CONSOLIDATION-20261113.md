# Alwaha-Pro — Consolidation Record (2026-11-06 to 2026-11-13)

This document records the reviewed work consolidated into the current 3.0.3 working branch. It is a release-readiness record, not a claim that the app has already been published.

## 1. Source-branch reconciliation

- Current working branch: `alwaha-pro-3.0.3-three-theme-ux-20261108`.
- It contains the full history of `alwaha-pro-3.0.3-final-rebuild-20261107` and is ahead by 207 commits at the last comparison (0 commits behind).
- It contains all commits from `alwaha-pro-3.0.2-release-r7.5-20261103` (0 commits behind).
- The R7.4.2 line diverges by three commits. Those three unique commits were reviewed separately and were not copied wholesale: their older seasonal image-theme approach and deletion/retention behavior were not accepted over the current lighter theme and two-party retention design.
- Build53 offline-cache work and the R7.5.1 runtime-loop repair were incorporated as code-level changes into the current branch; the old repair worktrees/scripts are not treated as separate release sources.
- The abandoned 2.8.9 line is not part of this consolidation.

## 2. Offline-first and performance work

- Static application shell and local assets are precached by the service worker with versioned asset URLs and a fresh cache namespace.
- Public data cache is separate from the encrypted local backup vault.
- Public cache is limited to approved public feed/reel/product/comment data; private messages, notifications, and private contacts are not placed in the public cache.
- Cache limits are enforced: 2 MiB per entry, 12 MiB total, 80 entries; media entries are size-limited and bounded.
- Cached public content remains available after a prior online sync; reconnect triggers a background refresh while cached content remains visible.
- The encrypted local vault remains a separate AES-GCM backup/export path; it is not used as the public display cache.
- Runtime mutation observers were narrowed to relevant modal/layer changes and updates are coalesced to avoid observer loops.
- The local-network sharing path remains disabled and is not represented as a working feature.

## 3. Profile and account security

- Profile privacy defaults keep email and phone hidden.
- Client writes cannot change admin or verification flags.
- Client-side hard deletion of user rows is revoked.
- Verification submission is restricted to the authenticated user's allowed fields; review status and reviewer fields remain admin-controlled.
- Public profile/directory reads use the hardened view path and do not expose hidden contact details.
- The verification form remains available to the user; it is not disabled as a substitute for server-side controls.

## 4. Marketplace and transaction safety

- Seller listing deletion is archival, not a hard delete.
- Seller contact email is not exposed through public listing reads.
- Product write privileges are limited to approved columns; server-side guards prevent client-side sale-state spoofing.
- Buyer/seller conversations do not require a friendship relationship.
- Conversation creation is limited to product and participant fields; listing snapshot and retention/consent fields are server-controlled.
- Marketplace messages are limited to conversation, sender, message body, and reply reference; clients cannot set message IDs, timestamps, or read timestamps on insert.
- Reply references are validated against the same conversation.
- Sale completion is performed through an authenticated RPC wrapper and private server-side implementation.
- Transaction records preserve a listing snapshot, agreement note, warranty duration/expiry, and retention state.
- Archive cleanup requires the retention notice and both buyer/seller consent timestamps; there is no unconditional 30-day deletion.
- Marketplace report creation cannot self-assign moderation status or review timestamps.
- Marketplace review creation is restricted to the verified buyer path; clients cannot backdate reviews.

## 5. Chat, friendship, and notifications

- Direct friend chat remains restricted to accepted friendship.
- Marketplace chat remains separate and available to buyer/seller participants without friendship.
- Real reply-to references are supported for direct and marketplace messages.
- Marketplace message read-state updates are restricted to the recipient's read timestamp.
- Notification updates are restricted to the read flag only; notification title/body/recipient/type/timestamps are not client-editable.
- Friend-request creation relies on the database's pending default; clients cannot insert an already-accepted request.
- Friend-request acceptance notification handling is installed.
- The intended read behavior remains: opening one notification marks that item only; mark-all is a separate manual action.

## 6. Game and Edge Function security

- Game move authority is server-side; authenticated clients cannot directly execute the legacy state-submission RPC or write game-room state.
- `game-actions` is deployed ACTIVE with JWT verification enabled.
- Security-definer implementations for game join, marketplace sale/retention, and RLS helper logic are isolated in the non-exposed `app_private` schema.
- Public RPC entry points used by the app remain as SECURITY INVOKER wrappers; internal RLS helpers are no longer exposed as public RPC functions.
- All remaining public SECURITY DEFINER trigger functions have an empty search_path; the app_private definer functions also use an empty search_path.
- `admin-api` remains JWT-verified and admin-gated. Current supported actions are summary, users, verification requests/review, and audit logs.
- `username-auth` remains a public login/signup entry point with its own credential validation; JWT verification is disabled on that endpoint by design.
- `call-config` remains JWT-verified.

## 7. Production Supabase migrations applied

The production project received the profile, marketplace, chat, retention, game, and least-privilege hardening migrations through 2026-11-13, including:

- Profile/account security hardening and constrained verification submission.
- Marketplace no-hard-delete, seller-contact privacy, transaction archive, warranty/retention, and two-party deletion consent.
- Legacy client privilege hardening and marketplace/message write-column restrictions.
- Real chat reply references and friend-request acceptance notifications.
- Marketplace/chat/notification column-level grants.
- SECURITY DEFINER isolation into `app_private` with public SECURITY INVOKER wrappers.
- Empty search_path for remaining trigger SECURITY DEFINER functions.

The matching SQL regression tests are committed under `supabase/tests` and wired into `scripts/ci-validate-supabase-sql.sh`.

## 8. Advisor results and remaining security action

- The advisor warning for authenticated users executing SECURITY DEFINER functions in the exposed public schema was removed by the private-schema/invoker-wrapper migration.
- All public and app_private SECURITY DEFINER functions are checked for an empty search_path.
- RLS-enabled tables with no policies are intentionally locked (admin logs, app settings, and legacy archive tables); they have no client grants and are not public data surfaces.
- Remaining actionable Auth warning: leaked-password protection is disabled. Enable it in the Supabase Dashboard under Authentication password/security settings. This toggle was not changed through the available project-management interface.
- Performance advisor notes include unused indexes on low-traffic/new tables and unindexed foreign keys in legacy tables. Do not drop the new marketplace/chat indexes solely because usage counters are still zero; re-evaluate after real traffic.

## 9. Deferred until after the first stable publication

These are known follow-up items, not completed features:

- A complete support/complaints queue with routing to the correct team and AI-agent workflow.
- Admin UI for reviewing marketplace reports (report submission and RLS are present; the current admin API does not yet provide the full report-review workflow).
- Advanced adaptive video quality and real-device call-quality validation.
- Kids-room 3D toys/rooms and advanced in-call visual effects unless fully device-tested.
- Further seasonal theme expansion beyond the current stable theme set.
- Additional post-launch UX polish and broad device compatibility testing.

## 10. Release state

- The current GitHub workflow is Build Only; it does not publish a release or deploy the app.
- A previous build-305 artifact was signed and its included hashes were verified, but it predates the latest consolidation/security commits and must not be distributed as the final build.
- No final APK/AAB built from the current branch head has been verified yet.
- No GitHub Release or store publication is claimed.
- Release gate: pass the current branch CI and SQL regression suite, build a fresh APK/AAB from the current head, verify APK/AAB signatures and SHA-256, then run the physical-device acceptance checklist before publication.

## 11. Physical-device acceptance checklist

1. Fresh install and upgrade install over the previous test build.
2. Login/signup and profile privacy edits.
3. Verification submission and admin review.
4. Product creation/edit/archive/reactivation/sale.
5. Buyer/seller marketplace chat, reply-to, and read state without friendship.
6. Direct friend request, accept/reject, and direct chat.
7. Single-notification read behavior and manual mark-all.
8. First online sync, then offline launch and public cached browsing.
9. Confirm private messages/notifications are not exposed as public offline cache.
10. Theme switching, Android back handling, low-data mode, and reconnect refresh.
11. Calls, ringtone playback, and video behavior on real devices.

**Release decision:** core backend security and source consolidation are substantially complete; final release readiness remains conditional on current-head CI/build/signing and real-device acceptance, plus enabling leaked-password protection in Supabase Auth.
