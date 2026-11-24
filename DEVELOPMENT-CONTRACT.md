# Alwaha-Pro development contract

## Branch model — permanent three-branch policy

The project has exactly three permanent operational branch roles:
- `main`: official public source; only reviewed and tested releases are promoted here.
- `release`: integration and acceptance build source; receives successful work from `work`.
- `work`: the only active branch for normal development, repairs and experiments.

Owner decision — 25 November 2026: the operational lifecycle is exactly `main`, `release` and `work`. Do not create a fourth operational, feature or validation branch. Existing legacy refs are historical/read-only and must be preserved. Do not delete, rename, retarget or reuse historical refs unless the owner explicitly requests that operation in a separate instruction. Do not use a legacy branch as a new baseline.

### Forward-only review rule

Every continuation starts from the latest validated project state, not from an older branch snapshot. Compare the current heads of `main`, `release` and `work` with relevant historical candidates; inspect unique commits, changed files, migrations, build scripts, native code, deployed Edge Functions and release artifacts. Prefer the newest compatible, tested implementation, not simply the newest timestamp. If an older branch contains a requirement absent from the latest baseline, port the requirement selectively and add a regression test; never restore an older whole file or behavior without proving it is still correct. Do not silently revert a previously fixed ringtone, privacy guard, cache token, permission, UI path or security control. Record all exceptions and migration decisions in the Arabic branch lifecycle register.

## Development is intentionally open

- New features, files, buttons, APIs and refactors are expected during development. CI must not fail solely because a new feature name or cache revision was introduced.
- Keep the development cache namespace within the current app line (currently `alwaha-pro-v3.0.4-*`) and keep each versioned script/style URL aligned with its Service Worker precache entry. Tests discover first-party modules from the page/build instead of requiring a dated hand-maintained list.
- Add regression tests for new behavior, but prefer semantic contracts, runtime tests and schema/capability checks over exact string snapshots.

## Security and data integrity stay strict

- Do not weaken RLS, table/column grants, storage ownership, participant checks, cryptographic verification, replay protection, packet expiry, file-size limits or account privacy to make CI green.
- Do not add a service-role key or privileged secret to client code.
- Local Mesh relays must see opaque ciphertext only. Pairing and relay consent must be explicit; a relay must not expose its account identity or device identity to the communicating users.
- Keep the app usable when offline only for data actually cached or restored locally. Never label an unsent item as sent.
- Android radio toggles remain under Android/user control. The app must not pretend it disabled cellular data or enabled a radio when it did not.

## Build and deployment

- Capacitor identity remains `pro.alwaha.app`, app name `Alwaha-Pro`, web directory `dist`.
- Admin Android identity remains `pro.alwaha.admin` and is kept separate from the public app.
- Build and release audits run only for `main`, `release` and `work`.
- Website publishing and public release publishing are gated to `main` only.
- Supabase production migrations are not auto-pushed from `work`, `release` or `main`. Validate them in disposable PostgreSQL/CI first, then apply them through an explicitly reviewed deployment path.
- A successful CI run is not proof of a physical two-device test. Record Android handset tests separately.

## Definition of done

A feature is complete only when its UI, authorization, storage/transport path, failure handling, cache behavior, privacy boundary and regression tests agree. For hardware-dependent behavior, record the exact Android API/device pair and real test outcome. Never describe an untested feature as field-verified.
