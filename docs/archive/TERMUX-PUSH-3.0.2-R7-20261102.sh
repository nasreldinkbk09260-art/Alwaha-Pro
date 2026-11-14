#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

# Upload the reviewed Alwaha-Pro 3.0.2 R7 source to an isolated GitHub branch.
# Never pushes main, never runs supabase db push, and never changes production DB.
REPO_URL="https://github.com/nasreldinkbk09260-art/Alwaha-Pro.git"
BASE_SHA="f116998da546b05b65d52bf89871de1490dcc920"
TARGET_BRANCH="alwaha-pro-3.0.2-release-20261102"
PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[ -s "$PACKAGE_DIR/SHA256SUMS.txt" ] || { echo "STOP: SHA256SUMS.txt is missing from R7 package."; exit 1; }
(cd "$PACKAGE_DIR" && sha256sum -c SHA256SUMS.txt >/dev/null) || { echo "STOP: R7 package checksum verification failed."; exit 1; }
[ -s "$PACKAGE_DIR/scripts/android/AlwahaAudioRoutePlugin.java" ] || { echo "STOP: Android audio route plugin source is missing."; exit 1; }
[ -s "$PACKAGE_DIR/scripts/marketplace-column-audit.mjs" ] || { echo "STOP: marketplace column permission audit is missing."; exit 1; }
[ -s "$PACKAGE_DIR/supabase/migrations/20261102150000_products_seller_email_privacy.sql" ] || { echo "STOP: seller_email privacy migration is missing."; exit 1; }
[ -s "$PACKAGE_DIR/supabase/tests/20261102160000_marketplace_snapshot_column_privileges.sql" ] || { echo "STOP: authenticated snapshot privilege test is missing."; exit 1; }
grep -q 'FileProvider.getUriForFile' "$PACKAGE_DIR/scripts/android/AlwahaAudioRoutePlugin.java" || { echo "STOP: secure APK FileProvider implementation is missing."; exit 1; }

for command in git node python3 gh sha256sum; do
  command -v "$command" >/dev/null 2>&1 || { echo "STOP: الأمر $command غير مثبت؛ ثبّت GitHub CLI: pkg install gh"; exit 1; }
done

gh auth status -h github.com >/dev/null 2>&1 || {
  echo "STOP: سجّل الدخول إلى GitHub أولاً: gh auth login -h github.com -p https -w";
  exit 1;
}
gh auth setup-git >/dev/null

TMP="$(mktemp -d "$HOME/alwaha-3.0.2-r7-push-XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

printf '===== 1. جلب نقطة العمل الدقيقة =====\n'
git clone --quiet --no-checkout --filter=blob:none "$REPO_URL" "$TMP/repo"
git -C "$TMP/repo" fetch --quiet --depth 1 origin "$BASE_SHA"
if git ls-remote --exit-code --heads origin "$TARGET_BRANCH" >/dev/null 2>&1; then
  echo "STOP: الفرع البعيد $TARGET_BRANCH موجود بالفعل؛ لن نستبدله أو ندفع فوقه تلقائياً. افحصه أولاً."; exit 1
fi
git -C "$TMP/repo" checkout --quiet --detach "$BASE_SHA"
ACTUAL="$(git -C "$TMP/repo" rev-parse HEAD)"
[ "$ACTUAL" = "$BASE_SHA" ] || { echo "STOP: نقطة الأساس غير مطابقة: $ACTUAL"; exit 1; }
git -C "$TMP/repo" checkout --quiet -b "$TARGET_BRANCH"

printf '===== 2. استبدال شجرة المصدر بالكامل بنسخة R7 =====\n'
python3 - "$PACKAGE_DIR" "$TMP/repo" <<'PY'
from pathlib import Path
import shutil, sys
source, target = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
if not (source/'package.json').is_file() or not (source/'index.html').is_file():
    raise SystemExit('STOP: لم يتم العثور على جذر حزمة R7 الصحيح.')
# Remove every previous tracked/untracked source entry, preserving only Git metadata.
for item in list(target.iterdir()):
    if item.name == '.git':
        continue
    if item.is_dir(): shutil.rmtree(item)
    else: item.unlink()
excluded_root = {'.git','node_modules','dist','ios','.gradle'}
for item in source.rglob('*'):
    rel = item.relative_to(source)
    # Exclude only the generated Android project at repository root. Do NOT
    # exclude scripts/android: it contains the checked-in native Java plugin.
    if rel.parts and rel.parts[0] in excluded_root | {'android'}:
        continue
    if len(rel.parts) > 1 and rel.parts[0] == 'admin-app' and rel.parts[1] in {'android','node_modules','dist'}:
        continue
    dest = target/rel
    if item.is_dir(): dest.mkdir(parents=True, exist_ok=True)
    elif item.is_file():
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, dest)
plugin = target/'scripts/android/AlwahaAudioRoutePlugin.java'
if not plugin.is_file():
    raise SystemExit('STOP: native plugin source was omitted while staging the R7 worktree.')
PY

printf '===== 2.1 تنظيف المسافات الطرفية غير المؤثرة =====\n'
python3 - "$TMP/repo" <<'PY_CLEAN'
from pathlib import Path
import sys
root=Path(sys.argv[1])
# Markdown documentation plus two proven whitespace-only/source-format cases.
targets=[p for p in root.rglob('*.md') if '.git' not in p.parts]
for rel in ('index.html','assets/vendor/supabase/supabase.js'):
    p=root/rel
    if p.is_file(): targets.append(p)
for p in targets:
    try: original=p.read_text(encoding='utf-8')
    except (UnicodeDecodeError, OSError): continue
    lines=original.splitlines(keepends=True)
    cleaned=[]
    for line in lines:
        if line.endswith('\r\n'):
            cleaned.append(line[:-2].rstrip(' \t')+'\r\n')
        elif line.endswith('\n'):
            cleaned.append(line[:-1].rstrip(' \t')+'\n')
        else:
            cleaned.append(line.rstrip(' \t'))
    updated=''.join(cleaned)
    if updated != original: p.write_text(updated, encoding='utf-8')
print('TRAILING_WHITESPACE_NORMALIZATION=PASS')
PY_CLEAN

printf '===== 3. تحقق الهوية وحارس قاعدة البيانات =====\n'
cd "$TMP/repo"
node - <<'NODE'
const fs=require('node:fs');
const p=JSON.parse(fs.readFileSync('package.json','utf8'));
const c=JSON.parse(fs.readFileSync('capacitor.config.json','utf8'));
const m=JSON.parse(fs.readFileSync('manifest.json','utf8'));
if(p.version!=='3.0.2'||m.version!=='3.0.2'||c.appId!=='pro.alwaha.app'||c.appName!=='Alwaha-Pro'||c.webDir!=='dist') throw new Error('Release identity mismatch.');
const workflow=fs.readFileSync('.github/workflows/build-apk-aab-release.yml','utf8');
if(!workflow.includes('alwaha-pro-3.0.2-release-20261102')||!workflow.includes("APP_VERSION: '3.0.2'")) throw new Error('3.0.2 CI branch/version is not wired.');
const guard=fs.readFileSync('.github/workflows/supabase-migrations.yml','utf8');
if(!guard.includes('will not run supabase db push')||!guard.includes('20261011184718_alwaha_profile_privacy_clean_start.sql')||!guard.includes('20261011184813_verification_request_profile_requirements.sql')) throw new Error('Historical migration safety guard is missing.');
const archiveMigration=fs.readFileSync('supabase/migrations/20261101210000_marketplace_transaction_archive_and_call_auth.sql','utf8');
if(!archiveMigration.includes('REVOKE DELETE ON TABLE public.products FROM PUBLIC, anon, authenticated')||!archiveMigration.includes('DROP POLICY IF EXISTS products_delete_own')) throw new Error('Marketplace hard-delete protection is missing.');
for(const old of ['20261024211500_marketplace_lifecycle_reviews.sql','20261027170000_require_accepted_friendship_for_messages.sql','20261029121500_add_marketplace_foreign_key_indexes.sql']) {
  if(fs.existsSync('supabase/migrations/'+old)) throw new Error('Duplicate legacy migration still active: '+old);
}
for(const archived of ['20261024211500_marketplace_lifecycle_reviews.sql','20261027170000_require_accepted_friendship_for_messages.sql','20261029121500_add_marketplace_foreign_key_indexes.sql']) {
  if(!fs.existsSync('docs/migration-archive-unapplied/'+archived)) throw new Error('Legacy migration archive missing: '+archived);
}
console.log('IDENTITY_AND_DB_SAFETY=PASS');
NODE

printf '===== 4. استخدام نتائج فحوص R7 المحفوظة =====\n'
echo 'R7 source audits, prebuild, and Admin web build are already recorded as PASS in docs/QA-RESULTS-20261102-R7.md.'
echo 'SHA256 and identity/DB safety checks were repeated before staging.'
echo 'GitHub Actions will run release audits, PostgreSQL regression and Android build after push; no duplicate local test loop is run here.'

git add -A
git diff --cached --check
if git diff --cached --quiet; then echo 'STOP: لا توجد تغييرات لرفعها.'; exit 1; fi
printf '===== 5. ملخص الشجرة =====\n'
git diff --cached --stat
printf '===== 6. إنشاء commit على الفرع المستقل =====\n'
git -c user.name='Alwaha-Pro Release Bot' -c user.email='release-bot@users.noreply.github.com' commit -m "Prepare Alwaha-Pro 3.0.2 release candidate R7"
NEW_SHA="$(git rev-parse HEAD)"
printf '===== 7. رفع الفرع فقط =====\n'
git push -u origin "$TARGET_BRANCH"

echo "RELEASE_BRANCH=$TARGET_BRANCH"
echo "RELEASE_COMMIT=$NEW_SHA"
echo "PRODUCTION_DATABASE_CHANGED=no"
echo "MAIN_BRANCH_CHANGED=no"
echo "NEXT=https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions"
