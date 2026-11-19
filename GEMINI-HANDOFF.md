# Alwaha-Pro handoff for another coding assistant

Repository: `https://github.com/nasreldinkbk09260-art/Alwaha-Pro`

Active private development branch: `alwaha-pro-3.0.4-private-test-20261119`

Recovery baseline (preserve; do not overwrite): `alwaha-pro-recovery-20261118`

Read `DEVELOPMENT-CONTRACT.md` first. Continue on the active branch, inspect its latest HEAD before editing, and never publish feature-branch artifacts to the public site or public release. Do not change production Supabase data from the assistant session.

## Product identity

- Capacitor app ID: `pro.alwaha.app`
- App name: `Alwaha-Pro`
- Web directory: `dist`
- Release line: `3.0.4`
- Preserve the existing signing key and app identity.

## Current scope in this branch

- Home feed comment totals are fetched and rendered.
- Direct chat and marketplace chat show voice-note, image and video controls.
- Private chat-media bucket migration and participant-scoped storage policies were added, plus a disposable-Postgres regression test.
- Chat media uses an opaque message reference and signed URLs; legacy text rows remain readable.
- A local encrypted vault now caches previously opened direct/market chats, a conversation index and selected profile fields.
- Local mode blocks app-level REST/Edge/Storage/Realtime cloud requests on the gated paths; uncached pages remain unavailable offline.
- Native Android Wi-Fi Direct create/connect plus a bounded TCP frame transport is implemented in `scripts/android/AlwahaLocalNetworkPlugin.java`.
- `alwaha-local-mesh.js` contains P-256 ECDH/ECDSA identities, pairwise HKDF/AES-GCM envelopes, ECDSA verification, HMAC route tokens, TTL/hop bounds, duplicate rejection, a ciphertext relay queue and chunked file transfer.
- Local direct/market chat sends and local WebRTC call signaling are wired to the Mesh path. Local WebRTC media itself is direct peer-to-peer and uses no public STUN/TURN servers.
- A dynamic development cache revision `3.0.4-dev` is used by the page and Service Worker.
- `scripts/mesh-protocol-runtime-test.mjs`, `scripts/local-network-native-audit.mjs` and `scripts/chat-media-offline-audit.mjs` are intended regression gates.

## Remaining work and known limitations — do not claim these are finished

1. Bluetooth is discovery-only. BLE/GATT or RFCOMM data transport is not implemented.
2. Wi-Fi Direct TCP transport, mesh cryptography and local WebRTC signaling have not yet been verified on two physical Android phones.
3. Multi-hop is explicit store-carry-forward when a trusted neighbor is connected; there is not yet automatic background topology discovery, route optimization or distance-based routing.
4. Live WebRTC audio/video media is direct between the two peers. Real-time media is not relayed through multiple mesh hops.
5. Group/conference calls and the “add another participant” flow are not implemented.
6. Offline UI can show only records cached/restored on that phone. A complete offline replica of all app sections, account data, pages, games and sync conflict resolution remains to be built.
7. Kids Room must be verified on a real two-phone video call with remote video. Do not treat a static room render or CI source audit as a real call test.
8. Build and CI success is not a substitute for device testing.

## Working procedure

1. Fetch the latest branch head.
2. Read the changed source and all relevant audit scripts before editing.
3. Keep changes on this branch; use sequential commits (avoid racing file writes to the same branch).
4. Run the GitHub Actions workflow. Fix syntax/audit failures without weakening security checks.
5. Inspect the APK/AAB artifact, SHA-256 and signing certificate from the successful run.
6. Record what was actually tested on a handset separately from CI.
7. Never merge to `main` or publish publicly without explicit release approval.

A second assistant can continue the same GitHub repository and branch if it has authenticated access to the GitHub account/repository. This handoff file supplies project context; the previous chat conversation itself is not automatically shared.
