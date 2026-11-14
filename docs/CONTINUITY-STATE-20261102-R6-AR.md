# نقطة الاستمرارية R6 — Alwaha-Pro 3.0.2 — 2 نوفمبر 2026

- أحدث مصدر موحد: هذا المجلد R6، مشتق من R5 مع استعادة ملف Java الأصلي من R4.
- الأساس التاريخي: `f116998da546b05b65d52bf89871de1490dcc920`، الفرع `alwaha-social-3.0.1-mobile-performance-20261020`.
- هوية التطبيق: `pro.alwaha.app`, `Alwaha-Pro`, `3.0.2`, `webDir=dist`; لا تغيّر icon.
- الملفات التاريخية المتاحة في المكتبة: R1, R4, R5, 3.0.1 Repair Bundle/Market Cache/Field/Chat/Compatibility/Call Repair، وحزمة تاريخية 2.8.2–3.0.1. كل ذلك تمت مراجعته؛ تفاصيل الدمج في `HISTORICAL-REPAIR-MERGE-R6-AR.md`.
- إصلاح R6 الوحيد فوق R5: استعادة `scripts/android/AlwahaAudioRoutePlugin.java` من R4 بنفس البصمة، وإعادة الفحوص.
- كل audits نجحت الآن بما فيها native-call UI. R5 report القديم كان مخطئاً في ادعاء native pass؛ R6 QA هو المرجع.
- npm run build ما زال يتوقف بسبب غياب esbuild؛ لا يوجد dist ولا APK/AAB 3.0.2.
- الفرع البعيد `alwaha-pro-3.0.2-release-20261102` لم يظهر في GitHub عند آخر check؛ السكربت R6 ينشئه من commit الأساس ويرفض استبداله إذا كان موجوداً.
- استخدم `TERMUX-PUSH-3.0.2-R6-20261102.sh` من جذر المجلد بعد التأكد من Git/GH login. السكربت يتحقق من SHA256، وملف native plugin، والهوية، والـ migrations duplicate guard؛ ويرفع فرع الإصدار فقط. لا يغير `main` ولا يطبق قاعدة Supabase.
- بعد push راقب workflow الرئيسي وworkflow لوحة الإدارة؛ أصلح فقط الفشل الجديد من logs ولا تعِد تشغيل audits التي لم تتغير.
- لا تطبق migrations على الإنتاج. migration history يحتوي مصدرين مفقودين. استخدم backup + test project + نشر مراقب للترحيلات الجديدة بعد CI فقط.
- بوابة الهاتفين مفتوحة: تثبيت APK من CI واختبار صداقة/إشعار/سوق/مكالمة/غرفة أطفال/نسخ احتياطي واستعادة على هاتفين وشبكتين.
