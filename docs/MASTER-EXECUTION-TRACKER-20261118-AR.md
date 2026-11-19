# سجل التنفيذ والاستمرارية الرئيسي — Alwaha-Pro
**التاريخ:** 18 نوفمبر 2026 (Africa/Cairo)  
**الفرع النشط:** `alwaha-pro-recovery-20261118` — أساسه `f5efcf5e5a730ca820439800a6faf70d852d704d`.  
**قاعدة النشر:** لا تعديل على `main`، ولا نشر APK/الموقع أو كتابة في Supabase الإنتاجية دون مراجعة بوابات الاختبار والموافقة المناسبة.

> هذا السجل يتقدم على أي توجيه أقدم متعارض في دفاتر R7 التاريخية. طلب المستخدم الحالي يعيد اعتماد الألعاب الجماعية ويطلب بناء وضع شبكة محلية جديد؛ لذلك لا يُعاد تطبيق القرار السابق بإبقاء الألعاب مغلقة أو حظر زر الشبكة. لا يُستعاد كود mesh قديم محذوف.

## 1. الحالة المثبتة
- GitHub Release `v3.0.4` مبني من `d149ade3f61de92046e82637f9b85b1dbdc1db31`، وبصمة APK: `a266bc8158c922c838452a499b29ea040c5c175af5bda6beeb8206853fa6f35c`.
- مصدر `main` و`alwaha-pro-3.0.3-dev` كان متطابقاً عند `f5efcf5e5a730ca820439800a6faf70d852d704d`، ومتقدماً على commit الإصدار المنشور. CI #594 و#595 نجحا على هذا المصدر؛ لا يثبت ذلك أن APK جديداً قد وُزّع أو اختُبر على الهاتف.
- Supabase `kjuixjdtqwcsnxefftrt` حالته `ACTIVE_HEALTHY`، آخر migration مقروء `20261118024802`. Edge Function `game-actions` نشطة وJWT محمي، وجدول `game_rooms` موجود وRLS مفعّل.
- الشطرنج وليدو وحرب الورق هي الألعاب الجماعية الموجودة؛ إنشاء/انضمام الغرف وQR واستعادة الغرفة والتحقق من الحركات موجودة في المصدر. بوابة واجهة كانت تخفيها، والتفعيل لا يعوّض اختبار حسابين وجهازين.
- أُضيف فرع الاسترداد إلى فروع تشغيل CI فقط. يظل نشر GitHub Release وPages مشروطاً بـ `github.ref == refs/heads/main`، ولا يغيّر هذا التعديل شروط النشر العام.
- محرر الملف الشخصي `alwaha-profile-editor.js` محمّل من `production-polish.js` وينقل أدوات التجربة إلى زر أسفل الصورة والاسم. يلزم التحقق من ظهوره في APK، لا إعادة كتابة محرر موجود بلا دليل.
- `alwaha-kids-room.js` موجود ويحتوي غرفة تفاعلية محلية مع تحكم ولي الأمر واستعادة فيديو الطرفين؛ زر الدخول كان معطلاً واختبار مكالمة حقيقية على جهازين لم يثبت بعد.

## 2. قائمة الأولويات الموحّدة من الأيام السبعة والملاحظات السابقة
| الأولوية | المهمة | الحالة/بوابة الإغلاق |
|---|---|---|
| P0 | تطابق APK مع أحدث مصدر | بناء مصدر commit محدد، تدقيق توقيع وبصمة وهوية التطبيق، ثم تثبيت واختبار ترقية |
| P1 | فتح الشطرنج وليدو وحرب الورق | CI، ثم حسابان/هاتفان: إنشاء غرفة، دعوة كود/QR، لعب، قطع/استعادة |
| P1 | اختيار مكالمة فيديو عادية أو غرفة الأطفال | اختبار اتصال وارد/صادر، وصول فيديو الطرف الآخر، دخول الغرفة والعودة والخروج كولي أمر |
| P1 | شبكة محلية في المحادثة Wi‑Fi/Bluetooth | غير منفذة: Capacitor Android Plugin أصلي، إقران بموافقة الطرفين، تشفير ونقل نصوص/صوت/فيديو/ملفات، اختبار هاتفين دون إنترنت |
| P1 | دردشة الأصدقاء والسوق | اختبار حقيقي بين طرفين، السوق لا يشترط الصداقة؛ تحقق من إنشاء المحادثة وإرسال/استلام الرسالة |
| P1 | الإشعارات وطلبات الصداقة | فتح إشعار واحد يعلّمه فقط؛ قبول الطلب لا ينتظر إعادة تحميل قائمة المستخدمين |
| P1 | سلامة الأطفال والإبلاغ والحظر والدعم | تجربة البلاغ العاجل، الحظر/فك الحظر، طلب الدعم وسجل الإدارة، وأذونات الكاميرا/الميكروفون والخروج الآمن |
| P2 | الملف الشخصي والخلفيات | الصورة والاسم أولاً، ثم زر مساحة الواحة، زر التسجيل/الدخول وبقية الخيارات بترتيب واضح؛ اختبار الخلفيات |
| P2 | الرنين والأصوات ومسار الصوت | تشغيل ملف الرنين كاملاً، مسار المكالمة ومكبر/سماعة؛ لا تخلط سماعة Bluetooth بميزة الاتصال المحلي |
| P2 | جودة الفيديو | قياس RTT وفقد الحزم وتبديل الجودة على شبكات مختلفة |
| P2 | الأداء والبيانات المحدودة/انقطاع الإنترنت | لا فقد للمسودات، تحقق cache/offline/reconnect، وتحديد ما يحتاج الخادم |
| P2 | الثيمات والملاحة | فحص الثيمات، زر الرجوع، السحب/الإخفاء/الاستعادة، تقليل الحركة والبيانات |
| P2 | السوق والضمان والأرشيف | بائع ومشتري مستقلان، لقطة الإعلان، ضمان/نزاع، وموافقتان قبل التنظيف |
| P2 | الإدارة | مراجعة تطبيق الإدارة وadmin-api وبلاغات/توثيق وسجل تدقيق بلا تسريب |
| P2 | تنظيف بيانات الاختبارات | طلب سابق لحذف الاختبارات عدا حساب الإدارة؛ قراءة الإنتاج أظهرت 3 مستخدمين و0 منشورات و1 منتج و1 reel و3 رسائل؛ لا حذف دون لقطة ومطابقة السجلات وعدم المساس بحساب الإدارة |
| P2 | الإعلان الحقيقي والصفحة الرسمية والفيديو التعريفي | لا بيانات أو إعلانات وهمية؛ يلزم محتوى يقدمه المالك، موسيقى مرخصة أو أصلية، ثم تحديث الموقع وتسجيل شرح |
| P0 | أمن Supabase/Auth | Advisor: تحذير Leaked Password Protection وست ملاحظات INFO لجداول RLS؛ راجع GRANT/RLS والدوال، ولا تغيّر إعدادات الإنتاج/SQL دون خطة وموافقة |

## 3. معمارية الشبكة المحلية المطلوبة
- زر داخل رأس المحادثة بجانب الصوت والفيديو، يعرض وضع الإنترنت أو المحلي وحالة الاقتران.
- اكتشاف جهاز قريب عبر Wi‑Fi/Bluetooth بحسب دعم Android، مع قبول/رفض واضح من الطرفين. لا تُفتح الكاميرا أو الميكروفون ولا يُرسل ملف قبل إذن منفصل.
- دردشة النصوص والملفات والصوت والفيديو عبر قناة محلية مشفرة وتحقق متبادل من الهوية؛ لا تذهب إلى Supabase/الإنترنت في الوضع المحلي إلا بطلب صريح للتحويل.
- يتطلب مكون Android/Capacitor أصلياً بصلاحيات واضحة وإيقاف آمن وإعادة اتصال؛ زر HTML أو WebRTC Internet ليس شبكة محلية.
- لا تُعد كود mesh القديم. اختبر Wi‑Fi بلا إنترنت، Bluetooth/قرب مدعوم، رفض الاقتران، قفل الشاشة، الرجوع، إعادة الاتصال، ملف كبير/إلغاء، والتحويل إلى الإنترنت. لا تُعلن Bluetooth calling قبل الاختبار الفعلي.

## 4. الاستئناف ونقطة الحفظ
1. اقرأ أحدث HEAD من `alwaha-pro-recovery-20261118` وهذا الملف قبل كل جلسة؛ لا تعتمد SHA من ذاكرة قديمة.
2. نفّذ أعلى بند غير محجوب فقط في الفرع المستقل؛ لا تنشئ فرعاً مكرراً ولا تدمج إلى `main`.
3. بعد كل دفعة: أضف اختبارات قبول، شغّل audits والبناء، افحص سجل GitHub Actions، ثم حدّث هذا الملف بحالة كل بند وSHA والنتائج والعائق والخطوة التالية.
4. cancelled ليست نجاحاً. عند فشل CI افتح السجل المحدد وأصلح السبب قبل أي إعادة تشغيل.
5. ممنوع حذف بيانات الإنتاج أو تغيير Auth أو تنفيذ migrations/SQL أو نشر Edge Functions أو إصدار APK/الموقع دون مراجعة بوابة الحماية.
6. لا يمكن للمجدول اكتشاف انقطاع الإنترنت أو استئناف العمل لحظياً أثناء الانقطاع. سيحاول التشغيل اليومي التالي الاستئناف من آخر commit وهذا السجل.

## 5. الدفعة الحالية
- إزالة بوابة الألعاب وعرض الشطرنج/ليدو/حرب الورق بأزرار إنشاء الغرفة والانضمام بالكود وQR واستعادة آخر غرفة.
- إضافة اختيار مكالمة فيديو عادية أو فيديو مع غرفة الأطفال؛ الدخول التلقائي لغرفة الأطفال ينتظر اتصال المكالمة ووصول بث الطرف الآخر، وزر يدوي متاح أثناء مكالمة فيديو متصلة.
- تحديث اختبارات الألعاب وواجهة التنقل وغرفة الأطفال، وإضافة سجل التنفيذ.
- لم تُكتب بيانات Supabase، ولم يُنشر APK أو الموقع. اختبار الهاتفين ما زال مطلوباً.
- CI #596/#597 فشلا في صياغة اختبار غرفة الأطفال؛ #598 اجتاز الصياغة ثم كشف شرط Kids Mode القديم، وأظهر كذلك أن `performance-audit.mjs` يرفض إضافة فرع CI التجريبي. #600 تقدم إلى تدقيق الأداء ثم فشل فقط عند قائمة الفروع. تم توسيع قائمة الفروع المسموحة صراحةً لتضم فرع الاسترداد مع بقاء نشر Release والموقع مقيداً إلى `main`؛ راجع أحدث تشغيل لتأكيد المرور.
- بعد إغلاق هذه الدفعة: الانتقال إلى مكوّن الشبكة المحلية الأصلي، مع توثيق أي مانع محدد؛ ثم اختبارات الدردشة والإشعارات وسلامة الأطفال.

## تحديث تدقيق المحادثات والفروع — 18 نوفمبر 2026
- CI #601 اجتاز الأداء وSQL ثم كشف بقايا اختبار فيديو قديم في `chat-release-audit.mjs`؛ commit `ea69a68` أزال شرط تأجيل وضع الأطفال وحدّث `reconciliation-audit.mjs` للسماح بالفرع المعتمد. تشغيل #602 (على SHA `ea69a68`) ظل يفشل في `chat-release-audit` بسبب فحص `initiateVideoCall()` المباشر؛ هذا غير مناسب بعد تحويل الزر إلى اختيار وضع مكالمة.
- تم الآن تحديث شرط `video action` للتحقق من ظهور نافذة الاختيار وخياري الفيديو العادي/غرفة الأطفال. كما يتحقق الشرط المضاف من قصر زر غرفة الأطفال على اتصال فيديو متصل وانتظار بث الطرف الآخر.
- قائمة الفروع المعتمدة المتطابقة في workflow و`performance-audit.mjs` و`reconciliation-audit.mjs`: `main` و`alwaha-pro-3.0.3-dev` وفرع الاسترداد المحدد فقط.

## تحديث اختبارات سلامة الأطفال — 18 نوفمبر 2026
- CI #602 اجتاز PostgreSQL وفحوص الأداء السابقة ثم تعثر في اختبار `video action` القديم؛ commit `06534ab` أصلح ذلك، وCI #603 بدأ على هذا الرأس.
- فحص البحث وجد اختبارين إضافيين ما زالا يفرضان تعطيل Kids Room في `user-safety-ui-audit.mjs` و`reconciliation-audit.mjs`. استُبدلا باختبارات إيجابية: اختيار فيديو عادي/غرفة الأطفال، ظهور زر الغرفة فقط عند اتصال الفيديو، انتظار بث الطرف الآخر، وبقاء خروج ولي الأمر. هذا لا يثبت اختبار جهازين؛ يظل بوابة قبل الإصدار.

## تحديث اختبار تشغيل المكالمات — 18 نوفمبر 2026
- CI #604 اجتاز PostgreSQL و`NATIVE_CALL_UI_AUDIT` و`CALL_FEEDBACK_RUNTIME_AUDIT`، ثم فشل في `call-signaling-runtime-test.mjs` لأن اختبار VM كان يحدد نهاية `CallSignalingManager` بافتراض أن `startAlwahaCall` تأتي بعده مباشرةً.
- إضافة مساعدات اختيار/فتح غرفة الأطفال بين الصنف والدالة غيّرت ترتيب المصدر دون تغيير الصنف نفسه. تم تعديل الاختبار ليقتطع الصنف عند بداية `pendingKidsRoomAfterConnect`، أي بعد قوس إغلاقه الفعلي وقبل المساعدات الخارجية.

## تصحيح حد اختبار الصنف — 18 نوفمبر 2026
- CI #607 اجتاز SQL والصياغة وتدقيق الواجهة الأصلي ومؤثرات المكالمة، لكنه أظهر أن حدّ الاقتطاع في `call-signaling-runtime-test.mjs` ما زال يبحث عن سطرين قبل مساعدات Kids Room. موضع المصدر الفعلي يحتوي سطرًا واحدًا فقط؛ تم تصحيح الحد إلى البنية الفعلية.


## نتيجة CI الناجحة — Build #608
- **الفرع:** `alwaha-pro-recovery-20261118`
- **Commit المختبَر:** `7cfaa2816b8d9b633a02341fd9fbefcfdad9056c`
- **GitHub Actions:** [Run #608 — success](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44239478909)
- **SQL:** اختبار Marketplace migrations وسلوك retention على PostgreSQL مؤقت نجح.
- **Web/JS:** بناء الويب، JSON، Service Worker، JavaScript syntax، release preflight، performance/storage، chat/feed، compatibility، runtime/back navigation، الألعاب/QR، Kids Room/backup، native call UI، call feedback/signaling، moderation/report/block، support-ticket، account deletion/privacy، وTypeScript للـEdge Functions نجحت في التشغيل.
- **Android:** إنشاء/مزامنة مشروع Capacitor، plugin الصوت الأصلي، أذونات Android، هوية التطبيق، target API 36، Gradle signed APK/AAB، التحقق من توقيع APK وAAB، وSHA256SUMS نجحت.
- **Build metadata:** `version=3.0.4`, `version_code=608`, `application_id=pro.alwaha.app`, `target_sdk=36`, `branch=alwaha-pro-recovery-20261118`, `commit=7cfaa2816b8d9b633a02341fd9fbefcfdad9056c`.
- **APK signing certificate SHA-256:** `41d039324101241546173f196c0f781ec23b33003ca7d7be2eca5dc329a925fb` (تم استخراج البصمة واجتاز التوقيع؛ لم تتم بعد مقارنتها ببصمة APK الرسمي المثبت سابقاً).
- **Artifact:** `Alwaha-Pro-3.0.4-build-608`, ID `14398682529`, size `54,492,253 bytes`, expiry `2026-12-18T04:47:20Z`. [Download build artifact](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44239478909/artifacts/14398682529)
- **نشر الإنتاج:** وظيفتا نشر APK release والموقع تم تخطيهما عمداً على فرع الاسترداد؛ لا تغيير على `main` ولا كتابة إلى Supabase الإنتاجية.
- **ما لم يثبت بعد:** تثبيت النسخة على جهاز Android حقيقي، مقارنة شهادة التوقيع مع النسخة السابقة، اختبار الألعاب بين حسابين/هاتفين، اختبار مكالمة الفيديو وغرفة الأطفال بين هاتفين، واختبار فقد/عودة الإنترنت.
- **حالة الأولويات:** فتح بوابة الألعاب واختيار الفيديو/غرفة الأطفال: اجتازا CI على المصدر. الميزة المحلية Wi‑Fi/Bluetooth: لم تُنفذ بعد؛ يلزم Capacitor Android Plugin أصلي مشفر ونقل بيانات محلي واختبار فعلي، ولا يوجد زر عامل بعد.
- **الخطوة التالية:** ابدأ تنفيذ طبقة النقل المحلي الأصلية بعد مراجعة Android API والصلاحيات، مع الحفاظ على النقل الحالي عبر الإنترنت وتوفير موافقة/اقتران واضح. بالتوازي حدّد اختبار هاتفين للألعاب والفيديو قبل ترقية أي Artifact إلى إصدار عام.


## الشبكة المحلية — المرحلة 1: أساس الاكتشاف الأصلي (18 نوفمبر 2026)
- أضيف قالب Capacitor أصلي مستقل `scripts/android/AlwahaLocalNetworkPlugin.java` باسم `AlwahaLocalNetwork`.
- الأساس يتيح فحص القدرات والأذونات، واكتشاف أجهزة Wi‑Fi Direct عبر `WifiP2pManager` وأجهزة Bluetooth Classic عبر `BluetoothAdapter`، مع إيقاف الفحص تلقائيًا بعد 25 ثانية وأحداث للأجهزة القريبة.
- أضيفت أذونات Android 13+ لـNearby Wi‑Fi وBluetooth Scan/Connect/Advertise، وإعلانات Bluetooth القديمة محصورة إلى API 30، مع `neverForLocation` حيث لا نستنتج موقعاً فعلياً.
- قُيّدت النتائج لتبقى `verified=false` و`authenticationRequired=true`. يعيد المكوّن صراحةً `transportReady=false` و`chatReady=false` و`fileTransferReady=false` و`callMediaReady=false`. **هذا أساس اكتشاف فقط، وليس زر شبكة محلية عاملاً أو نقل رسائل/مكالمات/ملفات بعد.**
- أضيف التسجيل الأصلي في MainActivity، وجسر JavaScript، واختبار قبول ثابت، وربط الاختبار بسير عمل CI. فُحص نص توليد MainActivity أيضًا، وصُحّح تمثيل سطر Java الجديد قبل بناء Android.
- لا تُطلب أذونات الشبكة المحلية الجديدة `ACCESS_LOCAL_NETWORK` في هذا البناء لأن التطبيق يستهدف API 36؛ وثائق Android الحالية تجعلها مطلوبة عند استهداف API 37+، بينما Wi‑Fi Direct على API 33+ يتطلب `NEARBY_WIFI_DEVICES`.
- **الخطوة التالية:** اجتياز Android compile، ثم تنفيذ قناة نقل آمنة ومشفرة مع اقتران متبادل قصير العمر وبيانات نصية/ملفات أولاً. بعدها دمج signaling لمكالمات الفيديو عبر Wi‑Fi Direct، ثم إظهار زر داخل المحادثة بعد نجاح كل مسار قبول. Bluetooth يظل للاكتشاف والرسائل/الملفات الخفيفة؛ الفيديو يمر عبر Wi‑Fi Direct/شبكة Wi‑Fi لا عبر Bluetooth وحده.


## نتيجة CI الناجحة — Build #612 (18 نوفمبر 2026)
- **Commit المختبر:** `1f295e177e472e0305378ddb430a82eb46833c5a` على `alwaha-pro-recovery-20261118`.
- **GitHub Actions:** [Run #612 — success](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44241981263)
- **PostgreSQL:** اختبار ترحيلات السوق والاحتفاظ اجتاز على قاعدة مؤقتة.
- **الويب والواجهات:** بناء الويب، release/security/performance، المحادثات، الملاحة، runtime/back navigation، الألعاب الجماعية/QR، Kids Room/backup، native call/signaling، سلامة المستخدم/الإشراف، دعم التذاكر، خصوصية وحذف الحساب، type checks؛ كلها اجتازت ضمن التشغيل.
- **الشبكة المحلية الأصلية:** اجتاز `audit:local-network-native`، وتوليد قالب Java، وتسجيل `AlwahaLocalNetworkPlugin` بجانب `AlwahaAudioRoutePlugin`، وفحص أذونات Wi‑Fi/Bluetooth، ثم ترجمة Android. تم توقيع APK/AAB والتحقق منهما.
- **Build metadata:** `version=3.0.4`, `version_code=612`, `application_id=pro.alwaha.app`, `target_sdk=36`, `branch=alwaha-pro-recovery-20261118`, `commit=1f295e177e472e0305378ddb430a82eb46833c5a`.
- **APK signing certificate SHA-256:** `41d039324101241546173f196c0f781ec23b33003ca7d7be2eca5dc329a925fb`؛ متطابقة مع شهادة Build #608. لم تُقارن بعد مع شهادة النسخة المثبتة على هاتف المستخدم.
- **Artifact:** `Alwaha-Pro-3.0.4-build-612`, ID `14399862668`, size `54,509,761 bytes`, expiry `2026-12-18T05:09:47Z`. [Download build artifact](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44241981263/artifacts/14399862668)
- **النشر العام:** Release وGitHub Pages تخطّيا عمداً على فرع الاسترداد. لا تعديل على `main` ولا Supabase production.
- **حالة ميزة الشبكة:** المرحلة الأولى هي اكتشاف Wi‑Fi Direct/Bluetooth وفحص قدرات وأذونات الجهاز فقط. لم يتم بعد الاقتران المشفر أو نقل الرسائل/الملفات أو مكالمات الإنترنت المحلي، ولا يوجد زر محادثة مفعل يدّعي اكتمال الاتصال.
- **بوابات مادية لازمة:** تثبيت Build 612 على جهازين Android واختبار اكتشاف متبادل عبر Wi‑Fi Direct وBluetooth. بعدها pairing قبول/رفض، ثم نقل نص/ملف واختبار الانقطاع. لا يمكن اعتمادها من CI وحده.
- **الخطوة التالية:** تصميم وتنفيذ مصادقة واقتران قصيرة العمر ومشفرة بين جهازين، ثم قناة نقل محلية Wi‑Fi Direct (نصوص/ملفات أولاً) وربطها بمسار الدردشة فقط بعد قبول اختبارات البروتوكول.

## بلاغ 401 في خدمة المنشورات — 18 نوفمبر 2026
- المستخدم أكد عودة الإنترنت، لكن واجهة المنشورات تعرض HTTP 401. هذا رفض مصادقة/تفويض من Supabase وليس دليلًا على انقطاع الشبكة وحده.
- كان `supabaseFetch` ينتظر `getSession()` لمدة 1200ms فقط ثم يستخدم مفتاح anon إذا تأخرت قراءة الجلسة؛ كما لم تكن هناك محاولة تجديد جلسة عند 401.
- عُدّل الآن انتظار الجلسة إلى 5000ms، وإعادة المحاولة مرة واحدة فقط بعد `auth.refreshSession()` عند 401 إذا كانت هناك جلسة مستخدم. لا يستخدم service-role ولا يتجاوز RLS.
- يلزم CI على هذا التعديل ثم اختبار فعلي على جهاز المستخدم. إذا استمر 401 بعد التجديد، يجب فحص `__alwahaLastApiError.message/code` وإعدادات API key/مشروع Supabase المنشور؛ لا تُخفَ تفاصيل الرفض ولا تُعطَ صلاحيات أوسع كحل سريع.


## إصلاح سياسات قراءة المحتوى العام — 18 نوفمبر 2026
- **تشخيص مؤكد على Supabase:** مشروع `kjuixjdtqwcsnxefftrt` نشط؛ عنوان المشروع والمفتاح العام في الإعداد العام يطابقان المشروع والمفتاح النشط. جدول `posts` لديه RLS وامتيازات SELECT المناسبة لـ anon/authenticated.
- سجلات API أظهرت 401 في GET المنشورات والريلز تزامنًا مع Postgres `permission denied for function is_user_blocked`.
- إعادة إنتاج read-only بدور `anon` على `public.posts` أعادت رفض تنفيذ `app_private.is_user_blocked`; القراءة بدور `authenticated` نجحت. الدالة تبقى خاصة ولا ينبغي منح anon تنفيذها أو USAGE على `app_private`.
- لم يظهر POST للمنشورات في نافذة السجلات المسترجعة؛ لذلك لا نعتبر حفظ المنشور قد فشل في قاعدة البيانات بعد. يلزم اختبار GET ثم POST كلٌ على حدة بعد الإصلاح.
- **التعديل المرشح في الفرع فقط:** فصل سياسات anon إلى `USING (true)` دون استدعاء دالة الحظر، وسياسات authenticated تحتفظ بفحص `is_user_blocked` للمنشورات والريلز والتعليقات. لا تغيير على INSERT أو DELETE ولا تخفيف للحظر.
- تمت إضافة migration واختبار SQL وظيفي يختبر anon، ومستخدمًا محظورًا، ومستخدمًا غير محظور، إضافة إلى static audit وربطها بـCI.
- **لم يُنفذ أي SQL على الإنتاج، ولم تُنشأ منشورات تجريبية أو تُحذف بيانات.** بعد نجاح CI، يُطلب اعتماد منفصل لتطبيق migration على Supabase الإنتاجية، ثم اختبار GET/POST فعلي.

- **CI #615 (run 44366746620) تعثر في الاختبار فقط:** migration نفسها نجحت في التطبيق على PostgreSQL المؤقت، لكن كتلة `DO` المنفذة تحت `anon` حاولت حل اسم دالة داخل `app_private` أثناء فحص الصلاحية، فأعاد PostgreSQL `permission denied for schema app_private`. تم نقل تحقق عدم امتلاك anon لصلاحية الدالة إلى فحص إداري سابق قبل `SET ROLE anon`، وإزالة الاستدعاء الذي كان يجعل اختبار anon نفسه يخالف العزل المقصود. لا تغيير على SQL الإنتاج أو على سياسة الحظر.


## إغلاق إصلاح 401 للقراءة العامة — CI #616 والإنتاج (18 نوفمبر 2026)
- **Branch source commit:** `9469373c9a59532120112242a5d77e6d7742d5c7`.
- **CI #616:** [Run #616 — success](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44367092125). اجتاز SQL على PostgreSQL مؤقت، release preflight، audit سياسات القراءة، الأداء، المحادثات/feed، الألعاب الجماعية، Kids Room/backup، بقية تدقيقات المشروع، web build وAndroid signed APK/AAB. لم يُنشر Release أو الموقع لأن الفرع recovery.
- **الإنتاج — Migration:** طبّق Supabase ترحيل `split_anon_public_content_policies` بنجاح، وسجل migration version `20261118181652`.
- **اختبار القراءة الحية بعد الترحيل:** بدور anon وبـauthenticated نجحت SELECT على posts/reels/comments دون permission error. counts في وقت الاختبار: posts=0, reels=1, comments=0؛ لا يوجد منشور تجريبي أو تعديل بيانات.
- **الحفاظ على العزل:** `anon_can_execute_block_helper=false`, `anon_can_use_private_schema=false`, `authenticated_can_execute_block_helper=true`. السياسات الجديدة مفصولة حسب الدور؛ authenticated لا يزال يخضع لفحص الحظر.
- **Auth security advisor:** تنبيه `auth_leaked_password_protection` ما زال WARN؛ يجب تفعيل حماية كلمات المرور المسرّبة في إعدادات Supabase Auth بعد مراجعة أثرها على التسجيل الحالي. بقية ملاحظات RLS بدون سياسات على جداول server-only ظلت INFO (admin_action_logs/app_settings/content_reports/support_tickets/user_blocks/user_consents).
- **لم يُثبت POST بعد:** عينة سجلات 401 القديمة كانت GET feed ولم يظهر فيها POST /rest/v1/posts. امتياز authenticated INSERT موجود وسياسة posts_insert_own موجودة؛ يجب أن يجرّب المستخدم نشر منشور عادي بحسابه، ثم تُفحص استجابة POST الجديدة دون إنشاء بيانات اختبار في الإنتاج. إذا فشل، افحص status/code/body وrequest log بعد إخفاء أي بيانات حساسة.
- **Build #616 Artifact:** `Alwaha-Pro-3.0.4-build-616`, artifact ID `14458780614`, ZIP digest `fb43dcb86651e6eee4d5d5fd186f3414dcc46b9e46775c8dd5957d9e946c5449`, expires `2026-12-18T18:15:34Z`. APK SHA-256 `4204e749c618e58a8c96727457f36a7afe0c7fcafabaa141d3044aada3f61db2`; AAB SHA-256 `14e6f256a1fca4095f49cc6740f523edf358fa347c64078ba695b6d0561db6af`. APK checksums verified against manifest.
- **Build metadata:** version 3.0.4, version_code 616, app ID `pro.alwaha.app`, target SDK 36, same signing SHA-256 as Build #612: `41d039324101241546173f196c0f781ec23b33003ca7d7be2eca5dc329a925fb`.
- **Automation:** task `6afdea303a888191aff5c7b6ae74f748` titled `Alwaha daily recovery`, recurring daily with flexible morning target at 08:00 Africa/Cairo; next run `2026-11-19T08:00:00+02:00`. It reads latest HEAD/tracker, continues top unfinished task and records checkpoints. It cannot resume instantly while device/internet is offline; it resumes on the next scheduled run when integrations are available.
- **الخطوة التالية:** اختبار المستخدم على Build 616: تسجيل الدخول، تحميل الخلاصة، نشر نص قصير، ثم تأكيد ظهوره بعد التحديث. بعدها اختبار هاتفين للألعاب/المكالمات. لا تعتمد ألعاب multiplayer أو LAN حتى تحقق جهازين فعليين.


## مطابقة مكونات Build 616 والألعاب الجماعية المنشورة — 18 نوفمبر 2026
- فُحص ملف APK نفسه: يحتوي `assets/public/index.html` بحجم 555,757 بايت، و`assets/public/games.js` بحجم 59,755 بايت، و`assets/public/alwaha-kids-room.js` بحجم 16,638 بايت؛ وملف الصفحة يشير إلى تحميل `games.js` و`alwaha-kids-room.js` بنفس cache token الخاص بـ3.0.4.
- زر التنقل `games-nav` في مصدر الفرع زر فعّال من نوع button، دون `disabled`، ويستدعي `showSection('games-section', this)`.
- خدمة `game-actions` على Supabase ACTIVE، `verify_jwt=true`، النسخة المنشورة 1، ومحتوى `index.ts` مطابق حرفيًا لملف الفرع (12,164 بايت). لذلك Edge Function نفسها ليست غائبة أو قديمة.
- `join_game_room` تسمح بدعوة المستخدم المسجل؛ `apply_game_action_result` مقيّدة بـservice_role فقط وتُستدعى من الخادم، وهو التصميم الصحيح لمنع تعديل الحالة من العميل.
- جدول `game_rooms` لا يحتوي غرفًا في وقت الفحص. لا نضيف غرف/حسابات اختبار إلى الإنتاج. تجربة اللعب تتطلب مستخدمين مسجلين وجهازين أو جلستين متزامنتين، مع اتصال إنترنت؛ هذه ليست ألعابًا محلية أو أوفلاين حاليًا.
- لم تظهر في نافذة السجلات التالية لتطبيق migration (آخر 30 دقيقة) طلبات تطبيق جديدة أو أخطاء 401 posts/reels؛ لا توجد محاولة POST أو game action حديثة في السجل المعروض.
- **الاستنتاج:** Build 616 يحتوي واجهة الألعاب وKids Room؛ CI/الملفات وEdge function المنشورة متطابقة. يلزم تثبيت Build 616 بدل النسخة السابقة ثم تجربة فتح صفحة الألعاب. لبدء مباراة استخدم حسابًا أولًا لإنشاء غرفة، والحساب الثاني للانضمام بالكود أو QR. يلزم اختبار فيديو فعلي بجهازين للتحقق من اختيار العادية/الأطفال، stream الطرف الآخر والخروج الأبوي. لا نعلن اللعبة/الفيديو مكتملة ميدانيًا قبل ذلك.


## دفعة تقوية اختبارات الألعاب الجماعية — 18 نوفمبر 2026
- راجعت تغطية `audit:games` بعد CI #616: كانت تغطي تكامل الواجهة وQR واختبارات SQL بصياغة ثابتة، لكن منطق قواعد الشطرنج/ليدو/حرب الورق داخل Edge Function لم يكن يملك اختبارات تشغيل مباشرة.
- فصلت قواعد الألعاب النقية إلى `supabase/functions/_shared/game-rules.ts` لتستخدمها Edge Function نفسها واختبار Deno مباشر؛ لا تغيير في واجهات API أو جدول الغرف أو سياسات RLS أو Supabase الإنتاجية.
- أضيفت اختبارات تشغيل للرمز، والحالات الأولية للألعاب الثلاث، والنقلات القانونية/غير القانونية والكش مات، وحركات ليدو والتمرير والفوز، وحرب الورق وتعادل الحرب وحفظ 52 ورقة، ورفض لاعب غير مشارك/حالة تالفة.
- أضيف تشغيل هذه الاختبارات إلى CI وتحديث تدقيق المصدر ليتحقق من وجودها. **حالة الدفعة عند كتابة هذا السجل: أضيف المصدر والاختبارات؛ نتيجة CI على commit هذه الدفعة لم تُحسم بعد ولا تُعد ناجحة قبل ظهور conclusion=success.**
- بوابة الجهازين لم تُغلق: لا يوجد اختبار حقيقي بحسابين وهاتفين في هذه البيئة. لا يُعتبر اجتياز Deno/CI بديلاً عن ذلك.
- الخطوة التالية: متابعة CI على commit الدفعة، فتح سجل أي وظيفة فاشلة وإصلاح السبب المحدد، ثم طلب تجربة الغرف/QR/الاستعادة على جهازين مستقلين.


## إصلاح تعثر CI #617 — 18 نوفمبر 2026
- **Run #617** على commit `186f4762f9e16ca520e904457c0f3b6a838591bc` فشل قبل تنفيذ تدقيق الألعاب بسبب خطأ صياغة في آخر `scripts/game-actions-audit.mjs`: قوس الإغلاق بعد `checks` سقط عند إضافة assertion الجديدة.
- فُتح سجل الوظيفة `Build and verify signed Android APK/AAB` (job ID `135035227942`) وتأكد أن الفشل SyntaxError في السطر 62 فقط؛ فحص PostgreSQL المؤقت نجح، ولم يبدأ نشر أو إنتاج.
- تم تصحيح القوس فقط دون تغيير منطق اللعبة أو SQL. سيُعاد التحقق على commit جديد؛ لا يُحتسب #617 نجاحًا.


## نتيجة CI الناجحة — Build #618 واختبارات قواعد الألعاب (18 نوفمبر 2026)
- **Commit المختبَر:** `0c115b6bbdac10a1fcdf20184c7f07ded6f7c175` على الفرع `alwaha-pro-recovery-20261118`.
- **GitHub Actions:** [Run #618 — success](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44370563721). نجحت وظيفتا PostgreSQL المؤقت وبناء Android؛ وظيفتا نشر APK Release وGitHub Pages كانتا `skipped` عمداً.
- **اختبارات الألعاب:** `deno check` لدالة `game-actions` نجح، واختبارات Deno الثمانية لقواعد الشطرنج/ليدو/حرب الورق نجحت، ثم `audit:games` وQR runtime audit نجحا. اختبارات الشطرنج شملت الحركة القانونية وغير القانونية والكش مات، وليدو الدخول/التمرير/الفوز، وحرب الورق وحالة الحرب مع حفظ 52 ورقة. اختبار SQL للغرف والامتيازات على PostgreSQL مؤقت نجح.
- **بقية البوابات المطلوبة:** release preflight، performance/storage، chat/feed، Android compatibility، runtime/back navigation، local-network discovery، native-call UI/signaling، adaptive video، fullscreen UI، reconciliation، retention/kids/vault، support tickets، user-safety/moderation، account deletion/privacy، admin security، وweb build كلها `success` في التشغيل نفسه.
- **بيانات البناء:** version `3.0.4`، version_code `618`، application_id `pro.alwaha.app`، target SDK `36`، والفرع/commit كما أعلاه.
- **Artifact:** `Alwaha-Pro-3.0.4-build-618`، ID `14459181253`، الحجم `54,520,763 bytes`، انتهاء الصلاحية `2026-12-18T18:34:09Z`. [تحميل Artifact Build 618](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44370563721/artifacts/14459181253). بصمة ZIP: `bf5dc4cc25f535cad9179b6996d086408b459c5a3ef6484bba066cf988252312`.
- **بصمات الملفات داخل الحزمة:** APK SHA-256 `b13b48a25c694858339b37563ee69ed8f717f962858abc47a181a0bbb054dba3`؛ AAB SHA-256 `a2da4649f115c78f97b0f4ddab75850e2339d3afebe99ca0a8a00e86e2e6e7b9`؛ Final Source ZIP SHA-256 `cf56a4d9cadbc30f5f70609dad4cfd90bccb7a58662d9e3c1601664253d7392f`. تم تشغيل `sha256sum --check` على الملفات الخمسة في الحزمة وكانت كلها `OK`.
- **التوقيع:** CI تحقق من توقيع APK وAAB؛ كما اجتاز AAB تحقق `jarsigner` المستقل. بصمة شهادة SHA-256 `41d039324101241546173f196c0f781ec23b33003ca7d7be2eca5dc329a925fb`، مطابقة لبصمة Builds #608/#612/#616. لم تُقارن بعد ببصمة النسخة المثبتة سابقاً على هاتف المالك.
- **Supabase/النشر:** لا SQL أو migration أو Edge Function deploy على الإنتاج ضمن هذه الدفعة؛ لا تغيير على `main`، ولم يُنشر APK أو الموقع رسمياً.
- **حالة P1 للألعاب:** اختبارات المصدر وقواعد الخادم وCI اجتازت. **لم يُغلق اختبار الجهازين**: لا بد من تثبيت Build 618 على هاتفين بحسابين منفصلين، إنشاء غرفة من الأول، الانضمام من الثاني بالكود ثم QR، تنفيذ حركات فعلية في الألعاب الثلاث، إغلاق الغرفة واستعادتها من الجهازين. لا نعلن اكتمالاً ميدانياً قبل هذه التجربة.
- **تعثر CI السابق:** #617 فشل بسبب قوس مفقود في حلقة `checks` في `game-actions-audit.mjs`؛ أُصلح في commit `0c115b6`، ثم اجتاز #618 جميع البوابات.
- **الخطوة التالية:** اختبار Build 618 على جهازين وحسابين وإرسال نتيجة فتح صفحة الألعاب/إنشاء الغرفة/QR/اللعب/الاستعادة. بعد توثيق بوابة الألعاب، ننتقل إلى اختبار مكالمة الفيديو العادية وغرفة الأطفال بين جهازين؛ لا يُعد CI اختبار هاتف.


## فتح مكالمات السوق — 18 نوفمبر 2026
- **التحقق قبل التعديل:** مسار مكالمات السوق كان موجودًا مسبقًا داخل `startAlwahaCall('market',...)` و`CallSignalingManager`، ويستخدم قنوات Realtime خاصة `market-call-inbox-*` و`market-call-room-*` ورسالة `webrtc-market-incoming`.
- **Supabase الإنتاج:** سياسات `realtime.messages` الفعلية تشمل `alwaha_market_call_channels_receive` و`alwaha_market_call_channels_send` لدور authenticated. القنوات تسمح فقط للمشتري/البائع المشاركين في محادثة السوق، وSELECT/INSERT privileges على Realtime متاحة.
- **سبب الإغلاق:** `callMarketSeller()` كانت تنتهي برسالة «قريبًا» بدل استخدام المسار المنفذ. تم ربطها الآن بالبحث عن محادثة غير مؤرشفة لنفس الإعلان وزوج المشتري/البائع، إعادة التحقق من حساب المستخدم بعد الطلب، ثم استدعاء `startAlwahaCall('market','audio',conversationId,peerId,title)`.
- **الأمان:** لا تُطلب صداقة لمكالمة السوق، لكن لا يسمح بالاتصال إلا بوجود محادثة حقيقية بين الطرفين؛ لا تغيير إلى RLS أو Realtime grants ولا فتح لقناة عامة.
- تمت إضافة اختبارات قبول لمسار الاتصال الصادر والوارد وفحص الطرفين وإزالة رسالة الإغلاق. يلزم CI ثم مكالمة جهازين فعلية قبل ادعاء اجتياز الاختبار الميداني.


- **CI #619 failure analysis:** migration/source code was intact; `scripts/chat-release-audit.mjs` still contained an assertion requiring the market-call button to remain disabled and display the old “coming soon” label. Replaced that obsolete assertion with checks for the authenticated conversation-scoped market call path and private Realtime policies. No production SQL or permissions were changed in response to this CI failure.


## تفعيل زر اتصال البائع في صفحة الإعلان — 18 نوفمبر 2026
- أزيلت خصائص disabled/aria-disabled ورسالة «قريبًا» من زر الاتصال في بطاقة تفاصيل الإعلان.
- الزر أصبح يستدعي `callMarketSeller(productId,title,sellerId)`، التي تتحقق من تسجيل الدخول، ومن وجود محادثة سوق نشطة مرتبطة بالإعلان والطرفين قبل بدء مكالمة السوق الصوتية عبر القنوات الخاصة.
- الاتصال لا يشترط صداقة، ولا يتيح الاتصال بحساب ذاتي أو محادثة مؤرشفة أو طرف خارج المحادثة.
- الاختبار الميداني بين حساب البائع والمشتري على هاتفين مطلوب قبل إعلان نجاح المكالمة عمليًا.


## فتح زر الأجهزة القريبة داخل المحادثة — مرحلة الاكتشاف فقط (18 نوفمبر 2026)
- أضيف زر Wi-Fi بجوار مكالمة الصوت والفيديو في شريط المحادثة.
- يفتح نافذة Android الأصلية عبر `window.alwahaLocalNetwork`، وتطلب `startDiscovery()` أذونات Nearby Wi-Fi/Bluetooth، ثم يستمع التطبيق إلى أحداث `peerDiscovered` و`peersDiscovered` و`discoveryState`. عند إغلاق النافذة يوقف المسح ويزيل جميع listeners.
- تعرض الأجهزة المكتشفة بوصفها «غير موثّقة» مع وسيلة الاكتشاف. لا يوجد زر اتصال/إرسال/ملف وهمي.
- تظل `transportReady/chatReady/fileTransferReady/callMediaReady=false`؛ الاقتران المتبادل والتشفير ونقل الرسائل/الملفات/الصوت المحلي ما زالت أعمالًا لاحقة تتطلب تنفيذًا واختبار جهازين.

- **CI #622 (44379043135) failed in one chat-audit wording assertion only:** the assertion expected “إرسال رسائل” but the actual UI warning says “تبادل رسائل”. All other checks in the chat audit passed, including the new discovery control. Updated the test to match the exact safe UI text. No runtime behavior or permissions changed.


## تصحيح صفحة الشروط وحالة الميزات — 18 نوفمبر 2026
- أظهر CI #623 وجود فحص سلامة قديم وعبارة قديمة في `official-site/terms.html` تزعم أن الألعاب مغلقة وأن Kids Room/مكالمات السوق غير متاحة.
- تم تعديل صفحة الشروط: الألعاب الجماعية الشطرنج/ليدو/حرب الورق متاحة بعد تسجيل الدخول والاتصال بالإنترنت وبغرف متعددة اللاعبين؛ غرفة الأطفال لا تعمل إلا أثناء فيديو متصل ووصول بث الطرف الآخر مع خروج ولي الأمر؛ مكالمة السوق الصوتية تتطلب محادثة سوق نشطة بين البائع والمشتري وتعمل عبر الإنترنت دون اشتراط الصداقة.
- تم توضيح أن زر Wi-Fi/Bluetooth الحالي يكتشف الأجهزة فقط، ولا يوفر بعد اقترانًا موثوقًا أو رسائل/ملفات/مكالمات محلية.
- استبدلنا فحص «الميزة غير متاحة» بفحص إيجابي لحالة الواجهة وبقاء القيود الأمنية ووضوح حدود الشبكة المحلية.


## متابعة الاسترداد والتحقق — 19 نوفمبر 2026

### نقطة البداية والتحقق من CI #622
- عند بدء هذه الدفعة تمت قراءة HEAD الفعلي للفرع `alwaha-pro-recovery-20261118`: `429ae40ee3ae454dd5f1702c5332d2b8b1f91ff1`، وقراءة هذا السجل من نفس الفرع (blob SHA: `9eb0f0792843edce3486f0da37be93f59ef99069`). لم يُستخدم SHA السابق كافتراض.
- **CI #622 — [Run 622](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44379043135): failure**، وليس cancelled. وظيفة PostgreSQL المؤقتة نجحت. وظيفة Android توقفت في الخطوة `Run chat and feed regression audit` عند assertion واحد: `discovery-only mode does not claim local messaging, files or calls are ready`. كان الاختبار ينتظر نص «إرسال رسائل» بينما الواجهة الآمنة تقول «تبادل رسائل». بقية فحوص هذه الخطوة نجحت، وما بعدها تخطّى بسبب فشل الخطوة. لا يدل السجل على فشل نقل بيانات أو تغيير صلاحيات أو كتابة إنتاجية.

### آخر بناء ناجح قبل إصلاحات الاكتشاف — Build #649
- **Commit:** `429ae40ee3ae454dd5f1702c5332d2b8b1f91ff1` — **[Run #649 success](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44416907637)**.
- نجحت وظيفة PostgreSQL المؤقت ووظيفة بناء/توقيع Android. وظيفتا نشر APK العام وGitHub Pages كانتا `skipped` عمدًا على فرع الاسترداد.
- Artifact: `Alwaha-Pro-3.0.4-build-649`, ID `14479169722`, الحجم `54,543,626 bytes`, SHA-256 للحزمة `eba50e3a0c443ed9274b34c8aeca4582f95bbf3624d59c69776f2d0d0840fff7`, انتهاء الصلاحية `2026-12-18T23:03:44Z`. [Artifact Build 649](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44416907637/artifacts/14479169722).
- بيانات البناء: version `3.0.4`, version_code `649`, application_id `pro.alwaha.app`, target SDK `36`. بصمة شهادة التوقيع SHA-256: `41d039324101241546173f196c0f781ec23b33003ca7d7be2eca5dc329a925fb`.
- هذا artifact أقدم من إصلاح رسائل حالة الاكتشاف وتقليل إذن Bluetooth؛ لا يُستخدم للتحقق من هذين التعديلين.

### إصلاحات محلية على فرع الاسترداد
- **اكتشاف الأجهزة:** Android plugin كان يرسل `discoveryState` بحقلَي `state` و`detail`، بينما واجهة المحادثة كانت تقرأ `status` و`message`. تم إصلاح المستهلك ليطابق عقد الحدث الفعلي، مع رسائل واضحة لحالات Wi-Fi Direct وBluetooth والإيقاف والمهلة. لا يتغير سلوك النقل ولا تُعرض حالة اقتران.
- **أقل صلاحيات Bluetooth:** أزيل `BLUETOOTH_ADVERTISE` لأنه غير مطلوب لمسح الأجهزة. بقي `BLUETOOTH_SCAN` و`BLUETOOTH_CONNECT` فقط لمرحلة الاكتشاف وقراءة اسم/عنوان الجهاز؛ لا يوجد إعلان BLE أو نقل Bluetooth.
- التسلسل الذي أنتج HEAD الحالي: `d36f9fd1695fe531761a2fb9e4bb2f20df283c5e` (إصلاح حالة الاكتشاف)، `27290b4437168c1496fd1448cd17eff8d2547649` (إزالة إذن الإعلان من plugin)، `26cd726a04f2df89551a62779790c5af296993de` (إزالة الإذن من Manifest build)، `8519e9249df1c97e3a3fcaee9c18a9cafbcd1526` (تحديث تدقيق أقل صلاحية Bluetooth).

### نتيجة البناء الحالي — Build #655
- **الفرع/HEAD المختبَر:** `alwaha-pro-recovery-20261118` / `8519e9249df1c97e3a3fcaee9c18a9cafbcd1526`.
- **GitHub Actions:** [Run #655 — success](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44476635882). نجحت وظيفة PostgreSQL المؤقتة ووظيفة Android؛ وظيفتا نشر APK العام والموقع كانتا `skipped`.
- Artifact: `Alwaha-Pro-3.0.4-build-655`, ID `14507121216`, الحجم `54,544,862 bytes`, digest `37f3b28f228a02e75b4a324d807075522214f1bbcf6c27d1b49bdd924b266589`, انتهاء الصلاحية `2026-12-19T07:07:57Z`. [Artifact Build 655](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44476635882/artifacts/14507121216).
- بيانات البناء: version `3.0.4`, version_code `655`, application_id `pro.alwaha.app`, target SDK `36`, وبصمة شهادة التوقيع SHA-256 نفسها `41d039324101241546173f196c0f781ec23b33003ca7d7be2eca5dc329a925fb`. تم بناء APK/AAB موقّعين والتحقق منهما؛ لم تُنشر نسخة عامة.
- أدلة CI من التشغيل: `PROFILE_UI_ACCEPTANCE=PASS (42/42)`, `MARKETPLACE_BUY_SELL_ACCEPTANCE=PASS (55 checks)`, `SERVER_AUTHORITATIVE_GAMES_AUDIT=PASS`, `RETENTION_KIDS_VAULT_AUDIT=PASS (44 checks)`, `USER_SAFETY_UI_AUDIT=PASS (24 checks)`, `ACCOUNT_DELETION_AUDIT=PASS (12 checks)`, `ADMIN_APP_AUDIT=PASS (25 checks)`, `CALL_SIGNALING_RUNTIME_AUDIT=PASS`, `NATIVE_CALL_UI_AUDIT=PASS`, وتدقيق الاكتشاف المحلي أكد أن النقل ما زال معلّمًا بوضوح بأنه غير جاهز.
- **لا تعني هذه الاختبارات إغلاق الاختبار الميداني:** لا يوجد في CI حسابان مسجلان على هاتفين فعليين؛ لا نعلن نجاح اللعب المتزامن أو بث الفيديو أو النقل المحلي قبل التجربة على الجهازين.

### مراجعة Supabase الإنتاجية — قراءة فقط
- المشروع `kjuixjdtqwcsnxefftrt` حالته `ACTIVE_HEALTHY`، وآخر migration مقروء `20261118181652`.
- Security Advisor: تحذير واحد `auth_leaked_password_protection` لأن حماية كلمات المرور المسرّبة معطلة، وست ملاحظات INFO لجداول RLS server-only التي لا تملك سياسات مباشرة. استعلام grants للـ `anon` و`authenticated` و`PUBLIC` على الجداول الستة أعاد `[]`؛ لا امتيازات جدول مباشرة لهذه الأدوار. لم تُغيّر إعدادات Auth أو RLS.
- Performance Advisor أظهر 25 مؤشرًا غير مستخدم في القياسات الحالية؛ لم يُحذف أي مؤشر لأن قلة الاستخدام الآن لا تكفي لإثبات أنه غير مطلوب.
- لم تُطبّق migrations أو تُنشر Edge Functions أو تُكتب بيانات أو تُحذف بيانات إنتاجية في هذه الدفعة.

### ما لم يُغلق بعد — بوابات صريحة
1. **الألعاب:** اختبارات Deno وقواعد الشطرنج/ليدو/حرب الورق وCI ناجحة؛ يلزم هاتفان وحسابان مستقلان: إنشاء غرفة، الانضمام بالكود ثم QR، نقلات/أدوار متزامنة، إعادة الاتصال، واستعادة الغرفة.
2. **الفيديو وغرفة الأطفال:** اختبارات المصدر تؤكد انتظار بث الطرف الآخر وخروج ولي الأمر وإنهاء الغرفة عند إنهاء المكالمة؛ يلزم مكالمة واردة وصادرة على هاتفين، تحقق remote stream فعلي، دخول/خروج Kids Room، وإعادة اختبار الكاميرا والميكروفون والصوت.
3. **الشبكة المحلية:** ما زال الموجود اكتشاف Wi-Fi Direct وBluetooth فقط. لا يوجد `WifiP2pManager.connect` أو TCP socket أو مصافحة مفاتيح أو تشفير جلسة أو إرسال رسالة/ملف. تظل `transportReady/chatReady/fileTransferReady/callMediaReady=false`. Bluetooth يظل discovery-only ولا يستخدم للإقران أو النقل أو المكالمات.
4. **الخطوة الهندسية التالية للشبكة المحلية:** تنفيذ Wi-Fi Direct فقط مع إعلان خدمة Alwaha، موافقة الطرفين، رمز مقارنة قصير مشتق من مصافحة ECDH مؤقتة، اشتقاق مفاتيح HKDF-SHA256، تشفير AES-GCM بمفاتيح اتجاهية وأرقام تسلسلية تمنع replay، ثم نقل رسائل وملفات مقسمة إلى chunks مع SHA-256 وفحص سلامة الملف. لا تخزين مفاتيح طويلة الأمد في الإصدار الأول، ولا تحويل تلقائي إلى الإنترنت، ولا ادعاء الجاهزية قبل اختبارات وحدات وأجهزة فعلية. التفاصيل في `docs/LOCAL-NETWORK-PAIRING-SECURITY-DESIGN-20261119-AR.md`.
5. **بقية الإغلاق الميداني:** اختبار الإشعارات (قراءة إشعار واحد فقط، والكل يدوي)، طلبات الصداقة، الملف الشخصي، السوق بين بائع/مشتري، ضمان/استلام/موافقتَي الأرشفة، البلاغ والحظر وفك الحظر، الدعم والإدارة، النسخ الاحتياطي والاستعادة، والأداء مع البيانات المحدودة. استخدم حسابات اختبار معتمدة أو بيئة staging؛ لا تنشئ سجلات وهمية في الإنتاج.
6. **Auth:** تحذير حماية كلمات المرور المسرّبة يحتاج قرارًا واعتمادًا منفصلًا قبل تغيير إعداد Supabase Auth.

### الإجراء التالي
- ثبّت Artifact Build 655 على هاتفين اختبار فقط بعد مطابقة بصمة شهادة التوقيع مع النسخة المرجعية، ثم سجّل نتائج الألعاب والفيديو وKids Room والسوق والإشعارات.
- ابدأ تنفيذ النقل المحلي على مراحل في هذا الفرع فقط، مع اختبارات تشفير/رفض/إعادة إرسال/قطع اتصال/ملف تالف قبل اختبار هاتفين. أبقِ جميع readiness flags false حتى إغلاق كل البوابات.
- لا merge إلى `main`، ولا نشر APK أو الموقع، ولا deploy Edge Functions، ولا تعديل Auth/RLS، ولا حذف/تغيير بيانات إنتاج دون موافقة حديثة مستقلة للعملية.


## توثيق اكتمال دفعة السجل — CI #656 (19 نوفمبر 2026)
- تم إنشاء commit توثيقي `c6ae4d1cfad3a604710916f5223fec363975a306` فوق مصدر التطبيق المختبَر في #655؛ أضاف تحديث سجل التغطية وتصميم النقل المحلي فقط، ولم يغيّر كود التطبيق.
- **CI #656:** [Run #656 — success](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44477707242). نجحت PostgreSQL المؤقتة وبناء/توقيع Android؛ نشر APK العام وGitHub Pages كانا `skipped`.
- Artifact الأحدث: `Alwaha-Pro-3.0.4-build-656`, ID `14506363666`, الحجم `54,553,315 bytes`, SHA-256 digest `7aaceeda30de8776990257571ffff5ac83fe0664961c5522d4048022c2db45eb`, انتهاء الصلاحية `2026-12-19T07:14:10Z`. [Artifact Build 656](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44477707242/artifacts/14506363666).
- بيانات البناء: version `3.0.4`, version_code `656`, application_id `pro.alwaha.app`, target SDK `36`, certificate SHA-256 `41d039324101241546173f196c0f781ec23b33003ca7d7be2eca5dc329a925fb`. الكود التنفيذي داخل artifact مطابق لكود Build 655؛ الاختلاف توثيقي فقط.
- عند إنشاء هذا التحديث كان HEAD هو `c6ae4d1cfad3a604710916f5223fec363975a306`. سيضيف هذا التحديث التوثيقي commit جديدًا فقط؛ لا توجد تغييرات تنفيذية جديدة بعد Build 655.


## دفعة اختبار دورة حياة واجهة الألعاب — 19 نوفمبر 2026

### نقطة البداية ومراجعة التشغيل السابق
- بدأ هذا التشغيل بقراءة HEAD الفعلي للفرع `alwaha-pro-recovery-20261118`: `e912aed93ec88a6859e267cdc2e09e559fdae1fb`، ثم قراءة هذا السجل من الفرع نفسه (blob SHA: `ef360ab4921504da4e71a2f2fd20ee6758198fce`).
- **CI #713** على commit `915597c003ee1ddf5bce61fcd87322d04d43c22d` فشل في تدقيق الشبكة المحلية فقط: لم يكن workflow يتحقق من وجود قالب `AlwahaLocalSessionCrypto.java`. أضيف فحص وجود الملف في commit `e912aed`، ثم **CI #714 نجح** على `e912aed`.
- **CI #714:** [Run 714 — success](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44589368281). نجحت PostgreSQL المؤقتة وبناء/توقيع Android. نشر APK العام وGitHub Pages كانا `skipped`. Artifact السابق: [Build 714](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44589368281/artifacts/14562193380)، ID `14562193380`، حجمه `54,603,261 bytes`، digest `abf374fc5a5f53bf7c8199e2a7f740f7ed07a38982b4a8747d36eca6e6b77b3d`.

### دفعة P1 للألعاب: اختبار تشغيل وظائف إنشاء/انضمام/استعادة الغرفة
- أضيف `scripts/game-ui-runtime-test.mjs`، وهو اختبار Node VM لوظائف دورة الغرفة المستخرجة من `games.js` مع استجابات خادم اختبارية؛ لا يغيّر كود اللعبة أو قاعدة البيانات.
- يغطي إنشاء غرف الشطرنج وليدو وحرب الورق والتحقق من أن الخادم أعاد اللعبة والمالك الصحيحين، والانضمام اليدوي بكود منقح إلى الحروف الكبيرة عبر `rpc/join_game_room` مع تثبيت نوع اللعبة، وقراءة/رفض QR حسب إصدار البروتوكول وصيغة الكود، واستعادة الغرفة بإعادة جلبها من الخادم والتحقق من عضوية الحساب، ورفض غرفة تخص حسابًا آخر أو غرفة لم تعد موجودة، وتحرير مسار الإجراء بعد النجاح/الفشل.
- تم ربط الاختبار بـ `npm run audit:games`، وأضيف تحقق إلى `game-actions-audit.mjs` لمنع فصل الاختبار عن بوابة الألعاب.
- **Commit المصدر:** `c4c56efc075e011051cf793fda1448c2c8f2d635` — `Add multiplayer game UI lifecycle runtime acceptance tests`.

### نتيجة CI #715
- **الفرع/Commit المختبر:** `alwaha-pro-recovery-20261118` / `c4c56efc075e011051cf793fda1448c2c8f2d635`.
- **GitHub Actions:** [Run 715 — success](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44590765583). نجحت وظيفة PostgreSQL المؤقتة ووظيفة بناء/توقيع Android. وظيفتا نشر APK العام وGitHub Pages كانتا `skipped`.
- أدلة التشغيل: `GAME_UI_RUNTIME_PASS` نجح مع **43 assertion**؛ `SERVER_AUTHORITATIVE_GAMES_AUDIT=PASS)، و`QR_RUNTIME_PASS`، و`LOCAL_SESSION_CRYPTO=PASS (23 assertions)`، و`PROFILE_UI_ACCEPTANCE=PASS (42/42)`.
- نجحت خطوات CI المسماة: release preflight، public-content/RLS audit، performance/storage، chat/feed، Android compatibility، runtime resilience، local-network native audit، native-call UI/signaling، adaptive-video quality، field repair، themes، navigation dock، home acceptance، smart assistant، UI handlers، fullscreen/modal isolation، marketplace permissions and buy/sell، reconciliation، user-safety API typing، game Edge Function typing/runtime rules/audit، retention/kids-room/backup، support tickets/admin queue، moderation/report/block، account deletion/privacy، وadmin security.
- **Build 715:** version `3.0.4`، version code `715`، application ID `pro.alwaha.app`، target SDK `36`. تم بناء APK وAAB والتحقق من توقيعهما؛ تحقق APK v2 نجح، والتحقق من توقيع AAB عبر `jarsigner` نجح، كما اجتاز `sha256sum --check` ملفات الحزمة.
- **بصمة شهادة توقيع APK SHA-256:** `41d039324101241546173f196c0f781ec23b33003ca7d7be2eca5dc329a925fb`.
- Artifact: `Alwaha-Pro-3.0.4-build-715`، ID `14563057223`، الحجم `54,605,989 bytes`، digest `db84ca71347016582d6f732ad1fc0c5af389a9e634c1151f4544f3366074f3b4`، وينتهي في `2026-12-19T18:46:03Z`. [Artifact Build 715 APK/AAB/Source](https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions/runs/44590765583/artifacts/14563057223).
- محرر الملف الشخصي لم يُعَد بناؤه؛ تأكد من وجود تحميله محليًا وإدخاله في build/cache، واجتاز اختبار القبول الموجود `42/42`.

### حدود ما أثبته هذا التشغيل
- اختبار 43 assertion يختبر وظائف دورة الغرفة واستجابات الخادم الوهمية داخل VM، وليس ضغط المستخدم على واجهة هاتف حقيقي. واختبار QR يثبت توليد/فك payload محليًا؛ لا يثبت نجاح كاميرا هاتف فعلي.
- **اختبار الألعاب بين حسابين وهاتفين ما زال مطلوبًا**: إنشاء الغرفة من الهاتف الأول، الانضمام بالكود ثم QR من الثاني، اللعب المتزامن في الألعاب الثلاث، قطع الاتصال وإعادته، ثم استعادة الغرفة على الجهازين.
- مكالمة الفيديو العادية وغرفة الأطفال لم تُختبرا على هاتفين حقيقيين بعد؛ يلزم اتصال وارد وصادر والتحقق من remote video track قبل الدخول، ثم دخول/خروج ولي الأمر.
- الشبكة المحلية ما زالت اكتشاف Wi‑Fi Direct/Bluetooth مع أساس تشفير جلسة فقط؛ لا يوجد اتصال Wi‑Fi P2P أو socket أو نقل رسائل/ملفات/مكالمات. تبقى جميع readiness flags false ولا تعرض الواجهة نقلًا محليًا عاملًا.
- لم تُكتب بيانات أو SQL أو migrations في Supabase الإنتاجية، ولم تُنشر Edge Functions، ولم يتغير Auth/RLS، ولم يُعدّل `main`، ولم يُنشر APK أو الموقع رسميًا.

### الخطوة التالية
1. بوابة P1 التالية هي تثبيت Artifact Build 715 على هاتفين بحسابين منفصلين وإتمام اختبار الألعاب الميداني أعلاه؛ لا يثبت CI ذلك.
2. بعد توثيق الألعاب، نفّذ اختبار الفيديو العادي وغرفة الأطفال على الجهازين والتحقق من وصول بث الطرف الآخر.
3. لا تبدأ نقل الرسائل/الملفات عبر Wi‑Fi/Bluetooth ولا ترفع readiness flags قبل إغلاق بوابتي الألعاب والفيديو والاختبارات الأمنية/الميدانية المطلوبة.
