import { Preferences } from '@capacitor/preferences';
import { PlatformService } from './PlatformService';

const DEVICE_ID_KEY = 'zenith_device_id';

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export class DeviceIdentityService {
  static async getDeviceId() {
    if (PlatformService.isNative()) {
      try {
        const { value } = await Preferences.get({ key: DEVICE_ID_KEY });
        if (value && value !== 'undefined' && value !== 'null') return value;

        const newId = generateUUID();
        await Preferences.set({ key: DEVICE_ID_KEY, value: newId });
        return newId;
      } catch (err) {
        console.error('[DeviceIdentityService] Capacitor preferences failed, fallback to generated UUID:', err);
        return generateUUID();
      }
    } else {
      let devId = localStorage.getItem(DEVICE_ID_KEY);
      if (!devId || devId === 'undefined' || devId === 'null') {
        devId = generateUUID();
        localStorage.setItem(DEVICE_ID_KEY, devId);
      }
      return devId;
    }
  }
}
