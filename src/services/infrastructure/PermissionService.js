import { PushNotifications } from '@capacitor/push-notifications';
import { PlatformService } from './PlatformService';

export class PermissionService {
  static async checkState() {
    if (PlatformService.isNative()) {
      try {
        const status = await PushNotifications.checkPermissions();
        return status.receive;
      } catch (err) {
        console.error('[PermissionService] Failed to check native permissions:', err);
        return 'prompt';
      }
    } else {
      if (!('Notification' in window)) return 'unsupported';
      return Notification.permission;
    }
  }

  static async request() {
    if (PlatformService.isNative()) {
      try {
        const status = await PushNotifications.requestPermissions();
        return status.receive;
      } catch (err) {
        console.error('[PermissionService] Failed to request native permissions:', err);
        return 'denied';
      }
    } else {
      if (!('Notification' in window)) return 'unsupported';
      return await Notification.requestPermission();
    }
  }
}
