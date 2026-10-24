# أوامر تثبيت الإصلاح والبناء والرفع — Alwaha-Pro 3.0.1

> الحزمة تستخرج محتويات المشروع فوق مجلد العمل نفسه؛ لا تحذف مجلد المشروع أو `.git`. لا تستخدم `git add -A` لأن المجلد قد يحتوي على نسخ احتياطية أو ملفات لا تخص الإصدار.

```bash
set -eu
ZIP="$HOME/storage/shared/Download/Alwaha-Pro-3.0.1-Repair-Bundle.zip"
REPO="$HOME/Documents/Alwaha-Pro-3.0.1-worktree-20261020"
BRANCH="alwaha-social-3.0.1-mobile-performance-20261020"

test -f "$ZIP"
unzip -o "$ZIP" -d "$HOME/Documents"
cd "$REPO"
test "$(git branch --show-current)" = "$BRANCH"
git diff --check

# تثبيت الحزم المحلية ثم التدقيق والبناء
npm ci --no-audit --no-fund
npm run audit:release
npm run audit:performance
npm run build
test -s dist/index.html
test -s dist/alwaha-native-back-handler.js
grep -q 'home-post-details-modal' dist/index.html
grep -q 'اتصال صوتي بالبائع' dist/index.html

# مراجعة الملفات المخصصة فقط، ثم رفعها إلى فرع التطوير الموجود
git status --short --branch
git add .github/workflows/build-apk-aab-release.yml \
  index.html package.json package-lock.json sw.js \
  scripts/build-web.mjs scripts/performance-audit.mjs \
  scripts/release-preflight.mjs scripts/native-back-handler.mjs \
  supabase/migrations/20261024211500_marketplace_lifecycle_reviews.sql \
  REPAIR_NOTES_AR.md TERMUX_BUILD_PUSH_AR.md
git diff --cached --check
git commit -m "Improve reels, exit flow, marketplace and public cache safety"
git push origin "$BRANCH"
```

## تنبيه إنتاج مهم
نجاح بناء الويب لا يعني أن ميزات السوق المعتمدة على المخطط الجديد أصبحت مفعّلة على قاعدة الإنتاج. هناك ملفان تاريخيان مفقودان في المستودع (`20261011184718_alwaha_profile_privacy_clean_start.sql` و`20261011184813_verification_request_profile_requirements.sql`) وسير عمل migrations يمنع النشر حتى استعادتهما ومقارنتهما بقاعدة الإنتاج. **لا تشغّل `supabase db push` ولا تنشئ بدائل فارغة.** بعد الرفع، انتظر نجاح GitHub Actions، ثم نزّل مخرجات APK/AAB.
