# سجل التغيير — Alwaha-Pro 3.0.2 R7.3

**2 نوفمبر 2026**

- جمع إصلاحات 3.0.1 الفعلية من آخر commit مرفوع `f116998`، وحزمة Field-Fixes Post-Test، وحزمة Market-Chat-Feed R2 بعد مقارنة الوظائف/SQL/audits لا الأسماء.
- الحفاظ على مصدر R7/R7.1 بما فيه admin app/Edge Function، الخزنة المشفرة، خلفيات المواسم، nav controls، kids room، native audio route plugin، migrations/test suite.
- تحديث Service Worker cache إلى `alwaha-pro-v3.0.2-r7.3-release-20261102` وتحديث performance/field/compatibility checks.
- إضافة `audit:reconciliation`، يربط الإصلاحات التاريخية بمتطلبات الإطلاق ويثبت invariants الأساسية.
- إصلاح CI PostgreSQL fixture بإضافة أعمدة `latitude`,`longitude`,`promoted_until` التي يمنحها fixture في SELECT allowlist.
- إضافة `20261102170000_marketplace_nonfriend_conversation.sql` لاختبار إنشاء محادثة ورسائل مشتري/بائع دون جدول friend requests، وعزل طرف ثالث.
- إدراج اختبار SQL ضمن runner وGitHub Actions، وربط الفرع `alwaha-pro-3.0.2-release-r7.3-20261102` في Android build-only workflow.
- الاحتفاظ بـWeb build وSupabase migration review كـmanual workflows فقط؛ لا deploy ولا `db push` عند push المصدر.
- نقل سكربت رفع R7 القديم إلى `docs/archive/` لمنع استخدامه بدلاً من سكربت R7.3.

**لم يتغير:** appId/appName/webDir/icon، لا شبكة محلية/mesh، لا Bluetooth وهمي، ولا تغيير مباشر في قاعدة الإنتاج.
