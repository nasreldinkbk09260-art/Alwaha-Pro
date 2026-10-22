# Alwaha Admin 1.0.0

Independent Capacitor Android app. Main app ID remains `pro.alwaha.app`; admin ID is `pro.alwaha.admin`.

The dedicated workflow builds APK/AAB only from branch `alwaha-admin-app-1.0.0` or manual dispatch. It requires the same release-signing GitHub secrets as the main workflow (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`, or the existing `ANDROID_*` aliases).

Features: admin sign-in, server-backed `public.users.is_admin` check, verification request review, and read-only account listing/search subject to existing RLS. No service-role key is included. Do not loosen database RLS automatically if a query is denied.
