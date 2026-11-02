# موانع الإصدار الرسمي — Alwaha-Pro 3.0.2 R7.3

آخر تحديث 2 نوفمبر 2026. هذه القائمة تتقدم على الموانع الأقدم في R3–R7.1.

## P0 — يجب إغلاقها قبل إعلان الإصدار الرسمي

1. **رفع R7.3 وتشغيل CI:** لم يظهر push بعد. فرع الهدف `alwaha-pro-3.0.2-release-r7.3-20261102` سيُرفع بالسكربت الجديد. يلزم نجاح run على SHA محدد.
2. **PostgreSQL SQL regression:** أُصلح fixture وأضيف اختبار محادثة السوق بلا صداقة، لكن لا نعتبره ناجحاً إلا بعد تشغيله في GitHub Actions.
3. **Web + Android build:** لم ينتج `dist` أو APK/AAB 3.0.2 جديد. يلزم build artifact، فحص package id/version والـsignatures.
4. **المحادثة الفعلية:** الإنتاج لديه الجداول والسياسات وRealtime، لكن عدد صفوف المحادثات/الرسائل كان صفراً عند الاستعلام؛ المستخدم أبلغ مشكلة الإرسال. يتطلب حساب مشتري وبائع واختبار REST/Realtime.
5. **حماية حذف الإعلان:** المنتج ما زال في production يقبل DELETE عبر authenticated/`products_delete_own`. migration R7 تسحب الصلاحية، لكنها لم تطبق.
6. **السجل/الضمان/الاحتفاظ:** snapshot/transaction/retention migrations موجودة في المصدر فقط، ولم تثبت في production.
7. **تاريخ migrations:** الملفان الأصليان `20261011184718_alwaha_profile_privacy_clean_start.sql` و`20261011184813_verification_request_profile_requirements.sql` مسجلان في production كمطبقين لكن محتواهما مفقود. لا تكتب بدائل تخمينية ولا تشغل `db push`.
8. **تجربة الجهازين:** لا دليل فعلي على video/audio/market calls/kids effects/backup restore على جهاز حديث وآخر أقدم وشبكتين مختلفتين.

## P1 — أمن/جودة لازمة للإغلاق

- Leaked Password Protection غير مفعلة في Supabase Auth.
- ثلاث SECURITY DEFINER functions تحتاج مراجعة صلاحيات ودوافع استخدام: `can_review_marketplace_product`, `join_game_room`, `submit_game_move`.
- فهرس `market_messages.sender_id` أضيف في R7.3 إلى migration السوق/الأرشفة واختبار SQL؛ لم يُختبر على PostgreSQL CI ولم يطبق على production بعد.
- اختبار thermal/performance/echo لغرفة الأطفال ومسار صوت WebRTC لم يجر على هاتفين.
- جودة video adaptive/TURN packet loss/RTT لم تُثبت فعلياً.
- رحلة الحساب كاملة من التسجيل حتى حذف الحساب وسيناريو اتصال ضعيف/دون اتصال لم تُقبل يدوياً.

## P2 — تجميل/تحسينات بعد إغلاق القواعد

- مراجعة بصرية لخلفيات الصيف/الشتاء/الخريف/الربيع للتأكد من cover كامل وتناسق ألوان وتباين على أحجام مختلفة.
- يوجد أثر كرتوني محدود بشخصيتي Emoji تتبعان السحب وسقوط/عودة قبعة أو حذاء وصوت متغير؛ لم يُقبل بصرياً على الأجهزة، ولا يمثل شخصيات كاملة أو 3D.
- غرفة الأطفال الحالية 2.5D ومؤثرات آمنة محلية، وليست محرك AR/فيزياء/كسر زجاج واقعي. توسيعها لفيزياء متقدمة ليس شرطاً تقنياً لاختبار المسار الحالي، لكنه متطلب مفتوح إن كان ضرورياً قبل إطلاق المنتج.
- تطبيق الإدارة المستقل يحتاج APK منفصل/توقيع واختبار admin مقابل user، رغم نجاح audit وبناء الويب.

## ما لا يعاد فحصه بلا تغيير

فحوص R7 الساكنة موثقة في `QA-RESULTS-20261102-R7.md`، وR7.3 أضاف reconciliation audit واختبار SQL للسوق بلا صداقة وفهرس sender_id. لا نطلب من المستخدم إعادة دورة npm audits في Termux؛ GitHub Actions يعيد الاختبارات الضرورية بعد push.

## تعريف «رسمي كامل»

يتطلب SHA CI ناجحاً، SQL regression ناجحاً، Web/APK/AAB build وتوقيعاً سليماً، مصالحة migration history ونسخة احتياطية، تفعيل إعدادات Auth اللازمة، نجاح الرسائل/الإشعارات/المكالمات على هاتفين وشبكتين، واختبار backup restore وUI/Compatibility. حتى ذلك الحين يظل R7.3 **Release Candidate Source** وليس الإصدار الرسمي.
