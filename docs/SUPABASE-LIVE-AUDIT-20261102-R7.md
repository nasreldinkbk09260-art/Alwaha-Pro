# سجل تدقيق Supabase الحي — 2 نوفمبر 2026 (قراءة فقط)

**المشروع:** `kjuixjdtqwcsnxefftrt`
**الغرض:** ربط حالة الإنتاج الفعلية بمصدر R7. لم ينفذ هذا التدقيق أي INSERT/UPDATE/DELETE أو DDL أو نشر migrations/functions.

## 1) سجل migrations

قائمة الإنتاج المعادة من Supabase تنتهي بـ:
- `20261101022015_marketplace_conversation_messaging`
- `20261101022031_marketplace_conversation_policy_owner_fix`

والمصدر يحتوي migrations أحدث لم تظهر في سجل الإنتاج:
- `20261101210000_marketplace_transaction_archive_and_call_auth`
- `20261102010000_legacy_client_privileges_hardening`
- `20261102100000_marketplace_retention_policy_and_cleanup`
- `20261102150000_products_seller_email_privacy`

كما أن migration `admin_action_logs` الأصلية موجودة في الإنتاج بأربع نسخ مسجلة، ومصدر استعادة R7 موجود داخل الحزمة؛ يجب مطابقة تعريفه وتاريخه قبل إعادة تطبيقه.

الملفان التاريخيان التاليان مسجلان في الإنتاج لكنهما غير موجودين ضمن migrations المصدر المستعاد:
- `20261011184718_alwaha_profile_privacy_clean_start.sql`
- `20261011184813_verification_request_profile_requirements.sql`

**القرار:** لا تستخدم `supabase db push` شاملاً ولا تنشئ ملفات بديلة وهمية لهذين المصدرين. المطلوب الحصول على النسخة الأصلية من GitHub/history/نسخ موثوقة أو توثيق فجوة الهجرة، ثم أخذ backup واختبار migration diff على بيئة مرحلية.

## 2) محادثة السوق في الإنتاج

تم التحقق من أن `public.market_conversations` و`public.market_messages` موجودتان، وRLS مفعّل، ومنح authenticated للقراءة والإدراج موجودة، وسياسات RLS تقصر القراءة/الإرسال على طرفي المحادثة، كما أن الجدولين ضمن `supabase_realtime`.

- عدد الصفوف وقت الاستعلام: 0 في كل من جدول المحادثات والرسائل.
- سياسة إنشاء المحادثة تقصر المشتري على `auth.uid()` وتتحقق من أن الإعلان فعال وأن seller_id يطابق صاحب الإعلان.
- سياسة إدراج الرسائل تتطلب sender_id يساوي المستخدم الحالي وعضويته مشترياً أو بائعاً في المحادثة نفسها.
- هذا يثبت أن بنية الجداول وسياساتها الأساسية موجودة في الإنتاج، لكنه لا يثبت نجاح الطلب من واجهة التطبيق ولا يفسر وحده شكوى عدم إرسال الرسالة.

**لا يوجد اختبار رسالة مباشر بحسابين في هذا التدقيق.** كما أن تدفق logs المتاح لآخر 24 ساعة أظهر مصادر Postgres وPgBouncer فقط؛ لم تتوفر سجلات PostgREST request errors مفصلة ضمن الاستعلام المستخدم. لذلك لا نخترع سبباً لخطأ الإرسال. بعد نشر build المرشح، يجب تسجيل كود HTTP ورسالة الخطأ عند POST إلى `market_conversations` ثم `market_messages` في حسابين منفصلين.

## 3) حذف الإعلان وحقول المنتج

- RLS على `products` موجود وسياسة القراءة العامة موجودة.
- جدول المنتجات لا يمنح `anon/authenticated` table-wide SELECT؛ هناك صلاحيات أعمدة محددة.
- في الإنتاج ما زالت صلاحية `DELETE` لدور authenticated وسياسة `products_delete_own` موجودتين وقت الفحص.
- زر حذف الإعلان في مصدر R7 لا يستخدم DELETE؛ ينفذ PATCH لتغيير الحالة إلى archived ويحافظ على المحادثات من جهة الواجهة.
- migration R7 `20261101210000` تسحب صلاحية DELETE وتحذف policy القديمة، وتحوّل FK محادثات السوق إلى SET NULL وتضيف snapshot. **لم تطبق بعد على الإنتاج.**

لا تعتبر حماية DB من الحذف المباشر مكتملة حتى تنشر migration وتختبرها في بيئة مرحلية.

## 4) البيع والضمان والاحتفاظ

مصدر R7 يحتوي `market_transactions` و`complete_market_sale` وسجل لقطة الإعلان ومدة الضمان/موعد الاحتفاظ. كما يحتوي migration `20261102100000` لجدولة `pg_cron`، والإشعار قبل التنظيف ومهلة الاعتراض ومنع حذف سجل النزاع.

لكن قائمة الجداول/المigrations في الإنتاج وقت التدقيق لا تثبت وجود `market_transactions` أو job التنظيف؛ لذلك **لا تعتبر مدة 30 يوماً أو الضمان والتنظيف التلقائي نشطة في الإنتاج بعد**.

## 5) Security Advisor

النتائج الحالية:
- تحذير `auth_leaked_password_protection`: الحماية من كلمات المرور المسرّبة معطلة؛ تحتاج التفعيل من إعدادات Supabase Auth.
- ثلاث دوال SECURITY DEFINER قابلة للتنفيذ بواسطة authenticated: `can_review_marketplace_product(bigint,uuid)`، `join_game_room(text,text)`، `submit_game_move(uuid,integer,jsonb,uuid,text,uuid)`. يجب مراجعة تعريفها وقيود auth/الملكية و`search_path` وgrants. لا تغيّرها آلياً؛ قد تكون RPCs مقصودة لكن تحتاج توثيقاً واختبارات إساءة.
- ستة جداول عليها RLS ولا توجد policies: `admin_action_logs`, `app_settings` وثلاثة جداول رسائل/منشورات/تعليقات تاريخية وأرشيف products. صنّفها حسب الحاجة، وتأكد أن المنح الخارجية مسحوبة؛ لا تضف policies عامة لإزالة التنبيه فحسب.

المصدر: Supabase Security Advisors، ملاحظة `observed_at` 2026-11-02 15:43 UTC.

## 6) Performance Advisor

- مفتاح أجنبي واحد بلا فهرس: `market_messages.sender_id`. migration R7 `20261101210000` تضيف `market_messages_sender_id_idx` لكنها غير مطبقة.
- توجد 21 ملاحظة unused indexes، معظمها معلوماتية؛ لا تحذفها دون تحليل معدل الاستخدام وحمل الإنتاج.
- ظهرت كذلك مراجع غير مفهرسة بجداول legacy archive. تراجع كعمل تحسين غير حاجب ما لم تظهر مشكلة فعلية.

المصدر: Supabase Performance Advisors، ملاحظة `observed_at` 2026-11-02 15:43 UTC.

## 7) خطوات التطبيق الآمن

1. احصل على backup حديث قابل للاستعادة.
2. احصل على نص migration الأصلي للمصدرين المفقودين أو وثّق اختلاف التاريخ؛ لا تخترع النص.
3. شغّل GitHub Actions/PostgreSQL tests على فرع R7.1 أولاً.
4. أنشئ بيئة مرحلية بمخطط مطابق، وطبّق migrations الجديدة عليها بالترتيب بعد مراجعة diff.
5. اختبر الرسائل، أرشفة الإعلان، snapshot، تسجيل البيع، الضمان، job cron، وسياسات RLS بحسابين.
6. راجع الدوال SECURITY DEFINER وAuth settings وAdvisors.
7. فقط بعد ذلك نفّذ خطة production deployment migration-by-migration مع rollback واضح؛ لا تستخدم `db push` الشامل.
