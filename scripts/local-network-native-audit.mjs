import fs from 'node:fs';
const read=path=>fs.readFileSync(path,'utf8');
const plugin=read('scripts/android/AlwahaLocalNetworkPlugin.java');
const bridge=read('scripts/native-back-handler.mjs');
const workflow=read('.github/workflows/build-apk-aab-release.yml');
const pkg=JSON.parse(read('package.json'));
const html=read('index.html');
const mesh=read('alwaha-local-mesh.js');
const build=read('scripts/build-web.mjs');
const sw=read('sw.js');
const checks=[
 ['stable Capacitor plugin identity retained',/@CapacitorPlugin\(\s*name\s*=\s*"AlwahaLocalNetwork"/.test(plugin)],
 ['Android 13+ Nearby Wi-Fi and Bluetooth permission aliases declared',plugin.includes('Manifest.permission.NEARBY_WIFI_DEVICES')&&plugin.includes('Manifest.permission.BLUETOOTH_SCAN')&&plugin.includes('Manifest.permission.BLUETOOTH_CONNECT')&&plugin.includes('Manifest.permission.BLUETOOTH_ADVERTISE')],
 ['legacy Android location permission path retained for Wi-Fi peer discovery',plugin.includes('legacyLocation')&&plugin.includes('Build.VERSION.SDK_INT >= 33')&&plugin.includes('Build.VERSION.SDK_INT >= 31')],
 ['Wi-Fi Direct discovery uses WifiP2pManager and bounded scan lifetime',plugin.includes('discoverPeers')&&plugin.includes('DISCOVERY_TIMEOUT_MS')&&plugin.includes('stopPeerDiscovery')],
 ['users can create a Wi-Fi Direct group and connect to a selected peer',plugin.includes('createWifiDirectGroup')&&plugin.includes('connectWifiDirectPeer')&&plugin.includes('wifiP2pManager.createGroup')&&plugin.includes('wifiP2pManager.connect')],
 ['native transport uses bounded length-prefixed TCP frames',plugin.includes('LOCAL_PACKET_PORT = 43817')&&plugin.includes('MAX_LOCAL_PACKET_BYTES = 262144')&&plugin.includes('output.writeInt(packet.length)')&&plugin.includes('input.readInt()')&&plugin.includes('input.readFully(packet)')],
 ['native transport has explicit start/send/stop methods and connection state',plugin.includes('startPacketTransport')&&plugin.includes('sendLocalPacket')&&plugin.includes('stopPacketTransport')&&plugin.includes('isTransportConnected()')],
 ['native transport closes sockets on disconnect and plugin teardown',plugin.includes('closeTransportSocket("peer-disconnected")')&&plugin.includes('stopPacketTransportInternal("plugin-destroyed")')&&plugin.includes('transportExecutor.shutdownNow()')],
 ['native frames are opaque bytes; no native path parses chat plaintext',plugin.includes('notifyListeners("localPacketReceived", payload)')&&!plugin.includes('new JSONObject(packet)')],
 ['plugin reports transport ready only while a socket exists',plugin.includes('result.put("transportReady", isTransportConnected())')&&plugin.includes('result.put("chatReady", isTransportConnected())')],
 ['mesh identities use P-256 ECDH and ECDSA with AES-GCM and HKDF',mesh.includes("name:'ECDH',namedCurve:'P-256'")&&mesh.includes("name:'ECDSA',namedCurve:'P-256'")&&mesh.includes("name:'AES-GCM'")&&mesh.includes("name:'HKDF'")],
 ['private keys remain non-extractable and are persisted in IndexedDB via local vault',mesh.includes('generateKey(algorithm,false,usages)')&&mesh.includes("mesh:identity-v1")&&mesh.includes("vault().put('mesh:identity-v1',identity)")],
 ['peer pairing requires fingerprint verification and explicit six-character confirmation',mesh.includes('fingerprintCode')&&mesh.includes("confirmationCode")&&mesh.includes("expected=fingerprint.slice(-6).toUpperCase()")],
 ['messages use rotating opaque route tokens and bounded expiry/hop limits',mesh.includes('routeTokens')&&mesh.includes('ROUTE_DAYS=3')&&mesh.includes('MAX_AGE_MS=72*60*60*1000')&&mesh.includes('MAX_HOPS=12')],
 ['end-to-end envelope signature is verified before dispatch',mesh.includes('crypto.subtle.sign({name:\'ECDSA\',hash:\'SHA-256\'}')&&mesh.includes('crypto.subtle.verify({name:\'ECDSA\',hash:\'SHA-256\'}')),
 ['relays store ciphertext only and reject duplicate packet IDs',mesh.includes('enqueueRelay(packet')&&mesh.includes('mesh:relay:')&&mesh.includes('mesh:seen:')&&mesh.includes('duplicate:true')],
 ['file transfer chunks encrypted files and reassembles within explicit size limits',mesh.includes('FILE_CHUNK_BYTES=120*1024')&&mesh.includes('25*1024*1024')&&mesh.includes('file-ready')&&mesh.includes('restoreFile')],
 ['chat and market UIs expose explicit local mode and trusted identity pairing',html.includes('toggleAlwahaLocalChatMode()')&&html.includes('data-pair-peer')&&html.includes('createWifiDirectGroup')&&html.includes('connectWifiDirectPeer')],
 ['direct and marketplace chat messages route through mesh in local mode',html.includes("sendToAccount(peerId,{type:'direct-text'")&&html.includes("sendToAccount(currentMarketPeerId,{type:'market-text'")],
 ['voice notes, pictures and videos use the same encrypted chunked local packet path',html.includes("sendFileToAccount(peerId,file,kind,{type:'direct'})")&&html.includes("sendFileToAccount(currentMarketPeerId,file,kind,{type:'market'")],
 ['mesh script is included in web build and service worker precache',build.includes("'alwaha-local-mesh.js'")&&sw.includes("'./alwaha-local-mesh.js'")&&html.includes('alwaha-local-mesh.js?v=')],
 ['Android build generates and registers the native Wi-Fi Direct plugin',workflow.includes('AlwahaLocalNetworkPlugin.java')&&workflow.includes('registerPlugin(AlwahaLocalNetworkPlugin.class)')],
 ['standard CI runs native audit plus cryptographic runtime tests',pkg.scripts['audit:local-network-native']==='node scripts/local-network-native-audit.mjs && node scripts/mesh-protocol-runtime-test.mjs']
];
let failures=0;
for(const [label,ok] of checks){console.log((ok?'PASS: ':'FAIL: ')+label);if(!ok)failures++;}
if(failures)process.exit(1);
console.log('LOCAL_MESH_NATIVE_AUDIT=PASS ('+checks.length+' checks)');
