# حزمة توافق وإصلاح Alwaha-Pro 3.0.1

هذه نسخة مصدر كاملة مبنية على حزمة إصلاح 30-10-2026، مع إضافات معالجة انتظار المنشورات والتسجيل ومؤشر التوافق المحلي. راجع `AUDIT_REPAIR_REPORT_AR_20261030.md` لمعرفة الإصلاحات والحدود والاختبارات.

## التثبيت على بيئة Termux الموجودة

1. احتفظ بنسخة احتياطية من مجلد المشروع الحالي.
2. استخرج مجلد `Alwaha-Pro-3.0.1-Compatibility-Repair-Candidate` من ZIP.
3. انسخ محتويات المجلد كاملة إلى مجلد المشروع العام الموجود فقط:
   `~/Documents/Alwaha-Pro-3.0.1-worktree-20261020`
4. تأكد أن الفرع الحالي هو:
   `alwaha-social-3.0.1-mobile-performance-20261020`
5. داخل المشروع نفّذ:

```bash
npm ci --no-audit --no-fund
npm run audit:release
npm run audit:performance
npm run audit:field-repair
npm run audit:chat
npm run audit:compatibility
npm run build
```

لا تنسخ هذه الحزمة إلى مجلد `Alwaha-Pro-Admin`، ولا تحذف مجلد `admin-app/` المحلي إن كان موجوداً خارج هذه الحزمة. لا تطبق أي migrations على قاعدة الإنتاج أثناء هذا الاختبار.

## Android

Capacitor 8.5.2 في هذا المشروع يتطلب Android 7.0/API 24 على الأقل. هذه الحزمة لا تخفض هذا الحد إلى Android 5؛ تغيير رقم minSdk وحده لا يجعل المكتبات الأصلية متوافقة. بعد نجاح GitHub Actions، اختبر APK على OPPO A5s Android 7 وعلى هاتف حديث، ثم نفّذ اختبار الحساب والمنشورات والمكالمات بين جهازين.
