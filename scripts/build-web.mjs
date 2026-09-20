import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const required = ['index.html', 'manifest.json', 'sw.js', 'icon.png'];

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

console.log(`Web build complete: ${required.join(', ')} -> dist/`);
