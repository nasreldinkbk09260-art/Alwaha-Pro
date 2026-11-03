#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

REPO_URL="https://github.com/nasreldinkbk09260-art/Alwaha-Pro.git"
BASE_BRANCH="alwaha-pro-3.0.2-release-r7.4-20261102"
BASE_SHA="942bb5fc1a32080a07ed9a8cd8dfcf97311778af"
TARGET_BRANCH="alwaha-pro-3.0.2-release-r7.4.2-20261103"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE="$HOME/Documents/Alwaha-Pro-3.0.2-R7.4.2-worktree-20261103"

stop(){ echo "STOP: $*" >&2; exit 1; }

cd "$SOURCE_DIR"
echo "===== 1. VERIFY SOURCE CHECKSUMS ====="
[ -s SHA256SUMS.txt ] || stop "SHA256SUMS.txt missing"
sha256sum -c SHA256SUMS.txt || stop "source checksum validation failed"
[ -s scripts/android/AlwahaAudioRoutePlugin.java ] || stop "native audio route plugin missing"
[ -s alwaha-theme-system.css ] || stop "seasonal theme stylesheet missing"
for image in spring summer autumn winter; do
  [ -s "assets/backgrounds/bg-${image}.webp" ] || stop "seasonal image missing: $image"
done

node --check sw.js
node --check alwaha-experience.js
node --check alwaha-modal-shell.js
node --check alwaha-runtime-guard.js
node --check scripts/runtime-boot-audit.mjs
node --check scripts/theme-runtime-test.mjs
node --check scripts/release-preflight.mjs
node --check scripts/reconciliation-audit.mjs

# All static audits run before creating or pushing a release branch.
npm run audit:release
npm run audit:performance
npm run audit:chat
npm run audit:compatibility
npm run audit:native-call-ui
npm run audit:field-repair
npm run audit:ui
npm run audit:retention-kids-vault
npm run audit:admin
npm run audit:marketplace-columns
npm run audit:reconciliation
npm run audit:fullscreen-ui
npm run audit:runtime
npm run audit:themes

echo
echo "===== 2. GITHUB AUTH AND BRANCH SAFETY ====="
gh auth status || stop "GitHub CLI is not authenticated"
gh auth setup-git
[ ! -e "$WORKTREE" ] || stop "worktree already exists; refusing to overwrite: $WORKTREE"

REMOTE_TARGET="$(git ls-remote --heads "$REPO_URL" "refs/heads/$TARGET_BRANCH" | awk 'NR==1{print $1}')"
[ -z "$REMOTE_TARGET" ] || stop "target branch already exists ($REMOTE_TARGET); no overwrite or force-push allowed"

mkdir -p "$(dirname "$WORKTREE")"
git clone --single-branch --branch "$BASE_BRANCH" "$REPO_URL" "$WORKTREE"
cd "$WORKTREE"
ACTUAL_BASE="$(git rev-parse HEAD)"
[ "$ACTUAL_BASE" = "$BASE_SHA" ] || stop "remote base differs from reviewed R7.4.1 commit: $ACTUAL_BASE"
git switch -c "$TARGET_BRANCH"

# Copy the fully reviewed source tree over the matching R7.4.1 base.
# No files are deleted from the remote repository; all source and native assets are retained.
cp -a "$SOURCE_DIR/." "$WORKTREE/"

# Archive the superseded R7.4 uploader instead of leaving two runnable root scripts.
if [ -f "$WORKTREE/TERMUX-PUSH-3.0.2-R7.4-20261102.sh" ]; then
  rm -f "$WORKTREE/TERMUX-PUSH-3.0.2-R7.4-20261102.sh"
fi

# The copy must still preserve the Android audio plugin, app identity, and build-only policy.
[ -s scripts/android/AlwahaAudioRoutePlugin.java ] || stop "native plugin was lost during copy"
grep -q 'pro.alwaha.app' capacitor.config.json || stop "unexpected Android app identity"
grep -q 'alwaha-pro-3.0.2-release-r7.4.2-20261103' .github/workflows/build-apk-aab-release.yml || stop "R7.4.2 build trigger missing"
! grep -R -E 'toggleFreeMeshShareSystem|free-mode-toggle-main-btn|openAlwahaLocalNetworkPanel' index.html >/dev/null || stop "obsolete local-network entry point reappeared"

node --check sw.js
node --check alwaha-experience.js
node --check alwaha-modal-shell.js
node --check alwaha-runtime-guard.js
node --check scripts/runtime-boot-audit.mjs
node --check scripts/theme-runtime-test.mjs
npm run audit:release
npm run audit:runtime
npm run audit:themes

git add -A
git diff --cached --check
echo
echo "===== 3. COMMIT AND PUSH NEW BUILD-ONLY BRANCH ====="
git commit -m "Fix WebView mutation loop and integrate seasonal themes R7.4.2"
git push -u origin "$TARGET_BRANCH"

echo
echo "===== 4. FINAL STATUS ====="
git status --short --branch
echo "RELEASE_BRANCH=$TARGET_BRANCH"
echo "RELEASE_COMMIT=$(git rev-parse HEAD)"
echo "BUILD_ONLY_ACTIONS=https://github.com/nasreldinkbk09260-art/Alwaha-Pro/actions"
echo "PRODUCTION_DATABASE_CHANGED=no"
echo "WEBSITE_PUBLISHED=no"
echo "MAIN_BRANCH_CHANGED=no"
echo "NEXT=تحقق من نجاح Actions لهذا الـcommit ثم ثبّت APK فوق النسخة الحالية دون إزالة التطبيق أو مسح بياناته."
