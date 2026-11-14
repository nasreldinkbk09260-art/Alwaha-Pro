> **مذكرة تاريخية مؤرشفة:** لا تستخدم أوامر/سكربتات هذه المرحلة. الحالة الجارية والرفع المعتمدان موجودان في `docs/CONTINUITY-STATE-20261103-R7.5-AR.md` والسكريبت `TERMUX-PUSH-3.0.2-R7.5-20261103.sh`.

# تحقق حزمة R7.4 قبل التسليم — 2 نوفمبر 2026

## ما تم التحقق منه في شجرة المصدر

- اجتازت 12 أوامر npm للتدقيق الساكن: release، performance، field repair، chat/feed، compatibility، native call UI، UI handlers، fullscreen/isolation، retention/kids/vault، admin، marketplace columns، reconciliation.
- اجتازت صياغة جميع ملفات JavaScript/MJS، وJSON الخاصة بالحزم والـmanifest وCapacitor، وصياغة Shell.
- 184 معرف HTML مميزاً، بلا تكرار ضمن نص المصدر.
- لا توجد مسافات زائدة في نهاية أسطر ملفات النص.
- تم التحقق من بقاء `icon.png` وملف Android native plugin وهوية `pro.alwaha.app` و`Alwaha-Pro` و`dist`.
- ملف manifest وبصمات SHA256 يغطيان شجرة المصدر (باستثناء ملف البصمات نفسه).
- الحزمة source-only؛ لا تضم `node_modules` أو `dist` أو مجلد Android مولداً أو ملفات توقيع/مفاتيح أو ملفات `.env`.

## حدود التسليم

- لا يوجد بناء محلي R7.4 لأن `node_modules`/`esbuild` غير مثبتين في بيئة إنشاء الحزمة.
- CI #48 الناجح مبني من R7.3 عند commit `553e1c4`، وليس من شجرة R7.4.
- البناء والتوقيع الجديدان يتطلبان تشغيل GitHub Actions بعد رفع R7.4.
- لا تغيير في Supabase production، ولا نشر موقع، ولا اختبار جهازين.
- الخلفيات الأربع الحالية 600×600 وليست أصول HD؛ حذف الحساب غير منفذ؛ الخزنة لا تتضمن كل ملفات الوسائط الثنائية. هذه نقاط مفتوحة موضحة في blockers/tracker.
