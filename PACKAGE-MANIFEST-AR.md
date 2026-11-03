# دليل محتويات Alwaha-Pro 3.0.2 R7.4.2

## المصدر والهوية
- مصدر العمل: R7.4.1 عند commit `942bb5fc1a32080a07ed9a8cd8dfcf97311778af`.
- الإصدار محفوظ `3.0.2`؛ التطبيق `pro.alwaha.app` / `Alwaha-Pro` / `dist` / `icon.png` الأصلي.
- الإصلاحات السابقة من R7.3/R7.4/R7.4.1 مستمرة؛ لا إعادة بناء على 2.8.x.

## ملفات الواجهة والتشغيل
- `index.html`, `sw.js`, `games.js`, `production-polish.js`, `compatibility.js`.
- `alwaha-experience.js`, `alwaha-modal-shell.js`, `alwaha-runtime-guard.js`.
- `alwaha-local-vault.js`, `alwaha-kids-room.js`.
- `alwaha-theme-system.css`، وخلفيات الربيع/الصيف/الخريف/الشتاء WebP محلية 1200×1920 مع SVG المصدر.
- الأصول المحلية القديمة والخطوط والصوت وأيقونات الطرف الثالث ومحرك الشطرنج محفوظة.

## Android وSupabase وCI
- `scripts/android/AlwahaAudioRoutePlugin.java` محفوظ؛ لم تتغير هوية Android.
- جميع migrations وSQL tests من R7.4.1 محفوظة؛ لا توجد migration جديدة في R7.4.2 ولم يُنفذ `supabase db push`.
- سير Android build-only يشغّل SQL regression، وrelease/performance/chat/compatibility/native/UI/retention/admin/marketplace/reconciliation/fullscreen/runtime/theme audits، ثم Web/APK/AAB وتحقق التوقيع.
- سير Pages والنشر اليدوي لم يتم تشغيله؛ لا نشر تلقائي للموقع.

## ملفات التوثيق والرفع
- المفكرة الرئيسية، مقارنة خط الأساس، سجل الموانع، سجل الإصلاح، QA، الاستمرارية، خطة إغلاق الإصدار وتجربة الجهازين.
- سكربت الرفع الحالي الوحيد: `TERMUX-PUSH-3.0.2-R7.4.2-20261103.sh`.
- سكربت R7.4 السابق محفوظ في `docs/archive/` للأرشيف فقط.

## حالة التحقق
- فحوص JavaScript/JSON/HTML وتدقيقات المصدر الساكن ناجحة بعد الإصلاح.
- لم يكتمل `npm ci` داخل حاوية المراجعة بسبب انتهاء مهلة الاتصال بـnpm registry؛ لذلك لم ينفذ Web/Android build محلياً.
- يلزم GitHub Actions واختبار APK على هاتفين قبل اعتماد الإصدار للنشر العام.
- لا يحتوي ZIP على `node_modules/` أو `dist/` أو ملفات توقيع أو APK/AAB قديمة.
