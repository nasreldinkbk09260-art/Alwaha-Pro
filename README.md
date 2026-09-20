# Alwaha-Pro 2.8.2 — GitHub فقط

هذه الحزمة معدّة بحيث تكون ملفات المشروع وقاعدة البيانات جزءًا من نفس المستودع. عند عمل `push` إلى الفرع `main` يقوم GitHub Actions بتطبيق ملفات Supabase Migrations ثم يبني APK وAAB موقعين.

## ماذا ترفع إلى GitHub؟

ارفع محتويات هذه الحزمة كلها إلى مستودع المشروع، مع الإبقاء على `icon.png` الموجودة لديك كما هي.

```text
index.html
manifest.json
sw.js
capacitor.config.json
package.json
icon.png                 ← أيقونتك الحالية، لا تستبدلها
scripts/build-web.mjs
supabase/config.toml
supabase/migrations/20260920090000_alwaha_pro_v282.sql
.github/workflows/build-apk-aab-release.yml
```

## هل تحتاج إلى فتح Supabase بعد ذلك؟

بعد ضبط أسرار GitHub مرة واحدة، لا تحتاج إلى فتح SQL Editor لتطبيق الـmigration. GitHub Actions يستخدم Supabase CLI ويدفع الـmigrations المعلّقة تلقائيًا إلى المشروع. Supabase توثق هذا النمط رسميًا عبر GitHub Actions. 

يوجد إعداد لمرة واحدة فقط لأن بيانات المصادقة وقاعدة البيانات لا يجوز وضعها داخل GitHub أو داخل التطبيق:

- `SUPABASE_ACCESS_TOKEN` — Personal Access Token الخاص بـSupabase.
- `SUPABASE_DB_PASSWORD` — كلمة مرور قاعدة بيانات مشروع Supabase.
- `ALWAHA_ADMIN_EMAIL` — البريد الذي تريد منحه دور المشرف تلقائيًا (اختياري لكنه موصى به).

وإذا كان مشروعك الحالي يعتمد على توقيع Android من الـworkflow القديم، اترك الأسرار الحالية كما هي:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

لا تكتب أيًا من هذه القيم داخل الملفات.

## إضافة Secrets من الهاتف

في GitHub افتح المستودع ثم:

`Settings → Secrets and variables → Actions → New repository secret`

أضف الأسماء السابقة وقيمها. بعدها يمكنك رفع الملفات/عمل Commit من الهاتف، وسيبدأ الـworkflow تلقائيًا على `main`، أو تشغيله يدويًا من:

`Actions → Alwaha-Pro • Supabase Migration + Android APK/AAB → Run workflow`

## ماذا يحدث بعد الـPush؟

1. يتم التحقق من ملفات المشروع والإصدار 2.8.2.
2. يتم تشغيل Supabase CLI.
3. يتم تطبيق `supabase/migrations/...sql` فقط إذا لم يكن قد طُبق سابقًا.
4. يتم ضبط حساب المشرف إن وُجد `ALWAHA_ADMIN_EMAIL`.
5. يتم بناء Web/PWA.
6. يتم إنشاء مشروع Android حديث عبر Capacitor 8.5.2.
7. يتم إبقاء Application ID الحالي `pro.alwaha.app` حتى لا يتحول التطبيق إلى تطبيق مختلف عند التحديث.
8. يتم استخدام `icon.png` الموجودة في المستودع كما هي.
9. يتم إنشاء APK وAAB موقّعين.
10. يتم نشرهما كـGitHub Actions artifact وكـGitHub Release مع ملف SHA256.

## قاعدة البيانات

ملف الـSQL ليس ملفًا عشوائيًا بجانب `index.html`؛ مكانه الصحيح داخل:

`supabase/migrations/`

وهذا يجعل Supabase CLI يتعامل معه كـmigration ويضعه في سجل migrations، لذلك لا يعيد تطبيق نفس النسخة عند كل Push.

المigration الحالية تتضمن Auth + RLS + Storage + Realtime والجداول الخاصة بالمنشورات والإعجابات والريلز والتعليقات والرسائل وطلبات الصداقة والإشعارات والتوثيق ونتائج الألعاب.

## مهم بخصوص الحسابات القديمة

الحسابات التي كانت محفوظة في النظام القديم مع كلمات مرور نصية لا يمكن إدخال كلمات مرورها إلى Supabase Auth بمجرد migration. الـmigration يحافظ على البيانات القديمة حيث يمكن ربطها بشكل آمن، لكن تسجيل الدخول بعد التحول يستخدم Supabase Auth.

## مهم بخصوص إعداد Auth

وظائف التسجيل وإعادة تعيين كلمة المرور تعتمد على Supabase Auth. إذا لم تكن روابط الموقع/إعادة التوجيه الخاصة بمشروعك مضبوطة في Auth من قبل، فقد تحتاج إلى ضبطها مرة واحدة في Supabase Dashboard؛ هذا مختلف عن تشغيل الـSQL migration.

## التحقق

تم فحص JSON وJavaScript وYAML وفحصًا ثابتًا لبنية الملفات والـonclick handlers. لم يتم تشغيل APK أو تنفيذ migration على مشروع Supabase الحقيقي من هذه البيئة، لذلك الاختبار الفعلي النهائي يتم داخل GitHub Actions على بيئتك.
