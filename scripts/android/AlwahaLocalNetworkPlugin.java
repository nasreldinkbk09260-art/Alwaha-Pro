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

@CapacitorPlugin(
    name = "AlwahaLocalNetwork",
    permissions = {
        @Permission(alias = "nearbyWifi", strings = { Manifest.permission.NEARBY_WIFI_DEVICES }),
        @Permission(alias = "bluetooth", strings = {
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT
        }),
        @Permission(alias = "legacyLocation", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
public class AlwahaLocalNetworkPlugin extends Plugin {
    private static final long DISCOVERY_TIMEOUT_MS = 25000L;
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
        result.put("phase", "discovery-only");
        result.put("wifiDirectSupported", wifiDirect);
        result.put("wifiEnabled", wifiEnabled);
        result.put("bluetoothClassicSupported", bluetooth != null);
        result.put("bluetoothEnabled", bluetoothEnabled);
        result.put("androidApi", Build.VERSION.SDK_INT);
        result.put("targetSdk", targetSdk);
        result.put("locationModeEnabled", isLocationModeEnabled());
        result.put("permissionsGranted", hasDiscoveryPermissions());
        result.put("transportReady", false);
        result.put("chatReady", false);
        result.put("fileTransferReady", false);
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
        result.put("message", "Nearby devices can be discovered, but encrypted data transport is not enabled in this build.");
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
                payload.put("transportReady", false);
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
