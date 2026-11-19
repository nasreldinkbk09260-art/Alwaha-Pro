import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const plugin = read('scripts/android/AlwahaLocalNetworkPlugin.java');
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
  ['Android build validates and generates the local network plugin template', workflow.includes('test -s scripts/android/AlwahaLocalNetworkPlugin.java') && workflow.includes("for plugin_name in ('AlwahaAudioRoutePlugin', 'AlwahaLocalNetworkPlugin'):") && workflow.includes("template_path = Path('scripts/android') / f'{plugin_name}.java'") && workflow.includes("template.replace('__ALWAHA_PACKAGE__', package_match.group(1))")],
  ['Android MainActivity registers both native plugins', workflow.includes('registerPlugin(AlwahaAudioRoutePlugin.class)') && workflow.includes('registerPlugin(AlwahaLocalNetworkPlugin.class)')],
  ['Android manifest adds Nearby Wi-Fi, Bluetooth and legacy declarations without adding broad location claims', workflow.includes('android.permission.NEARBY_WIFI_DEVICES') && workflow.includes('android.permission.BLUETOOTH_SCAN') && workflow.includes('android.permission.BLUETOOTH_CONNECT') && !workflow.includes('android.permission.BLUETOOTH_ADVERTISE') && workflow.includes('neverForLocation')],
  ['chat header exposes permission-gated nearby-device discovery', html.includes('onclick="openAlwahaLocalDiscovery()"') && html.includes('async function openAlwahaLocalDiscovery()') && html.includes('plugin.startDiscovery()') && html.includes("bind('peerDiscovered'")],
  ['native discovery status events use the exact state/detail payload contract emitted by Android', plugin.includes('payload.put("state", state)') && plugin.includes('payload.put("detail", detail)') && html.includes("const state=String(payload?.state||'')") && html.includes("const detail=String(payload?.detail||'')") && !html.includes("map[payload?.status]") && !html.includes("payload?.message||('حالة الاكتشاف:")],
  ['native discovery UI explains timeout and stop reasons without claiming a data transport', html.includes("if(state==='stopped')") && html.includes("detail==='timeout'") && html.includes('تم إيقاف البحث عن الأجهزة القريبة.') && html.includes('transportReady')===false],
  ['nearby discovery labels devices unverified and exposes no fake connect action', html.includes('verified:false,authenticationRequired:true') && html.includes('لا يوجد اتصال أو نقل بيانات') && !html.includes('data-local-connect')],
  ['native local network audit is part of the standard npm validation scripts', pkg.scripts['audit:local-network-native'] === 'node scripts/local-network-native-audit.mjs']
];
let failed = 0;
for (const [label, ok] of checks) {
  console.log((ok ? 'PASS: ' : 'FAIL: ') + label);
  if (!ok) failed++;
}
if (failed) process.exitCode = 1;
else console.log('PASS: native local discovery foundation is registered, permission-scoped, and honestly marked transport-incomplete.');
