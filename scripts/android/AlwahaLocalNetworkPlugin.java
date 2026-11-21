package __ALWAHA_PACKAGE__;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothServerSocket;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.wifi.WifiManager;
import android.net.wifi.p2p.WifiP2pDevice;
import android.net.wifi.p2p.WifiP2pDeviceList;
import android.net.wifi.p2p.WifiP2pManager;
import android.net.wifi.p2p.WifiP2pConfig;
import android.net.wifi.WpsInfo;
import android.util.Base64;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.AdvertisingOptions;
import com.google.android.gms.nearby.connection.ConnectionInfo;
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback;
import com.google.android.gms.nearby.connection.ConnectionResolution;
import com.google.android.gms.nearby.connection.ConnectionsClient;
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo;
import com.google.android.gms.nearby.connection.DiscoveryOptions;
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback;
import com.google.android.gms.nearby.connection.Payload;
import com.google.android.gms.nearby.connection.PayloadCallback;
import com.google.android.gms.nearby.connection.PayloadTransferUpdate;
import com.google.android.gms.nearby.connection.Strategy;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import java.util.ArrayList;
import java.util.List;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.UUID;

@CapacitorPlugin(
    name = "AlwahaLocalNetwork",
    permissions = {
        @Permission(alias = "nearbyWifi", strings = { Manifest.permission.NEARBY_WIFI_DEVICES }),
        @Permission(alias = "bluetooth", strings = {
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_ADVERTISE
        }),
        @Permission(alias = "legacyLocation", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
public class AlwahaLocalNetworkPlugin extends Plugin {
    private static final long DISCOVERY_TIMEOUT_MS = 25000L;
    private static final int LOCAL_PACKET_PORT = 43817;
    private static final int MAX_LOCAL_PACKET_BYTES = 262144;
    private static final UUID BLUETOOTH_PACKET_UUID = UUID.fromString("3b5d8f2a-6b71-4d9a-9e10-7a6c2f4b8d31");
    private static final String BLUETOOTH_SERVICE_NAME = "Alwaha-Pro Local";
    private final ExecutorService transportExecutor = Executors.newCachedThreadPool();
    private volatile ServerSocket transportServer;
    private volatile Socket transportSocket;
    private volatile BluetoothServerSocket bluetoothServerSocket;
    private volatile BluetoothSocket bluetoothTransportSocket;
    private volatile boolean bluetoothServerClosed = false;
    private volatile boolean transportClosed = false;
    private final Object transportWriteLock = new Object();

    // Nearby Connections cluster transport. The advertised endpoint name is intentionally empty:
    // no account name, profile, device name, stable fingerprint, or relay label is disclosed.
    private static final String NEARBY_SERVICE_ID = "pro.alwaha.app.mesh";
    private static final int NEARBY_CHUNK_BYTES = 18000;
    private static final int MAX_NEARBY_CHUNKS = 16;
    private static final int MAX_NEARBY_ASSEMBLIES = 64;
    private static final long NEARBY_ASSEMBLY_TTL_MS = 30000L;
    private volatile ConnectionsClient nearbyClient;
    private volatile boolean nearbyMeshRunning = false;
    private final Set<String> nearbyConnectedEndpoints = ConcurrentHashMap.newKeySet();
    private final Set<String> nearbyConnectingEndpoints = ConcurrentHashMap.newKeySet();
    private final Map<String, NearbyFrameAssembly> nearbyAssemblies = new ConcurrentHashMap<>();

    private static final class NearbyFrameAssembly {
        final String[] chunks;
        final long createdAt = System.currentTimeMillis();
        int received;
        int totalBytes;
        NearbyFrameAssembly(int total) { chunks = new String[total]; }
    }

    private void emitNearbyState(String state) {
        JSObject payload = new JSObject();
        payload.put("state", state);
        payload.put("connectedCount", nearbyConnectedEndpoints.size());
        payload.put("anonymous", true);
        notifyListeners("nearbyTransportState", payload, true);
    }

    private final PayloadCallback nearbyPayloadCallback = new PayloadCallback() {
        @Override public void onPayloadReceived(String endpointId, Payload payload) {
            if (payload == null || payload.getType() != Payload.Type.BYTES) return;
            byte[] bytes = payload.asBytes();
            if (bytes == null || bytes.length == 0 || bytes.length > 28000) return;
            acceptNearbyFrame(endpointId, bytes);
        }
        @Override public void onPayloadTransferUpdate(String endpointId, PayloadTransferUpdate update) {
            if (update != null && update.getStatus() == PayloadTransferUpdate.Status.FAILURE) {
                JSObject state = new JSObject();
                state.put("state", "payload-failed");
                state.put("connectedCount", nearbyConnectedEndpoints.size());
                notifyListeners("nearbyTransportState", state, true);
            }
        }
    };

    private final ConnectionLifecycleCallback nearbyConnectionLifecycleCallback = new ConnectionLifecycleCallback() {
        @Override public void onConnectionInitiated(String endpointId, ConnectionInfo info) {
            ConnectionsClient client = nearbyClient;
            if (!nearbyMeshRunning || client == null) {
                if (client != null) client.rejectConnection(endpointId);
                return;
            }
            // Consent is enforced in the encrypted mesh layer before any packet is relayed.
            // Accepting the transport does not reveal or register the device as a contact.
            client.acceptConnection(endpointId, nearbyPayloadCallback)
                .addOnFailureListener(error -> {
                    nearbyConnectingEndpoints.remove(endpointId);
                    emitNearbyState("accept-failed");
                });
        }

        @Override public void onConnectionResult(String endpointId, ConnectionResolution resolution) {
            nearbyConnectingEndpoints.remove(endpointId);
            if (resolution != null && resolution.getStatus() != null && resolution.getStatus().isSuccess()) {
                nearbyConnectedEndpoints.add(endpointId);
                emitNearbyState("connected");
            } else {
                nearbyConnectedEndpoints.remove(endpointId);
                emitNearbyState("connection-failed");
            }
        }

        @Override public void onDisconnected(String endpointId) {
            nearbyConnectingEndpoints.remove(endpointId);
            nearbyConnectedEndpoints.remove(endpointId);
            nearbyAssemblies.keySet().removeIf(key -> key.startsWith(endpointId + "|"));
            emitNearbyState("disconnected");
        }
    };

    private final EndpointDiscoveryCallback nearbyEndpointDiscoveryCallback = new EndpointDiscoveryCallback() {
        @Override public void onEndpointFound(String endpointId, DiscoveredEndpointInfo info) {
            if (!nearbyMeshRunning || endpointId == null || endpointId.isEmpty()) return;
            if (nearbyConnectedEndpoints.contains(endpointId) || !nearbyConnectingEndpoints.add(endpointId)) return;
            ConnectionsClient client = nearbyClient;
            if (client == null) {
                nearbyConnectingEndpoints.remove(endpointId);
                return;
            }
            // Endpoint names supplied by remote apps are deliberately ignored.
            client.requestConnection("", endpointId, nearbyConnectionLifecycleCallback)
                .addOnFailureListener(error -> {
                    nearbyConnectingEndpoints.remove(endpointId);
                    emitNearbyState("request-failed");
                });
        }
        @Override public void onEndpointLost(String endpointId) {
            // Do not expose endpoint IDs to UI. Existing active links may remain valid.
            nearbyConnectingEndpoints.remove(endpointId);
        }
    };

    private void acceptNearbyFrame(String endpointId, byte[] raw) {
        try {
            JSONObject frame = new JSONObject(new String(raw, StandardCharsets.UTF_8));
            if (!"AWN1".equals(frame.optString("t"))) return;
            String id = frame.optString("id", "");
            int index = frame.optInt("i", -1);
            int total = frame.optInt("n", -1);
            String data = frame.optString("d", "");
            if (!id.matches("^[A-Fa-f0-9-]{20,40}$") || total < 1 || total > MAX_NEARBY_CHUNKS
                || index < 0 || index >= total || data.isEmpty()) return;

            long now = System.currentTimeMillis();
            nearbyAssemblies.entrySet().removeIf(entry -> now - entry.getValue().createdAt > NEARBY_ASSEMBLY_TTL_MS);
            String key = endpointId + "|" + id;
            NearbyFrameAssembly assembly = nearbyAssemblies.get(key);
            if (assembly == null) {
                if (nearbyAssemblies.size() >= MAX_NEARBY_ASSEMBLIES) return;
                NearbyFrameAssembly fresh = new NearbyFrameAssembly(total);
                NearbyFrameAssembly previous = nearbyAssemblies.putIfAbsent(key, fresh);
                assembly = previous == null ? fresh : previous;
            }
            synchronized (assembly) {
                if (assembly.chunks.length != total || assembly.chunks[index] != null) return;
                byte[] decoded = Base64.decode(data, Base64.URL_SAFE | Base64.NO_WRAP);
                if (decoded.length == 0 || assembly.totalBytes + decoded.length > MAX_LOCAL_PACKET_BYTES) {
                    nearbyAssemblies.remove(key);
                    return;
                }
                assembly.chunks[index] = data;
                assembly.totalBytes += decoded.length;
                assembly.received++;
                if (assembly.received != total) return;
                ByteArrayOutputStream output = new ByteArrayOutputStream(assembly.totalBytes);
                for (String chunk : assembly.chunks) {
                    if (chunk == null) return;
                    output.write(Base64.decode(chunk, Base64.URL_SAFE | Base64.NO_WRAP));
                }
                byte[] packet = output.toByteArray();
                nearbyAssemblies.remove(key);
                JSObject payload = new JSObject();
                payload.put("packet", Base64.encodeToString(packet, Base64.URL_SAFE | Base64.NO_WRAP));
                payload.put("endpointId", endpointId); // Internal routing token only; never rendered in UI.
                payload.put("bytes", packet.length);
                notifyListeners("localNearbyPacketReceived", payload, true);
            }
        } catch (Exception ignored) {
            // Malformed and over-budget frames are dropped without exposing peer metadata.
        }
    }


    private WifiP2pManager wifiP2pManager;
    private WifiP2pManager.Channel wifiChannel;
    private BluetoothAdapter bluetoothAdapter;
    private BroadcastReceiver receiver;
    private boolean receiverRegistered = false;
    private boolean wifiDiscoveryActive = false;
    private boolean bluetoothDiscoveryActive = false;
    private Handler handler;
    private final Runnable discoveryTimeout = () -> stopDiscoveryInternal("timeout");

    @Override
    public void load() {
        handler = new Handler(Looper.getMainLooper());
    }

    @PluginMethod
    public void openInternetSettings(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            intent = new Intent(Settings.Panel.ACTION_INTERNET_CONNECTIVITY);
        } else {
            intent = new Intent(Settings.ACTION_WIRELESS_SETTINGS);
        }
        try {
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            result.put("automaticMobileDataToggle", false);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Android could not open the Internet settings panel.", error);
        }
    }

    @PluginMethod
    public void openBluetoothSettings(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
        } else {
            intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
        }
        try {
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Android could not open the Bluetooth settings panel.", error);
        }
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        boolean wifiDirect = getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_WIFI_DIRECT);
        BluetoothAdapter bluetooth = getBluetoothAdapter();
        WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        boolean wifiEnabled = false;
        boolean bluetoothEnabled = false;
        try { wifiEnabled = wifi != null && wifi.isWifiEnabled(); } catch (SecurityException ignored) {}
        try { bluetoothEnabled = bluetooth != null && bluetooth.isEnabled(); } catch (SecurityException ignored) {}
        int targetSdk = getContext().getApplicationInfo().targetSdkVersion;

        JSObject result = new JSObject();
        result.put("phase", "wifi-direct+bluetooth-classic-store-forward");
        result.put("bluetoothRfcommSupported", bluetooth != null);
        result.put("bluetoothDataTransportReady", isBluetoothTransportConnected());
        result.put("wifiDirectSupported", wifiDirect);
        result.put("wifiEnabled", wifiEnabled);
        result.put("bluetoothClassicSupported", bluetooth != null);
        result.put("bluetoothEnabled", bluetoothEnabled);
        result.put("androidApi", Build.VERSION.SDK_INT);
        result.put("targetSdk", targetSdk);
        result.put("locationModeEnabled", isLocationModeEnabled());
        result.put("permissionsGranted", hasDiscoveryPermissions());
        result.put("transportReady", isTransportConnected());
        result.put("chatReady", isTransportConnected());
        result.put("fileTransferReady", isTransportConnected());
        result.put("callMediaReady", false);
        result.put("requiresAccessLocalNetworkPermission", Build.VERSION.SDK_INT >= 37 && targetSdk >= 37);
        call.resolve(result);
    }

    @PluginMethod
    public void startBluetoothPacketServer(PluginCall call) {
        if (!hasDiscoveryPermissions()) {
            call.reject("Nearby Bluetooth permission is required before starting Bluetooth transfer.");
            return;
        }
        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("Enable Bluetooth in Android settings before starting local transfer.");
            return;
        }
        try {
            Intent discoverable = new Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE);
            discoverable.putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, 300);
            getActivity().startActivity(discoverable);
        } catch (Exception error) {
            call.reject("Android could not open the Bluetooth visibility approval screen.", error);
            return;
        }
        transportExecutor.execute(() -> {
            try {
                BluetoothServerSocket existing = bluetoothServerSocket;
                if (existing == null || bluetoothServerClosed) {
                    BluetoothServerSocket server = adapter.listenUsingInsecureRfcommWithServiceRecord(BLUETOOTH_SERVICE_NAME, BLUETOOTH_PACKET_UUID);
                    bluetoothServerSocket = server;
                    bluetoothServerClosed = false;
                    transportExecutor.execute(() -> acceptBluetoothClients(server));
                }
                JSObject result = new JSObject();
                result.put("listening", true);
                result.put("transport", "bluetooth-rfcomm-e2e-encrypted");
                result.put("visibilitySeconds", 300);
                call.resolve(result);
                emitTransportState("bluetooth-server-listening", BLUETOOTH_SERVICE_NAME);
            } catch (SecurityException error) {
                call.reject("Bluetooth connect permission was denied.", error);
            } catch (Exception error) {
                call.reject("Could not start the local Bluetooth packet receiver.", error);
            }
        });
    }

    @PluginMethod
    public void connectBluetoothPeer(PluginCall call) {
        if (!hasDiscoveryPermissions()) {
            call.reject("Nearby Bluetooth permission is required before connecting to a device.");
            return;
        }
        String address = call.getString("address", "");
        if (address == null || !address.matches("(?i)^[0-9a-f]{2}(:[0-9a-f]{2}){5}$")) {
            call.reject("The nearby Bluetooth device address is invalid.");
            return;
        }
        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("Bluetooth is not enabled on this device.");
            return;
        }
        transportExecutor.execute(() -> {
            BluetoothSocket socket = null;
            try {
                if (adapter.isDiscovering()) adapter.cancelDiscovery();
                BluetoothDevice device = adapter.getRemoteDevice(address);
                socket = device.createInsecureRfcommSocketToServiceRecord(BLUETOOTH_PACKET_UUID);
                socket.connect();
                attachBluetoothTransportSocket(socket);
                JSObject result = new JSObject();
                result.put("connected", true);
                result.put("transport", "bluetooth-rfcomm-e2e-encrypted");
                result.put("address", address);
                call.resolve(result);
            } catch (SecurityException error) {
                if (socket != null) try { socket.close(); } catch (Exception ignored) {}
                call.reject("Bluetooth permission was denied while connecting.", error);
            } catch (Exception error) {
                if (socket != null) try { socket.close(); } catch (Exception ignored) {}
                call.reject("Could not connect to the Bluetooth peer. Confirm the other phone approved visibility and started its receiver.", error);
            }
        });
    }

    @PluginMethod
    public void requestLocalPermissions(PluginCall call) {
        requestPermissionsForCurrentApi(call, "permissionOnlyCallback");
    }

    @PermissionCallback
    private void permissionOnlyCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasDiscoveryPermissions());
        result.put("phase", "discovery-only");
        if (hasDiscoveryPermissions()) call.resolve(result);
        else call.reject("Alwaha-Pro needs Nearby Wi-Fi/Bluetooth permission before looking for nearby devices.");
    }

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        if (!hasDiscoveryPermissions()) {
            requestPermissionsForCurrentApi(call, "discoveryPermissionCallback");
            return;
        }
        startDiscoveryNow(call);
    }

    @PermissionCallback
    private void discoveryPermissionCallback(PluginCall call) {
        if (!hasDiscoveryPermissions()) {
            call.reject("Nearby device permission was not granted. No scan was started.");
            return;
        }
        startDiscoveryNow(call);
    }

    @PluginMethod
    public void createWifiDirectGroup(PluginCall call) {
        if (!hasDiscoveryPermissions()) {
            call.reject("Nearby Wi-Fi permission is required before creating a local group.");
            return;
        }
        ensureWifiP2p();
        if (wifiP2pManager == null || wifiChannel == null) {
            call.reject("Wi-Fi Direct is not available on this device.");
            return;
        }
        try {
            wifiP2pManager.createGroup(wifiChannel, new WifiP2pManager.ActionListener() {
                @Override public void onSuccess() {
                    JSObject result = new JSObject();
                    result.put("started", true);
                    result.put("role", "group-owner");
                    result.put("transportReady", false);
                    call.resolve(result);
                    emitTransportState("group-created", "waiting-for-peer");
                }
                @Override public void onFailure(int reason) {
                    call.reject("Could not create the Wi-Fi Direct group. Android reason: " + reason);
                }
            });
        } catch (SecurityException error) {
            call.reject("Wi-Fi Direct permission was denied.", error);
        }
    }

    @PluginMethod
    public void connectWifiDirectPeer(PluginCall call) {
        if (!hasDiscoveryPermissions()) {
            call.reject("Nearby Wi-Fi permission is required before connecting to a peer.");
            return;
        }
        String address = call.getString("address", "");
        if (address == null || !address.matches("(?i)^[0-9a-f]{2}(:[0-9a-f]{2}){5}$")) {
            call.reject("The nearby Wi-Fi Direct device address is invalid.");
            return;
        }
        ensureWifiP2p();
        if (wifiP2pManager == null || wifiChannel == null) {
            call.reject("Wi-Fi Direct is not available on this device.");
            return;
        }
        WifiP2pConfig config = new WifiP2pConfig();
        config.deviceAddress = address;
        config.wps.setup = WpsInfo.PBC;
        config.groupOwnerIntent = 0;
        try {
            wifiP2pManager.connect(wifiChannel, config, new WifiP2pManager.ActionListener() {
                @Override public void onSuccess() {
                    JSObject result = new JSObject();
                    result.put("started", true);
                    result.put("transportReady", false);
                    result.put("message", "Connection request accepted by Android; waiting for Wi-Fi Direct group formation.");
                    call.resolve(result);
                    emitTransportState("connection-requested", address);
                }
                @Override public void onFailure(int reason) {
                    call.reject("Wi-Fi Direct connection failed. Android reason: " + reason);
                }
            });
        } catch (SecurityException error) {
            call.reject("Wi-Fi Direct permission was denied.", error);
        }
    }

    @PluginMethod
    public void startPacketTransport(PluginCall call) {
        if (!hasDiscoveryPermissions()) {
            call.reject("Nearby Wi-Fi permission is required before starting local transport.");
            return;
        }
        ensureWifiP2p();
        if (wifiP2pManager == null || wifiChannel == null) {
            call.reject("Wi-Fi Direct is not available on this device.");
            return;
        }
        try {
            wifiP2pManager.requestConnectionInfo(wifiChannel, info -> {
                if (info == null || !info.groupFormed) {
                    call.reject("Wi-Fi Direct group is not connected yet.");
                    return;
                }
                if (info.isGroupOwner) {
                    startPacketServer(call);
                } else if (info.groupOwnerAddress != null) {
                    connectPacketClient(info.groupOwnerAddress.getHostAddress(), call);
                } else {
                    call.reject("Android did not provide the Wi-Fi Direct group-owner address.");
                }
            });
        } catch (SecurityException error) {
            call.reject("Wi-Fi Direct connection information permission was denied.", error);
        }
    }

    @PluginMethod
    public void sendLocalPacket(PluginCall call) {
        String encoded = call.getString("packet", "");
        if (encoded == null || encoded.isEmpty()) {
            call.reject("An encrypted local packet is required.");
            return;
        }
        byte[] packet;
        try { packet = Base64.decode(encoded, Base64.URL_SAFE | Base64.NO_WRAP); }
        catch (IllegalArgumentException error) { call.reject("Local packet encoding is invalid."); return; }
        if (packet.length == 0 || packet.length > MAX_LOCAL_PACKET_BYTES) {
            call.reject("Local packet exceeds the allowed 256 KiB transport frame.");
            return;
        }
        Socket socket = transportSocket;
        BluetoothSocket bluetoothSocket = bluetoothTransportSocket;
        boolean wifiReady = socket != null && !socket.isClosed() && socket.isConnected();
        boolean bluetoothReady = bluetoothSocket != null && bluetoothSocket.isConnected();
        if (!wifiReady && !bluetoothReady) {
            call.reject("No Wi-Fi Direct or Bluetooth packet transport is connected.");
            return;
        }
        transportExecutor.execute(() -> {
            try {
                synchronized (transportWriteLock) {
                    OutputStream rawOutput = bluetoothReady ? bluetoothSocket.getOutputStream() : socket.getOutputStream();
                    DataOutputStream output = new DataOutputStream(rawOutput);
                    output.writeInt(packet.length);
                    output.write(packet);
                    output.flush();
                }
                JSObject result = new JSObject();
                result.put("sent", true);
                result.put("bytes", packet.length);
                call.resolve(result);
            } catch (Exception error) {
                closeTransportSocket("send-failed");
                call.reject("Could not send the local encrypted packet.", error);
            }
        });
    }


    @PluginMethod
    public void startNearbyMesh(PluginCall call) {
        if (!hasDiscoveryPermissions()) {
            requestPermissionsForCurrentApi(call, "nearbyMeshPermissionCallback");
            return;
        }
        startNearbyMeshNow(call);
    }

    @PermissionCallback
    private void nearbyMeshPermissionCallback(PluginCall call) {
        if (!hasDiscoveryPermissions()) {
            call.reject("Nearby Wi-Fi/Bluetooth permissions were not granted.");
            return;
        }
        startNearbyMeshNow(call);
    }

    private void startNearbyMeshNow(PluginCall call) {
        if (nearbyMeshRunning && nearbyClient != null) {
            JSObject result = new JSObject();
            result.put("started", true);
            result.put("connectedCount", nearbyConnectedEndpoints.size());
            result.put("anonymous", true);
            call.resolve(result);
            return;
        }
        try {
            ConnectionsClient client = Nearby.getConnectionsClient(getContext());
            nearbyClient = client;
            nearbyMeshRunning = true;
            AdvertisingOptions advertising = new AdvertisingOptions.Builder()
                .setStrategy(Strategy.P2P_CLUSTER).build();
            DiscoveryOptions discovery = new DiscoveryOptions.Builder()
                .setStrategy(Strategy.P2P_CLUSTER).build();

            // Empty endpoint name is intentional. The API still has an internal ephemeral
            // endpoint token for transport, but Alwaha never publishes a human-facing identity.
            client.startAdvertising("", NEARBY_SERVICE_ID, nearbyConnectionLifecycleCallback, advertising)
                .addOnSuccessListener(unused ->
                    client.startDiscovery(NEARBY_SERVICE_ID, nearbyEndpointDiscoveryCallback, discovery)
                        .addOnSuccessListener(ignored -> {
                            JSObject result = new JSObject();
                            result.put("started", true);
                            result.put("connectedCount", nearbyConnectedEndpoints.size());
                            result.put("anonymous", true);
                            call.resolve(result);
                            emitNearbyState("discovering");
                        })
                        .addOnFailureListener(error -> {
                            nearbyMeshRunning = false;
                            client.stopAdvertising();
                            call.reject("Nearby discovery could not start. Check radio settings and Google Play services.", error);
                            emitNearbyState("start-failed");
                        })
                )
                .addOnFailureListener(error -> {
                    nearbyMeshRunning = false;
                    client.stopDiscovery();
                    call.reject("Nearby advertising could not start. Check radio settings and Google Play services.", error);
                    emitNearbyState("start-failed");
                });
        } catch (Exception error) {
            nearbyMeshRunning = false;
            call.reject("Nearby Connections is unavailable on this device.", error);
            emitNearbyState("unavailable");
        }
    }

    @PluginMethod
    public void stopNearbyMesh(PluginCall call) {
        nearbyMeshRunning = false;
        ConnectionsClient client = nearbyClient;
        if (client != null) {
            try { client.stopAdvertising(); } catch (Exception ignored) {}
            try { client.stopDiscovery(); } catch (Exception ignored) {}
            try { client.stopAllEndpoints(); } catch (Exception ignored) {}
        }
        nearbyConnectedEndpoints.clear();
        nearbyConnectingEndpoints.clear();
        nearbyAssemblies.clear();
        emitNearbyState("stopped");
        JSObject result = new JSObject();
        result.put("stopped", true);
        result.put("connectedCount", 0);
        call.resolve(result);
    }

    @PluginMethod
    public void sendNearbyPacket(PluginCall call) {
        String encoded = call.getString("packet", "");
        String excludeEndpointId = call.getString("excludeEndpointId", "");
        if (encoded == null || encoded.isEmpty()) {
            call.reject("An encrypted mesh packet is required.");
            return;
        }
        byte[] packet;
        try { packet = Base64.decode(encoded, Base64.URL_SAFE | Base64.NO_WRAP); }
        catch (IllegalArgumentException error) { call.reject("Nearby packet encoding is invalid."); return; }
        if (packet.length == 0 || packet.length > MAX_LOCAL_PACKET_BYTES) {
            call.reject("Nearby packet exceeds the allowed 256 KiB limit.");
            return;
        }
        ConnectionsClient client = nearbyClient;
        if (!nearbyMeshRunning || client == null) {
            call.resolve(new JSObject().put("sent", 0).put("connectedCount", 0));
            return;
        }
        List<String> endpoints = new ArrayList<>();
        for (String endpoint : nearbyConnectedEndpoints) {
            if (endpoint != null && !endpoint.equals(excludeEndpointId)) endpoints.add(endpoint);
        }
        if (endpoints.isEmpty()) {
            call.resolve(new JSObject().put("sent", 0).put("connectedCount", nearbyConnectedEndpoints.size()));
            return;
        }
        String transferId = UUID.randomUUID().toString();
        int total = (int) Math.ceil((double) packet.length / NEARBY_CHUNK_BYTES);
        if (total < 1 || total > MAX_NEARBY_CHUNKS) {
            call.reject("Nearby packet chunk count exceeds the safe limit.");
            return;
        }
        int sent = 0;
        for (String endpoint : endpoints) {
            boolean queuedAll = true;
            for (int index = 0; index < total; index++) {
                int start = index * NEARBY_CHUNK_BYTES;
                int end = Math.min(packet.length, start + NEARBY_CHUNK_BYTES);
                byte[] piece = new byte[end - start];
                System.arraycopy(packet, start, piece, 0, piece.length);
                try {
                    JSONObject frame = new JSONObject();
                    frame.put("t", "AWN1");
                    frame.put("id", transferId);
                    frame.put("i", index);
                    frame.put("n", total);
                    frame.put("d", Base64.encodeToString(piece, Base64.URL_SAFE | Base64.NO_WRAP));
                    byte[] bytes = frame.toString().getBytes(StandardCharsets.UTF_8);
                    if (bytes.length > 30000) { queuedAll = false; break; }
                    client.sendPayload(endpoint, Payload.fromBytes(bytes))
                        .addOnFailureListener(error -> emitNearbyState("send-failed"));
                } catch (Exception error) {
                    queuedAll = false;
                    break;
                }
            }
            if (queuedAll) sent++;
        }
        JSObject result = new JSObject();
        result.put("sent", sent);
        result.put("connectedCount", nearbyConnectedEndpoints.size());
        result.put("anonymous", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stopPacketTransport(PluginCall call) {
        stopPacketTransportInternal("user");
        JSObject result = new JSObject();
        result.put("stopped", true);
        call.resolve(result);
    }

    private void ensureWifiP2p() {
        try {
            if (wifiP2pManager == null) wifiP2pManager = (WifiP2pManager) getContext().getSystemService(Context.WIFI_P2P_SERVICE);
            if (wifiP2pManager != null && wifiChannel == null) {
                wifiChannel = wifiP2pManager.initialize(getContext(), getActivity().getMainLooper(), () -> emitTransportState("wifi-channel-disconnected", ""));
            }
        } catch (Exception error) {
            emitTransportState("wifi-direct-unavailable", error.getClass().getSimpleName());
        }
    }

    private void startPacketServer(PluginCall call) {
        transportExecutor.execute(() -> {
            try {
                ServerSocket existing = transportServer;
                if (existing == null || existing.isClosed()) {
                    ServerSocket server = new ServerSocket();
                    server.setReuseAddress(true);
                    server.bind(new InetSocketAddress(LOCAL_PACKET_PORT), 2);
                    transportServer = server;
                    transportClosed = false;
                    transportExecutor.execute(() -> acceptPacketClients(server));
                }
                JSObject result = new JSObject();
                result.put("listening", true);
                result.put("connected", isTransportConnected());
                result.put("role", "group-owner");
                result.put("port", LOCAL_PACKET_PORT);
                call.resolve(result);
                emitTransportState("packet-server-listening", String.valueOf(LOCAL_PACKET_PORT));
            } catch (Exception error) {
                call.reject("Could not start the local packet listener.", error);
            }
        });
    }

    private void acceptPacketClients(ServerSocket server) {
        while (!transportClosed && server != null && !server.isClosed()) {
            try {
                Socket socket = server.accept();
                socket.setKeepAlive(true);
                socket.setTcpNoDelay(true);
                attachTransportSocket(socket);
            } catch (Exception error) {
                if (!transportClosed) emitTransportState("packet-accept-failed", error.getClass().getSimpleName());
                break;
            }
        }
    }

    private void connectPacketClient(String host, PluginCall call) {
        transportExecutor.execute(() -> {
            try {
                Socket socket = new Socket();
                socket.connect(new InetSocketAddress(host, LOCAL_PACKET_PORT), 8000);
                socket.setKeepAlive(true);
                socket.setTcpNoDelay(true);
                attachTransportSocket(socket);
                JSObject result = new JSObject();
                result.put("connected", true);
                result.put("role", "group-client");
                result.put("host", host);
                result.put("port", LOCAL_PACKET_PORT);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Could not connect to the Wi-Fi Direct packet listener.", error);
            }
        });
    }

    private void attachTransportSocket(Socket socket) {
        closeTransportSocket("replaced");
        transportSocket = socket;
        transportClosed = false;
        emitTransportState("packet-transport-connected", socket.getInetAddress() == null ? "" : socket.getInetAddress().getHostAddress());
        transportExecutor.execute(() -> readTransportFrames(socket));
    }

    private void attachBluetoothTransportSocket(BluetoothSocket socket) {
        closeTransportSocket("replaced");
        bluetoothTransportSocket = socket;
        transportClosed = false;
        String address = "";
        try { address = socket.getRemoteDevice() == null ? "" : socket.getRemoteDevice().getAddress(); } catch (SecurityException ignored) {}
        emitTransportState("packet-transport-connected", address);
        transportExecutor.execute(() -> readBluetoothFrames(socket));
    }

    private void acceptBluetoothClients(BluetoothServerSocket server) {
        while (!bluetoothServerClosed && server != null) {
            try {
                BluetoothSocket socket = server.accept();
                if (socket != null) attachBluetoothTransportSocket(socket);
            } catch (Exception error) {
                if (!bluetoothServerClosed) emitTransportState("bluetooth-accept-failed", error.getClass().getSimpleName());
                break;
            }
        }
    }

    private void readBluetoothFrames(BluetoothSocket socket) {
        try {
            DataInputStream input = new DataInputStream(socket.getInputStream());
            while (!transportClosed && socket.isConnected()) {
                int length = input.readInt();
                if (length <= 0 || length > MAX_LOCAL_PACKET_BYTES) throw new IllegalStateException("Invalid Bluetooth packet length.");
                byte[] packet = new byte[length];
                input.readFully(packet);
                JSObject payload = new JSObject();
                payload.put("packet", Base64.encodeToString(packet, Base64.URL_SAFE | Base64.NO_WRAP));
                payload.put("bytes", length);
                payload.put("transport", "bluetooth-rfcomm");
                notifyListeners("localPacketReceived", payload);
            }
        } catch (Exception error) {
            if (!transportClosed) emitTransportState("packet-transport-disconnected", error.getClass().getSimpleName());
            closeBluetoothTransportSocketFor(socket, "peer-disconnected");
        }
    }

    private void readTransportFrames(Socket socket) {
        try {
            DataInputStream input = new DataInputStream(socket.getInputStream());
            while (!transportClosed && !socket.isClosed()) {
                int length = input.readInt();
                if (length <= 0 || length > MAX_LOCAL_PACKET_BYTES) throw new IllegalStateException("Invalid local packet length.");
                byte[] packet = new byte[length];
                input.readFully(packet);
                JSObject payload = new JSObject();
                payload.put("packet", Base64.encodeToString(packet, Base64.URL_SAFE | Base64.NO_WRAP));
                payload.put("bytes", length);
                notifyListeners("localPacketReceived", payload);
            }
        } catch (Exception error) {
            if (!transportClosed) emitTransportState("packet-transport-disconnected", error.getClass().getSimpleName());
            closeTransportSocketFor(socket, "peer-disconnected");
        }
    }

    private boolean isTransportConnected() {
        Socket socket = transportSocket;
        BluetoothSocket bluetoothSocket = bluetoothTransportSocket;
        boolean wifiReady = socket != null && socket.isConnected() && !socket.isClosed();
        boolean bluetoothReady = bluetoothSocket != null && bluetoothSocket.isConnected();
        return wifiReady || bluetoothReady;
    }

    private boolean isBluetoothTransportConnected() {
        BluetoothSocket socket = bluetoothTransportSocket;
        return socket != null && socket.isConnected();
    }

    private void closeTransportSocket(String reason) {
        Socket socket = transportSocket;
        BluetoothSocket bluetoothSocket = bluetoothTransportSocket;
        transportSocket = null;
        bluetoothTransportSocket = null;
        if (socket != null) try { socket.close(); } catch (Exception ignored) {}
        if (bluetoothSocket != null) try { bluetoothSocket.close(); } catch (Exception ignored) {}
        emitTransportState("packet-transport-closed", reason);
    }

    private void closeBluetoothTransportSocketFor(BluetoothSocket expected, String reason) {
        if (bluetoothTransportSocket != expected) {
            try { if (expected != null) expected.close(); } catch (Exception ignored) {}
            return;
        }
        bluetoothTransportSocket = null;
        if (expected != null) try { expected.close(); } catch (Exception ignored) {}
        emitTransportState("packet-transport-closed", reason);
    }

    private void closeTransportSocketFor(Socket expected, String reason) {
        if (transportSocket != expected) {
            try { if (expected != null) expected.close(); } catch (Exception ignored) {}
            return;
        }
        transportSocket = null;
        closeSocketAndNotify(expected, reason);
    }

    private void closeSocketAndNotify(Socket socket, String reason) {
        if (socket != null) try { socket.close(); } catch (Exception ignored) {}
        emitTransportState("packet-transport-closed", reason);
    }

    private void stopPacketTransportInternal(String reason) {
        transportClosed = true;
        closeTransportSocket(reason);
        ServerSocket server = transportServer;
        transportServer = null;
        if (server != null) try { server.close(); } catch (Exception ignored) {}
        bluetoothServerClosed = true;
        BluetoothServerSocket bluetoothServer = bluetoothServerSocket;
        bluetoothServerSocket = null;
        if (bluetoothServer != null) try { bluetoothServer.close(); } catch (Exception ignored) {}
    }

    private void emitTransportState(String state, String detail) {
        JSObject payload = new JSObject();
        payload.put("state", state);
        payload.put("detail", detail);
        payload.put("transportReady", isTransportConnected());
        payload.put("transport", isBluetoothTransportConnected() ? "bluetooth-rfcomm" : "wifi-direct-tcp");
        notifyListeners("transportState", payload);
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        stopDiscoveryInternal("user");
        JSObject result = new JSObject();
        result.put("stopped", true);
        call.resolve(result);
    }

    private void requestPermissionsForCurrentApi(PluginCall call, String callbackName) {
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissionForAliases(new String[] { "nearbyWifi", "bluetooth" }, call, callbackName);
        } else if (Build.VERSION.SDK_INT >= 31) {
            requestPermissionForAliases(new String[] { "legacyLocation", "bluetooth" }, call, callbackName);
        } else {
            requestPermissionForAlias("legacyLocation", call, callbackName);
        }
    }

    private boolean hasDiscoveryPermissions() {
        boolean wifiPermission = Build.VERSION.SDK_INT >= 33
            ? getPermissionState("nearbyWifi") == PermissionState.GRANTED
            : getPermissionState("legacyLocation") == PermissionState.GRANTED;
        boolean bluetoothPermission = Build.VERSION.SDK_INT < 31
            || getPermissionState("bluetooth") == PermissionState.GRANTED;
        return wifiPermission && bluetoothPermission;
    }

    private void startDiscoveryNow(PluginCall call) {
        boolean wifiStarted = startWifiDirectDiscovery();
        boolean bluetoothStarted = startBluetoothDiscovery();

        if (!wifiStarted && !bluetoothStarted) {
            call.reject("No nearby discovery transport could start. Check Wi-Fi/Bluetooth support, device settings and permissions.");
            return;
        }

        if (handler != null) {
            handler.removeCallbacks(discoveryTimeout);
            handler.postDelayed(discoveryTimeout, DISCOVERY_TIMEOUT_MS);
        }
        JSObject result = new JSObject();
        result.put("started", true);
        result.put("wifiDirectStarted", wifiStarted);
        result.put("bluetoothDiscoveryStarted", bluetoothStarted);
        result.put("phase", "discovery-only");
        result.put("transportReady", false);
        result.put("message", "Nearby devices can be discovered. Connect a Wi-Fi Direct peer to start the encrypted local packet transport.");
        call.resolve(result);
        emitDiscoveryState("scanning", "user");
    }

    private boolean startWifiDirectDiscovery() {
        if (!getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_WIFI_DIRECT)) return false;
        if (!isLocationModeEnabled()) {
            emitDiscoveryState("wifi-location-required", "system");
            return false;
        }
        try {
            wifiP2pManager = (WifiP2pManager) getContext().getSystemService(Context.WIFI_P2P_SERVICE);
            if (wifiP2pManager == null) return false;
            if (wifiChannel == null) {
                wifiChannel = wifiP2pManager.initialize(getContext(), getActivity().getMainLooper(), null);
                if (wifiChannel == null) return false;
            }
            ensureReceiverRegistered();
            wifiP2pManager.discoverPeers(wifiChannel, new WifiP2pManager.ActionListener() {
                @Override public void onSuccess() {
                    wifiDiscoveryActive = true;
                    emitDiscoveryState("wifi-direct-scanning", "wifi-direct");
                    requestWifiPeers();
                }
                @Override public void onFailure(int reason) {
                    wifiDiscoveryActive = false;
                    emitDiscoveryState("wifi-direct-unavailable", String.valueOf(reason));
                }
            });
            return true;
        } catch (SecurityException error) {
            emitDiscoveryState("wifi-permission-denied", "wifi-direct");
            return false;
        } catch (Exception error) {
            emitDiscoveryState("wifi-direct-error", error.getClass().getSimpleName());
            return false;
        }
    }

    private boolean startBluetoothDiscovery() {
        bluetoothAdapter = getBluetoothAdapter();
        if (bluetoothAdapter == null) return false;
        try {
            if (!bluetoothAdapter.isEnabled()) {
                emitDiscoveryState("bluetooth-disabled", "bluetooth");
                return false;
            }
            ensureReceiverRegistered();
            if (bluetoothAdapter.isDiscovering()) bluetoothAdapter.cancelDiscovery();
            bluetoothDiscoveryActive = bluetoothAdapter.startDiscovery();
            emitDiscoveryState(bluetoothDiscoveryActive ? "bluetooth-scanning" : "bluetooth-scan-unavailable", "bluetooth");
            return bluetoothDiscoveryActive;
        } catch (SecurityException error) {
            emitDiscoveryState("bluetooth-permission-denied", "bluetooth");
            return false;
        } catch (Exception error) {
            emitDiscoveryState("bluetooth-error", error.getClass().getSimpleName());
            return false;
        }
    }

    private BluetoothAdapter getBluetoothAdapter() {
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                android.bluetooth.BluetoothManager manager = (android.bluetooth.BluetoothManager)
                    getContext().getSystemService(Context.BLUETOOTH_SERVICE);
                return manager == null ? null : manager.getAdapter();
            }
            return BluetoothAdapter.getDefaultAdapter();
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean isLocationModeEnabled() {
        try {
            LocationManager location = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 28 && location != null) return location.isLocationEnabled();
            return Settings.Secure.getInt(getContext().getContentResolver(), Settings.Secure.LOCATION_MODE, 0)
                != Settings.Secure.LOCATION_MODE_OFF;
        } catch (Exception ignored) {
            return false;
        }
    }

    private void ensureReceiverRegistered() {
        if (receiverRegistered) return;
        IntentFilter filter = new IntentFilter();
        filter.addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION);
        filter.addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION);
        filter.addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION);
        filter.addAction(BluetoothDevice.ACTION_FOUND);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        filter.addAction(BluetoothAdapter.ACTION_STATE_CHANGED);

        receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if (intent == null || intent.getAction() == null) return;
                String action = intent.getAction();
                if (WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION.equals(action)) {
                    requestWifiPeers();
                } else if (WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION.equals(action)) {
                    requestWifiConnectionInfo();
                } else if (WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION.equals(action)) {
                    int state = intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1);
                    emitDiscoveryState(state == WifiP2pManager.WIFI_P2P_STATE_ENABLED ? "wifi-direct-enabled" : "wifi-direct-disabled", "wifi-direct");
                } else if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                    emitBluetoothPeer(intent);
                } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                    bluetoothDiscoveryActive = false;
                    emitDiscoveryState("bluetooth-discovery-finished", "bluetooth");
                } else if (BluetoothAdapter.ACTION_STATE_CHANGED.equals(action)) {
                    emitDiscoveryState("bluetooth-state-changed", "bluetooth");
                }
            }
        };
        try {
            if (Build.VERSION.SDK_INT >= 33) getContext().registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
            else getContext().registerReceiver(receiver, filter);
            receiverRegistered = true;
        } catch (Exception error) {
            receiver = null;
            emitDiscoveryState("receiver-registration-failed", error.getClass().getSimpleName());
        }
    }

    private void requestWifiPeers() {
        if (wifiP2pManager == null || wifiChannel == null) return;
        try {
            wifiP2pManager.requestPeers(wifiChannel, peers -> emitWifiPeers(peers));
        } catch (SecurityException error) {
            emitDiscoveryState("wifi-peer-list-permission-denied", "wifi-direct");
        }
    }

    private void emitWifiPeers(WifiP2pDeviceList peers) {
        List<JSObject> list = new ArrayList<>();
        for (WifiP2pDevice device : peers.getDeviceList()) {
            JSObject item = new JSObject();
            item.put("transport", "wifi-direct");
            item.put("name", device.deviceName == null || device.deviceName.isEmpty() ? "جهاز قريب" : device.deviceName);
            item.put("address", device.deviceAddress);
            item.put("status", device.status);
            item.put("verified", false);
            item.put("authenticationRequired", true);
            list.add(item);
        }
        JSObject payload = new JSObject();
        payload.put("peers", list);
        payload.put("transport", "wifi-direct");
        notifyListeners("peersDiscovered", payload);
    }

    private void emitBluetoothPeer(Intent intent) {
        try {
            BluetoothDevice device;
            if (Build.VERSION.SDK_INT >= 33) device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice.class);
            else {
                //noinspection deprecation
                device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
            }
            if (device == null) return;
            JSObject item = new JSObject();
            item.put("transport", "bluetooth");
            String name = "جهاز Bluetooth قريب";
            try {
                String found = device.getName();
                if (found != null && !found.trim().isEmpty()) name = found.trim();
            } catch (SecurityException ignored) {}
            item.put("name", name);
            try { item.put("address", device.getAddress()); } catch (SecurityException ignored) {}
            try { item.put("bondState", device.getBondState()); } catch (SecurityException ignored) {}
            item.put("verified", false);
            item.put("authenticationRequired", true);
            JSObject payload = new JSObject();
            payload.put("peer", item);
            notifyListeners("peerDiscovered", payload);
        } catch (Exception error) {
            emitDiscoveryState("bluetooth-device-read-failed", error.getClass().getSimpleName());
        }
    }

    private void requestWifiConnectionInfo() {
        if (wifiP2pManager == null || wifiChannel == null) return;
        try {
            wifiP2pManager.requestConnectionInfo(wifiChannel, info -> {
                JSObject payload = new JSObject();
                payload.put("groupFormed", info.groupFormed);
                payload.put("isGroupOwner", info.isGroupOwner);
                payload.put("groupOwnerAddress", info.groupOwnerAddress == null ? "" : info.groupOwnerAddress.getHostAddress());
                payload.put("transportReady", isTransportConnected());
                payload.put("verified", false);
                notifyListeners("wifiDirectLinkChanged", payload);
            });
        } catch (SecurityException error) {
            emitDiscoveryState("wifi-link-info-permission-denied", "wifi-direct");
        }
    }

    private void emitDiscoveryState(String state, String detail) {
        JSObject payload = new JSObject();
        payload.put("state", state);
        payload.put("detail", detail);
        payload.put("phase", "discovery-only");
        payload.put("transportReady", false);
        notifyListeners("discoveryState", payload);
    }

    @Override
    protected void handleOnDestroy() {
        stopPacketTransportInternal("plugin-destroyed");
        nearbyMeshRunning = false;
        try { if (nearbyClient != null) { nearbyClient.stopAdvertising(); nearbyClient.stopDiscovery(); nearbyClient.stopAllEndpoints(); } } catch (Exception ignored) {}
        nearbyConnectedEndpoints.clear(); nearbyConnectingEndpoints.clear(); nearbyAssemblies.clear();
        stopDiscoveryInternal("plugin-destroyed");
        transportExecutor.shutdownNow();
        super.handleOnDestroy();
    }

    private void stopDiscoveryInternal(String reason) {
        if (handler != null) handler.removeCallbacks(discoveryTimeout);
        try {
            if (wifiP2pManager != null && wifiChannel != null && wifiDiscoveryActive) {
                wifiP2pManager.stopPeerDiscovery(wifiChannel, new WifiP2pManager.ActionListener() {
                    @Override public void onSuccess() { wifiDiscoveryActive = false; }
                    @Override public void onFailure(int ignored) { wifiDiscoveryActive = false; }
                });
            }
        } catch (Exception ignored) { wifiDiscoveryActive = false; }
        try { if (bluetoothAdapter != null && bluetoothDiscoveryActive) bluetoothAdapter.cancelDiscovery(); }
        catch (Exception ignored) {}
        bluetoothDiscoveryActive = false;
        if (receiverRegistered && receiver != null) {
            try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) {}
        }
        receiverRegistered = false;
        receiver = null;
        emitDiscoveryState("stopped", reason);
    }
}
