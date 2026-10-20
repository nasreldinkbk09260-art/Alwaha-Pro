import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const nodeModules = path.join(root, 'node_modules');
const assets = path.join(root, 'assets', 'vendor');
const ensure = (p) => fs.mkdirSync(p, { recursive: true });
const copy = (source, target) => {
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error(`Missing vendor source file: ${path.relative(root, source)}`);
  ensure(path.dirname(target));
  fs.copyFileSync(source, target);
};
const copyDirMerge = (source, target) => {
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) throw new Error(`Missing vendor source directory: ${path.relative(root, source)}`);
  ensure(target);
  fs.cpSync(source, target, { recursive: true, force: true });
};

const faRoot = path.join(nodeModules, '@fortawesome', 'fontawesome-free');
const cairoRoot = path.join(nodeModules, '@fontsource', 'cairo');
const supaRoot = path.join(nodeModules, '@supabase', 'supabase-js');
const supaCandidates = [
  path.join(supaRoot, 'dist', 'umd', 'supabase.js'),
  path.join(supaRoot, 'dist', 'umd', 'supabase.min.js'),
  path.join(supaRoot, 'dist', 'umd', 'index.js')
];
const supaSource = supaCandidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
if (!fs.existsSync(path.join(faRoot, 'css', 'all.min.css'))) throw new Error('Font Awesome pinned CSS file is missing.');
if (!fs.existsSync(path.join(faRoot, 'webfonts'))) throw new Error('Font Awesome webfonts directory is missing.');
if (!fs.existsSync(path.join(cairoRoot, 'files'))) throw new Error('Cairo font package files directory is missing.');
if (!supaSource) throw new Error('No classic-browser UMD bundle found for @supabase/supabase-js. CDN links were left intact.');

const faCssOut = path.join(assets, 'fontawesome', 'css', 'all.min.css');
const faFontsOut = path.join(assets, 'fontawesome', 'webfonts');
copy(path.join(faRoot, 'css', 'all.min.css'), faCssOut);
copyDirMerge(path.join(faRoot, 'webfonts'), faFontsOut);
const cairoOut = path.join(assets, 'cairo');
for (const weight of ['300', '400', '600', '700', '900']) copy(path.join(cairoRoot, `${weight}.css`), path.join(cairoOut, `${weight}.css`));
copyDirMerge(path.join(cairoRoot, 'files'), path.join(cairoOut, 'files'));
const supaOut = path.join(assets, 'supabase', 'supabase.js');
copy(supaSource, supaOut);

const vendorFiles = new Set([
  './assets/vendor/fontawesome/css/all.min.css',
  './assets/vendor/supabase/supabase.js',
  ...['300','400','600','700','900'].map((w) => `./assets/vendor/cairo/${w}.css`)
]);
function addCssDependencies(cssPath, publicPrefix) {
  const text = fs.readFileSync(cssPath, 'utf8');
  const cssDir = path.dirname(cssPath);
  for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('data:') || raw.startsWith('http:') || raw.startsWith('https:') || raw.startsWith('//')) continue;
    const local = path.resolve(cssDir, raw);
    if (!local.startsWith(path.resolve(assets) + path.sep) || !fs.existsSync(local) || !fs.statSync(local).isFile()) continue;
    vendorFiles.add('./' + path.relative(root, local).split(path.sep).join('/'));
  }
}
addCssDependencies(faCssOut, './assets/vendor/fontawesome');
for (const weight of ['300','400','600','700','900']) addCssDependencies(path.join(cairoOut, `${weight}.css`), './assets/vendor/cairo');
const precacheListPath = path.join(assets, 'precache-list.json');
ensure(path.dirname(precacheListPath));
fs.writeFileSync(precacheListPath, JSON.stringify([...vendorFiles].sort(), null, 2) + '\n');
console.log(`Vendor assets prepared (${vendorFiles.size} offline resources).`);
console.log(`Supabase classic bundle source: ${path.relative(root, supaSource)}`);
