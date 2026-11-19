package __ALWAHA_PACKAGE__;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
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

import java.util.ArrayList;
import java.util.List;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

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
    private final ExecutorService transportExecutor = Executors.newCachedThreadPool();
    private volatile ServerSocket transportServer;
    private volatile Socket transportSocket;
    private volatile boolean transportClosed = false;
    private final Object transportWriteLock = new Object();
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
        result.put("phase", "wifi-direct-store-forward");
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
        if (socket == null || socket.isClosed() || !socket.isConnected()) {
            call.reject("No Wi-Fi Direct packet transport is connected.");
            return;
        }
        transportExecutor.execute(() -> {
            try {
                synchronized (transportWriteLock) {
                    DataOutputStream output = new DataOutputStream(socket.getOutputStream());
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
        return socket != null && socket.isConnected() && !socket.isClosed();
    }

    private void closeTransportSocket(String reason) {
        Socket socket = transportSocket;
        transportSocket = null;
        closeSocketAndNotify(socket, reason);
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
    }

    private void emitTransportState(String state, String detail) {
        JSObject payload = new JSObject();
        payload.put("state", state);
        payload.put("detail", detail);
        payload.put("transportReady", isTransportConnected());
        payload.put("transport", "wifi-direct-tcp");
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
