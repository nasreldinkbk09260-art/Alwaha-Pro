# حالة الاستمرارية — Alwaha-Pro 3.0.2 R7.3

**التاريخ:** 2 نوفمبر 2026. **حالة المصدر:** موحد ومراجع محلياً، ولم يُرفع بعد. **الحالة الرسمية:** غير معتمد للنشر.

## نقطة البداية الدقيقة

- GitHub repo: `nasreldinkbk09260-art/Alwaha-Pro`.
- Baseline: `f116998da546b05b65d52bf89871de1490dcc920` على `alwaha-social-3.0.1-mobile-performance-20261020`.
- هذا هو آخر commit رفعه المستخدم إلى خط 3.0.1 وقت الفحص؛ Action #43 بنى APK/AAB بنجاح من هذا commit بتاريخ 31 أكتوبر 2026.
- Branch R7.3: `alwaha-pro-3.0.2-release-r7.3-20261102` (لم يوجد في GitHub عند إعداد R7.3).
- ممنوع الدفع إلى `main` أو force-push أو تشغيل `supabase db push`.

## ما تم في R7.3 فوق R7.1

1. تمت مصالحة إصلاحات 3.0.1 بعد الاختبار الميداني مع R7: إصلاحات WebView/النوافذ/الإشعارات، إضافة Android audio route plugin، وتحويل حذف الإعلان إلى أرشفة.
2. تمت مراجعة Market-Chat-Feed-Repair R2 بتاريخ 1 نوفمبر ومقارنة سلوك الإشعارات/الخلاصة/محادثات السوق/أرشفة الإعلان في المصدر الحالي؛ هذه السلوكيات موجودة في مصدر R7.3. لم نعد استخدام cache token القديم الخاص بـ3.0.1، بل رفعناه إلى namespace مستقل لـR7.3.
3. بقيت غرفة الأطفال من R5 إلى R7.3 كما هي وظيفياً: فلاتر، نافذتا فيديو، بالون، ألعاب قابلة للسحب، مفتاح وباب، خروج ولي الأمر، ومؤثرات صوت عبر مسار WebRTC منفصل. التكسير مؤثر كرتوني آمن وليس فيزياء/AR حقيقية.
4. أُكملت مشاهد المواسم الأربعة كخلفيات كاملة الشاشة محلية CSS، وأضيف أثر مشي كرتوني خفيف لدوائر التنقل مع منع الحركة في وضع توفير البيانات/تقليل الحركة.
5. أضيف فهرس `market_messages.sender_id` إلى migration غير المطبقة واختبار SQL يثبته، إغلاقاً لتنبيه الأداء المحدد.
6. تغيّر cache إلى `alwaha-pro-v3.0.2-r7.3-release-20261102` وتطابقت اختبارات performance/field/compatibility معه.
7. أضيف `scripts/reconciliation-audit.mjs` وربط في package/workflow.
8. أضيف اختبار SQL `20261102170000_marketplace_nonfriend_conversation.sql` لإثبات محادثة مشتري/بائع دون صداقة وعزل المستخدم الثالث.
9. أصلح `ci-bootstrap.sql` ليعرّف `latitude`,`longitude`,`promoted_until` التي سبق منحها ضمن SELECT allowlist.
10. أضيف فرع R7.3 إلى workflow APK/AAB build-only؛ web build وSupabase migration guard يظلان manual فقط.
11. جرى تجهيز `TERMUX-PUSH-3.0.2-R7.3-20261102.sh` كمسار رفع وحيد. يراجع المسافات الزائدة قبل الاستنساخ، ثم يكرر `git diff --cached --check` على النسخة staged منعاً لتكرار توقف سكربت R7 السابق.

## تم اختباره في هذه الجولة

- فحص مصدر/محتوى Market Chat R2 مع R7، وليس بالاعتماد على تساوي الاسم.
- تدقيق غرفة الأطفال ومسار صوت RTCPeerConnection.
- تدقيق سكربتات cache token.
- `node --check scripts/reconciliation-audit.mjs` و`node scripts/reconciliation-audit.mjs`: PASS (34 فحص مصالحة ساكناً).
- سلامة ZIP Build #43 من GitHub: `unzip -t` PASS، وداخله APK/AAB 3.0.1 فقط.
- بقية تدقيقات release/performance/chat/compatibility/native/UI/admin/marketplace/retention تُعاد في GitHub CI بعد الرفع؛ لا تُعاد يدوياً على Termux بلا سبب.

## موانع لم تُغلق

- فرع R7.3 لم يُرفع ولم يعمل Actions على source SHA الجديد.
- لا Web build ولا APK/AAB 3.0.2 جديد حتى نجاح CI.
- لم تنفذ PostgreSQL CI بعد؛ اختبار no-friendship أضيف للمسار وسيحكم CI بصحته.
- لم تُطبق migrations الجديدة على الإنتاج. الإنتاج ما زال يملك `products_delete_own` وصلاحية DELETE؛ snapshots/transactions/retention في المصدر فقط.
- مصدر migration تاريخيين مطبقين في الإنتاج غير موجود في المستودع/المواد المستعادة: `20261011184718_alwaha_profile_privacy_clean_start.sql` و`20261011184813_verification_request_profile_requirements.sql`. لا تخمّن SQL ولا تنشئ ملفات شكلية.
- Supabase Auth Leaked Password Protection معطل، وثلاث SECURITY DEFINER warnings تحتاج مراجعة، فهرس `market_messages.sender_id` أضيف إلى migration واختبار SQL، لكنه لم يُطبق على الإنتاج بعد.
- إرسال السوق لم يثبت على حسابين حقيقيين؛ الجداول والسياسات موجودة في الإنتاج لكن عدد صفوفها كان صفراً عند القراءة.
- لا مكالمة WebRTC/Video أو TURN أو غرفة أطفال مختبرة فعلياً بين جهازين/شبكتين.
- لا يوجد قبول كامل لجهاز Android قديم وآخر حديث، ولا تجربة استعادة backup.

## نقطة الاستئناف

نفّذ فقط سكربت R7.3 من جذر الحزمة بعد فكها، ثم احفظ SHA الناتج ونتائج GitHub Actions. لا تعِد تشغيل إصلاحات 3.0.1 القديمة على R7.3 ما لم يكشف CI أو اختبار حقيقي خطأ محدداً.
