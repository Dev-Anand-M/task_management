import { PlatformService } from './infrastructure/PlatformService';
import { PermissionService } from './infrastructure/PermissionService';
import { DeviceIdentityService } from './infrastructure/DeviceIdentityService';
import { PushSubscriptionRepository } from '../repositories/PushSubscriptionRepository';
import { WebPushProvider } from './providers/WebPushProvider';
import { NativePushProvider } from './providers/NativePushProvider';

class NotificationManagerService {
  constructor() {
    this.userId = null;
    this.deviceId = null;
    this.provider = PlatformService.isNative()
      ? new NativePushProvider()
      : new WebPushProvider();
  }

  /**
   * Load device installation identity
   */
  async initialize(userId) {
    this.userId = userId;
    this.deviceId = await DeviceIdentityService.getDeviceId();
    console.log(`[NotificationManager] Initialized device ID: ${this.deviceId} for user: ${this.userId}`);
  }

  getCurrentDevice() {
    return {
      deviceId: this.deviceId,
      platform: PlatformService.getPlatformName(),
      isNative: PlatformService.isNative()
    };
  }

  /**
   * Trigger the register/sync flow
   */
  async register() {
    if (!this.userId || !this.deviceId) {
      console.warn('[NotificationManager] Cannot register: initialize must be called first.');
      return;
    }

    try {
      const permission = await PermissionService.request();
      if (permission !== 'granted') {
        console.log('[NotificationManager] Registration skipped: permissions not granted');
        return;
      }

      if (PlatformService.isNative()) {
        await this.provider.register(this.userId, this.deviceId, async (deviceData) => {
          await PushSubscriptionRepository.registerDevice(deviceData);
          console.log('[NotificationManager] Native FCM device registered successfully');
        });
      } else {
        const registrationData = await this.provider.register(this.userId, this.deviceId);
        await PushSubscriptionRepository.registerDevice(registrationData);
        console.log('[NotificationManager] Web Push device registered successfully');
      }
    } catch (err) {
      console.error('[NotificationManager] Registration failed:', err);
    }
  }

  /**
   * Clean up user context on logout (keeps subscription active in DB for background updates)
   */
  async unregister() {
    console.log('[NotificationManager] User session cleared');
    this.userId = null;
  }
}

export const NotificationManager = new NotificationManagerService();
