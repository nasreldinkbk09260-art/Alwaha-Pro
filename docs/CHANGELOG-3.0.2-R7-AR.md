# سجل تغييرات Alwaha-Pro 3.0.2 — R7

- إصلاح 4 استعلامات products كانت تطلب أعمدة غير متاحة في Supabase: `archived_at`, `sold_at`, `sold_to`. لم نمنح هذه الأعمدة للمستخدمين؛ لا يحتاجها عرض الواجهة.
- إزالة `sold_at` من تفاصيل الإعلان و`sold_to` من schema probe، وإزالة حقول الأرشيف/البيع غير المستعملة من قوائم سلعي والتعديل.
- تعديل `capture_market_conversation_snapshot` ليقرأ فقط الحقول المسموح بها بدلاً من `SELECT *` أثناء تنفيذ SECURITY INVOKER trigger.
- إضافة migration `20261102150000_products_seller_email_privacy.sql` لإعادة إنشاء حماية 2.8.4 للعمود القديم في قواعد التثبيت الجديدة، دون إرجاع contact_phone العام أو تعديل user_directory.
- تضييق CI PostgreSQL bootstrap إلى column-level SELECT grants كما في الإنتاج وإضافة اختبارين بدور authenticated.
- إضافة `audit:marketplace-columns` وربطه بـ release preflight وGitHub Actions وTermux push script.
- تصحيح مقارنة 2.8.2: أربعة IDs تخص free local-share section محذوف عمداً، ومطابقة SHA لموسيقى وخلفيات 2.8.8 byte-for-byte.

- إصلاح قاعدة الاستثناء في سكربت Termux حتى لا يحذف `scripts/android` عند استبدال شجرة المصدر في فرع الإصدار؛ أضيف preflight + native audit لهذا المسار ومحاكاة staging ناجحة.
