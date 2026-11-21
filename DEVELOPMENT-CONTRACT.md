# Alwaha-Pro development contract

## Branch model — permanent three-branch policy

The project has exactly three permanent branch roles:
- `main`: stable official branch. No direct development pushes; only reviewed, tested, user-approved releases.
- `release`: integration and real-device acceptance branch. It receives only successful work and produces private APK/AAB test builds.
- `work`: the single active development branch for all normal changes, repairs and experiments.

Do not create feature branches by default. Do not leave successful work scattered across abandoned branches. A fourth branch is permitted only as a temporary recovery/replacement branch when repairing a canonical branch is demonstrably less safe or less practical. Record its reason, source SHA, the branch it replaces, unique changes migrated, CI/device-test evidence and deletion condition in `docs/BRANCH-LIFECYCLE-POLICY-AR.md`.

### Safe replacement protocol

Never delete a broken branch merely because a replacement exists. Freeze and record the old branch HEAD; compare commits and file trees; migrate every required unique change, including code, assets, migrations, tests, workflows and documentation; run relevant audits, security/SQL checks and builds; verify the replacement contains all required work; update the canonical branch role and branch register; only then delete the replaced branch. If any comparison or test is inconclusive, keep the original branch and stop deletion. After a successful replacement, remove the temporary branch so the repository returns to the three permanent branches.

The detailed and binding Arabic procedure is in `docs/BRANCH-LIFECYCLE-POLICY-AR.md`.

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
- Private verification builds may run from `work` and `release`.
- Website publishing and public release publishing are gated to `main` only.
- Supabase production migrations are not auto-pushed from `work` or `release`. Validate them in disposable PostgreSQL/CI first, then apply them through an explicitly reviewed deployment path.
- A successful CI run is not proof of a physical two-device test. Record Android handset tests separately.

## Definition of done

A feature is complete only when its UI, authorization, storage/transport path, failure handling, cache behavior, privacy boundary and regression tests agree. For hardware-dependent behavior, record the exact Android API/device pair and real test outcome.
