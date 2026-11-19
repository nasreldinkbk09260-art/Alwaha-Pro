import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const plugin = read('scripts/android/AlwahaLocalNetworkPlugin.java');
const crypto = read('scripts/android/AlwahaLocalSessionCrypto.java');
const cryptoTest = read('scripts/android/AlwahaLocalSessionCryptoTest.java');
const cryptoRunner = read('scripts/local-network-crypto-runtime-test.mjs');
const bridge = read('scripts/native-back-handler.mjs');
const workflow = read('.github/workflows/build-apk-aab-release.yml');
const pkg = JSON.parse(read('package.json'));
const html = read('index.html');

const checks = [
  ['native Capacitor plugin uses the stable AlwahaLocalNetwork registration name', /@CapacitorPlugin\(\s*name\s*=\s*"AlwahaLocalNetwork"/.test(plugin)],
  ['plugin declares Android 13+ Nearby Wi-Fi and Bluetooth runtime permission aliases', plugin.includes('Manifest.permission.NEARBY_WIFI_DEVICES') && plugin.includes('Manifest.permission.BLUETOOTH_SCAN') && plugin.includes('Manifest.permission.BLUETOOTH_CONNECT') && !plugin.includes('Manifest.permission.BLUETOOTH_ADVERTISE')],
  ['plugin preserves the legacy location permission path below Android 13', plugin.includes('legacyLocation') && plugin.includes('Build.VERSION.SDK_INT >= 33') && plugin.includes('Build.VERSION.SDK_INT >= 31')],
  ['Wi-Fi Direct discovery uses WifiP2pManager and checks the system location-mode requirement', plugin.includes('WifiP2pManager') && plugin.includes('discoverPeers') && plugin.includes('isLocationModeEnabled()')],
  ['Bluetooth classic discovery uses the Android adapter and bounded scan lifecycle', plugin.includes('BluetoothAdapter') && plugin.includes('startDiscovery()') && plugin.includes('DISCOVERY_TIMEOUT_MS') && plugin.includes('cancelDiscovery()')],
  ['discovered peers are explicitly unverified pending a separate pairing handshake', plugin.includes('authenticationRequired') && plugin.includes('verified", false')],
  ['discovery stage does not claim local chat, file or call transport is ready', plugin.includes('"phase", "discovery-only"') && plugin.includes('"transportReady", false') && plugin.includes('"chatReady", false') && plugin.includes('"fileTransferReady", false') && plugin.includes('"callMediaReady", false')],
  ['native JavaScript bridge registers AlwahaLocalNetwork separately from audio routing', bridge.includes("registerPlugin('AlwahaLocalNetwork')") && bridge.includes('window.alwahaLocalNetwork')],
  ['native plugin opens user-controlled Wi-Fi, Bluetooth and mobile data settings instead of silently toggling radios',plugin.includes('openWifiSettings')&&plugin.includes('Settings.Panel.ACTION_WIFI')&&plugin.includes('openBluetoothSettings')&&plugin.includes('Settings.ACTION_BLUETOOTH_SETTINGS')&&plugin.includes('openMobileDataSettings')&&plugin.includes('Settings.ACTION_DATA_USAGE_SETTINGS')&&plugin.includes('automaticToggleSupported", false')],
  ['nearby discovery modal exposes the three system settings actions with explicit user consent',html.includes('data-open-wifi')&&html.includes('data-open-bluetooth')&&html.includes('data-open-mobile-data')&&html.includes('openAlwahaLocalSystemSettings')],

  ['Android build validates and generates the local network plugin and crypto templates', workflow.includes('test -s scripts/android/AlwahaLocalNetworkPlugin.java') && workflow.includes('test -s scripts/android/AlwahaLocalSessionCrypto.java') && workflow.includes("for plugin_name in ('AlwahaAudioRoutePlugin', 'AlwahaLocalNetworkPlugin', 'AlwahaLocalSessionCrypto'):") && workflow.includes("template_path = Path('scripts/android') / f'{plugin_name}.java'") && workflow.includes("template.replace('__ALWAHA_PACKAGE__', package_match.group(1))")],
  ['crypto core uses ephemeral P-256 ECDH and a transcript-bound HKDF-SHA-256 schedule', crypto.includes('secp256r1') && crypto.includes('KeyAgreement.getInstance("ECDH")') && crypto.includes('hkdfSha256(sharedSecret, salt, info, 104)') && crypto.includes('buildTranscript(lowPublicKey, lowNonce, highPublicKey, highNonce)')],
  ['crypto core derives independent directional AES-256-GCM keys and nonce prefixes', crypto.includes('lowToHighKey') && crypto.includes('highToLowKey') && crypto.includes('sendNoncePrefix') && crypto.includes('receiveNoncePrefix') && crypto.includes('AES/GCM/NoPadding')],
  ['pairing code and explicit acceptance tokens are bound to the same session transcript', crypto.includes('comparisonCode()') && crypto.includes('acceptanceToken()') && crypto.includes('verifyPeerAcceptance(byte[] peerToken)') && crypto.includes('MessageDigest.isEqual(expected, peerToken)')],
  ['encrypted frames authenticate protocol/type/sequence/transfer id and reject replay or out-of-order frames', crypto.includes('frameAad(type, transferId, sequence)') && crypto.includes('frame.sequence != receiveSequence + 1') && crypto.includes('MessageDigest.isEqual(expectedNonce, frame.nonce)') && crypto.includes('MAX_FILE_CHUNK_BYTES')],
  ['Java protocol tests cover two-peer agreement, tampering, replay, ordering, transfer binding and limits', cryptoTest.includes('both peers derive the same comparison code') && cryptoTest.includes('AES-GCM rejects modified ciphertext') && cryptoTest.includes('replayed frame sequence is rejected') && cryptoTest.includes('transfer identifier is authenticated as additional data') && cryptoRunner.includes("spawnSync('javac'") && cryptoRunner.includes("spawnSync('java'")],
  ['Android MainActivity registers both native plugins', workflow.includes('registerPlugin(AlwahaAudioRoutePlugin.class)') && workflow.includes('registerPlugin(AlwahaLocalNetworkPlugin.class)')],
  ['Android manifest adds Nearby Wi-Fi, Bluetooth and legacy declarations without adding broad location claims', workflow.includes('android.permission.NEARBY_WIFI_DEVICES') && workflow.includes('android.permission.BLUETOOTH_SCAN') && workflow.includes('android.permission.BLUETOOTH_CONNECT') && !workflow.includes('android.permission.BLUETOOTH_ADVERTISE') && workflow.includes('neverForLocation')],
  ['chat header exposes permission-gated nearby-device discovery', html.includes('onclick="openAlwahaLocalDiscovery()"') && html.includes('async function openAlwahaLocalDiscovery()') && html.includes('plugin.startDiscovery()') && html.includes("bind('peerDiscovered'")],
  ['native discovery status events use the exact state/detail payload contract emitted by Android', plugin.includes('payload.put("state", state)') && plugin.includes('payload.put("detail", detail)') && html.includes("const state=String(payload?.state||'')") && html.includes("const detail=String(payload?.detail||'')") && !html.includes("map[payload?.status]") && !html.includes("payload?.message||('حالة الاكتشاف:")],
  ['native discovery UI explains timeout and stop reasons without claiming a data transport', html.includes("if(state==='stopped')") && html.includes("detail==='timeout'") && html.includes('تم إيقاف البحث عن الأجهزة القريبة.') && html.includes('transportReady')===false],
  ['nearby discovery labels devices unverified and exposes no fake connect action', html.includes('verified:false,authenticationRequired:true') && html.includes('لا يوجد اتصال أو نقل بيانات') && !html.includes('data-local-connect')],
  ['native local network audit is part of the standard npm validation scripts', pkg.scripts['audit:local-network-native'] === 'node scripts/local-network-native-audit.mjs && node scripts/local-network-crypto-runtime-test.mjs']
];
let failed = 0;
for (const [label, ok] of checks) {
  console.log((ok ? 'PASS: ' : 'FAIL: ') + label);
  if (!ok) failed++;
}
if (failed) process.exitCode = 1;
else console.log('PASS: native local discovery foundation is registered, permission-scoped, and honestly marked transport-incomplete.');
