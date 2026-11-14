# سجل تغييرات Alwaha-Pro 3.0.2 — R6

- نقطة الأساس هي R5 الكاملة، بعد دمج ترقيعات 3.0.1 الميدانية/السوق/الدردشة/التوافق ومراجعة حزم 2.8.2 و2.8.4 و2.8.7 و2.8.8.
- استعادة ملف `scripts/android/AlwahaAudioRoutePlugin.java` من R4 حرفياً؛ بصمة SHA256 للنسخة المستعادة تطابق ملف R4. كان ملف المصدر غائباً من R5 رغم أن CI واختبار native call يشترطانه.
- إعادة تشغيل `audit:native-call-ui` بعد الاستعادة: PASS.
- إعادة تشغيل جميع تدقيقات R5: release, performance, field-repair, chat (53), compatibility, native-call-ui, UI (244 استدعاء/116 دالة), retention-kids-vault (37), admin (16): PASS.
- `prebuild`: PASS، 41 مورداً محلياً.
- بناء واجهة الإدارة Web: PASS باستخدام ImageMagick fallback، ثم حذف ناتج `dist` المؤقت.
- JS/MJS وكتل inline وJSON وYAML وBash syntax: PASS.
- `npm run build` للتطبيق الرئيسي ما زال BLOCKED بسبب غياب `esbuild` وعدم تثبيت dependencies محلياً؛ لم ينتج `dist` ولا APK/AAB.
- لم يرفع فرع GitHub ولم تُشغّل Actions ولم تُطبق migrations على Supabase ولم يحدث اختبار هاتفين.
