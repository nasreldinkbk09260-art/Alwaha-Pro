# أوامر فكّ الإصلاح وبنائه ورفعه من Termux

> استخرج الملف المضغوط فوق مجلد المشروع الحالي بالاسم نفسه. لا تحذف مجلد المشروع ولا تغيّر الفرع، ولا تستخدم `git add -A` لأن المجلد قد يحتوي على نسخ احتياطية أو تطبيق الإدارة المنفصل.

```bash
set -eu
ZIP="$HOME/storage/shared/Download/Alwaha-Pro-3.0.1-Post-Repair.zip"
REPO="$HOME/Documents/Alwaha-Pro-3.0.1-worktree-20261020"
BRANCH="alwaha-social-3.0.1-mobile-performance-20261020"

# 1) استبدال ملفات المصدر بالإصلاحات مع إبقاء بيانات Git الموجودة في المجلد
test -f "$ZIP"
mkdir -p "$HOME/Documents"
unzip -o "$ZIP" -d "$HOME/Documents"
cd "$REPO"

# 2) التأكد من الفرع وعدم لمس المفاتيح أو بيانات المشروع
test "$(git branch --show-current)" = "$BRANCH"
git diff --check

# 3) تثبيت الاعتماديات ثم فحوصات الإصدار والأداء والبناء
npm ci --no-audit --no-fund
npm run audit:release
npm run audit:performance
npm run build
test -s dist/index.html
test -s dist/alwaha-native-back-handler.js
grep -q 'home-post-details-modal' dist/index.html

# 4) فحص الملفات المتغيرة قبل تسجيل الإصلاحات
git diff --check
git status --short --branch

# 5) إضافة ملفات المشروع المقصودة فقط؛ لا تُضف ملفات النسخ الاحتياطية أو admin-app
git add .github/workflows/build-apk-aab-release.yml \
  index.html package.json package-lock.json sw.js \
  scripts/build-web.mjs scripts/performance-audit.mjs \
  scripts/release-preflight.mjs scripts/native-back-handler.mjs \
  assets/vendor REPAIR_NOTES_AR.md TERMUX_BUILD_PUSH_AR.md

git diff --cached --check
git commit -m "Fix home post details and editing; refresh offline cache"
git push origin "$BRANCH"
```

## بعد الرفع
يتولى سير عمل GitHub Actions بناء APK وAAB بحسب إعداد المستودع. لا تعتبر ملف التثبيت جاهزًا حتى تظهر نتيجة نجاح سير العمل ثم تحمّل مخرجاته. لا تنفّذ `supabase db push` ولا تستبدل مفاتيح التوقيع أو أسرار GitHub.
