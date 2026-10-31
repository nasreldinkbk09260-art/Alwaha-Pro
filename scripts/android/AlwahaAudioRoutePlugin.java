package __ALWAHA_PACKAGE__;

import android.content.ClipData;
import android.content.Intent;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AlwahaAudioRoute")
public class AlwahaAudioRoutePlugin extends Plugin {
    @PluginMethod
    public void setRoute(PluginCall call) {
        Boolean requested = call.getBoolean("speaker");
        boolean speaker = requested != null && requested;
        AudioManager audio = (AudioManager) getContext().getSystemService(getContext().AUDIO_SERVICE);
        if (audio == null) { call.reject("Android audio service is unavailable."); return; }
        try {
            audio.setMode(AudioManager.MODE_IN_COMMUNICATION);
            String route = speaker ? "speaker" : "earpiece";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AudioDeviceInfo target = null;
                for (AudioDeviceInfo device : audio.getAvailableCommunicationDevices()) {
                    int type = device.getType();
                    if ((speaker && type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) || (!speaker && type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE)) { target = device; break; }
                }
                if (target != null) {
                    if (!audio.setCommunicationDevice(target)) { call.reject("Android rejected the requested audio route."); return; }
                } else {
                    audio.clearCommunicationDevice();
                    audio.setSpeakerphoneOn(speaker);
                    route = speaker ? "speaker" : "system-default";
                }
            } else {
                audio.setSpeakerphoneOn(speaker);
            }
            JSObject result = new JSObject(); result.put("speaker", speaker); result.put("route", route); call.resolve(result);
        } catch (Exception error) { call.reject("Could not change Android call audio route.", error); }
    }

    @PluginMethod
    public void shareApk(PluginCall call) {
        new Thread(() -> {
            try {
                File source = new File(getContext().getApplicationInfo().sourceDir);
                File shareDirectory = new File(getContext().getCacheDir(), "shared-apk");
                if (!shareDirectory.exists() && !shareDirectory.mkdirs()) throw new IllegalStateException("Could not create APK share cache.");
                File apkCopy = new File(shareDirectory, "Alwaha-Pro-3.0.1.apk");
                try (InputStream input = new FileInputStream(source); OutputStream output = new FileOutputStream(apkCopy, false)) {
                    byte[] buffer = new byte[64 * 1024];
                    int read;
                    while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read);
                    output.flush();
                }
                Uri apkUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".alwaha-fileprovider", apkCopy);
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("application/vnd.android.package-archive");
                send.putExtra(Intent.EXTRA_STREAM, apkUri);
                send.setClipData(ClipData.newUri(getContext().getContentResolver(), "Alwaha-Pro APK", apkUri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().runOnUiThread(() -> {
                    try {
                        Intent chooser = Intent.createChooser(send, "مشاركة تطبيق Alwaha-Pro");
                        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        getActivity().startActivity(chooser);
                        call.resolve();
                    } catch (Exception error) { call.reject("Could not open Android app sharing options.", error); }
                });
            } catch (Exception error) { call.reject("Could not prepare the installed Alwaha-Pro APK for sharing.", error); }
        }).start();
    }

    @PluginMethod
    public void resetRoute(PluginCall call) {
        AudioManager audio = (AudioManager) getContext().getSystemService(getContext().AUDIO_SERVICE);
        try {
            if (audio != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) audio.clearCommunicationDevice();
                audio.setSpeakerphoneOn(false);
                audio.setMode(AudioManager.MODE_NORMAL);
            }
            call.resolve();
        } catch (Exception error) { call.reject("Could not reset Android call audio route.", error); }
    }
}
