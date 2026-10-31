import fs from 'node:fs';
import process from 'node:process';
import vm from 'node:vm';
const fail = (message) => { console.error('FAIL:', message); process.exitCode = 1; };
const pass = (message) => console.log('PASS:', message);
const read = (file) => { if (!fs.existsSync(file)) { fail(`Missing ${file}`); return ''; } return fs.readFileSync(file, 'utf8'); };
const html = read('index.html');
const compat = read('compatibility.js');
const polish = read('production-polish.js');
const sw = read('sw.js');
const build = read('scripts/build-web.mjs');
const workflow = read('.github/workflows/build-apk-aab-release.yml');
for (const [label, condition] of [
  ['compatibility module loaded by index.html', html.includes('./compatibility.js')],
  ['local feature scoring is defined', compat.includes('function snapshot()') && compat.includes('weight: 20')],
  ['compatibility percentage is rendered', compat.includes('alwaha-compat-score')],
  ['optimization is local-only', compat.includes('No device report or capability data is uploaded') && /function localOptimize\(/.test(compat) && compat.includes('alwaha_compat_lite_v1')],
  ['unsupported Android native baseline is reported', compat.includes('report.os < 7') && compat.includes('report.nativeSupported')],
  ['missing feature summary is shown', compat.includes('ميزات قد لا تعمل بالكامل على هذا الجهاز')],
  ['registration button has duplicate-submit guard', polish.includes('registrationInFlight')],
  ['registration button displays progress state', polish.includes('جاري إنشاء الحساب...') && polish.includes('aria-busy')],
  ['API timeout includes response body parsing', html.includes('const requestPromise = (async () =>') && html.includes('Alwaha request timed out')],
  ['old WebView without AbortController has bounded request wait', html.includes("typeof AbortController === 'function' ? new AbortController() : null")],
  ['home feed auth lookup has deadline', html.includes('alwahaUiDeadline(getCurrentAuthUser(), 1400, null)')],
  ['native app install banner is suppressed', html.includes('const androidWebView =') && html.includes('nativeCapacitor || nativeScheme || androidWebView')],
  ['build includes compatibility module', build.includes("'compatibility.js'")],
  ['service worker precaches compatibility module', sw.includes("'./compatibility.js'")],
  ['service worker cache namespace changed', sw.includes('compatibility-20261031')],
  ['CI runs compatibility audit', workflow.includes('npm run audit:compatibility')]
]) condition ? pass(label) : fail(label);
const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
let inlineCount = 0;
for (const match of html.matchAll(scriptPattern)) {
  const attrs = match[1] || '';
  if (/\bsrc\s*=/.test(attrs)) continue;
  const type = (attrs.match(/\btype\s*=\s*[\"']([^\"']+)/i) || [,''])[1].toLowerCase();
  if (type && !['text/javascript','application/javascript'].includes(type)) continue;
  const source = match[2] || '';
  if (!source.trim()) continue;
  try { new vm.Script(source, { filename: `index.html:inline-${inlineCount + 1}` }); inlineCount++; }
  catch (error) { fail(`Inline script syntax error (${inlineCount + 1}): ${error.message}`); }
}
if (inlineCount < 1) fail('No inline application JavaScript blocks were syntax-checked.');
else pass(`all ${inlineCount} inline JavaScript blocks parse successfully`);
if (process.exitCode) process.exit(1);
console.log('Alwaha compatibility repair audit passed.');
