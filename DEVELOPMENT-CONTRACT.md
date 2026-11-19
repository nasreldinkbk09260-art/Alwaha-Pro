# Alwaha-Pro development contract

## Development is intentionally open

- Work on feature branches without a fixed allowlist of branch names.
- Every branch pushed to GitHub runs SQL validation, source audits and a private APK/AAB build.
- New features, files, buttons, APIs and refactors are expected during development. CI must not fail solely because a new feature name or cache revision was introduced.
- Keep the development cache namespace within the current app line (currently `alwaha-pro-v3.0.4-*`) and keep each versioned script/style URL aligned with its Service Worker precache entry. Tests discover first-party modules from the page/build instead of requiring a dated hand-maintained list.
- Add regression tests for new behavior, but prefer semantic contracts, runtime tests and schema/capability checks over exact string snapshots.

## Security and data integrity stay strict

- Do not weaken RLS, table/column grants, storage ownership, participant checks, cryptographic verification, replay protection, packet expiry, file-size limits or account privacy to make CI green.
- Do not add a service-role key or privileged secret to client code.
- Local Mesh relays must see opaque ciphertext only. Pairing must be explicit and verified on both devices.
- Keep the app usable when offline only for data actually cached or restored locally. Never label an unsent item as sent.
- Android radio toggles remain under Android/user control. The app must not pretend it disabled cellular data or enabled a radio when it did not.

## Build and deployment

- Capacitor identity remains `pro.alwaha.app`, app name `Alwaha-Pro`, web directory `dist`.
- All branches may build private verification artifacts.
- Website publishing and public release publishing are gated to `main` only.
- Supabase production migrations are not auto-pushed from feature branches. Validate them in disposable PostgreSQL/CI first, then apply them through an explicitly reviewed deployment path.
- A successful CI run is not proof of a physical two-device test. Record Android handset tests separately.

## Definition of done

A feature is complete only when its UI, authorization, storage/transport path, failure handling, cache behavior, privacy boundary and regression tests agree. For hardware-dependent behavior, record the exact Android API/device pair and real test outcome.
