# نقطة الاستمرارية R5 — 2 نوفمبر 2026

- أحدث مصدر محفوظ: شجرة R5 المستندة إلى R3/R4؛ لا تبدأ من الصفر.
- فرع GitHub المستهدف: `alwaha-pro-3.0.2-release-20261102`؛ غير موجود وقت فحص R5.
- الأساس: `f116998da546b05b65d52bf89871de1490dcc920`.
- الهوية الرئيسية: `pro.alwaha.app` / `Alwaha-Pro` / `webDir=dist` / version `3.0.2`.

## إصلاحات R5
- صوت غرفة الأطفال عبر مسار WebRTC منفصل عن الميكروفون، مع تجميع جميع مسارات الطرف الآخر في MediaStream واحد حتى لا يستبدل صوت المؤثرات صوت الميكروفون أو فيديو الكاميرا.
- قائمة محادثات السوق تتوافق مع مخطط الإنتاج الحالي قبل إضافة `listing_snapshot` و`market_transactions`؛ الإضافات اختيارية حتى تطبيق migration.
- نجاح إرسال رسالة السوق لا ينتظر refresh للقائمة؛ التحديثات الثانوية تعمل بالخلفية.
- migration السوق يمنع hard-delete للإعلانات من أدوار العميل ويحذف `products_delete_own`، واختبار CI يعيد إنشاء الحالة القديمة قبل الترحيل ليتحقق من سحبها.
- cache token: `alwaha-pro-v3.0.2-r5-shared-call-audio-20261102`، واختبارات cache محدثة.
- لوحة إدارة مستقلة `admin-app/` مع API المصدر المستعاد من Supabase live v5، شاشة سجل التدقيق، `audit:admin` (16 checks)، وworkflow Android مستقل. واجهة الإدارة الويب بُنيت محلياً بنجاح.

## التاريخ المرجعي
- استعيدت حزم 2.8.2 و2.8.4 و2.8.7 و2.8.8. `free-section` القديم كان شبكة محلية فقط ولا يستعاد. 2.8.7 notification fail-safe موجود في المصدر. 2.8.8 يحتوي الصوتين الكاملين والخلفيات، لا Bluetooth/Wi-Fi Direct.
- فرع الإدارة `alwaha-admin-app-1.0.0` يحتوي واجهة قديمة، لكن backend المنشور موجود في Supabase. استعدنا نسخة المصدر الفعالة (version 5) ووثقناها. لا نعيد نشرها دون تغيير/اختبار.
- سجل Supabase يحتوي أربع migrations لإدارة `admin_action_logs` مطبقة؛ النصوص الأصلية غير موجودة. أضفنا migration مصدر استعادة جديداً منفصلاً، وليس نصاً تاريخياً.

## نتائج الفحوص R5
- `prebuild` PASS (41 مورداً محلياً).
- `audit:release`, `audit:performance` (13)، `audit:field-repair` (140 ID)، `audit:chat` (53)، `audit:compatibility`, `audit:native-call-ui`, `audit:ui` (244 event calls / 116 functions)، `audit:retention-kids-vault` (37)، `audit:admin` (16) PASS.
- JS/MJS وShell syntax PASS، TypeScript لـ`admin-api` PASS عبر `tsc` مع stubs لـDeno/Supabase، وكل ملفات workflow YAML PASS.
- admin web build PASS عبر ImageMagick fallback؛ الناتج المؤقت حُذف بعد التحقق.

## ما لم يكتمل
- `npm ci` للتطبيق الرئيسي فشل بسبب DNS `EAI_AGAIN`؛ لا يوجد `dist` أو APK/AAB جديد للتطبيق الرئيسي.
- لم يعمل GitHub Actions ولم يُرفع فرع الإصدار. Workflow الإدارة لم يُشغّل على فرع 3.0.2 ولم ينتج APK/AAB إداري.
- لم تنفذ اختبارات SQL على PostgreSQL، ولم تُطبق migrations على Supabase، ولم يحدث deploy جديد لـ`admin-api`.
- القراءة المباشرة للإنتاج: market conversations/messages موجودة وسياسات RLS لا تشترط الصداقة؛ `listing_snapshot` و`market_transactions` غائبان؛ products DELETE privilege/policy ما زالا فعالين؛ فهرس `market_messages.sender_id` مفقود؛ `pg_cron` available 1.6.4 لكنه غير مثبت.
- Supabase Auth يحتاج تفعيل Leaked Password Protection، وثلاث دوال `SECURITY DEFINER` تحتاج مراجعة.
- لا يوجد اختبار هاتفين أو شبكتين، لا اختبار صدى صوت غرفة الأطفال، ولا اعتماد رسمي.

## طريقة النشر الآمنة
- لا تستخدم `supabase db push` الشامل بسبب migration history الناقص؛ لا تصطنع نصي `20261011184718` و`20261011184813`.
- بعد CI وSQL regression، اختبر migrations الجديدة على قاعدة اختبار ثم انشرها واحدةً واحدةً بمسار محكوم ونسخة احتياطية ومراجعة النتائج.
- لا تعِد الفحوص الساكنة الناجحة إلا بعد تعديل المصدر.

## الخطوة التالية
استخدم `TERMUX-PUSH-3.0.2-R5-20261102.sh` من Termux لرفع فرع الإصدار المستقل. سيتحقق من عدم وجود الفرع البعيد قبل الإنشاء، ويشغل audits بما فيها admin audit، ولا يغير `main` ولا يطبق migrations على Supabase. بعد push تابع workflow الرئيسي وworkflow لوحة الإدارة، ثم أصلح أي فشل من سجلات Actions.

## ملفات الاستعادة المتاحة
- Checkpoint R5 ZIP: 5.6 MB تقريباً؛ checksum خارجي منفصل و179 ملفاً داخلياً متحققاً.
- Historical reference pack: 93 MB تقريباً؛ يضم 2.8.2/2.8.4/2.8.7/2.8.8 وbuild 38/40 لـ3.0.1 وملفات الإدارة التاريخية.
- لا يوجد APK/AAB 3.0.2 بعد.
