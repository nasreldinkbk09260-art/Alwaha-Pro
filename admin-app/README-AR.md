# Alwaha Admin 1.0.0 — لوحة الإدارة المستقلة

## الهوية والبناء
- تطبيق عربي مستقل باسم «إدارة الواحة».
- Android package: pro.alwaha.admin؛ منفصل عن التطبيق العام pro.alwaha.app.
- آخر بناء موثق: Admin Build #20، نجح بناء APK/AAB والتحقق من التوقيع في 15 نوفمبر 2026.
- نتيجة Admin Build #20: https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/43754948485

## وظائف الخادم الحالية
Edge Function admin-api: ACTIVE، version 7، verify_jwt=true.

الإجراءات المتاحة:
- summary
- list_users
- list_verification_requests
- review_verification
- list_content_reports
- review_content_report
- list_audit_logs
- purge_test_media

الواجهة تدعم عرض الملخص والحسابات والبحث وطلبات التوثيق ومراجعتها والبلاغات ومراجعتها وسجل التدقيق. عملية purge_test_media مقيّدة بقائمة ثابتة من 18 مسارًا قديمًا وتحتاج رمز تأكيد صريحًا؛ لم تُنفّذ عملية الحذف في متابعة 17 نوفمبر 2026.

## حماية الخادم
- يتحقق Edge Function من JWT عبر auth.getUser(token) ثم يقرأ public.users.is_admin على الخادم باستخدام Service Role.
- قائمة الإجراءات محددة ومقفلة، مع حدود للصفحات والبحث وحجم الطلب.
- يُسجّل الإجراء في admin_action_logs بحالة pending ثم تُحدّث النتيجة إلى success/denied/error.
- جدول admin_action_logs في الإنتاج عليه RLS ولا توجد سياسات للعميل ولا صلاحيات anon/authenticated؛ الوصول الخادمي فقط.
- لا يوجد مفتاح service_role في المتصفح أو APK.

## حدود اللوحة الحالية
هذه لوحة إدارة أساسية وليست «مكتب المدير العام» الكامل. لا توفر حاليًا:
- حظر الحسابات أو تعطيلها أو استعادتها أو حذف الحسابات التجريبية من الواجهة.
- إخفاء المنشورات/الريلز مباشرة أو إدارة المنتجات والمعاملات والنزاعات والضمان.
- إدارة أدوار متعددة وصلاحيات موظفين دقيقة.
- إعدادات الميزات والمراقبة اليومية والتنبيهات والدعم أو مساعد AI.

أي إجراء إداري جديد يجب أن يُنفذ عبر Edge Function محمية، مع تحقق خادمي من الصلاحية والهدف، وسبب موثق وسجل تدقيق واختبارات رفض لغير المصرح لهم. لا تُعرض أزرار توحي بوظيفة غير منفذة.

## migrations
تاريخ migrations الإدارة الأربع الأصلية موجود في سجل Supabase. ملف admin-app/supabase/migrations/20261102130000_admin_action_logs_source_recovery.sql ترحيل استعادة مصدر لبيئة جديدة وليس نسخة تاريخية من migrations الأصلية؛ لا يعاد تطبيقه على الإنتاج الحالي.
