import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const packageName = 'pro.alwaha.localtest';
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'alwaha-local-crypto-'));
const packageDirectory = path.join(temporaryRoot, ...packageName.split('.'));
fs.mkdirSync(packageDirectory, { recursive: true });

try {
  const sourceFiles = [
    'scripts/android/AlwahaLocalSessionCrypto.java',
    'scripts/android/AlwahaLocalSessionCryptoTest.java'
  ];
  const generated = sourceFiles.map((sourcePath) => {
    const source = fs.readFileSync(path.join(root, sourcePath), 'utf8')
      .replaceAll('__ALWAHA_PACKAGE__', packageName);
    if (source.includes('__ALWAHA_PACKAGE__')) throw new Error('Unresolved Java package placeholder in ' + sourcePath + '.');
    const destination = path.join(packageDirectory, path.basename(sourcePath));
    fs.writeFileSync(destination, source, 'utf8');
    return destination;
  });

  const compile = spawnSync('javac', ['-Xlint:all', '-d', temporaryRoot, ...generated], { encoding: 'utf8' });
  if (compile.error) throw compile.error;
  if (compile.status !== 0) {
    process.stderr.write(compile.stdout || '');
    process.stderr.write(compile.stderr || '');
    process.exitCode = compile.status || 1;
  } else {
    const run = spawnSync('java', ['-ea', '-cp', temporaryRoot, packageName + '.AlwahaLocalSessionCryptoTest'], { encoding: 'utf8' });
    if (run.error) throw run.error;
    process.stdout.write(run.stdout || '');
    if (run.status !== 0) {
      process.stderr.write(run.stderr || '');
      process.exitCode = run.status || 1;
    }
  }
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
