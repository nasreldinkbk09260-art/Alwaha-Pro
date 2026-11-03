#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

# Alwaha-Pro 3.0.2 R7.3: upload source to a dedicated build-only branch.
# This script does not publish a website, deploy Supabase, or modify production DB.
REPO_URL="https://github.com/nasreldinkbk09260-art/Alwaha-Pro.git"
BASE_SHA="f116998da546b05b65d52bf89871de1490dcc920"
TARGET_BRANCH="alwaha-pro-3.0.2-release-r7.3-20261102"
PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say() { printf '\n===== %s =====\n' "$1"; }
stop() { printf '\nSTOP: %s\n' "$1" >&2; exit 1; }

say "1. التحقق من الحزمة الموحدة R7.3"
[ -s "$PACKAGE_DIR/SHA256SUMS.txt" ] || stop "ملف SHA256SUMS.txt غير موجود."
(cd "$PACKAGE_DIR" && sha256sum -c SHA256SUMS.txt) || stop "فشل تطابق SHA256؛ لا ترفع الحزمة."
python3 - "$PACKAGE_DIR" <<'PY_WHITESPACE'
from pathlib import Path
import sys
root=Path(sys.argv[1])
text_ext={'.md','.txt','.yml','.yaml','.json','.js','.mjs','.sh','.sql','.java','.toml','.html','.css','.xml'}
issues=[]
for path in root.rglob('*'):
    if not path.is_file() or (path.suffix.lower() not in text_ext and path.name != '.gitignore'):
        continue
    data=path.read_bytes()
    if b'\0' in data:
        continue
    try: data.decode('utf-8')
    except UnicodeDecodeError: continue
    for line_no,line in enumerate(data.splitlines(),1):
        if line.endswith((b' ',b'\t')):
            issues.append(f'{path.relative_to(root)}:{line_no}')
if issues:
    raise SystemExit('Trailing whitespace must be removed before upload: '+', '.join(issues[:30]))
print('SOURCE_TRAILING_WHITESPACE=PASS')
PY_WHITESPACE
for file in \
  package.json package-lock.json index.html manifest.json sw.js icon.png capacitor.config.json \
  scripts/android/AlwahaAudioRoutePlugin.java scripts/reconciliation-audit.mjs \
  scripts/marketplace-column-audit.mjs \
  supabase/migrations/20261102150000_products_seller_email_privacy.sql \
  supabase/tests/20261102170000_marketplace_nonfriend_conversation.sql \
  docs/CONTINUITY-STATE-20261102-R7.3-AR.md \
  docs/REQUIREMENTS-TRACKER-20261102-R7.3-AR.md; do
  [ -s "$PACKAGE_DIR/$file" ] || stop "ملف أساسي مفقود: $file"
done

say "2. حارس هوية التطبيق وبيئة البناء"
node - "$PACKAGE_DIR" <<'NODE_BLOCK'
const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2];
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const cap=JSON.parse(fs.readFileSync(path.join(root,'capacitor.config.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
if(pkg.version!=='3.0.2'||manifest.version!=='3.0.2') throw new Error('Version mismatch.');
if(cap.appId!=='pro.alwaha.app'||cap.appName!=='Alwaha-Pro'||cap.webDir!=='dist') throw new Error('Application identity mismatch.');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/build-apk-aab-release.yml'),'utf8');
if(!workflow.includes('alwaha-pro-3.0.2-release-r7.3-20261102')) throw new Error('R7.3 build-only branch is not wired.');
if(!workflow.includes('npm run audit:reconciliation')) throw new Error('Reconciliation audit is not wired into CI.');
const pages=fs.readFileSync(path.join(root,'.github/workflows/pages-web-300.yml'),'utf8');
if(/^\s*push:/m.test(pages)||/deploy-pages|actions\/deploy-pages/i.test(pages)) throw new Error('Unexpected automatic website deployment workflow.');
const migrationGuard=fs.readFileSync(path.join(root,'.github/workflows/supabase-migrations.yml'),'utf8');
if(!migrationGuard.includes('will not run supabase db push')||!migrationGuard.includes('20261011184718_alwaha_profile_privacy_clean_start.sql')||!migrationGuard.includes('20261011184813_verification_request_profile_requirements.sql')) throw new Error('Historical migration safety guard missing.');
const mesh=fs.readFileSync(path.join(root,'index.html'),'utf8')+fs.readFileSync(path.join(root,'games.js'),'utf8');
if(/toggleFreeMeshShareSystem|free-mode-toggle-main-btn|local-share-file-btn|radar-live-results|free-section/.test(mesh)) throw new Error('Obsolete local share feature unexpectedly reappeared.');
console.log('APP_IDENTITY=PASS');
console.log('R7_3_BUILD_ONLY_WORKFLOW=PASS');
console.log('NO_AUTO_DEPLOY=PASS');
console.log('SUPABASE_HISTORY_GUARD=PASS');
console.log('LOCAL_MESH_SHARE_ABSENT=PASS');
NODE_BLOCK

say "3. فحص أدوات الرفع وتوثيق GitHub"
for command in git node python3 gh sha256sum; do
  command -v "$command" >/dev/null 2>&1 || stop "الأمر $command غير مثبت؛ ثبّت النواقص ثم أعد تشغيل السكربت."
done
gh auth status -h github.com >/dev/null 2>&1 || stop "سجّل الدخول أولاً: gh auth login -h github.com -p https -w"
gh auth setup-git >/dev/null

say "4. منع استبدال أي فرع موجود"
if git ls-remote --exit-code --heads "$REPO_URL" "$TARGET_BRANCH" >/dev/null 2>&1; then
  stop "الفرع $TARGET_BRANCH موجود بالفعل. لن نستبدله أو ندفع فوقه؛ افحصه أولاً."
fi

TMP="$(mktemp -d "$HOME/alwaha-3.0.2-r7.3-push-XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

say "5. جلب commit الأساس المعتمد"
git clone --quiet --no-checkout --filter=blob:none "$REPO_URL" "$TMP/repo"
git -C "$TMP/repo" fetch --quiet --depth 1 origin "$BASE_SHA"
git -C "$TMP/repo" checkout --quiet --detach "$BASE_SHA"
ACTUAL="$(git -C "$TMP/repo" rev-parse HEAD)"
[ "$ACTUAL" = "$BASE_SHA" ] || stop "نقطة الأساس غير مطابقة: $ACTUAL"
git -C "$TMP/repo" checkout --quiet -b "$TARGET_BRANCH"

say "6. استبدال شجرة المصدر بشجرة R7.3 النظيفة"
python3 - "$PACKAGE_DIR" "$TMP/repo" <<'PY_STAGING'
from pathlib import Path
import shutil,sys
source,target=Path(sys.argv[1]).resolve(),Path(sys.argv[2]).resolve()
if not (source/'package.json').is_file() or not (source/'index.html').is_file():
    raise SystemExit('STOP: R7.3 source root was not found.')
for item in list(target.iterdir()):
    if item.name == '.git': continue
    if item.is_dir(): shutil.rmtree(item)
    else: item.unlink()
excluded_root={'.git','node_modules','dist','ios','.gradle','android'}
for item in source.rglob('*'):
    rel=item.relative_to(source)
    # Exclude only generated root Android output; keep scripts/android native plugin.
    if rel.parts and rel.parts[0] in excluded_root: continue
    if len(rel.parts)>1 and rel.parts[0]=='admin-app' and rel.parts[1] in {'android','node_modules','dist'}: continue
    dest=target/rel
    if item.is_dir(): dest.mkdir(parents=True,exist_ok=True)
    elif item.is_file():
        dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(item,dest)
if not (target/'scripts/android/AlwahaAudioRoutePlugin.java').is_file():
    raise SystemExit('STOP: scripts/android native plugin was omitted.')
if not (target/'TERMUX-PUSH-3.0.2-R7.3-20261102.sh').is_file():
    raise SystemExit('STOP: R7.3 uploader was omitted from its own source tree.')
PY_STAGING

say "7. التحقق النهائي من الملف staged دون تعديل محتوى المصدر"
(cd "$TMP/repo" && sha256sum -c SHA256SUMS.txt >/dev/null) || stop "ملفات المصدر staged لا تطابق SHA256SUMS.txt."
git -C "$TMP/repo" add -A
git -C "$TMP/repo" diff --cached --check || stop "فشل git diff --cached --check؛ لم يحدث push."
git -C "$TMP/repo" diff --cached --quiet && stop "لا توجد تغييرات لرفعها."

say "8. إنشاء commit مستقل"
git -C "$TMP/repo" -c user.name='Alwaha-Pro Release Bot' -c user.email='release-bot@users.noreply.github.com' commit -m "Prepare Alwaha-Pro 3.0.2 release candidate R7.3"
NEW_SHA="$(git -C "$TMP/repo" rev-parse HEAD)"

say "9. رفع R7.3 لبدء CI build-only"
if git ls-remote --exit-code --heads "$REPO_URL" "$TARGET_BRANCH" >/dev/null 2>&1; then
  stop "ظهر الفرع على الخادم قبل push؛ أوقفنا العملية لتجنب استبداله."
fi
git -C "$TMP/repo" push -u origin "$TARGET_BRANCH"

printf '\nRELEASE_BRANCH=%s\n' "$TARGET_BRANCH"
printf 'RELEASE_COMMIT=%s\n' "$NEW_SHA"
printf 'BUILD_ONLY_ACTIONS=https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions\n'
printf 'PRODUCTION_DATABASE_CHANGED=no\n'
printf 'WEBSITE_PUBLISHED=no\n'
printf 'MAIN_BRANCH_CHANGED=no\n'
printf 'NEXT=انتظر نتيجة GitHub Actions لهذا الـcommit؛ لا تطبق migrations على الإنتاج.\n'
