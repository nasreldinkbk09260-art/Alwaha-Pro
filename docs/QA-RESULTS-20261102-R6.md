# نتائج الفحص R6 — 2 نوفمبر 2026

**المصدر:** R5 بعد استعادة ملف Android المفقود من R4.

## نتائج ناجحة عند إعادة التشغيل

| الفحص | النتيجة |
|---|---|
| `audit:release` | PASS |
| `audit:performance` | PASS |
| `audit:field-repair` | PASS — 140 معرف DOM بلا تكرار |
| `audit:chat` | PASS — 53 تحققاً |
| `audit:compatibility` | PASS — 3 كتل JavaScript مضمّنة |
| `audit:native-call-ui` | PASS بعد استعادة `scripts/android/AlwahaAudioRoutePlugin.java` |
| `audit:ui` | PASS — 244 استدعاء حدث إلى 116 دالة |
| `audit:retention-kids-vault` | PASS — 37 تحققاً |
| `audit:admin` | PASS — 16 تحققاً |
| `prebuild` | PASS — 41 مورداً محلياً |
| بناء واجهة الإدارة Web | PASS — ImageMagick fallback، icon.png 1024×1024 |
| JavaScript/MJS وكتل inline | PASS عبر `node --check` |
| JSON | PASS — ملفات التطبيق والإدارة |
| GitHub Actions YAML | PASS — workflows الأربعة |
| Termux deployment shell | PASS عبر `bash -n` |
| SHA256 المصدر الداخلي | PASS بعد تحديث manifest |

## تصحيح تقرير R5 السابق

عند إعادة تشغيل R5 قبل الاستعادة، فشل `audit:native-call-ui` برسالة ENOENT لأن `scripts/android/AlwahaAudioRoutePlugin.java` كان غائباً. استُعيد من R4 بملف مطابق حرفياً (SHA256 `41796f59aabb2c2f5ccf859a46b11b735908f5a60e11c7e56034ec8a02f99964`)، ثم أعيد الاختبار ونجح. تقرير R5 القديم يبقى تاريخياً؛ نتيجة R6 هي المرجع الحالي.

## ما لم ينجح أو لم ينفذ

- `npm run build` جُرب وتوقف بسبب `ERR_MODULE_NOT_FOUND: esbuild`. لا توجد `node_modules`؛ محاولة تثبيت dependencies السابقة تعثرت بـ`EAI_AGAIN` من `registry.npmjs.org`. لم ينتج `dist` للتطبيق الرئيسي.
- لم يُنفذ `npm ci` بنجاح ولا `npm audit` محلياً. GitHub Actions سيشغل التثبيت وتدقيق الاعتماديات بعد الرفع.
- لم يحدث push إلى GitHub ولم تعمل workflows، ولم ينشأ APK/AAB جديد للتطبيق الرئيسي أو الإداري.
- لم تتوفر PostgreSQL محلياً لتشغيل SQL tests؛ الـ workflow يحتوي PostgreSQL 16 service وbootstrap لاختبار ترحيلات السوق والإدارة.
- لم تُطبق أي migrations أو DDL على Supabase، ولم يُنشر `admin-api` من جديد.
- لم يجر اختبار هاتفين/شبكتين، لا مكالمة فيديو فعلية، ولا اختبار صوت غرفة الأطفال من الطرف الآخر.
- حماية Leaked Password Protection تحتاج إعداد Auth من لوحة Supabase.
- مصدرا migration التاريخيان `20261011184718` و`20261011184813` غير متاحين؛ لا تستخدم `db push` الشامل.

## الحكم

**R6 أحدث وأكمل مصدر 3.0.2 المتاح؛ لكنه ليس إصداراً رسمياً جاهزاً للنشر حتى نجاح GitHub Actions والبناء/التوقيع، واختبارات SQL/Supabase، واختبار الهاتفين.**


## اكتشاف لاحق بعد توسيع مطابقة النسخ القديمة

- فحص Supabase read-only أكد أن R6 كان يطلب `archived_at`, `sold_at`, `sold_to` من products رغم أنها غير ممنوحة ضمن SELECT column allowlist. كما كانت دالة snapshot تستعمل SELECT * بصلاحيات SECURITY INVOKER. عولج الاثنان في R7 وأضيف CI test بدور authenticated.
- فحص 2.8.4 وجد privacy trigger فعلياً في الإنتاج، وصفر قيم seller_email غير فارغة من 4 منتجات، لكن مصدره لا يوجد ضمن migrations. أضيف ترحيل R7 لإعادة إنتاجه على قواعد جديدة.
