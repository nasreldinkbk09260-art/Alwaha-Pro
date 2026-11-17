# حالة استمرارية Alwaha-Pro — 17 نوفمبر 2026

## المرجع العام
- المستودع: nasreldinkbk09260-art/Alwaha-Pro
- main عند بداية المتابعة: 60c69ed1dd39a835c489a19f46541406107cb2e1
- Build #520 على main نجح في اختبار SQL وبناء/تحقق APK/AAB ونشر APK وGitHub Pages.
- التطبيق العام 3.0.3، versionCode 520، package pro.alwaha.app، target SDK 36.
- بصمة شهادة التوقيع SHA-256: 41d039324101241546173f196c0f781ec23b33003ca7d7be2eca5dc329a925fb
- بصمة APK SHA-256: c80d36140eb8603098f49362eb6192eb9f0e78372f7310ab7e2f339bde7ed5ac
- بصمة AAB SHA-256: 039339900aea37ad07275dd07239a1bcb5e86bcc52ab773062826b2a8a8cbf7f
- Build #520: https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44071937879
- الإصدار الرسمي: https://github.com/nasreldinkbk09260-art/Alwaha-Pro/releases/tag/v3.0.3

## فرع العمل الحالي
- الفرع: alwaha-pro-3.0.3-profile-onboarding-editor-20261117
- فرع تطوير منفصل؛ لم يتم دمجه في main ولم يُنشر على Pages أو Google Play.
- أضيفت فيه تعديلات نموذج التسجيل والملف الشخصي وEdge Function جديدة باسم profile-update. يلزم CI ومراجعة الكود ثم قرار صريح قبل دمج أو نشر Edge Function إلى Supabase.
- لا تغيير لهوية التطبيق pro.alwaha.app أو هوية تطبيق الإدارة pro.alwaha.admin.

## التسجيل والملف الشخصي
- الحقول المطلوبة: الاسم الظاهر، اسم المستخدم الفريد المقترح تلقائيًا والقابل للتعديل، كلمة المرور، وتأكيد كلمة المرور.
- البريد الإلكتروني والهاتف اختياريان. الحساب دون بريد حقيقي موثق يمكنه الدخول باسم المستخدم وكلمة المرور لكنه لا يستطيع استعادة كلمة المرور عبر البريد عند نسيانها.
- الصورة الشخصية واسم العائلة والجنس وتاريخ الميلاد بيانات اختيارية.
- التعديل الجديد يرتب الصورة والاسم أولًا، ثم الأزرار؛ يضع مساحة الواحة وإعدادات التجربة خلف زر مستقل؛ يحوّل عناصر القائمة القابلة للنقر إلى أزرار أصلية؛ ويضيف شاشة تعديل بيانات بعد الدخول.
- التحديثات تستخدم Edge Function profile-update، تتحقق من JWT، وتحدّث صف المستخدم المطابق لهوية الجلسة فقط مع قائمة حقول مسموحة. لا تمنح العميل صلاحية UPDATE عامة على جدول users. تغيير البريد يمر عبر Auth user endpoint ويحتاج تأكيد البريد.
- هذه الوظيفة غير منشورة في Supabase الإنتاج حتى الآن؛ لذلك لا تعتبر جاهزة للمستخدمين قبل نشرها واختبارها.

## بيانات الإنتاج عند الفحص
- auth.users = 3 وpublic.users = 3: مدير واحد وحسابان غير إداريين.
- posts = 0، reels = 0، profiles = 0.
- products = 1: إعلان «عطر الورد»، السعر المسجل 00، والوصف «عطور حسب الطلب»، من أحد الحسابين غير الإداريين.
- لا توجد محادثات سوق أو معاملات مرتبطة بالإعلان (0/0).
- لم يُحذف أو يُؤرشف أي حساب أو منتج أو وسائط خلال هذه المتابعة. لا يُنشأ إعلان سوق حقيقي دون بيانات المنتج الفعلية من مالكه.
- لا تُحذف وسائط الاختبار الـ18 تلقائيًا؛ يلزم إذن منفصل قبل الحذف النهائي.

## Supabase والأمان
- المشروع ACTIVE_HEALTHY، Postgres 17.6.
- Migration storage_upload_ownership مسجلة كمطبقة في الإنتاج.
- خمس جداول عليها RLS دون سياسات: admin_action_logs وapp_settings وcontent_reports وuser_blocks وuser_consents. فحص GRANT أظهر صلاحيات postgres وservice_role فقط دون anon/authenticated؛ لا تضف سياسات عامة عشوائيًا.
- Advisor: حماية كلمات المرور المسربة غير مفعّلة.
- Advisor الأداء أظهر 23 index غير مستخدم؛ لا تُحذف دون قياس workload حقيقي.
- Edge Function admin-api نشطة، version 7، verify_jwt=true.
- Admin Build #20 نجح؛ https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/43754948485
- لم يُنفذ حذف الوسائط الـ18 ولم تُغيّر كلمة مرور المدير.

## الموقع والفيديو
- الموقع الرسمي الحالي: https://nasreldinkbk09260-art.github.io/Alwaha-Pro/official/
- Build #520 نشر Pages بنجاح. تصحيح نصوص التسجيل الاختياري على فرع العمل فقط، ولم يُنشر بعد.
- فيديو تعريفي بصري أولي مدته 30 ثانية سيُسلّم كملف منفصل؛ هو رسوم واجهة توضيحية مبنية على هوية التطبيق ومزاياه الموثقة، وليس تسجيل شاشة حيًا من هاتف. لا تنشره كإعلان نهائي قبل تصوير لقطات فعلية من Build معتمد ومراجعة المحتوى.
- لا يوجد نطاق تجاري قصير ولا QR رسمي.
- لا يوجد دليل على رفع AAB أو موافقة Google Play.

## الاختبارات المحلية على فرع العمل
- profile-ui-acceptance: 40/40
- release-preflight: PASS
- offline-cache-audit: PASS
- ui-handler-audit: PASS (272 inline handlers)
- runtime-boot-audit: 24 checks PASS
- fullscreen-ui-audit: PASS
- compatibility-audit: PASS
- account-deletion-audit: 12 checks PASS
- theme-runtime-audit: PASS
- navigation-dock-runtime-test: PASS
- Deno type-check وAndroid CI ما زالا ينتظران GitHub Actions بعد رفع جميع الملفات.

## القيود والخطوات التالية
1. استكمال CI على الفرع الحالي، وإصلاح أي فشل قبل فتح PR.
2. مراجعة نشر profile-update إلى Supabase production؛ لا تنشرها قبل تأكيد صريح واختبار Auth/username/email/avatar على حسابات اختبار مخصصة.
3. بعد اجتياز الاختبارات ومراجعة صاحب المشروع، فتح PR إلى main؛ لا دمج تلقائي.
4. لا حذف للحسابين غير الإداريين أو إعلان «عطر الورد» أو وسائط الاختبار دون موافقة واضحة على الأثر.
5. تصوير واختبار على هاتفين وشبكتين، خصوصًا التسجيل دون بريد، تغيير البريد، وتحديث الصورة والملف.
6. إكمال SMTP والدعم وسياسة الخصوصية والشروط وسلامة الأطفال، ثم إجراءات Play Console.
7. لا تستخدم فرع 2.8.9 ولا تغيّر هوية التطبيق.

