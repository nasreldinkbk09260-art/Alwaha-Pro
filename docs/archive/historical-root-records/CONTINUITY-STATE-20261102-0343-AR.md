> هذه نقطة تاريخية قديمة، وتم تجاوزها بنقطة الاستمرارية R5. استخدم `docs/CONTINUITY-STATE-20261102-R5-AR.md` وسكربت `TERMUX-PUSH-3.0.2-R5-20261102.sh` فقط.

# نقطة متابعة Alwaha-Pro 3.0.2 — R3 — 2 نوفمبر 2026، 03:43–04:xx Cairo

> هذه مذكرة الاستمرارية الأساسية. لا تبدأ مشروعاً جديداً ولا تستعد إلى 2.8.8 أو 3.0.1 كنسخة نهائية. ابدأ دائماً من هذا المجلد ونفس ملفات R3.

## المصدر والخط الأساس

- ملف المصدر المستلم من المستخدم: `Alwaha-Pro-3.0.2-Complete-Source-Candidate-20261101-R1.zip`.
- SHA-256 الأصلي الذي تحقّق منه المستخدم في Termux: `f56ae24a80f3163963056408c13c57ab1120b475c4a46eb5f51179582c344118`.
- مجلد العمل المستمر: `/mnt/data/Alwaha-Pro-3.0.2-Final-Worktree-20261102-0343`.
- GitHub repo: `nasreldinkbk09260-art/Alwaha-Pro`.
- نقطة الأساس: branch `alwaha-social-3.0.1-mobile-performance-20261020`, commit `f116998da546b05b65d52bf89871de1490dcc920`.
- الفرع المراد إنشاؤه: `alwaha-pro-3.0.2-release-20261102`. لا تعدّل `main` أو فرع 3.0.1 الأساسي.
- هوية التطبيق ثابتة: `pro.alwaha.app`, الاسم `Alwaha-Pro`, الإصدار `3.0.2`, و`webDir=dist`.

## سياسة المال/البيئة

- GitHub repository عام وصلاحية حساب GitHub الحالية تشمل push.
- استخدم GitHub Actions على المستودع العام لبناء Android؛ لا حاجة لشراء runner.
- لا تنشئ Supabase Preview Branch مدفوعاً. السعر الذي أظهرته أداة Supabase هو `0.01344 USD/branch-hour`; فروع Supabase في الخطة المجانية غير متاحة حسب معلومات التسعير التي تمت مراجعتها. لا توجد ضرورة لإنفاق هذه التكلفة الآن.
- لا تشغّل `supabase db push`, ولا تنفّذ DDL أو `migration repair` على قاعدة الإنتاج قبل حل انجراف سجل الترحيلات.

## إصلاحات R3 الموجودة الآن

1. استعادة `scripts/android/AlwahaAudioRoutePlugin.java` الذي كان ناقصاً من R1 مع اسم APK 3.0.2؛ تدقيق `audit:native-call-ui` يمر.
2. تعديل `scripts/vendor-assets.mjs` حتى يستخدم 41 مورداً محلياً مثبتاً داخل الحزمة عند غياب حزم `node_modules`؛ `npm run prebuild` يمر.
3. نقل النسخ التاريخية غير المطابقة من مجلد `supabase/migrations/` إلى `docs/migration-archive-unapplied/`، مع حفظ نصوصها. النسخ المؤرشفة: `20261024211500`, `20261027170000`, `20261029121500`. أرقام الإنتاج الصحيحة حسب السجل: `20261029035135`, `20261029035139`, `20261029121330`.
4. تحديث `release-preflight.mjs` و`field-repair-audit.mjs` لقراءة أسماء migrations الصحيحة، وإصلاح early-exit بحيث تنفذ جميع فحوص preflight قبل الحكم النهائي.
5. إشعارات الصداقة: لا تُعلّم كل الإشعارات عند فتح المركز؛ أزرار القبول/الرفض توقف propagation، تُعطّل أثناء الطلب، وبعد النجاح تُزال بطاقة الطلب وحدها ويُعلّم إشعارها فقط كمقروء. تدقيق المحادثة 50 تحققاً.
6. السوق: صندوق محادثات منفصل عن الأصدقاء؛ لا تشترط صداقة بين البائع والمشتري؛ الأرشفة لا تحذف سجل المحادثات؛ لقطة الإعلان تبقى عند حذف المنتج؛ سجل البيع والاتفاق والضمان يعمل عبر RPC ذرية، مع قنوات مكالمة سوق مقيدة بأطراف محادثة موثقة.
7. ترحيل أمن جديد `20261102010000_legacy_client_privileges_hardening.sql` يسحب صلاحيات كتابة/حذف/TRUNCATE غير الضرورية على جداول `likes`, `profiles`, `ratings` القديمة مع إبقاء القراءة. فحص Supabase الحي كان قد أكد صلاحيات client واسعة على الجداول الثلاث رغم RLS. الترحيل واختباره SQL لم يطبقا على الإنتاج.
8. ترحيل احتفاظ `20261102100000_marketplace_retention_policy_and_cleanup.sql`: 30 يوماً لمحادثة/إعلان مؤرشف بلا ضمان؛ حتى نهاية الضمان + 30 يوماً للصفقة ذات الضمان؛ إشعار المشتري والبائع قبل 7 أيام؛ `disputed` يستثنى؛ تنظيف يومي محدود عبر `pg_cron`. أضيف استثناء آمن في guard يسمح فقط لـ`postgres`/`service_role` بأرشفة ضمان انتهى، ويظل buyer-only confirmation محفوظاً. إشعارات الدفعات تحدّث فقط الصفوف التي تم اختيارها وقفلها بالفعل. الترحيل لم يطبق على الإنتاج.
9. غرفة الأطفال: صوت من AudioContext واحد، أصوات بترددات متدرجة، إعادة ضبط المفتاح/القفل لكل دخول، معالجة `pointercancel`، تحكم لوحة مفاتيح، focus trap، خروج ولي الأمر، وإغلاق تلقائي قبل إزالة وسائط المكالمة. الفلاتر الحالية CSS ألوان كاميرا، والمشهد الآن منظور CSS 2.5D مع صورتين عائمتين muted من بث الطرف الآخر دون مسار صوت إضافي؛ ليس AR face-tracking أو محرك 3D/WebGL/فيزياء حقيقية.
10. خزنة محلية مشفرة: AES-GCM/PBKDF2، تشفير قبل التخزين، صيغة base64 مع قراءة النسخة القديمة، استعادة إعدادات ومسودات فقط دون مسح كامل IndexedDB، ترقيم صفحات للتصدير، تحذير عند الحد، وتخزين envelope مشفر في IndexedDB مع زر تنزيل نسخة محفوظة. البيانات السحابية تُصدّر كلقطة ولا يعيد الاستيراد كتابتها إلى Supabase تلقائياً.
11. `alwaha-experience.js`: المواسم الأربعة، تحريك/تكديس/إخفاء/إعادة ترتيب دوائر التنقل مع حفظ الإعدادات، أصوات متدرجة من AudioContext واحد ومعدل 55ms لتجنب الإنشاء المتكرر. زر الشبكة المحلية لا يزال محذوفاً.
12. تحديث service worker cache token إلى `alwaha-pro-v3.0.2-release-candidate-20261102-0343`.
13. إضافة `audit:ui` للتحقق من event handlers، و`audit:retention-kids-vault` للتحقق من الميزات الجديدة، وكلاهما مربوط في GitHub Actions.

## نتائج الفحوص المحلية الحالية — بعد آخر تعديلات R3

- JSON / lock versions / manifest / Capacitor identity: PASS.
- `node --check` لكل `.js` و`.mjs` وملف UMD: PASS.
- 3 كتل JavaScript inline داخل `index.html`: PASS.
- `npm run prebuild`: PASS — 41 ملف vendor محلي.
- `npm run audit:release`: PASS.
- `npm run audit:performance`: PASS.
- `npm run audit:chat`: PASS — 50 تحققاً.
- `npm run audit:compatibility`: PASS.
- `npm run audit:native-call-ui`: PASS — 5 تحققات.
- `npm run audit:field-repair`: PASS — 140 static DOM IDs بدون تكرار.
- `npm run audit:ui`: PASS — 244 استدعاء حدث inline إلى 116 اسم وظيفة، ولا مدخل شبكة محلية.
- `npm run audit:retention-kids-vault`: PASS — 32 تحققاً.
- `npm run build`: لم ينجح محلياً بسبب تعذر DNS/تنزيل npm وغياب `node_modules/esbuild`. لا يوجد `dist` محلي بعد.
- لا يوجد APK/AAB 3.0.2 جديد. Build 43 الناجح سابقاً كان 3.0.1 فقط.

## حالة Supabase الحية — قراءة فقط

Project ref: `kjuixjdtqwcsnxefftrt`.

- `20261101022015` و`20261101022031` مطبقان بالفعل؛ لا تعِد تشغيلهما.
- `20261101210000`, `20261102010000`, `20261102100000` غير مطبقة.
- `20261011184718_alwaha_profile_privacy_clean_start.sql` و`20261011184813_verification_request_profile_requirements.sql` مسجلان في production migration ledger كمطبقين، لكن ملفيهما الأصليين لم يُستعادا من المستودع/المكتبة. لا تنشئ SQL تخمينياً لهما. `supabase-migrations.yml` يبقى guard غير ناشر يحظر أي دفع عندما لا يكون المصدر التاريخي موجوداً.
- `pg_cron` متاح لكنه غير مثبت في الإنتاج. لا يوجد `cron.job` قبل الترحيل. مصدر R3 يثبته ويجدول التنظيف عند 03:00 UTC، لكن هذا لم يتفعل في الإنتاج بعد.
- فحص ACL كشف client roles على `likes`, `profiles`, `ratings` لديها SELECT/INSERT/UPDATE/DELETE/TRUNCATE رغم RLS؛ migration hardening موجودة في المصدر فقط.
- Leaked Password Protection في Auth كان OFF في آخر قراءة؛ يحتاج إعداد منفصل بعد اختبار أثره على التسجيل.
- `call-config` Edge Function يوفر Google STUN ويضيف TURN إذا كانت أسرار TURN الثلاثة مهيأة. لم يثبت وجود TURN ولم يتم اختبار مكالمة جهازين.
- تحذيرات سابقة لثلاث دوال SECURITY DEFINER موجودة (`can_review_marketplace_product`, `join_game_room`, `submit_game_move`)؛ لا تُغيّر عشوائياً.

## أشياء تمنع تسمية النسخة «رسمية» بعد

1. رفع R3 إلى فرع GitHub مستقل وتشغيل GitHub Actions.
2. نجاح `npm ci`, `npm audit --audit-level=high`, Web build, Capacitor sync, signed APK/AAB, signature + appId + version checks.
3. استعادة نصّي migration التاريخيين المفقودين، أو عملية reconciliation موثقة قبل أي نشر DB. لا يوجد تصريح لتجاوز guard.
4. اختبار الترحيلات الجديدة على قاعدة Postgres/Supabase development قابلة للإتلاف. لا تشتري فرع Supabase preview طالما يمكن تأجيلها إلى قاعدة تطوير مجانية/محلية؛ لا تنفذ على production.
5. اختبار هاتفين وشبكتين: مكالمات صديق وسوق، صوت/فيديو/سماعة/كتم/كاميرا/إنهاء، طلب الصداقة/الإشعارات، دردشة السوق، الضمان/الأرشفة، backup/import، الأطفال، الأداء/الحرارة.
6. TURN إن كان ضرورياً للاختبار على الشبكات المقيدة.
7. حزمة الإدارة المستقلة ليست ضمن هذا المصدر، فقط واجهة إدارة التوثيق المضمنة.

## قاعدة الاستمرار

تابع من هذا المجلد. لا تعِد فحوصات R1 التي نجحت؛ شغّل التدقيقات أعلاه فقط بعد تغييرات المصدر. لا ترفع إلى `main`; استخدم الفرع `alwaha-pro-3.0.2-release-20261102`. لا تنفذ migration على production. لا تصف candidate بأنه رسمي قبل نجاح GitHub CI والتوقيع واختبار الهاتفين وتسوية migration history.

## آخر تحقق وقيود الرفع — 2 نوفمبر 2026، 04:04 Cairo

- أعيد تشغيل الفحوص بعد آخر تعديل لغرفة الأطفال والخزنة وسياسة الاحتفاظ: syntax/JSON، `audit:release`, `audit:chat` (49), `audit:compatibility`, `audit:performance`, `audit:field-repair`, `audit:native-call-ui`, `audit:ui`, `audit:retention-kids-vault` (31)، و`prebuild` (41 مورداً) كلها PASS.
- `npm run build` لم ينتج dist/APK/AAB هنا لأن `node_modules/esbuild` غير متوفر وتعذر الاتصال بسجل npm في المحاولات السابقة؛ GitHub Actions هو مسار البناء التالي بعد رفع الفرع.
- جرى استدعاء GitHub create-branch للفرع `alwaha-pro-3.0.2-release-20261102` ورُفض بـ403 `Resource not accessible by integration`. لم يتغير أي فرع أو commit. الحل العملي المرفق هو `TERMUX-PUSH-3.0.2-R5-20261102.sh` باستخدام `gh` الموثق من Termux؛ هذا هو الفعل الوحيد المطلوب من صاحب الحساب لتشغيل CI.
- يوجد `supabase-migrations.yml` كحارس غير ناشر؛ لن يعمل `db push` بسبب مصدرين تاريخيين مطبقين مفقودين. لم تُطبق DDL أو cron على الإنتاج.
- أنشئ R3 ZIP بعد تحديث `SHA256SUMS.txt`؛ يجب أن يتضمن السكربت، سجل الحالة، الاختبارات، وحزمة المصدر.


## إغلاق مراجعة R3 الإضافية — 2 نوفمبر 2026

- أصلحنا تسلسلاً كان يعطل رسالة الترحيب التلقائية في محادثة السوق بسبب `return` مبكر؛ أصبحت الرسالة تظهر بعد فتح المحادثة، وفحص الدردشة أصبح 50 تحققاً.
- أضيفت حماية من حذف الأرشيف المتأخر دون إشعار: إذا عاد Cron بعد انقطاع طويل، يرسل إشعاراً أولاً، ويظل السجل والرسائل محفوظين 7 أيام كاملة بعد وقت إرسال الإشعار. أضيف اختبار سلوكي لذلك في PostgreSQL CI وفحص ساكن إضافي؛ تدقيق الاحتفاظ/الأطفال/الخزنة أصبح 32 تحققاً.
- آخر تشغيل كامل للفحوص المحلية: جميع تدقيقات الإصدار الثمانية PASS، ثلاث كتل inline، JS/MJS/JSON/YAML/Bash syntax PASS، 26 migration فعالة ذات timestamps فريدة، الأسماء القديمة مؤرشفة خارج المسار النشط، و`npm run prebuild` PASS (41 مورداً).
- لم يشغّل بعد PostgreSQL CI ولا Android build لأنه لم يحدث push؛ لم تُنتج APK/AAB ولم تتغير قاعدة الإنتاج.
