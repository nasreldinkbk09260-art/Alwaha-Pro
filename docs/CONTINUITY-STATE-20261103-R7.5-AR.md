# نقطة متابعة R7.5 — Alwaha-Pro 3.0.2

- **Source**: هذه الشجرة مبنية على محتوى R7.4 الكامل، ثم أضيفت ثيمات R7.5 واختباراتها.
- **Git base**: `553e1c431a0cfb92112516533b746ba0a2976f4f` (R7.3).
- **Target branch**: `alwaha-pro-3.0.2-release-r7.5-20261103`.
- **Upload script**: `TERMUX-PUSH-3.0.2-R7.5-20261103.sh`.
- **App identity**: `pro.alwaha.app`, `Alwaha-Pro`, `dist`, keep `icon.png`.
- **Database**: no production schema/auth change applied. Don't run `supabase db push` until legacy migration reconciliation, backup, test plan and explicit approval are complete.

## ما تغير في R7.5

- ثيم أساسي محفوظ + الربيع/الصيف/الخريف/الشتاء.
- خلفيات محلية 1200×1920 WebP، SVG مصدر.
- لوحة ألوان تتغير للسطوح والحقول والنوافذ والتنقل.
- old preference migration; offline cache; runtime logic test.
- workflow now includes `npm run audit:themes`.

## تشغيل رفع المصدر

```bash
cd "$HOME/storage/shared/Download/Alwaha-Pro-3.0.2-R7.5-FINAL-20261103" || exit 1
bash ./TERMUX-PUSH-3.0.2-R7.5-20261103.sh
```

## بوابات باقية

1. Run GitHub Actions for the R7.5 SHA; pass SQL regression, audits, npm audit, Web build, APK/AAB, signature check.
2. Confirm product RLS/archive, market send/receive and Realtime on test environment before production migrations.
3. Resolve two missing historical migration source files or a reviewed reconciliation path; don't fabricate migrations.
4. Enable Supabase Auth leaked password protection.
5. Review the three exposed SECURITY DEFINER functions and legacy no-policy/unindexed advisories.
6. Test on two devices/two networks, plus camera/mic/speaker, kids audio, backup export/import, login, notifications and marketplace.
7. Complete account deletion workflow and decide whether local media should be included in backup.

**Never label official/full release until these gates pass.**

ملاحظة النقل بين الأجهزة: ملفات الخلفيات نفسها مضمّنة في نسخة التطبيق، لذلك كل تثبيت جديد يحصل على المشاهد الأربعة محلياً دون إنترنت. اختيار الثيم هو تفضيل شخصي محفوظ محلياً، وينتقل إلى الجهاز الآخر عند تصدير النسخة الاحتياطية المشفرة واستعادتها؛ مشاركة APK وحده لا تنقل بيانات المستخدم أو إعداداته الخاصة.
