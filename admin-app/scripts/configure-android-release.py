#!/usr/bin/env python3
from pathlib import Path
import os
import re
import shutil

path = Path('android/app/build.gradle')
source = path.read_text(encoding='utf-8')


def matching_brace(text: str, opening: int) -> int:
    depth = 0
    quote = None
    escaped = False
    for index in range(opening, len(text)):
        char = text[index]
        if quote:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in ('"', "'"):
            quote = char
        elif char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                return index
    raise SystemExit('Unbalanced Gradle braces.')


def find_block(text: str, name: str, start: int = 0, end: int | None = None):
    end = len(text) if end is None else end
    match = re.search(r'(?m)^([ \t]*)' + re.escape(name) + r'\s*\{', text[start:end])
    if not match:
        return None
    absolute = start + match.start()
    opening = start + match.end() - 1
    closing = matching_brace(text, opening)
    if closing > end:
        raise SystemExit(f'{name} block extends beyond parent.')
    return absolute, opening, closing, match.group(1)


def require_block(text: str, name: str, parent=None):
    found = find_block(text, name, parent[1] + 1 if parent else 0, parent[2] if parent else None)
    if found is None:
        raise SystemExit(f'Missing Gradle block: {name}')
    return found


def set_property(text: str, block_name: str, prop: str, value: str, parent_name: str | None = 'android'):
    parent = require_block(text, parent_name) if parent_name else None
    block = require_block(text, block_name, parent)
    body_start, body_end = block[1] + 1, block[2]
    body = text[body_start:body_end]
    match = re.search(r'(?m)^([ \t]*)' + re.escape(prop) + r'\b[^\n]*', body)
    if match:
        replacement = f'{match.group(1)}{prop} = {value}'
        return text[:body_start + match.start()] + replacement + text[body_start + match.end():]
    insertion = f'\n{block[3]}    {prop} = {value}'
    return text[:block[1] + 1] + insertion + text[block[1] + 1:]


version_code = os.environ.get('VERSION_CODE', '')
if not version_code.isdigit() or int(version_code) < 1:
    raise SystemExit('VERSION_CODE must be a positive integer.')
loader = '''def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (!keystorePropertiesFile.exists()) throw new GradleException("Missing keystore properties")
keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
'''
if 'def keystorePropertiesFile' not in source:
    match = re.search(r'(?m)^[ \t]*android\s*\{', source)
    if not match:
        raise SystemExit('Android block not found.')
    source = source[:match.start()] + loader + '\n' + source[match.start():]

source = set_property(source, 'android', 'namespace', '"pro.alwaha.admin"', None)
source = set_property(source, 'defaultConfig', 'applicationId', '"pro.alwaha.admin"')
source = set_property(source, 'defaultConfig', 'versionCode', version_code)
source = set_property(source, 'defaultConfig', 'versionName', '"1.0.0"')
source = set_property(source, 'defaultConfig', 'targetSdkVersion', '36')

android = require_block(source, 'android')
signing = find_block(source, 'signingConfigs', android[1] + 1, android[2])
if signing is None:
    signing_text = '''
signingConfigs {
    release {
        storeFile file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
    }
}
'''
    source = source[:android[1] + 1] + signing_text + source[android[1] + 1:]

android = require_block(source, 'android')
build_types = require_block(source, 'buildTypes', android)
release = find_block(source, 'release', build_types[1] + 1, build_types[2])
if release is None:
    raise SystemExit('Release build type not found.')
release_body = source[release[1] + 1:release[2]]
if not re.search(r'(?m)^\s*signingConfig\s+signingConfigs\.release\b', release_body):
    source = source[:release[1] + 1] + '\n                signingConfig signingConfigs.release' + source[release[1] + 1:]

path.write_text(source, encoding='utf-8')
icon=Path('dist/icon.png'); resources=Path('android/app/src/main/res')
(resources/'drawable-nodpi').mkdir(parents=True,exist_ok=True)
shutil.copy2(icon,resources/'drawable-nodpi/ic_admin_foreground.png')
for folder in resources.glob('mipmap-*'):
    if not folder.is_dir() or folder.name=='mipmap-anydpi-v26': continue
    for name in ('ic_launcher','ic_launcher_round'):
        for old in folder.glob(name+'.*'):
            if old.suffix.lower()!='.png': old.unlink()
        shutil.copy2(icon,folder/(name+'.png'))
adaptive=resources/'mipmap-anydpi-v26'; adaptive.mkdir(parents=True,exist_ok=True)
xml='''<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@android:color/black" />\n  <foreground android:drawable="@drawable/ic_admin_foreground" />\n</adaptive-icon>'''
(adaptive/'ic_launcher.xml').write_text(xml); (adaptive/'ic_launcher_round.xml').write_text(xml)
print('Configured pro.alwaha.admin, version 1.0.0, target API 36 and release signing.')
