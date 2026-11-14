# رفع وبناء R7.5 — Alwaha-Pro 3.0.2

من مجلد المصدر بعد فك الحزمة:

```bash
bash ./TERMUX-PUSH-3.0.2-R7.5-20261103.sh
```

يرفع المصدر إلى فرع مستقل `alwaha-pro-3.0.2-release-r7.5-20261103` مبني من R7.3 commit `553e1c4`. سير GitHub Actions على الفرع يشغّل PostgreSQL SQL regression ثم مراجعات المصدر وبناء Web/Android وتوقيع APK/AAB والتحقق منهما، بما في ذلك اختبار تشغيل منطق الثيمات. لا يوجد نشر تلقائي للموقع أو Supabase.

لا تشغّل `supabase db push`. لا تُطبّق ترحيلات السوق/الضمان/الحذف على الإنتاج قبل استعادة محتوى الترحيلين التاريخيين المفقودين، ومراجعة خطة المصالحة والنسخة الاحتياطية على بيئة اختبار.

**R7.4 uploader and instructions are historical. Use the R7.5 script only.**
