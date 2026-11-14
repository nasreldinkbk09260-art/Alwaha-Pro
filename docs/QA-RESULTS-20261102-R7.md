# نتائج فحص R7 — 2 نوفمبر 2026

**مصدر R7:** R6 بعد إصلاح صلاحيات استعلامات المنتجات، Trigger لقطة الإعلان، وإعادة إنشاء مصدر خصوصية seller_email.

## فحوص المصدر التي نجحت

| الفحص | النتيجة |
|---|---|
| `audit:marketplace-columns` | PASS — 8 استعلامات منتجات تطابق SELECT allowlist |
| `audit:release` | PASS |
| `audit:performance` | PASS |
| `audit:field-repair` | PASS — 140 معرف DOM بلا تكرار |
| `audit:chat` | PASS — 53 تحققاً |
| `audit:compatibility` | PASS — 3 كتل JavaScript مضمّنة |
| `audit:native-call-ui` | PASS |
| `audit:ui` | PASS — 244 استدعاء حدث إلى 116 دالة |
| `audit:retention-kids-vault` | PASS — 37 تحققاً |
| `audit:admin` | PASS — 16 تحققاً |
| `prebuild` | PASS — 41 مورداً محلياً |
| JS/MJS وinline JS | PASS |
| JSON/YAML | PASS — ملفات التطبيق والإدارة و4 workflows |
| Termux push script / SQL runner Bash syntax | PASS |

## مراجعة Supabase الحية (قراءة فقط)

- `products` لا يمنح `anon` أو `authenticated` table-wide SELECT؛ القراءة عبر قائمة أعمدة محددة من migration `20261029035135`.
- `archived_at`, `sold_at`, `sold_to`, `seller_email` غير قابلة للقراءة لـ`authenticated`. R6 كان يطلب الثلاثة الأولى في عدة استعلامات دون استخدام؛ تم حذفها من تلك الاستعلامات بدلاً من توسيع كشف بيانات المشتري.
- `market_conversation_capture_listing_snapshot` كان يستخدم `SELECT *` مع SECURITY INVOKER؛ عُدّل ليقرأ فقط الأعمدة الممنوحة للمشتري.
- يوجد في الإنتاج trigger `products_clear_public_email`، ووظيفة مسح البريد، وصفر صفوف seller_email غير فارغة من إجمالي 4 منتجات عند الفحص. لا يوجد ملف مصدر لهذه الوظيفة في سلسلة migrations الحالية؛ أضيف ترحيل مصدر جديد `20261102150000_products_seller_email_privacy.sql` لضمان قواعد جديدة.

## PostgreSQL CI الإضافي

- تم تضييق `supabase/tests/ci-bootstrap.sql` ليحاكي column-level grants الحقيقية بدلاً من GRANT SELECT على كامل المنتجات.
- أضيف اختبار SQL ينفذ إدراج المنتج بدور authenticated ويفحص أن seller_email يُمسح.
- أضيف اختبار SQL ينفذ إنشاء market_conversation بدور authenticated مع صلاحيات قراءة جزئية ويتحقق من حفظ listing_snapshot.
- `scripts/ci-validate-supabase-sql.sh` وworkflow يضمان migration والاختبارين.

لم يتوفر PostgreSQL محلياً لتشغيل هذه الاختبارات هنا؛ سيتم تشغيلها في GitHub Actions قبل بناء Android.

## موانع لم تغلق بعد

- `npm run build` ما زال يحتاج `esbuild` غير مثبت محلياً؛ لم ينتج dist.
- لم يُرفع الفرع ولم تُشغّل GitHub Actions.
- لم تطبق migrations الجديدة على Supabase؛ ولا يجوز تطبيق db push الشامل بسبب source gaps التاريخية.
- لا يوجد APK/AAB 3.0.2 موقع، ولا اختبار هاتفين/شبكتين.
- Leaked Password Protection ما زالت تحتاج تفعيل Auth من لوحة Supabase.

**الحكم:** R7 هو أحدث source checkpoint موحد واجتاز الفحوص الساكنة؛ CI/SQL/Android/Supabase/two-device release gates لا تزال مفتوحة.


## طريقة الرفع بدون تكرار فحوص الهاتف

سكربت Termux R7 يتحقق من بصمة الحزمة والهوية وحراس تاريخ migrations ووجود الملفات المطلوبة، ثم يرفع الفرع المستقل. لا يعيد دورة audits التي اجتازت محلياً. GitHub Actions يعيد الفحوص وPostgreSQL regression ويبني APK/AAB؛ هذه هي بوابة التحقق بعد الرفع.
