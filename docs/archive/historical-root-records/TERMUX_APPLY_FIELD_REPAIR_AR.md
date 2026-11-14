# تطبيق حزمة الإصلاح الميداني عبر Termux

> **مهم:** لا تستبدل مجلد المشروع كله. الخطوات أدناه تحفظ الملفات الحالية ثم تنسخ الملفات التي تغيّرت فقط، وتترك `admin-app/` والملفات غير المتتبعة كما هي.

## 1. فك الحزمة

فكّ `Alwaha-Pro-3.0.1-Field-Repair-20261027.zip` داخل:
`/storage/emulated/0/Download/Alwaha-Pro-3.0.1-Field-Repair-20261027/`

وبذلك يفترض أن يكون مجلد المصدر:
`$HOME/storage/shared/Download/Alwaha-Pro-3.0.1-Field-Repair-20261027/Alwaha-Pro-3.0.1-worktree-20261020`

## 2. انسخ الملفات المحددة مع نسخة احتياطية تلقائية

```bash
set -eu
DEST="$HOME/Documents/Alwaha-Pro-3.0.1-worktree-20261020"
KIT="$HOME/storage/shared/Download/Alwaha-Pro-3.0.1-Field-Repair-20261027/Alwaha-Pro-3.0.1-worktree-20261020"
BACKUP="$HOME/storage/shared/Download/Alwaha-Pro-3.0.1-field-backup-$(date +%Y%m%d-%H%M%S)"
FILES=(
  index.html
  sw.js
  package.json
  REPAIR_NOTES_AR.md
  scripts/release-preflight.mjs
  scripts/performance-audit.mjs
  scripts/field-repair-audit.mjs
  supabase/migrations/20261027170000_require_accepted_friendship_for_messages.sql
)

test -d "$DEST"
test -f "$KIT/index.html"
mkdir -p "$BACKUP"
for F in "${FILES[@]}"; do
  test -f "$KIT/$F" || { echo "ملف الحزمة مفقود: $F"; exit 1; }
  if [ -f "$DEST/$F" ]; then
    mkdir -p "$BACKUP/$(dirname "$F")"
    cp -p "$DEST/$F" "$BACKUP/$F"
  fi
done
for F in "${FILES[@]}"; do
  mkdir -p "$DEST/$(dirname "$F")"
  cp -p "$KIT/$F" "$DEST/$F"
done

echo "BACKUP=$BACKUP"
cd "$DEST"
echo '===== تحقق سريع ====='
node scripts/release-preflight.mjs
node scripts/performance-audit.mjs
node scripts/field-repair-audit.mjs
node --check sw.js
```

## 3. تثبيت حزم البناء والبناء من جديد

```bash
cd "$HOME/Documents/Alwaha-Pro-3.0.1-worktree-20261020" || exit 1
npm ci --no-audit --no-fund
npm run audit:release
npm run audit:performance
npm run audit:field-repair
npm run build
```

إذا فشل `npm ci` بسبب الشبكة أو DNS، أو فشل أي تدقيق/بناء، **توقف ولا ترفع APK**؛ أصلح الخطأ أولًا. نجاح `npm run build` يصنع ملفات الويب داخل `dist`، وليس وحده دليلًا على أن APK موقّع جديدًا صدر.

## 4. قاعدة البيانات والرفع

ترحيل `20261027170000_require_accepted_friendship_for_messages.sql` مرفق لكنه غير مطبق تلقائيًا. سجل المهاجرات الموجود به ترحيلان تاريخيان مفقودان؛ لا تشغّل `supabase db push` ولا تنشئ ترحيلات فارغة لتعويضهما. بعد حل سجل المهاجرات ومراجعة المخطط الفعلي، طبّق الترحيل في بيئة اختبار أولًا ثم تحقق من سياسات RLS.

بعد نجاح البناء وفحص الملفات، اعرض `git status --short --branch` وراجع التغييرات، وأضف الملفات المحددة فقط. لا تستخدم `git add .` لأن مجلد الإدارة والنسخ الاحتياطية قد تكون غير متتبعة ولا نريد إدراجها عشوائيًا.
