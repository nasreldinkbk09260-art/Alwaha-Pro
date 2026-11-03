# دليل محتويات Alwaha-Pro 3.0.2 R7.4

- التطبيق وملفاته: `index.html`, `games.js`, `production-polish.js`, `compatibility.js`, `alwaha-kids-room.js`, `alwaha-local-vault.js`, `alwaha-experience.js`, `alwaha-modal-shell.js`, `sw.js`.
- الأصول: حزم الطرف الثالث والخطوط والأيقونات، ملفات الصوت المحلية، خلفيات الثيمات الأربع، ومحرك الشطرنج.
- Android: مصدر `scripts/android/AlwahaAudioRoutePlugin.java` مع الحفاظ على هوية `pro.alwaha.app` و`Alwaha-Pro` و`dist` والأيقونة الأصلية.
- Supabase: migrations/tests الأصلية وإصلاحات اختبارات CI؛ لا يوجد تطبيق تلقائي على قاعدة الإنتاج.
- CI: SQL regression PostgreSQL مؤقت، release/performance/UI/fullscreen/marketplace/admin audits، بناء Web وAPK/AAB وتحقق التوقيع.
- وثائق: المفكرة الرئيسية، مقارنة خط الأساس، خريطة الاستمرارية، تقارير QA، خطة الإغلاق، قائمة الموانع، سجل R7.4، وخطة تجربة الجهازين.
- الحزمة source-only؛ لا تضم `node_modules/` أو `dist/` أو Android build generated أو ملفات توقيع أو APK/AAB قديمة.
- سكربت الرفع الوحيد الموصى به: `TERMUX-PUSH-3.0.2-R7.4-20261102.sh`.

Build #48، إذا احتجته للمقارنة، ناتج R7.3 فقط وليس من شجرة R7.4.
