import { App } from '@capacitor/app';
import { registerPlugin } from '@capacitor/core';

const AlwahaAudioRoute = registerPlugin('AlwahaAudioRoute');
window.alwahaAudioRoute = AlwahaAudioRoute;

function handleAndroidBack() {
  if (typeof window.navigateBack === 'function') {
    window.navigateBack();
  } else {
    console.warn('[Alwaha-Pro] navigateBack is not available yet.');
  }
}

if (window.Capacitor?.getPlatform?.() === 'android') {
  window.alwahaExitNativeApp = () => App.exitApp();
  App.addListener('backButton', handleAndroidBack)
    .then(() => console.info('[Alwaha-Pro] Android back-button handler registered.'))
    .catch((error) => console.warn('[Alwaha-Pro] Could not register Android back handler:', error));
}
