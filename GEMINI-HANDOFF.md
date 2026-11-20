# Alwaha-Pro continuation handoff — 20 Nov 2026

## Continue on the SAME branch — do not create another branch
- Repository: https://github.com/nasreldinkbk09260-art/Alwaha-Pro
- Active branch: alwaha-pro-3.0.4-user-requests-20261120
- Current HEAD: df17e3713f7a69867b7b50fbe885180a79e04d1e
- App identity: pro.alwaha.app / Alwaha-Pro / webDir dist
- Release line: 3.0.4 / versionCode 972

Read DEVELOPMENT-CONTRACT.md, docs/ALWAHA-USER-REQUESTS-20261120-AR.md and docs/DEVICE-ACCEPTANCE-3.0.4-B972-AR.md first. Do not create a new branch, merge to main, or rerun the already successful #972 pipeline unless source has changed.

## Verified build #972
GitHub Actions run: https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44664609344
- Run #972 / commit df17e3713f7a69867b7b50fbe885180a79e04d1e
- Result: SUCCESS for disposable PostgreSQL migration/retention tests and signed Android APK/AAB build.
- Android job passed all audits: release preflight, RLS, performance/cache, chat/media, compatibility, runtime/back navigation, native Wi-Fi Direct + Bluetooth, native call UI/runtime, adaptive video, field repair, themes, navigation dock, home, assistant, UI handler, profile/privacy, fullscreen/modal, marketplace, delivery, reconciliation, games, kids/vault, support, safety, deletion/terms, admin security, dependency audit, web build, Capacitor sync, native plugin registration, Android permissions, target API 36, APK/AAB build, signature verification and artifact upload.
- Public APK release and website publishing jobs were SKIPPED. No public release was created.
- Artifact ID 14597446797, name Alwaha-Pro-3.0.4-build-972, size 54,686,859 bytes, artifact SHA-256 a311d1210a4213ac6edbfdc72821d52e666a25ec3c2bc96c16d77d133bfe1331.
- APK SHA-256 03333976efa9dd27d78aac309ce2011b7e0af503f69ac7e54d96499dd965f82d.
- AAB SHA-256 07facdfe02f4d5b8d32dcfaf10eadf8762fd606756d457bb2912c1ea40814b3d.
- Package pro.alwaha.app, version 3.0.4, versionCode 972, target SDK 36.
- Signing certificate SHA-256 41d039324101241546173f196c0f781ec23b33003ca7d7be2eca5dc329a925fb.
- All five archive checksums were independently verified from the downloaded artifact. No public release or website deployment was performed.

## Production Supabase updates verified
Project kjuixjdtqwcsnxefftrt.
1. marketplace_delivery_workflow_20261120 is applied (migration version 20261119233747). Production market_transactions has delivery method/status, private recipient name/phone/address/instructions, fee/provider/tracking, delivered timestamp and update timestamp fields.
2. post_comment_counts_view_20261120 is applied (migration version 20261120031314). public.post_comment_counts uses security_invoker=true, groups only post target_id/count, uses a partial index on comments(target_id) for target_type='post', grants SELECT to anon/authenticated only, and gives no write privilege.
3. comments RLS remains authoritative. Production view query returned post id 5 with 2 comments. anon/authenticated SELECT are true; anon INSERT and authenticated UPDATE on the view are false.
4. No unrelated production data or policies were changed in this continuation.

## Feature state — distinguish source/CI from physical-device proof

### Present in source and covered by CI audits
- Home comment counts load asynchronously from post_comment_counts and increment after successful comment submission. Offline cache stores only post id/count.
- Direct chat has voice-note and image/video controls.
- Marketplace chat has voice-note and image/video controls.
- Marketplace seller audio call uses a participant-checked private buyer/seller conversation path.
- Call UI includes accept/decline/end, speaker, camera mute/switch and Kids Room during video.
- Kids Room restores local/remote video elements, requests playback while active and restores prior element state on exit.
- Theme registry is extensible; default/oasis/abyss remain and new theme IDs can be registered.
- Local mesh has E2E encrypted packets, trusted identity pairing/fingerprint validation, replay/duplicate protection, bounded frames/chunks, store-carry-forward queue and automatic relay flush after trusted-neighbor handshake.
- Android packet transport now implements Wi-Fi Direct TCP and Bluetooth Classic RFCOMM. UI starts Bluetooth receiver with Android visibility approval and connects to a discovered peer. Both transports feed a shared packet event; application-level packet encryption/authentication stays above native transport.
- Offline direct inbox restores previously encrypted cached messages and safe peer labels when offline or API fetch fails.
- Service Worker cache revision is isolated for this development build.
- Native Android plugin registration and target API 36 were verified in the signed build.

### Still not proven / still incomplete — do not mark complete
1. No manual Android GUI session was run from this workspace. The sandbox browser could not open local/file URLs under its policy. CI proves scripted audits/build, not manual taps on a device.
2. No two-physical-phone test has been performed. Wi-Fi Direct, RFCOMM discovery/visibility/pairing, fingerprints, message/file transfer, relay, live call media and Kids Room need physical-device acceptance.
3. Bluetooth Classic RFCOMM carries encrypted packets/messages/files, not live WebRTC call media. Local live calls require direct Wi-Fi Direct TCP and a paired peer.
4. Local WebRTC signaling/media runs direct-peer only; live voice/video is not routed over multi-hop relay.
5. Mesh store-carry-forward has one active native packet transport/neighbor per device. Do not call it a fully concurrent multi-neighbor mesh or distance-optimized route network.
6. Group calls / add-another-participant remain incomplete. Do not add a cosmetic button. Implement multi-peer connections, invites/member authorization, signaling, media tracks, layout and complete leave/end lifecycle before showing it.
7. Offline mode is not a complete replica of every account section. Only cached public content and previously fetched private data can be shown. Preserve local account identity and never expose another account's private data.
8. Android does not let the app silently switch off cellular data; the app opens Android settings and the user changes it.
9. Marketplace delivery tracks buyer/seller agreement and status; it does not book an external courier, create carrier labels or charge shipping automatically.
10. Android background restrictions and long-range relay resilience require physical tests.

## Next actions for the new chat
1. Stay on this exact branch/HEAD. Check latest Actions after #972; do not rerun #972 as it is already green.
2. Add a real browser-visual acceptance test in CI against built dist (headless Chrome/Chromium), mobile viewport screenshots, actual visible/enabled controls and safe navigation/modal opening. Use anonymous UI fixtures or mocked backend; no production writes or real credentials.
3. Cover visible contextual controls: direct/market chat voice/photo/video, marketplace call, mesh discovery/pair/transport, call speaker/camera/end/Kids Room, comment counts, theme picker and delivery actions.
4. Expand native lifecycle tests for RFCOMM/Wi-Fi Direct: permission denial, discovery timeout, disconnect/reconnect, duplicate/oversized frames, concurrent writes and server shutdown. Keep E2E encryption/replay/hop controls unchanged.
5. Test physical devices before stating device-complete: two Android phones, distinct test accounts, Bluetooth and Wi-Fi Direct separately, trusted pairing, text/audio/image/video file transfer, third-device relay if available, local direct Wi-Fi calls, Kids Room, ending on either phone, loss/reconnect and offline cache.
6. No merge to main and no public release. Do not apply additional production migrations without review and necessity.

Branch URL: https://github.com/nasreldinkbk09260-art/Alwaha-Pro/tree/alwaha-pro-3.0.4-user-requests-20261120
