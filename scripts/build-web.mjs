import fs from 'node:fs';
import path from 'node:path';
import { build, transform } from 'esbuild';

const root = process.cwd();
const dist = path.join(root, 'dist');
const required = ['index.html', 'manifest.json', 'sw.js', 'icon.png', 'games.js', 'production-polish.js', 'alwaha-call-feedback.js', 'compatibility.js', 'alwaha-local-vault.js', 'alwaha-experience.js', 'alwaha-modal-shell.js', 'alwaha-runtime-guard.js', 'alwaha-kids-room.js', 'alwaha-smart-assistant.js', 'alwaha-theme-system.css'];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Missing required web file: ${file}`);
  }
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const file of required) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

for (const folder of ['assets', 'images', 'img', 'media', 'fonts']) {
  const source = path.join(root, folder);
  if (fs.existsSync(source)) {
    fs.cpSync(source, path.join(dist, folder), { recursive: true });
  }
}

const qrVendorDir = path.join(root, 'scripts', 'vendor', 'qr');
const qrOutputDir = path.join(dist, 'assets', 'qr');
const qrVendors = [
  { source: 'jsQR.js', output: 'jsQR.min.js', license: 'LICENSE-jsQR-Apache-2.0.txt' },
  { source: 'qrcode-generator.js', output: 'qrcode-generator.min.js', license: 'LICENSE-qrcode-generator-MIT.txt' }
];
fs.mkdirSync(qrOutputDir, { recursive: true });
for (const vendor of qrVendors) {
  const source = path.join(qrVendorDir, vendor.source);
  const license = path.join(qrVendorDir, vendor.license);
  if (!fs.existsSync(source) || !fs.existsSync(license)) {
    throw new Error('Missing pinned offline QR vendor source or license: ' + vendor.source);
  }
  let sourceCode = fs.readFileSync(source, 'utf8');
  if (vendor.output === 'qrcode-generator.min.js') {
    sourceCode += '\n; if (typeof window !== \'undefined\') window.qrcode = qrcode;\n';
  }
  const result = await transform(sourceCode, {
    loader: 'js',
    minify: true,
    target: ['es2018'],
    legalComments: 'none'
  });
  fs.writeFileSync(path.join(qrOutputDir, vendor.output), result.code + '\n', 'utf8');
  fs.copyFileSync(license, path.join(qrOutputDir, vendor.license));
}
for (const output of ['jsQR.min.js', 'qrcode-generator.min.js']) {
  const target = path.join(qrOutputDir, output);
  if (!fs.existsSync(target) || fs.statSync(target).size < 1000) {
    throw new Error('Offline QR runtime asset was not generated: ' + output);
  }
}

const nativeBackEntry = path.join(root, 'scripts', 'native-back-handler.mjs');
if (!fs.existsSync(nativeBackEntry)) {
  throw new Error('Missing Android native back handler entry point.');
}
await build({
  entryPoints: [nativeBackEntry],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2020'],
  outfile: path.join(dist, 'alwaha-native-back-handler.js'),
  legalComments: 'none',
  logLevel: 'warning'
});
if (!fs.existsSync(path.join(dist, 'alwaha-native-back-handler.js'))) {
  throw new Error('Android native back handler bundle was not generated.');
}
console.log('Offline QR decoder and encoder minified into dist/assets/qr/.');
console.log(`Web build complete: ${required.join(', ')}, QR runtime and alwaha-native-back-handler.js -> dist/`);
