package __ALWAHA_PACKAGE__;

import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
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
