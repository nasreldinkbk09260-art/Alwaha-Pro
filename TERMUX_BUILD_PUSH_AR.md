# الرفع والبناء — R7.5

من جذر مجلد المصدر بعد فك الحزمة:

```bash
cd "$HOME/storage/shared/Download/Alwaha-Pro-3.0.2-R7.5-FINAL-20261103" || exit 1
bash ./TERMUX-PUSH-3.0.2-R7.5-20261103.sh
```

يبني السكربت فرع R7.5 مستقلاً من commit R7.3 `553e1c4`، ويتحقق من SHA وهوية التطبيق والملفات الأساسية، ويرفض استبدال الفرع إن كان موجوداً. لا يدفع إلى `main` ولا ينشر الموقع ولا يطبق migrations ولا يشغّل `supabase db push`.

بعد الرفع راجع تشغيل GitHub Actions على SHA الجديد لنجاح PostgreSQL regression ثم Web/APK/AAB وتوقيعها. Build #48 السابق يخص R7.3 فقط، ولا يمثل تعديلات R7.5.
