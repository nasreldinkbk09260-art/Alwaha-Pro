# Alwaha-Pro — handoff for Gemini / another coding assistant

Repository: https://github.com/nasreldinkbk09260-art/Alwaha-Pro
**Active work branch:** `alwaha-pro-3.0.4-user-requests-20261120`
**Release line:** 3.0.4 (private development only)
**Product identity:** `appId=pro.alwaha.app`, `appName=Alwaha-Pro`, `webDir=dist`

Read `DEVELOPMENT-CONTRACT.md` and `docs/ALWAHA-USER-REQUESTS-20261120-AR.md` first. Fetch the branch HEAD before editing. Continue on this exact branch; do not create a replacement branch, merge to `main`, publish the APK/website or write to production Supabase without explicit approval.

## Current change set

- Home feed paints posts without waiting for a large comments-table scan. It loads `post_comment_counts` asynchronously, updates visible counts and increments the displayed count after a successful comment. A legacy query fallback remains for environments before the new migration is applied.
- Added `supabase/migrations/20261120010000_post_comment_counts_view.sql`: read-only aggregate view `post_comment_counts` with `security_invoker=true`; underlying `comments` RLS remains authoritative. A partial index supports post counts. Migration and dedicated RLS tests are wired into disposable PostgreSQL CI only. **Not applied to production Supabase.**
- Direct chat and marketplace already had voice-note and image/video controls; the change set adds audit coverage rather than duplicate controls.
- Fixed the call-hangup UI race in which a remote-ended callback could reopen the call modal after the local user tapped End.
- Kids Room now remounts the real local/remote video elements, enables safe playback while the room is open, restores their original state on close and makes its return-to-call action exit the overlay directly.
- Local mesh discovery panel exposes Android Internet/Wi-Fi and Bluetooth settings panels. Android remains in control: the app does not claim to switch cellular data silently.
- Trusted-neighbor hello now triggers automatic ciphertext relay-queue flushing. Pairing remains explicit and verified; queued packets remain opaque to relays.
- Added runtime coverage for trusted-neighbor auto-forward, offline inbox fallback, local UI visibility and Kids Room/call-close regressions.
- Offline direct inbox now falls back to previously cached encrypted messages even if the device reports online but the REST request fails. Safe peer display labels/avatars are cached in the encrypted local vault.
- Removed source-audit restrictions that banned local-network UI or required exactly three themes. Development workflow accepts all branch names; public publishing remains `main` only plus `ALWAHA_PUBLIC_RELEASE_ENABLED=true`.
- Bumped the Service Worker registration/cache namespace to `3.0.4-user-requests-20261120` to avoid reusing the previous development cache.

## Known incomplete work — do not mark as complete

1. Bluetooth is still discovery-only; BLE GATT/RFCOMM data transport has not been implemented.
2. Wi-Fi Direct and multi-hop still need physical validation on two or more Android phones. Auto-forward starts only after a trusted neighbor handshake; automatic radio/topology discovery and distance-aware route selection are not complete.
3. Local WebRTC call signaling can travel through the encrypted mesh, but live voice/video media is not relayed over multiple hops.
4. Group/conference calls and “add another participant” are not implemented. Current call manager is designed around one remote peer/one peer connection; do not add a cosmetic button. Implement multi-peer signaling, membership authorization, lifecycle and cleanup before exposing it.
5. Full offline replica of all app sections and account data is not complete. Previously cached public content, profile data, direct chats and selected marketplace data are available. The user must still have a valid locally persisted session; do not bypass account identity checks to expose another user's private data. Uncached content cannot be reconstructed offline.
6. Android apps cannot silently turn off mobile data; the UI opens the Android settings panel and instructs the user to toggle manually.
7. Voice/media controls and marketplace caller paths exist in source, but still need hands-on tests between two real accounts/devices.
8. Kids Room has source fixes and CI assertions but needs a real connected video call test on two phones.

## CI / release rules

- SQL tests run against a disposable PostgreSQL instance; never use this feature branch to apply migrations to production Supabase.
- Every branch gets private validation. Website and public Android release jobs require `main` and `vars.ALWAHA_PUBLIC_RELEASE_ENABLED == 'true'`.
- Do not weaken RLS, grants, membership checks, E2E cryptography, anti-replay, packet expiry/hop limits, file limits or account privacy to make CI green.
- A successful CI run is not a physical-device test. Record hardware/API pair and observed result separately.
- Latest known run #862 (commit `65deed14412470d570002abdb6155251a91153ac`) passed the disposable PostgreSQL job; its Android build job was cancelled by a subsequent source update. Check the latest Actions run for the current branch HEAD before proceeding.
