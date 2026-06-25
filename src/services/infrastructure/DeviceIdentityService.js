import { Preferences } from '@capacitor/preferences';
import { PlatformService } from './PlatformService';

const DEVICE_ID_KEY = 'zenith_device_id';

export class DeviceIdentityService {
  static async getDeviceId() {
    if (PlatformService.isNative()) {
      try {
        const { value } = await Preferences.get({ key: DEVICE_ID_KEY });
        if (value) return value;

        const newId = crypto.randomUUID();
        await Preferences.set({ key: DEVICE_ID_KEY, value: newId });
        return newId;
      } catch (err) {
        console.error('[DeviceIdentityService] Capacitor preferences failed, fallback to random UUID:', err);
        return crypto.randomUUID();
      }
    } else {
      let devId = localStorage.getItem(DEVICE_ID_KEY);
      if (!devId) {
        devId = crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, devId);
      }
      return devId;
    }
  }
}
