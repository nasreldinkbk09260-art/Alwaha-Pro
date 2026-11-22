import fs from 'node:fs';

const files = {
  html: 'index.html',
  nativeAudio: 'scripts/android/AlwahaAudioRoutePlugin.java',
  workflow: '.github/workflows/build-apk-aab-release.yml',
  homeAudit: 'scripts/home-section-acceptance.mjs',
  fieldAudit: 'scripts/field-repair-audit.mjs'
};
const source = Object.fromEntries(Object.entries(files).map(([key, file]) => {
  if (!fs.existsSync(file)) throw new Error(`Missing required source: ${file}`);
  return [key, fs.readFileSync(file, 'utf8')];
}));
const forbidden = [
  ['app-share UI', /share-app-btn-main|shareAlwahaApp/],
  ['native APK-share method', /shareApk\s*\(/],
  ['APK FileProvider build injection', /alwaha-fileprovider|alwaha_file_paths|shared_apk|FileProvider/]
];
let failed = 0;
for (const [label, pattern] of forbidden) {
  const offenders = Object.entries(source).filter(([name, content]) => ['html','nativeAudio','workflow'].includes(name) && pattern.test(content)).map(([name]) => name);
  if (offenders.length) { failed++; console.error(`FAIL: ${label} returned in ${offenders.join(', ')}`); }
  else console.log(`PASS: ${label} remains removed`);
}
if (!source.homeAudit.includes('app-share UI and native APK share method remain removed') ||
    !source.fieldAudit.includes('deprecated app-share UI and native APK-sharing path remain absent')) {
  failed++;
  console.error('FAIL: regression tests do not enforce the removal');
} else console.log('PASS: regression tests prevent app-share reintroduction');
if (failed) process.exit(1);
console.log('APP_SHARE_REMOVAL_AUDIT=PASS');
