# تقرير Supabase الحي — 2 نوفمبر 2026 / R7.3

**المشروع:** `kjuixjdtqwcsnxefftrt`. جميع استعلامات هذا التقرير للقراءة فقط؛ لم ننفذ `apply_migration` أو `execute_sql` كتابة أو deploy Edge Function.

## سجل migrations والإنتاج

- migration history الحي ينتهي في `20261101022031_marketplace_conversation_policy_owner_fix`.
- ترحيلات market conversation الأساسية مسجلة في التاريخ وموجودة في المصدر: `20261101022015_marketplace_conversation_messaging.sql` و`20261101022031_marketplace_conversation_policy_owner_fix.sql`.
- جدولَا `market_conversations` و`market_messages` موجودان، RLS مفعّل، سياسات الطرفين SELECT/INSERT موجودة، والجدولان في Realtime publication.
- عدد الصفوف كان 0 في الجدولين وقت الفحص؛ لذلك وجود schema/policies لا يثبت أن الرسائل أُرسلت فعلاً. بلاغ المستخدم عن فشل الإرسال يبقى مفتوحاً حتى اختبار مشتري/بائع حقيقي.
- في `products` بقيت صلاحية `DELETE` وسياسة `products_delete_own` على authenticated. واجهة المصدر تؤرشف، لكن القاعدة لم تتلق migration منع الحذف بعد.
- `listing_snapshot`, `market_transactions` وطبقة الاحتفاظ/الضمان من migrations 3.0.2 ليست مثبتة في الإنتاج عند قراءة المخطط. سيبقى الإعلان القديم ظاهراً في سجلات التجربة حتى rollout آمن.
- `seller_email` column موجود في production، وشوهدت سابقاً trigger privacy و0 قيم بريد غير فارغة ضمن 4 سجلات وقت الفحص السابق. migration idempotent الجديدة في R7.3 مطلوبة للـclean install/تطابق المصدر، وليست مطبقة هنا.

## تحذيرات Advisor وقت الفحص

### Security
- `auth_leaked_password_protection`: حماية كلمات المرور المسرّبة Disabled؛ يجب تفعيلها من إعداد Auth.
- 3 دوال `SECURITY DEFINER` قابلة للتنفيذ بواسطة authenticated: `can_review_marketplace_product`, `join_game_room`, `submit_game_move`. تحتاج مراجعة purpose/authorization/grant/safe search_path. لا تُحوّلها كلها إلى INVOKER عشوائياً لأن بعضها قد يحتاج صلاحيات مضبوطة؛ لا تسحبها دون اختبار الواجهة.
- 6 جداول عليها RLS بلا policies: `admin_action_logs`, `app_settings`, و4 legacy archive tables. راجع أولاً GRANT/Exposed schema والاستخدام؛ عدم وجود policy يعني no rows by default فقط إذا لم تكن هناك bypass roles، ولا تحذف أو توسع سياسات بغير دليل.

### Performance
- FK غير مفهرس في `market_messages.sender_id` (لديه index في migration R7). ثلاثة FK إضافية في جداول legacy قديمة.
- Advisor أظهر 21 index غير مستخدم عند القياس، بما فيها indexes للإعلانات/السوق/الإدارة. لا تحذفها آلياً؛ البيانات صغيرة وبعض الميزات حديثة.

## migrations التاريخية المفقودة

الإنتاج يسجل `20261011184718_alwaha_profile_privacy_clean_start` و`20261011184813_verification_request_profile_requirements` كمطبقتين، لكن ملفات SQL الأصلية غير متاحة في source/archives الحالية. يجب استرجاع النسخ الأصلية من commit/backup موثوق. لا ننشئ بدائل تخمينية ولا نشغل `supabase db push` الشامل.

## خطة rollout الآمنة

1. نجاح GitHub PostgreSQL fixture + SQL behavior tests R7.3.
2. استعادة migration source التاريخيين ومصالحة `supabase migration list`/المخطط الفعلي.
3. نسخة احتياطية من قاعدة الإنتاج وtest project/branch موثوق، ثم dry-run لكل migration جديدة منفردة ومراجعة RLS/GRANT/Realtime/SECURITY DEFINER/advisors.
4. تطبيق التغييرات بترتيب مضبوط وخطة rollback، دون دفعة عامة.
5. اختبار السوق والصداقة والاتصال والإشعارات بحسابين واقعيين ثم مراقبة logs.

**الحالة:** لا توجد أي تغييرات إنتاجية نفذت في R7.3.
