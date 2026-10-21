import fs from "node:fs";
import process from "node:process";

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const pass = (message) => console.log(`PASS: ${message}`);
const read = (p) => {
  if (!fs.existsSync(p)) {
    fail(`Missing file: ${p}`);
    return "";
  }
  return fs.readFileSync(p, "utf8");
};
const json = (p) => {
  try { return JSON.parse(read(p)); }
  catch (e) { fail(`Invalid JSON ${p}: ${e.message}`); return {}; }
};

const pkg = json("package.json");
const lock = json("package-lock.json");
const manifest = json("manifest.json");
const html = read("index.html");
const sw = read("sw.js");
const workflow = read(".github/workflows/build-apk-aab-release.yml");

if (pkg.version === "3.0.1") pass("package version is 3.0.1");
else fail(`package version is ${pkg.version}`);

if (lock.version === "3.0.1" && lock.packages?.[""]?.version === "3.0.1")
  pass("package-lock root versions match 3.0.1");
else fail("package-lock version mismatch");

if (manifest.version === "3.0.1") pass("manifest version is 3.0.1");
else fail("manifest version mismatch");

if (/<title>Alwaha-Pro 3\.0\.1<\/title>/i.test(html) &&
    /currentAppVersion\s*=\s*["']3\.0\.1["']/.test(html))
  pass("HTML title and currentAppVersion match 3.0.1");
else fail("HTML release version mismatch");

if (/CACHE_NAME\s*=\s*['"]alwaha-pro-v3\.0\.1-mobile-performance['"]/.test(sw))
  pass("service worker uses the 3.0.1 cache namespace");
else fail("service worker cache namespace mismatch");

if (html.includes("3.0.1 mobile performance guard") &&
    /pointer:\s*coarse/.test(html) && /max-width:\s*768px/.test(html))
  pass("mobile performance CSS guard is present");
else fail("mobile performance CSS guard missing or incomplete");

if (/APP_VERSION:\s*['"]3\.0\.1['"]/.test(workflow) &&
    /VERSION_NAME:\s*['"]3\.0\.1['"]/.test(workflow))
  pass("workflow version variables match 3.0.1");
else fail("workflow version variables mismatch");

if (workflow.includes("Alwaha-Pro-3.0.1.apk") &&
    workflow.includes("Alwaha-Pro-3.0.1.aab"))
  pass("workflow output names match 3.0.1");
else fail("workflow APK/AAB output names mismatch");

if (workflow.includes("npm run audit:performance"))
  pass("workflow invokes performance audit");
else fail("workflow does not invoke performance audit");

if (pkg.scripts?.["audit:performance"] === "node scripts/performance-audit.mjs")
  pass("performance audit npm script is registered");
else fail("performance audit npm script missing");


// Guard against deleting caches owned by unrelated applications.
if (
  /const\s+appCacheNames\s*=\s*names\.filter\s*\(\s*name\s*=>\s*name\.startsWith\(['"]alwaha-pro-['"]\)\s*\)/s.test(html) &&
  /appCacheNames\.map\s*\(\s*name\s*=>\s*caches\.delete\(name\)\s*\)/s.test(html) &&
  !/Promise\.all\s*\(\s*names\.map\s*\(\s*name\s*=>\s*caches\.delete\(name\)\s*\)\s*\)/s.test(html)
) {
  pass("cache cleanup is restricted to the alwaha-pro- namespace");
} else {
  fail("cache cleanup must delete only alwaha-pro- caches");
}


// Guard against updating service workers owned by unrelated applications.
if (
  /const\s+appWorkerUrl\s*=\s*new URL\(['"]\.\/sw\.js['"],\s*window\.location\.href\)\.href/.test(html) &&
  /const\s+appRegs\s*=\s*regs\.filter/.test(html) &&
  /appRegs\.map\s*\(\s*async\s*\(reg\)/s.test(html) &&
  !/Promise\.all\s*\(\s*regs\.map\s*\(\s*async\s*\(reg\)/s.test(html)
) {
  pass("service-worker cleanup is restricted to the app's ./sw.js registration");
} else {
  fail("service-worker cleanup must target only the app's ./sw.js registration");
}

console.log("\n===== STORAGE USAGE INVENTORY (read-only) =====");
const files = ["index.html", "sw.js"];
for (const file of files) {
  const content = read(file);
  for (const [label, regex] of [
    ["localStorage", /\blocalStorage\b/g],
    ["sessionStorage", /\bsessionStorage\b/g],
    ["IndexedDB", /\bindexedDB\b/g],
    ["Cache API", /\bcaches\.(?:open|match|keys|delete)\b/g],
    ["service worker registration", /serviceWorker\.register/g],
  ]) {
    const count = [...content.matchAll(regex)].length;
    if (count) console.log(`${file}: ${label} references = ${count}`);
  }
}
console.log("Inventory is a text scan only; it does not prove runtime data safety.");
if (process.exitCode) process.exit(process.exitCode);
