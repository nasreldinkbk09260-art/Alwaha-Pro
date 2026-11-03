# نتائج تدقيق R7.4.2 — 3 نوفمبر 2026

## نتيجة التحقيق

تم تحديد حلقة MutationObserver/syncDock في `alwaha-experience.js` و`alwaha-modal-shell.js`، وتعديل مراقبة DOM كي لا تعيد مزامنة واجهة التنقل عند كل تغيير. إعادة كتابة `textContent` لنفس قيمة المقبض لم تعد تحدث، ومراقب النوافذ صار يفلتر تغييرات الطبقات ويجمع التحديث في إطار الرسم.

## نتائج فحوص المصدر التي شُغّلت بعد آخر تعديل

| الفحص | النتيجة |
|---|---|
| `audit:release` | PASS |
| `audit:performance` | PASS |
| `audit:field-repair` | PASS |
| `audit:chat` | PASS |
| `audit:compatibility` | PASS |
| `audit:native-call-ui` | PASS |
| `audit:ui` | PASS |
| `audit:retention-kids-vault` | PASS |
| `audit:admin` | PASS |
| `audit:marketplace-columns` | PASS |
| `audit:reconciliation` | PASS |
| `audit:fullscreen-ui` | PASS |
| `audit:runtime` | PASS — يتضمن فحوص منع الحلقة |
| `audit:themes` | PASS — الثيم الأساسي + 4 ثيمات محلية + 3 ترحيلات أسماء قديمة |
| `node --check` | PASS — ملفات JS/MJS و3 كتل JavaScript داخل index.html |
| `bash -n` | PASS — سكربت رفع R7.4.2 |
| أبعاد خلفيات الموسم | PASS — كل صورة WebP بدقة 1200×1920 |
| سلامة إعداد workflow | PASS — trigger للفرع R7.4.2 وفحوص theme build-only |

## ما لم ينفذ في هذه البيئة

- `npm ci` لم يكتمل خلال المهلة المحددة بسبب عدم استجابة npm registry؛ لم يُنشأ `node_modules` ولم يُترك مجلد بناء جزئي.
- لذلك لم يُنفذ Web build أو Android Gradle build محلياً، ولم يُفحص APK/AAB أو توقيعه من هذه الحاوية.
- لم يُنشأ أو يُرفع فرع R7.4.2 بعد؛ السكربت المرفق ينشئ فرعاً جديداً من R7.4.1 عند commit `942bb5fc1a32080a07ed9a8cd8dfcf97311778af`، ولا يستخدم force-push.
- لم يتم اختبار APK المصحح على الهاتفين؛ هذه الخطوة تالية لنجاح GitHub Actions.
- لم تتغير Supabase الإنتاجية، ولم تُطبق migrations، ولم يُنشر الموقع.

## القرار

هذه حزمة إصلاح مصدر مرشحة للبناء، وليست اعتماد نشر عام بعد. بعد تشغيل سكربت Termux يجب انتظار نجاح GitHub Actions لنفس commit، ثم تثبيت APK الجديد فوق التطبيق الحالي دون إلغاء تثبيت أو مسح بيانات، وإجراء تجربة الهاتفين. رقم إصدار Android في workflow أعلى من Build 51 حتى يكون التثبيت تحديثاً عادياً عند استخدام مفتاح التوقيع نفسه.
