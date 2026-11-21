# Alwaha-Pro development contract

## Branch model — permanent three-branch policy

The project has exactly three permanent branch roles:
- `main`: stable official branch. No direct development pushes; only reviewed, tested, user-approved releases.
- `release`: integration and real-device acceptance branch. It receives only successful work and produces private APK/AAB test builds.
- `work`: the single active development branch for all normal changes, repairs and experiments.

Do not create feature branches by default. The three operational roles are `main`, `release` and `work`; `work` is the single normal development branch. **Historical branches created under older workflows must be preserved** as read-only reference points: do not bulk-delete, rename or automatically reuse them merely to reach a branch-count target. Compare and selectively recover unique work from them when a requirement is still missing. A fourth branch is permitted only as a short-lived emergency recovery/replacement branch when repairing one of the three operational branches is demonstrably less safe or less practical. Record its reason, source SHA, target role, unique changes migrated, CI/device-test evidence and deletion condition in `docs/BRANCH-LIFECYCLE-POLICY-AR.md`. Delete only that temporary emergency branch after its purpose is verified; this does not authorize deleting pre-existing historical branches.

### Safe replacement protocol

Never bulk-delete historic branches. For an emergency replacement, freeze and record the source HEAD; compare commits and file trees; migrate every required unique change, including code, assets, migrations, tests, workflows and documentation; run relevant audits, security/SQL checks and builds; verify the replacement contains all required work; update the canonical branch role and branch register. Keep all pre-existing historical branches unless the project owner separately authorizes a specific archival cleanup. Delete only the temporary emergency branch after its purpose is completed or cancelled and its unique changes are accounted for. If any comparison or test is inconclusive, keep the source and stop deletion.

The detailed and binding Arabic procedure is in `docs/BRANCH-LIFECYCLE-POLICY-AR.md`.
### Forward-only review rule

Every continuation starts from the latest validated project state, not from an older branch snapshot. Compare the current heads of `main`, `release` and `work` with every relevant historical candidate; inspect unique commits, changed files, migrations, build scripts, native code, deployed Edge Functions and release artifacts. Prefer the newest compatible, tested implementation, not simply the newest timestamp. If an older branch contains a requirement absent from the latest baseline, port the requirement selectively and add a regression test; never restore an older whole file or behavior without proving it is still correct. Do not silently revert a previously fixed ringtone, privacy guard, cache token, permission, UI path or security control. Record all exceptions and migration decisions in the Arabic branch lifecycle register.


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
