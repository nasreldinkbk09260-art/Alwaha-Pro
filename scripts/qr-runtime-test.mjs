import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { transform } from 'esbuild';

const read = (file) => fs.readFileSync(file, 'utf8');
const options = { loader: 'js', minify: true, target: ['es2018'], legalComments: 'none' };

// Reproduce the exact source transformation used by scripts/build-web.mjs.
const decoderSource = read('scripts/vendor/qr/jsQR.js');
const encoderSource = read('scripts/vendor/qr/qrcode-generator.js') +
  '\n; if (typeof window !== \'undefined\') window.qrcode = qrcode;\n';
const [decoder, encoder] = await Promise.all([
  transform(decoderSource, options),
  transform(encoderSource, options)
]);

const decoderWindow = {};
vm.runInNewContext(decoder.code, { self: decoderWindow, console }, { timeout: 5000 });
assert.equal(typeof decoderWindow.jsQR, 'function', 'jsQR must be exposed on the browser global');

const encoderWindow = {};
vm.runInNewContext(encoder.code, { window: encoderWindow, console }, { timeout: 5000 });
assert.equal(typeof encoderWindow.qrcode, 'function', 'qrcode generator must be exported to window after minification');

const payload = 'ALWAHA-GAME|1|chess|A2BCDE';
const qr = encoderWindow.qrcode(0, 'M');
qr.addData(payload);
qr.make();
const svg = qr.createSvgTag(5, 8, 'Alwaha-Pro game invite', 'Game room QR');
assert.ok(svg.startsWith('<svg'), 'QR encoder must create an SVG image');
assert.ok(svg.includes('viewBox=') && svg.includes('<path'), 'QR SVG must include vector modules and a viewBox');
assert.ok(svg.length > 500, 'QR SVG output must contain a complete matrix');
console.log('QR_RUNTIME_PASS: minified jsQR global, minified qrcode global, and room-invite SVG generation');
