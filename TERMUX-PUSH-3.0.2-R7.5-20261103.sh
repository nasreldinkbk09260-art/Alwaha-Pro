#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

# Alwaha-Pro 3.0.2 R7.5 source uploader; build-only, no production DB deployment.
REPO_URL="https://github.com/nasreldinkbk09260-art/Alwaha-Pro.git"
BASE_SHA="553e1c431a0cfb92112516533b746ba0a2976f4f"
TARGET_BRANCH="alwaha-pro-3.0.2-release-r7.5-20261103"
PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say(){ printf '\n===== %s =====\n' "$1"; }
stop(){ printf '\nSTOP: %s\n' "$1" >&2; exit 1; }

say "1. التحقق من بصمة ومحتويات R7.5"
[ -s "$PACKAGE_DIR/SHA256SUMS.txt" ] || stop "SHA256SUMS.txt مفقود."
(cd "$PACKAGE_DIR" && sha256sum -c SHA256SUMS.txt) || stop "فشل تحقق SHA256؛ لم يحدث رفع."
python3 - "$PACKAGE_DIR" <<'PY_WHITESPACE'
from pathlib import Path
import sys
root=Path(sys.argv[1]); ext={'.md','.txt','.yml','.yaml','.json','.js','.mjs','.sh','.sql','.java','.toml','.html','.css','.xml'}
issues=[]
for path in root.rglob('*'):
    if not path.is_file() or any(x in {'node_modules','dist','.git'} for x in path.parts) or (path.suffix.lower() not in ext and path.name!='.gitignore'): continue
    data=path.read_bytes()
    if b'\0' in data: continue
    try: data.decode('utf-8')
    except UnicodeDecodeError: continue
    for line_no,line in enumerate(data.splitlines(),1):
        if line.endswith((b' ',b'\t')): issues.append(f'{path.relative_to(root)}:{line_no}')
if issues: raise SystemExit('Trailing whitespace: '+', '.join(issues[:30]))
print('SOURCE_TRAILING_WHITESPACE=PASS')
PY_WHITESPACE
for file in \
  package.json package-lock.json index.html manifest.json sw.js icon.png capacitor.config.json \
  alwaha-experience.js alwaha-modal-shell.js alwaha-local-vault.js alwaha-kids-room.js \
  scripts/fullscreen-ui-audit.mjs scripts/theme-runtime-test.mjs scripts/android/AlwahaAudioRoutePlugin.java \
  supabase/migrations/20261101210000_marketplace_transaction_archive_and_call_auth.sql \
  supabase/migrations/20261102100000_marketplace_retention_policy_and_cleanup.sql \
  supabase/tests/20261102170000_marketplace_nonfriend_conversation.sql \
  docs/CHANGELOG-3.0.2-R7.5-AR.md docs/RELEASE-BLOCKERS-AR.md; do
  [ -s "$PACKAGE_DIR/$file" ] || stop "ملف أساسي مفقود: $file"
done

say "2. فحص هوية التطبيق والـworkflow"
node - "$PACKAGE_DIR" <<'NODE'
const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2];
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pkg=JSON.parse(read('package.json'));
const lock=JSON.parse(read('package-lock.json'));
const manifest=JSON.parse(read('manifest.json'));
const cap=JSON.parse(read('capacitor.config.json'));
if(pkg.version!=='3.0.2'||lock.packages?.['']?.version!=='3.0.2'||manifest.version!=='3.0.2')throw Error('Version mismatch.');
if(cap.appId!=='pro.alwaha.app'||cap.appName!=='Alwaha-Pro'||cap.webDir!=='dist')throw Error('Application identity mismatch.');
const workflow=read('.github/workflows/build-apk-aab-release.yml');
if(!workflow.includes('alwaha-pro-3.0.2-release-r7.5-20261103')||!workflow.includes('npm run audit:fullscreen-ui')||!workflow.includes('npm run audit:reconciliation'))throw Error('R7.5 workflow or audits are not wired.');
const pages=read('.github/workflows/pages-web-300.yml');
if(/^\s*push:/m.test(pages)||/deploy-pages|actions\/deploy-pages/i.test(pages))throw Error('Unexpected automatic website deployment.');
const guard=read('.github/workflows/supabase-migrations.yml');
if(!guard.includes('will not run supabase db push')||!guard.includes('20261011184718_alwaha_profile_privacy_clean_start.sql')||!guard.includes('20261011184813_verification_request_profile_requirements.sql'))throw Error('Supabase history guard missing.');
const html=read('index.html')+read('games.js');
if(/toggleFreeMeshShareSystem|free-mode-toggle-main-btn|local-share-file-btn|radar-live-results|free-section/.test(html))throw Error('Obsolete local-network sharing control has returned.');
if(!read('sw.js').includes("'./alwaha-modal-shell.js'"))throw Error('Modal isolation module is not precached.');
console.log('APP_IDENTITY=PASS');console.log('R7_5_BUILD_ONLY_WORKFLOW=PASS');console.log('NO_AUTO_DEPLOY=PASS');console.log('SUPABASE_HISTORY_GUARD=PASS');console.log('LOCAL_NETWORK_SHARE_ABSENT=PASS');
NODE

say "3. التحقق من أدوات GitHub"
for command in git node python3 gh sha256sum; do command -v "$command" >/dev/null 2>&1 || stop "الأمر $command غير مثبت."; done
gh auth status -h github.com >/dev/null 2>&1 || stop "سجّل الدخول أولاً: gh auth login -h github.com -p https -w"
gh auth setup-git >/dev/null

say "4. منع الكتابة فوق فرع سابق"
if git ls-remote --exit-code --heads "$REPO_URL" "$TARGET_BRANCH" >/dev/null 2>&1; then
  stop "الفرع $TARGET_BRANCH موجود بالفعل؛ لن نستبدله أو نعمل force-push."
fi
TMP="$(mktemp -d "$HOME/alwaha-3.0.2-r7.5-push-XXXXXX")"
cleanup(){ rm -rf "$TMP"; }
trap cleanup EXIT

say "5. استنساخ نقطة R7.3 المعتمدة"
git clone --quiet --no-checkout --filter=blob:none "$REPO_URL" "$TMP/repo"
git -C "$TMP/repo" fetch --quiet --depth 1 origin "$BASE_SHA"
git -C "$TMP/repo" checkout --quiet --detach "$BASE_SHA"
ACTUAL="$(git -C "$TMP/repo" rev-parse HEAD)"
[ "$ACTUAL" = "$BASE_SHA" ] || stop "نقطة الأساس لا تطابق R7.3: $ACTUAL"
git -C "$TMP/repo" checkout --quiet -b "$TARGET_BRANCH"

say "6. استبدال شجرة المصدر بنسخة R7.5 دون المساس بتاريخ Git"
python3 - "$PACKAGE_DIR" "$TMP/repo" <<'PY'
from pathlib import Path
import shutil,sys
source,target=Path(sys.argv[1]).resolve(),Path(sys.argv[2]).resolve()
if not (source/'package.json').is_file() or not (source/'index.html').is_file():
    raise SystemExit('R7.5 source root not found.')
for item in list(target.iterdir()):
    if item.name=='.git': continue
    if item.is_dir(): shutil.rmtree(item)
    else: item.unlink()
excluded={'node_modules','dist','ios','.gradle','android'}
for item in source.rglob('*'):
    rel=item.relative_to(source)
    if rel.parts and rel.parts[0] in excluded: continue
    if len(rel.parts)>1 and rel.parts[0]=='admin-app' and rel.parts[1] in {'android','node_modules','dist'}: continue
    dest=target/rel
    if item.is_dir(): dest.mkdir(parents=True,exist_ok=True)
    elif item.is_file():
        dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(item,dest)
required=['alwaha-modal-shell.js','scripts/android/AlwahaAudioRoutePlugin.java','TERMUX-PUSH-3.0.2-R7.5-20261103.sh','alwaha-theme-system.css','assets/backgrounds/bg-spring.webp','assets/backgrounds/bg-summer.webp','assets/backgrounds/bg-autumn.webp','assets/backgrounds/bg-winter.webp']
missing=[x for x in required if not (target/x).is_file()]
if missing: raise SystemExit('Missing staged release files: '+', '.join(missing))
PY

say "7. فحص نظافة الشجرة staged"
(cd "$TMP/repo" && sha256sum -c SHA256SUMS.txt >/dev/null) || stop "فشل التحقق من ملفات المصدر staged."
git -C "$TMP/repo" add -A
git -C "$TMP/repo" diff --cached --check || stop "فشل git diff --cached --check."
git -C "$TMP/repo" diff --cached --quiet && stop "لا توجد تغييرات لرفعها."

say "8. إنشاء commit R7.5 مستقل"
git -C "$TMP/repo" -c user.name='Alwaha-Pro Release Bot' -c user.email='release-bot@users.noreply.github.com' commit -m "Prepare Alwaha-Pro 3.0.2 release candidate R7.5"
NEW_SHA="$(git -C "$TMP/repo" rev-parse HEAD)"
if git ls-remote --exit-code --heads "$REPO_URL" "$TARGET_BRANCH" >/dev/null 2>&1; then stop "ظهر فرع R7.5 على الخادم قبل الرفع؛ أوقفنا لحماية الفرع."; fi
git -C "$TMP/repo" push -u origin "$TARGET_BRANCH"
printf '\nRELEASE_BRANCH=%s\nRELEASE_COMMIT=%s\n' "$TARGET_BRANCH" "$NEW_SHA"
printf 'ACTIONS=https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions\n'
printf 'PRODUCTION_DATABASE_CHANGED=no\nWEBSITE_PUBLISHED=no\nMAIN_BRANCH_CHANGED=no\n'
printf 'NEXT=لا تعتمد ZIP رسمياً حتى ينجح CI ثم يتم اختبار الهاتفين ومصالحة Supabase بأمان.\n'
