# مطابقة قاعدة Supabase الحية مع مصدر 3.0.3 — 2026-11-08

> جرد للقراءة فقط؛ لم تُنفذ أي كتابة أو ترحيل أو تعديل بيانات على قاعدة الإنتاج.

## سجل الترحيلات
- يحتوي الفرع 31 ملف SQL ضمن supabase/migrations، وسجل الإنتاج يحتوي 29 إصداراً.
- 23 إصداراً متطابقاً بين المصدر والسجل الحي.
- ثمانية ملفات مصدر لم تظهر مطبقة في الإنتاج:
  - 20261101210000_marketplace_transaction_archive_and_call_auth.sql
  - 20261102010000_legacy_client_privileges_hardening.sql
  - 20261102100000_marketplace_retention_policy_and_cleanup.sql
  - 20261102150000_products_seller_email_privacy.sql
- 20261108100000_server_authoritative_game_actions.sql
- 20261108110000_marketplace_retention_two_party_consent.sql
- 20261108120000_real_chat_message_replies.sql
- 20261108130000_friend_request_acceptance_notification.sql
- إصداران مسجلان كمطبقين في الإنتاج ولم نعثر على ملفيهما أو على commits لهما في مسار المستودع:
  - 20261011184718_alwaha_profile_privacy_clean_start.sql
  - 20261011184813_verification_request_profile_requirements.sql
- لا يجوز اختلاق نص تاريخي لهاتين الهجرتين أو إنشاء ملفين بنفس الإصدار بالتخمين. يلزم استرجاع الأصل أو إعداد baseline جديد موثق لا يتعارض مع تاريخ الإنتاج.

## فروق مؤكدة في قاعدة الإنتاج
- جدول public.market_transactions غير موجود.
- العمود market_conversations.listing_snapshot غير موجود.
- أعمدة الاحتفاظ archived_at وretention_until وretention_notice_sent_at غير موجودة على محادثات السوق.
- فهرس market_messages_sender_id_idx غير موجود.
- سياسة products_delete_own ما زالت موجودة، وصلاحية DELETE على public.products ما زالت ممنوحة إلى authenticated.
- سياسات realtime.messages الحية تحتوي مسارات مكالمات الصداقة القديمة ولا تحتوي market-call-inbox- أو market-call-room-.
- لذلك لا يجوز إعلان البيع الموثق أو لقطة الإعلان أو الضمان أو الاحتفاظ الآلي أو مكالمات السوق مكتملة إنتاجياً قبل مراجعة واعتماد الترحيلات وتشغيل اختبارات تكامل عليها.


## ترحيلات 3.0.3 الجديدة غير المنشورة
- `20261108100000_server_authoritative_game_actions.sql`: ينقل إنشاء الغرف وحركات الألعاب إلى Edge Function ويتحقق من دور اللاعب ورقم الحركة ويمنع الكتابة المباشرة في game_rooms.
- `20261108110000_marketplace_retention_two_party_consent.sql`: يمنع الحذف التلقائي؛ يتطلب موافقة منفصلة قابلة للسحب من المشتري والبائع بعد الإشعار والمهلة.
- `20261108120000_real_chat_message_replies.sql`: يضيف reply_to_id ويمنع RLS الرد على رسالة من زوج محادثة آخر أو من محادثة سوق مختلفة.
- `20261108130000_friend_request_acceptance_notification.sql`: يرسل لصاحب الطلب إشعاراً واحداً عند قبول الصداقة.
- هذه الملفات اجتازت اختبارات PostgreSQL المعزولة عندما يكتمل CI، لكنها لم تُطبّق على قاعدة الإنتاج. لا تفترض أن وظائفها متاحة للمستخدمين الفعليين قبل النشر والتحقق.

## ما تأكد أنه محمي حالياً
- عمود products.seller_email موجود، لكن authenticated لا يملك SELECT عليه، ويوجد trigger حي باسم products_clear_public_email. لم أضف إصلاحاً مكرراً لهذا المسار.
- جدولَا admin_action_logs وapp_settings مفعّل عليهما RLS ولا تظهر صلاحيات عميل مباشرة في فحص المنح.
- الخدمات المنشورة username-auth وcall-config وadmin-api تطابق ملفات المصدر في الفرع حرفياً. verify_jwt=false لـ username-auth الخاص بتسجيل الدخول الأولي باسم المستخدم، وtrue للخدمتين الأخريين.
- دوال can_review_marketplace_product وjoin_game_room وsubmit_game_move من نوع SECURITY DEFINER. ACL المقروء لا يمنح PUBLIC صلاحية EXECUTE؛ الصلاحية محددة لـ authenticated وservice_role، وأجسام الدوال تتضمن فحوص auth.uid()/المشارك/الدور. بقيت مراجعة سياسات استدعائها ضمن مراجعة الأمان، ولا تُحذف عشوائياً.
- Security Advisor يسجل تحذيراً لتعطيل حماية كلمات المرور المسرّبة. هذا إعداد Auth في لوحة المشروع، ولا يكفي تغيير واجهة التطبيق لحله.
- Performance Advisor يسجل مفاتيح خارجية بلا فهرس، بينها market_messages.sender_id، و17 فهرساً غير مستخدم في الفترة المرصودة. لم أحذف أياً منها لأن عدم الاستخدام في مشروع قليل الحركة لا يثبت أنها زائدة.
- Health Advisor لم يسجل ملاحظات في اللقطة المقروءة.

## بوابة ما قبل الإنتاج
1. استرجاع/توثيق مصدري الهجرتين التاريخيتين المفقودتين دون إعادة استخدام إصداراتهما بالتخمين.
2. مراجعة ترحيلات السوق الأربعة مع أثرها على الصلاحيات واللقطات وسياسة الحذف وجدولة pg_cron.
3. اعتماد نافذة تطبيق آمنة؛ ترحيل الاحتفاظ ينشئ مهمة تنظيف دورية تحذف الأرشيف بعد مدة الإشعار المحددة، ولذلك لا يُطبق دون موافقة صريحة على سياسة الاحتفاظ.
4. بعد الترحيل: إعادة فحص privileges وRLS وRealtime وindexes وmigration history، ثم اختبار جهازين على محادثة السوق ومكالمة السوق والبيع والضمان والأرشفة.
5. تفعيل Leaked Password Protection في إعدادات Auth والتحقق منه قبل الإطلاق.

## حدود الجرد
هذه لقطة قراءة مباشرة للمخطط والصلاحيات وسجل الترحيلات وقت المراجعة، وليست اختباراً لحركة مستخدم فعلية ولا إذناً بتنفيذ DDL على قاعدة الإنتاج.