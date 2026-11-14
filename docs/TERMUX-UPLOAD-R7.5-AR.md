# رفع R7.5 من Termux

1. تحقق من الملف قبل فك الضغط، ثم فكّه:ـ

```bash
cd "$HOME/storage/shared/Download" || exit 1
sha256sum -c Alwaha-Pro-3.0.2-R7.5-FINAL-20261103.zip.sha256
unzip -q Alwaha-Pro-3.0.2-R7.5-FINAL-20261103.zip
cd "$HOME/storage/shared/Download/Alwaha-Pro-3.0.2-R7.5-FINAL-20261103" || exit 1
bash ./TERMUX-PUSH-3.0.2-R7.5-20261103.sh
```

السكريبت نفسه يعيد التحقق من `SHA256SUMS.txt` قبل أي Git operation، ثم ينشئ فرعاً مستقلاً من R7.3 `553e1c4`، ينسخ كامل المصدر، ثم يرفع commit جديداً. يتطلب Git وNode وPython وGitHub CLI (`gh auth login`). لا يغير `main` أو قاعدة الإنتاج ولا يعمل force-push.

بعد انتهاء الرفع، تابع `https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions`. لا تعتبر build السابق #48 بناءً لـR7.5.
