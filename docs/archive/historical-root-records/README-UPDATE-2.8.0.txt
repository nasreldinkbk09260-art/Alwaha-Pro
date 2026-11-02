Alwaha-Pro v2.8.0 — تحديث المشروع

الملفات المحدثة:
- index.html
- package.json
- capacitor.config.json
- manifest.json
- sw.js
- build-apk-aab-release.yml
- supabase_auth_rls_migration.sql

مهم:
1) أبقيت icon.png خارج الحزمة لأن الأيقونة الحالية لم يتم رفعها ولم أقم بتغييرها. يجب أن تبقى icon.png في جذر المستودع كما هي.
2) قبل البناء: شغّل supabase_auth_rls_migration.sql مرة واحدة من Supabase SQL Editor.
3) من Supabase Dashboard > Authentication > URL Configuration اضبط Site URL و Redirect URLs حسب رابط النشر الفعلي للتطبيق.
4) الحسابات القديمة التي كانت كلمات مرورها محفوظة في public.users بالطريقة القديمة لا يمكن تحويل كلمات مرورها إلى Supabase Auth تلقائيًا من SQL فقط؛ يلزم إعادة التسجيل أو مسار ترحيل آمن من خادم موثوق.
5) لتعيين مدير بعد إنشاء حسابه:
   update public.users set is_admin = true where identifier = 'ADMIN-EMAIL-HERE';
6) build workflow يستخدم Capacitor 8.5.2 و Node 24.
7) تم توحيد appId مع PACKAGE_ID المستخدم في workflow إلى com.alwahapro.app. لا تغيّر appId إذا كانت النسخة المنشورة للمستخدمين تستخدم معرفًا مختلفًا؛ يجب الحفاظ على معرف الحزمة نفسه حتى تبقى التحديثات متوافقة.

لم يتم تنفيذ بناء Android فعليًا داخل بيئة المحادثة؛ تم فحص JavaScript/JSON/YAML، وسيتم اختبار البناء النهائي عند تشغيل GitHub Actions.
