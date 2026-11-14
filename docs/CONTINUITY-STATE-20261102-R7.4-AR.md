> **مذكرة تاريخية مؤرشفة:** لا تستخدم أوامر/سكربتات هذه المرحلة. الحالة الجارية والرفع المعتمدان موجودان في `docs/CONTINUITY-STATE-20261103-R7.5-AR.md` والسكريبت `TERMUX-PUSH-3.0.2-R7.5-20261103.sh`.

# نقطة متابعة Alwaha-Pro 3.0.2 — R7.4

**قاعدة العمل:** فرع R7.3 عند `553e1c431a0cfb92112516533b746ba0a2976f4f`، دون الرجوع إلى 2.8.9 أو إعادة بناء التطبيق من الصفر. النسخ 2.8.5–2.8.8 تبقى مراجع مقارنة فقط.

## هوية ثابتة
- `appId=pro.alwaha.app`
- `appName=Alwaha-Pro`
- `webDir=dist`
- احتفظ بـ`icon.png` كما هو.
- لا تعِد زر الشبكة المحلية. لا تفعّل Bluetooth كوظيفة غير منفذة.

## تغييرات R7.4
- `alwaha-modal-shell.js`: عزل طبقات الحوار/الصفحات، inert للخلفية، حصر التركيز وEscape.
- `index.html`: زر مستقل لمحادثات السوق، صفحة inbox كاملة، محادثة سوق كاملة، عزل بقية المودالات، وتحسين الملف العام.
- `alwaha-experience.js`: صور ثيمات محلية، دوائر تنقل شفافة، ضغط مطول 380ms لإعادة الترتيب، حفظ الموضع والإخفاء والتكديس، وإخفاء أثناء الصفحات المفتوحة مع handle.
- `sw.js`: cache token R7.4 وprecache لـ`alwaha-modal-shell.js`.
- إصلاح تكرار ID الفيديو الديناميكي بتحويله إلى `data-camera-live-video` ومحدد scoped داخل `#camera-view-box`.
- مزامنة إصلاحات CI السابقة: seller fixture، snapshot fixture، products insert policy في CI bootstrap، والاستثناء المقيد لتسجيل retention notice بواسطة العامل الموثوق.

## نتائج فحوص المصدر التي أعيدت
- 12 npm audits: PASS (`release`, `performance`, `field-repair`, `chat`, `compatibility`, `native-call-ui`, `ui`, `fullscreen-ui`, `retention-kids-vault`, `admin`, `marketplace-columns`, `reconciliation`).
- `node --check` لكل ملفات JS/MJS: PASS.
- JSON files: PASS.
- `bash -n` لكل سكربتات shell: PASS.
- معرفات HTML الفعلية الثابتة: 184 دون تكرار. المعاينة الديناميكية المشتركة أصبحت data attribute وليست ID.
- `git diff --check` لم يجر هنا لأن المصدر مستخرج من ZIP بلا `.git`; سكربت Termux ينفذه بعد staging.
- لم يتم تشغيل `npm ci` أو build محلياً في هذه البيئة. CI #48 ناجح لكن يخص R7.3، وليس R7.4.

## حالة قاعدة الإنتاج — قراءة فقط
- محادثات السوق والجداول الأساسية وسياسات القراءة/الإرسال موجودة، وقد أظهرت سياسات السوق أن buyer/seller طرفا المحادثة لا يحتاجان صداقة لإرسال `market_messages`.
- سياسات friend-chat العامة لا تزال تتطلب صداقة مقبولة؛ هذا القيد لم يُلغ.
- production لا يزال يسمح بحذف `products` مباشرة عبر policy/grant القديم، بينما migration archive في المصدر فقط.
- migrations الأرشفة/لقطات الإعلان/الضمان/retention ومكالمة السوق ليست مثبتة كتطبيقات في سجل الإنتاج.
- `market_messages.sender_id` index غير موجود بالإنتاج حتى تطبيق migration آمن؛ CI #48 اختبر migration على PostgreSQL مؤقت فقط.
- ملفا migration التاريخيان `20261011184718_...` و`20261011184813_...` مسجلان في الإنتاج ومفقود محتواهما. ممنوع اختلاق محتوى أو `db push` قبل المصالحة.
- Leaked Password Protection غير مفعلة، وهناك ثلاث دوال SECURITY DEFINER تتطلب مراجعة؛ لم نغيرها.

## اختبارات لم تُنجز
- CI على SHA R7.4، بما فيه PostgreSQL regression وبناء web/APK/AAB وتوقيعها.
- اختبار فعلي من حساب مشتري وبائع لإرسال/استقبال Realtime ورسائل السوق والمكالمات.
- هاتفان Android وشبكتان مختلفتان، جهاز حديث وآخر أقدم، echo/RTT/packet loss/جودة الفيديو/السماعة/وضع الأطفال/حرارة/نسخ احتياطي واستعادة.
- اختبار استخدام بصري وتفاعلي للصفحات الكاملة والدوائر على Android/WebView فعلي.

## رفع R7.4
شغّل فقط `TERMUX-PUSH-3.0.2-R7.4-20261102.sh` من جذر هذه الحزمة. ينشئ فرع `alwaha-pro-3.0.2-release-r7.4-20261102` من commit R7.3، ويرفض استبدال فرع موجود. لا يغير `main`، لا ينشر Pages، ولا ينفذ migrations أو db push.
