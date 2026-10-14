# مطابقة سجل ترحيلات Supabase — Alwaha-Pro

آخر تحقق مباشر من سجل الإنتاج في 14 أكتوبر 2026. أسماء الترحيلات والنسخ أدناه مبنية على سجل Supabase الحي.

| Version | Name in production | Local source status |
|---|---|---|
| 20260920090000 | alwaha_pro_v282 | موجود |
| 20261007082734 | 20261005000000_fix_like_count_security | الاسم المحلي بمحاذاة رقم الإنتاج في هذا المرشح |
| 20261011184718 | alwaha_profile_privacy_clean_start | **ملف المصدر الأصلي غير موجود في المستودع بعد** |
| 20261011184813 | verification_request_profile_requirements | **ملف المصدر الأصلي غير موجود في المستودع بعد** |
| 20261011204819 | secure_contact_privacy_defaults | موجود |
| 20261013235236 | multiplayer_game_rooms_v283 | الاسم المحلي بمحاذاة رقم الإنتاج في هذا المرشح |
| 20261014192321 | username_follows_call_features_20261014090000 | الاسم المحلي بمحاذاة رقم الإنتاج في هذا المرشح |
| 20261014193854 | legacy_archive_api_access_hardening | أضيف في هذا المرشح |
| 20261014194007 | safe_public_directory_invoker | أضيف في هذا المرشح |
| 20261014194053 | app_settings_api_privacy | أضيف في هذا المرشح |
| 20261014194820 | release_policy_performance_cleanup | أضيف في هذا المرشح |
| 20261014194848 | rls_initplan_optimization | أضيف في هذا المرشح |
| 20261014195018 | game_room_join_game_validation | أضيف في هذا المرشح |
| 20261014195108 | game_room_join_rpc_compatibility | أضيف في هذا المرشح |
| 20261014195445 | friend_request_column_privileges | أضيف في هذا المرشح؛ يسمح بتعديل الحالة فقط |
| 20261014195540 | friend_request_policy_consolidation | أضيف في هذا المرشح؛ سياسة تحديث موحّدة للمشاركين |

## قاعدة أمان

لا تشغّل supabase db push ولا تعِد تفعيل workflow النشر قبل استعادة ومراجعة المصدرين التاريخيين المفقودين، ومقارنة حالة قاعدة البيانات، وتنفيذ dry-run مستقل. لا تضف ملفات فارغة أو ترحيلات no-op بأسماء التاريخ المفقود؛ ذلك يخفي فقدان المصدر بدل إصلاحه.

## البيانات المحفوظة

وقت معالجة صلاحيات الجداول التاريخية، كانت posts_legacy_20260923010735 تحتوي صفّين وproducts_legacy_20260923010735 تحتوي ثلاثة صفوف، بينما تعليقات ورسائل legacy كانت فارغة. تم الاحتفاظ بهذه الصفوف، وسحب صلاحيات API من الأدوار anon وauthenticated دون حذف البيانات.
