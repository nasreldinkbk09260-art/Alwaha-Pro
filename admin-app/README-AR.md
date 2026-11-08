# Alwaha Admin 1.0.0 — لوحة الإدارة المستقلة

## ما تم استرجاعه
- واجهة عربية مستقلة بهوية `pro.alwaha.admin`، منفصلة عن تطبيق `pro.alwaha.app`.
- وظائف الخادم `admin-api` مستعادة من نسخة Supabase الحية: **ACTIVE، version 5، verify_jwt=true**، وبصمة المصدر المنشور `902c55efa123c01da1d9c18778c013373e81c2330b88e993286bc7d59697585b`.
- الواجهة تستخدم `supabase.functions.invoke('admin-api')` فقط.
- مكتبة Supabase JS محلية ومثبتة داخل حزمة الإدارة، من `assets/vendor/supabase/supabase.js` ببصمة SHA-256 ثابتة؛ لا تعتمد الواجهة على CDN أثناء التشغيل. لا تقرأ أو تعدّل جداول `users` و`verification_requests` مباشرة من المتصفح، ولا تحتوي مفتاح `service_role`.
- الوظائف الحالية: ملخص الحسابات والطلبات المعلقة، عرض الحسابات والبحث، قائمة طلبات التوثيق، قبول/رفض الطلبات، وسجل التدقيق.
- أضيفت شاشة سجل التدقيق إلى الواجهة لأنها مدعومة بالفعل في API، وأزيلت إشارات الشبكة المحلية من لوحة الإدارة أيضاً.

## حماية الخادم
- يتحقق Edge Function من JWT عبر `auth.getUser(token)`، ثم يفحص `public.users.is_admin` باستخدام Service Role على الخادم.
- قائمة الإجراءات محددة ومقفلة، مع حدود offset/limit/query وحجم الطلب، وتسجيل pending/success/denied/error في `admin_action_logs`.
- جدول `admin_action_logs` في الإنتاج: RLS مفعّل، بلا سياسات للعميل، ولا توجد امتيازات `anon` أو `authenticated`؛ يمتلك `service_role` فقط صلاحيات الجدول.
- لا تُنقل مفاتيح الخدمة إلى HTML أو APK. الأسرار محفوظة في Supabase/GitHub Secrets.

## حالة migrations
سجل Supabase يحتوي هذه الإصدارات مطبقة: `20261022155623_admin_action_logs`، `20261022155649_admin_action_logs_pending_outcome`، `20261022160030_admin_action_logs_list_access`، `20261022160159_admin_action_logs_actor_retention`.
لم نجد نصوص SQL الأصلية لهذه الملفات في فرع GitHub أو حزم الإدارة المسترجعة. لذلك أُنشئ `20261102130000_admin_action_logs_source_recovery.sql` كـ **ترحيل استعادة مصدر جديد** اعتماداً على مخطط الإنتاج المقروء فقط؛ ليس نسخة تاريخية ولا يعاد تشغيله على الإنتاج. يستخدم عند إنشاء بيئة جديدة وبعد مراجعة اعتماديات الجداول والأدوار. أضيف إلى `scripts/ci-validate-supabase-sql.sh` مع اختبار `supabase/tests/20261102130000_admin_action_logs_source_recovery.sql` للتحقق من RLS وGRANT وتسلسل الهوية والفهارس.

## البناء
- `npm install --no-audit --no-fund`
- `npm run build`
- `npx cap add android` ثم `npx cap sync android`
- workflow: `.github/workflows/build-admin-apk.yml` يبني APK/AAB منفصلين ويوقعهما باستخدام أسرار Keystore.
- معرف الحزمة منفصل: `pro.alwaha.admin`، الإصدار 1.0.0. لا يغير هوية التطبيق الرئيسي.

## ما لم يُبنَ بعد
هذه لوحة الإدارة الأساسية وليست «مكتب المدير العام» الكامل. لا توجد بعد إدارة الأجهزة/OTP، تقارير الأمن والأداء اليومية داخل التطبيق، إدارة البلاغات والمنشورات والسوق والريلز والألعاب، إعدادات الميزات، أو الردود الآلية للبائعين. تبقى الأزرار/الإجراءات غير الموجودة غير مفعّلة ولا يُدّعى اكتمالها.
