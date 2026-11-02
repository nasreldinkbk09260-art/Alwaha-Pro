# نقطة الاستمرارية R7 — Alwaha-Pro 3.0.2

- R7 هو أحدث مصدر موحد. لا تبدأ من جديد ولا تستخدم سكربتات 3.0.1 القديمة فوقه.
- الأساس: `f116998da546b05b65d52bf89871de1490dcc920` على `alwaha-social-3.0.1-mobile-performance-20261020`.
- الهوية: `pro.alwaha.app` / `Alwaha-Pro` / `3.0.2` / `dist`.
- ملفات 2.8.2/2.8.4/2.8.7/2.8.8 والمرشحين 3.0.1/R1/R4/R5 محفوظة ومقارنة؛ نتائج المصالحة في `docs/HISTORICAL-REPAIR-MERGE-R6-AR.md` و`BASELINE-COMPARISON-2.8.x-AR.md`.
- R6 استعاد Android audio plugin من R4. R7 أضاف تدقيق product column grants، أصلح استعلامات products والsnapshot trigger، وأعاد مصدر seller_email privacy.
- نجحت audits: marketplace-columns, release, performance, field-repair, chat(53), compatibility, native-call-ui, ui(244/116), retention-kids-vault(37), admin(16), prebuild(41 assets), JS/MJS/inline, JSON/YAML, Bash syntax.
- فحص Supabase حي read-only أظهر أن products تستخدم column-level SELECT allowlist. R6 كان يطلب archived_at/sold_at/sold_to رغم أنها غير ممنوحة؛ R7 لم يوسع الوصول بل أزال طلب هذه الحقول غير المستخدمة.
- migration جديدة `20261102150000_products_seller_email_privacy.sql`; اختباران SQL جديدان للـ authenticated insert وmarket snapshot partial-column permissions. لم تُطبق على الإنتاج.
- `npm run build` محلياً يتوقف بسبب غياب esbuild، ولا يوجد dist/APK/AAB 3.0.2.
- استخدم فقط `TERMUX-PUSH-3.0.2-R7-20261102.sh` لرفع فرع مستقل. يتحقق SHA ووجود Android plugin ومigration/privacy test وأداة column audit، ثم يشغّل جميع audits ويرفع الفرع؛ لا يدفع main ولا يطبق Supabase.
- بعد الرفع راقب PostgreSQL SQL regression job ثم build-android وbuild-admin workflows؛ لا تنفذ db push على الإنتاج قبل حل migration source gaps ونسخة احتياطية.
- اختبار الهاتفين ما زال مطلوباً بعد إصدار APK/AAB من CI.

- تم اختبار محاكاة copy-stage الخاصة بسكربت Termux بعد إصلاح قاعدة الاستثناء: `android/` في الجذر لا ينسخ، لكن `scripts/android/AlwahaAudioRoutePlugin.java` ينسخ. أضيف فحص يمنع فقد الملف مستقبلاً.
- بناء لوحة الإدارة Web نجح؛ بناء التطبيق الرئيسي ما زال ينتظر npm dependencies وesbuild، وCI بعد push.

- سكربت الرفع R7 لا يعيد فحوص المصدر التي اجتازت؛ يتحقق من SHA/الهوية/ملفات الحساسية فقط ثم يرفع الفرع. GitHub Actions ينفذ audits وSQL regression والبناء كشرط اعتماد.
