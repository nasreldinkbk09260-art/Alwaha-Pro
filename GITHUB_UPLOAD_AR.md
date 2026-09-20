# رفع Alwaha-Pro 2.8.2 من الهاتف

## 1) ارفع الملفات

انسخ محتويات هذه الحزمة إلى مستودع Alwaha-Pro في GitHub.

لا ترفع `node_modules` ولا `dist` ولا أي ملف مفاتيح Android.

احتفظ بأيقونتك الحالية `icon.png` في جذر المشروع.

## 2) أضف GitHub Secrets مرة واحدة

من الهاتف:

`Repository → Settings → Secrets and variables → Actions → New repository secret`

أضف:

`SUPABASE_ACCESS_TOKEN`

`SUPABASE_DB_PASSWORD`

`ALWAHA_ADMIN_EMAIL`

ثم أسرار توقيع Android الموجودة لديك إذا كانت مستخدمة في مشروعك:

`ANDROID_KEYSTORE_BASE64`

`ANDROID_KEYSTORE_PASSWORD`

`ANDROID_KEY_ALIAS`

`ANDROID_KEY_PASSWORD`

## 3) بعد ذلك لا تحتاج SQL Editor

كل Push إلى `main` يشغل الـworkflow الذي يطبق migration ويكمل بناء التطبيق.

## 4) استلام التطبيق

بعد نجاح الـworkflow افتح:

`Actions` → أحدث تشغيل → `Artifacts`

أو افتح:

`Releases`

وستجد:

- `Alwaha-Pro-2.8.2.apk`
- `Alwaha-Pro-2.8.2.aab`
- `SHA256SUMS.txt`

## 5) لا تغيّر Application ID

الإصدار محفوظ على:

`pro.alwaha.app`

حتى يظل البناء تحديثًا لنفس التطبيق.
