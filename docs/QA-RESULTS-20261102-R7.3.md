# نتائج تدقيق R7.3 — 2 نوفمبر 2026

## مقارنة المصدر والرفع التاريخي

- آخر فرع 3.0.1 المرفوع: `alwaha-social-3.0.1-mobile-performance-20261020`.
- آخر commit: `f116998da546b05b65d52bf89871de1490dcc920`، الرسالة `Apply Alwaha-Pro 3.0.1 field test repairs`، بتاريخ 31 أكتوبر 2026.
- GitHub Actions Build #43 / run `41205477395` نجح من commit نفسه. artifact هو APK/AAB **3.0.1 فقط**، ولم يُستخدم كإصدار 3.0.2. ZIP/hash/مخرجاته موثقة في `docs/BUILD43-HISTORICAL-REFERENCE-AR.md`.
- إصلاح 3.0.1 post-test وMarket-Chat-Feed R2 راجعا بالمحتوى، لا باسم الملف. الأول كان ضمن خط Build #43/R7؛ الثاني كـscript لم يرفع في ذلك الفرع، لكن سلوكياته المقصودة موجودة في R7.3.
- لا يمكن الادعاء بمراجعة نصوص الدردشات الأربعة كاملةً؛ خريطة المصدر تذكر أسماءها والمواد التي أمكن استرجاعها في `docs/CHAT-CONTINUITY-SOURCE-MAP-R7.3-AR.md`.

## فحوص R7.3 التي نُفذت محلياً

| الفحص | النتيجة |
|---|---|
| `npm run audit:release` | PASS |
| `npm run audit:performance` | PASS |
| `npm run audit:field-repair` | PASS — 140 static DOM IDs بلا تكرار |
| `npm run audit:chat` | PASS — 53 checks |
| `npm run audit:compatibility` | PASS — ثلاث كتل JavaScript مضمنة parse |
| `npm run audit:native-call-ui` | PASS — 6 checks |
| `npm run audit:ui` | PASS — 244 inline event handler calls إلى 116 أسماء دوال |
| `npm run audit:retention-kids-vault` | PASS — 37 checks |
| `npm run audit:admin` | PASS — 16 checks |
| `npm run audit:marketplace-columns` | PASS — 8 queries مقابل allowlist الأعمدة |
| `npm run audit:reconciliation` | PASS — 34 cross-release invariants |
| `npm run prebuild` | PASS — 41 precached local assets |
| `node --check` لكل ملفات JS/MJS | PASS |
| JSON parsing وYAML parsing للـworkflows | PASS |
| `bash -n` لسكربت الرفع وSQL runner | PASS |
| فحص trailing whitespace في جميع الملفات النصية + حارس Termux المبكر | PASS — صفر مواضع |

تم حفظ سجل المخرجات في بيئة العمل باسم `alwaha-r73-validation-20261102.log`؛ لا يضم بيانات أو أسرار إنتاج.

## إصلاحات واختبارات CI الجديدة

1. عُرّفت أعمدة `latitude`, `longitude`, `promoted_until` داخل `supabase/tests/ci-bootstrap.sql` قبل منح SELECT عليها؛ كان CI fixture يمنح صلاحيات لأعمدة غير معرّفة.
2. أضيف `supabase/tests/20261102170000_marketplace_nonfriend_conversation.sql`: يثبت محادثة مشتري/بائع دون جدول صداقة في الـfixture، تبادل رسالة من الطرفين، وعزل مستخدم ثالث. الاختبار مضاف إلى `scripts/ci-validate-supabase-sql.sh` وworkflow Android.
3. أضيف فهرس `market_messages(sender_id)` إلى migration السوق/الأرشفة غير المطبقة، والاختبار يتحقق من وجوده، لمعالجة مؤشر الأداء الحي المحدد.
4. أضيف `scripts/reconciliation-audit.mjs` وربط في package والـworkflow، ويدقق 34 invariant من الإصلاحات عبر الإصدارات.
5. صارت الخلفيات الأربعة مشاهد CSS محلية كاملة الشاشة؛ تتوقف حركتها في reduced-motion/data-saver. أضيف مؤثر شخصيتين Emoji خفيف مع سقوط/عودة القبعة أو الحذاء بعد سحب أزرار التنقل. هذه مؤثرات بسيطة وليست رسوماً ثلاثية الأبعاد.

## ما لم ينجز أو لا يمكن ادعاء نجاحه

- لم يُرفع R7.3 إلى GitHub وقت هذه الحزمة، ولم يبدأ Actions من SHA R7.3.
- لا APK/AAB 3.0.2 حتى ينجح workflow، ولا Web build محلي مكتمل. لم تُشغّل عملية build المحلية لأن `node_modules/esbuild` غير موجود؛ تثبيت npm السابق تعثر DNS (`EAI_AGAIN`). سيُنفذ `npm ci` على GitHub hosted runner.
- `psql`/PostgreSQL غير متاح محلياً؛ لذلك لم تعمل اختبارات SQL الجديدة في هذه البيئة. يلزم نجاح PostgreSQL CI قبل أي rollout.
- لم تكتب هذه الجولة إلى Supabase production، ولم تطبق migration، ولم تنشر Edge Function أو Pages.
- قاعدة الإنتاج ما زالت تسمح `products_delete_own` وDELETE، ولم تُفعّل snapshot/transactions/retention. migration source في R7.3 فقط.
- المحادثة السوقية لم تُثبت برسالة حقيقية بين حسابين؛ جداولها وسياساتها موجودة في الإنتاج لكن صفوفها كانت صفر وقت الاستعلام.
- مصدر migration تاريخيين مطبقين على الإنتاج غير متاح: `20261011184718_alwaha_profile_privacy_clean_start.sql` و`20261011184813_verification_request_profile_requirements.sql`. لا تُنشأ نسخ تخمينية ولا يُشغّل `supabase db push`.
- Supabase Auth Leaked Password Protection معطل، و3 دوال SECURITY DEFINER أظهرت advisor warnings. يلزم مراجعة منفصلة؛ لا تغييرات تلقائية.
- لا مكالمة WebRTC/TURN أو فيديو أو غرفة أطفال على هاتفين/شبكتين؛ ولا استعادة backup فعلية؛ ولا فحص بصري للخلفيات على هاتف قديم وحديث.
- غرفة الأطفال CSS 2.5D بمؤثرات آمنة، وليست AR/فيزياء حقيقية. الكوب يتفتت كرتونياً.

## قرار الحالة

R7.3 **مرشح مصدر موحد جاهز لبدء build-only CI** بعد الرفع، وليس نسخة رسمية نهائية بعد. لا تُنقل حالتها إلى “جاهز للنشر” إلا بعد PostgreSQL regression + Web/APK/AAB build/signature + فحص artifacts + جهازين وشبكتين + مصالحة/rollout قاعدة البيانات.
