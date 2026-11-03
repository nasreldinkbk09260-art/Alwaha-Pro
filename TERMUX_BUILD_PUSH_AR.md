# الرفع والبناء — Alwaha-Pro 3.0.2 R7.4.2

من جذر المجلد بعد فك الحزمة:

```bash
bash ./TERMUX-PUSH-3.0.2-R7.4.2-20261103.sh
```

السكريبت يتحقق من `SHA256SUMS.txt`، ويشغّل فحوص المصدر، ويتأكد من GitHub auth ومن عدم وجود فرع الهدف، ثم يجلب R7.4.1 عند SHA المتوقع `942bb5fc1a32080a07ed9a8cd8dfcf97311778af`، وينشئ فرعاً جديداً `alwaha-pro-3.0.2-release-r7.4.2-20261103` ويرفعه دون force-push.

رفع هذا الفرع يشغّل GitHub Actions build-only: PostgreSQL regression على قاعدة اختبار مؤقتة، ثم Web/APK/AAB وتوقيعها. لا يوجد نشر تلقائي للموقع، ولا دفع migrations إلى Supabase الإنتاجية، ولا تغيير في `main`.

بعد نجاح Actions نزّل APK من artifact الخاص بنفس commit، ثم ثبّته فوق التطبيق الحالي. الـworkflow يضع `versionCode` من `github.run_number`؛ لذلك ينبغي أن يكون أعلى من Build 51. لا تحذف التطبيق ولا تمسح بياناته قبل هذا الاختبار.

السكريبت القديم `TERMUX-PUSH-3.0.2-R7.4-20261102.sh` مؤرشف في `docs/archive/` ولا يُستخدم لهذا الإصلاح.
