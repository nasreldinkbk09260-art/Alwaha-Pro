# الرفع والبناء — R7.3

من جذر مجلد المصدر بعد فك الحزمة شغّل مرة واحدة:

```bash
bash ./TERMUX-PUSH-3.0.2-R7.3-20261102.sh
```

السكريبت يتحقق من بصمة SHA وهوية التطبيق وحواجز التاريخ، ينشئ فرعاً مستقلاً من commit `f116998da546b05b65d52bf89871de1490dcc920` ويرفع المصدر كاملاً إلى `alwaha-pro-3.0.2-release-r7.3-20261102`. لا يدفع إلى main ولا ينشر موقعاً ولا يطبق migrations ولا يشغّل `supabase db push`.

بعد الرفع يلزم GitHub Actions لعمل SQL regression ثم Web/Android build وتوقيع APK/AAB. لا تعد تشغيل npm audits في Termux؛ سجلات CI هي الدليل التالي.
