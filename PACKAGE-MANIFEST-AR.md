# دليل محتويات R7.3 — Alwaha-Pro 3.0.2

- مصدر التطبيق: `index.html`, `games.js`, `production-polish.js`, `compatibility.js`, `alwaha-kids-room.js`, `alwaha-local-vault.js`, `alwaha-experience.js`, `sw.js`.
- أصول محلية: vendor bundles/fonts/icons، صوتا الرنين، وأربع خلفيات، chess asset.
- Android native: `scripts/android/AlwahaAudioRoutePlugin.java` (لا تحذف؛ يجب أن يبقى في شجرة الرفع).
- Supabase: functions/migrations/tests، بما فيها `20261102170000_marketplace_nonfriend_conversation.sql` الجديدة.
- CI: Android APK/AAB Build Only، PostgreSQL disposable fixture, release audits, Web build manual-only, Supabase migration-history manual guard.
- وثائق مرجعية: المفكرة الرئيسية، متتبع المتطلبات، reconciliation، خريطة مصادر الدردشات، closure plan، live Supabase audit، release blockers، QA report، سجل Build #43، وسجل الاستعادة والاستبعادات. الوثائق القديمة نقلت إلى `docs/archive/` مع الاحتفاظ بها.
- عدد الملفات الحالية داخل المصدر (مع ملف SHA256SUMS): 214 ملفاً؛ لا يحتوي مجلد بناء Android أو dist أو node_modules.
- سكربت الرفع الوحيد الموصى به: `TERMUX-PUSH-3.0.2-R7.3-20261102.sh`.

**الحزمة source-only:** لا تضم `dist/` أو مجلد Android المولّد أو node_modules أو APK/AAB قديمة. GitHub Actions ينتج artifacts جديدة من SHA R7.3.
