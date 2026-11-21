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
 ['native transport closes sockets on disconnect and plugin teardown',plugin.includes('closeTransportSocketFor(socket, "peer-disconnected")')&&plugin.includes('stopPacketTransportInternal("plugin-destroyed")')&&plugin.includes('transportExecutor.shutdownNow()')],
 ['native frames are opaque bytes; no native path parses chat plaintext',plugin.includes('notifyListeners("localPacketReceived", payload)')&&!plugin.includes('new JSONObject(packet)')],
 ['plugin reports transport ready only while a socket exists',plugin.includes('result.put("transportReady", isTransportConnected())')&&plugin.includes('result.put("chatReady", isTransportConnected())')],
 ['Bluetooth Classic RFCOMM offers an explicit Android-approved, time-bounded visibility path',plugin.includes('startBluetoothPacketServer')&&plugin.includes('BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE')&&plugin.includes('EXTRA_DISCOVERABLE_DURATION, 300')],
 ['Bluetooth Classic accepts an unpaired RFCOMM link while application E2E encryption remains mandatory',plugin.includes('listenUsingInsecureRfcommWithServiceRecord')&&plugin.includes('createInsecureRfcommSocketToServiceRecord')&&mesh.includes("name:'AES-GCM'")&&mesh.includes("name:'ECDSA'")],
 ['Bluetooth packet transport reuses the same bounded length-prefixed opaque encrypted frames',plugin.includes('readBluetoothFrames')&&plugin.includes('Invalid Bluetooth packet length')&&plugin.includes('bluetoothSocket.getOutputStream()')&&plugin.includes('MAX_LOCAL_PACKET_BYTES = 262144')],
 ['Bluetooth server and client transport sockets are closed on disconnect and plugin teardown',plugin.includes('closeBluetoothTransportSocketFor')&&plugin.includes('bluetoothServer.close()')&&plugin.includes('transportExecutor.shutdownNow()')],
 ['Android capability response distinguishes Bluetooth data transport from call media',plugin.includes('bluetoothDataTransportReady')&&plugin.includes('result.put("callMediaReady", false)')],
 ['local discovery UI exposes Bluetooth server, transport-specific connection and Wi-Fi Direct without conflating them',html.includes('data-bluetooth-server')&&html.includes('plugin.startBluetoothPacketServer()')&&html.includes('plugin.connectBluetoothPeer({address:button.dataset.connectAddress})')&&html.includes('data-connect-transport')&&html.includes('plugin.connectWifiDirectPeer({address:button.dataset.connectAddress})')],
 ['mesh identities use P-256 ECDH and ECDSA with AES-GCM and HKDF',mesh.includes("name:'ECDH',namedCurve:'P-256'")&&mesh.includes("name:'ECDSA',namedCurve:'P-256'")&&mesh.includes("name:'AES-GCM'")&&mesh.includes("name:'HKDF'")],
 ['private keys remain non-extractable and are persisted in IndexedDB via local vault',mesh.includes('generateKey(algorithm,false,usages)')&&mesh.includes("mesh:identity-v1")&&mesh.includes("vault().put('mesh:identity-v1',identity)")],
 ['peer pairing requires fingerprint verification and explicit six-character confirmation',mesh.includes('fingerprintCode')&&mesh.includes("confirmationCode")&&mesh.includes("expected=fingerprint.slice(-6).toUpperCase()")],
 ['messages use rotating opaque route tokens and bounded expiry/hop limits',mesh.includes('routeTokensForPair')&&mesh.includes('deriveRouteHmacKey')&&mesh.includes("name:'HMAC'")&&!mesh.includes("'AlwahaMeshRouteV1|'+fingerprint")&&mesh.includes('ROUTE_DAYS=3')&&mesh.includes('MAX_AGE_MS=72*60*60*1000')&&mesh.includes('MAX_HOPS=12')],
 ['end-to-end envelope signature is verified before dispatch',mesh.includes('crypto.subtle.sign({name:\'ECDSA\',hash:\'SHA-256\'}')&&mesh.includes('crypto.subtle.verify({name:\'ECDSA\',hash:\'SHA-256\'}')],
 ['relays store ciphertext only and reject duplicate packet IDs',mesh.includes('enqueueRelay(packet')&&mesh.includes('mesh:relay:')&&mesh.includes('mesh:seen:')&&mesh.includes('duplicate:true')&&mesh.includes("reason:'untrusted-neighbor'")],
 ['file transfer chunks encrypted files and reassembles within explicit size limits',mesh.includes('FILE_CHUNK_BYTES=120*1024')&&mesh.includes('25*1024*1024')&&mesh.includes('file-ready')&&mesh.includes('restoreFile')],
 ['chat and market UIs expose explicit local mode and trusted identity pairing',html.includes('toggleAlwahaLocalChatMode()')&&html.includes('data-pair-peer')&&html.includes('createWifiDirectGroup')&&html.includes('connectWifiDirectPeer')],
 ['direct and marketplace chat messages route through mesh in local mode',html.includes("sendToAccount(peerId,{type:'direct-text'")&&html.includes("sendToAccount(currentMarketPeerId,{type:'market-text'")],
 ['voice notes, pictures and videos use the same encrypted chunked local packet path',html.includes("sendFileToAccount(peerId,file,kind,{type:'direct'})")&&html.includes("sendFileToAccount(currentMarketPeerId,file,kind,{type:'market'")],
 ['mesh script is included in web build and service worker precache',build.includes("'alwaha-local-mesh.js'")&&sw.includes("'./alwaha-local-mesh.js'")&&html.includes('alwaha-local-mesh.js?v=')],
 ['Android build generates and registers the native Wi-Fi Direct plugin',workflow.includes('AlwahaLocalNetworkPlugin.java')&&workflow.includes('registerPlugin(AlwahaLocalNetworkPlugin.class)')],
 ['standard CI runs native audit plus cryptographic runtime tests',pkg.scripts['audit:local-network-native']==='node scripts/local-network-native-audit.mjs && node scripts/mesh-protocol-runtime-test.mjs'],
 ['route tokens are HMACs derived from pairwise ECDH secrets, not public fingerprints',mesh.includes('deriveRouteHmacKey')&&mesh.includes('routeTokensForPair')&&mesh.includes("name:'HMAC'")&&!mesh.includes("'AlwahaMeshRouteV1|'+fingerprint")],
 ['incoming and outgoing local file chunks are encrypted at rest',mesh.includes('storeLocalEncrypted(key,{chunk:chunk.chunk')&&mesh.includes("storeLocalEncrypted('mesh:file:'+fileId+':'+index")&&mesh.includes('readLocalEncrypted(base+\':\'+i)')],
 ['mesh relay forwarding is limited to validated Nearby identity peers and a bounded queue',mesh.includes('validateBundle(message.bundle)')&&mesh.includes('relayAllowed:true')&&mesh.includes('relayCount>=300')&&mesh.includes('pruneExpiredState')],
 ['encrypted relay queue resumes when a consenting peer completes the identity hello',mesh.includes('if(modeEnabled)await flushRelayQueue(endpointKey)')&&mesh.includes('if(result?.relayed&&modeEnabled)await flushRelayQueue()')&&mesh.includes('relayAllowed:true')],
 ['Mesh exposes the authenticated active link type and clears it when the native transport disconnects',mesh.includes('function getTransportType(){return transportType;}')&&mesh.includes("transportType=String(event.transport||'unknown')")&&mesh.includes("transportType=''")&&mesh.includes('getTransportType,')],
 ['native transport status distinguishes Bluetooth RFCOMM from Wi-Fi Direct TCP',plugin.includes('isBluetoothTransportConnected() ? "bluetooth-rfcomm" : "wifi-direct-tcp"')&&plugin.includes('payload.put("transport", isBluetoothTransportConnected() ? "bluetooth-rfcomm" : "wifi-direct-tcp")')],
 ['native incoming frames use a bounded FIFO rather than a drop-on-busy lock',mesh.includes('receiveQueue=Promise.resolve()')&&mesh.includes('MAX_PENDING_RECEIVE=256')&&mesh.includes('pendingReceiveCount>=MAX_PENDING_RECEIVE')&&mesh.includes('receiveQueue.then(')],
 ['queued native frames are invalidated when the transport session changes',mesh.includes('transportGeneration++')&&mesh.includes("reason:'stale-transport'")&&mesh.includes('processRawPacket(encoded,generation,endpointId)')],
 ['incoming packets require a validated neighbor hello; only direct decryption requires contact trust',mesh.includes("reason:'neighbor-not-identified'")&&mesh.includes('!trusted&&!neighbor?.relayAllowed')&&mesh.includes('relayAllowed:true')],

 ['Android opens only user-approved Internet and Bluetooth system panels',plugin.includes('openInternetSettings')&&plugin.includes('Settings.Panel.ACTION_INTERNET_CONNECTIVITY')&&plugin.includes('openBluetoothSettings')&&plugin.includes('Settings.ACTION_BLUETOOTH_SETTINGS')&&html.includes('data-open-internet-settings')&&html.includes('data-open-bluetooth-settings')],
 ['Android does not claim app-level cellular-data toggling',plugin.includes('automaticMobileDataToggle')&&plugin.includes('false')&&html.includes('لا يستطيع التطبيق إطفاء بيانات الهاتف تلقائيًا')],


 ['route tokens are HMACs derived from pairwise ECDH secrets, not public fingerprints',mesh.includes('deriveRouteHmacKey')&&mesh.includes('routeTokensForPair')&&mesh.includes("name:'HMAC'")&&!mesh.includes("'AlwahaMeshRouteV1|'+fingerprint")],
 ['incoming and outgoing local file chunks are encrypted at rest',mesh.includes('storeLocalEncrypted(key,{chunk:chunk.chunk')&&mesh.includes("storeLocalEncrypted('mesh:file:'+fileId+':'+index")&&mesh.includes('readLocalEncrypted(base+\':\'+i)')],
 ['mesh relay forwarding uses validated identity neighbors and a bounded queue',mesh.includes("reason:'neighbor-not-identified'")&&mesh.includes('relayCount>=300')&&mesh.includes('pruneExpiredState')],

 ['Nearby Connections SDK 19.5.1 is included in the generated Android app build',workflow.includes('com.google.android.gms:play-services-nearby:19.5.1')],
 ['Nearby mesh uses the many-to-many P2P_CLUSTER strategy for advertising and discovery',plugin.includes('Strategy.P2P_CLUSTER')&&plugin.includes('startAdvertising')&&plugin.includes('startDiscovery')&&plugin.includes('NEARBY_SERVICE_ID')],
 ['Nearby peers connect automatically with a strict per-device connection cap',plugin.includes('nearbyEndpointDiscoveryCallback')&&plugin.includes('requestConnection')&&plugin.includes('MAX_NEARBY_ENDPOINTS = 6')],
 ['incoming Nearby transport is accepted only while the user has enabled the bridge',plugin.includes('if (!nearbyMeshActive || client == null)')&&plugin.includes('acceptConnection(endpointId, nearbyPayloadCallback)')],
 ['Nearby encrypted byte frames are routed by endpoint and remain within the native packet limit',plugin.includes('sendPayload(targets, Payload.fromBytes(packet))')&&plugin.includes('event.put("endpointId", endpointId)')&&plugin.includes('MAX_LOCAL_PACKET_BYTES = 262144')],
 ['Nearby advertising, discovery and endpoints stop when the user disables the switch',plugin.includes('stopNearbyMesh(PluginCall call)')&&plugin.includes('stopAdvertising()')&&plugin.includes('stopDiscovery()')&&plugin.includes('stopAllEndpoints()')],
 ['missing Bluetooth and Wi-Fi activation controls use Android system approval or panels',plugin.includes('BluetoothAdapter.ACTION_REQUEST_ENABLE')&&plugin.includes('Settings.Panel.ACTION_WIFI')&&html.includes('requestBluetoothEnable()')&&html.includes('openWifiPanel()')],
 ['bridge consent provides persistent accept, decline and 30-day reminder choices',html.includes('ALWAHA_MESH_CONSENT_KEY')&&html.includes("setItem(ALWAHA_MESH_CONSENT_KEY,'accepted')")&&html.includes("setItem(ALWAHA_MESH_CONSENT_KEY,'declined')")&&html.includes('30*24*60*60*1000')],
 ['bridge scan does not suspend cloud realtime until a verified local neighbor is active',html.includes('syncAlwahaMeshRealtime(active)')&&!html.includes('await closeAlwahaCloudRealtimeForLocalMode();\\n            const buttonText')],
 ['switch turns green only when a verified active transport peer is available',mesh.includes('return transportEndpoints.size>0||Boolean(transportPeerFingerprint)')&&html.includes("button.style.color=active?'#a8ffd7':(requested?'#ffd88b':'')")],
 ['relay queues enforce per-neighbor packet and byte rate limits',mesh.includes('traffic.packets>300')&&mesh.includes('traffic.bytes>30*1024*1024')],
];
let failures=0;
for(const [label,ok] of checks){console.log((ok?'PASS: ':'FAIL: ')+label);if(!ok)failures++;}
if(failures)process.exit(1);
console.log('LOCAL_MESH_NATIVE_AUDIT=PASS ('+checks.length+' checks)');
