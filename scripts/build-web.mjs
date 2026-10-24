import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const dist = path.join(root, 'dist');
const required = ['index.html', 'manifest.json', 'sw.js', 'icon.png', 'games.js', 'production-polish.js'];

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
console.log(`Web build complete: ${required.join(', ')}, alwaha-native-back-handler.js -> dist/`);
