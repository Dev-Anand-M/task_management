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
      return;
    }

    try {
      const permission = await PermissionService.request();
      if (permission !== 'granted') {
        return;
      }

      // Re-verify device/user identity after async permission check to prevent logout race conditions
      if (!this.userId || !this.deviceId) {
        console.warn('[NotificationManager] Registration aborted: identity cleared during permission request');
        return;
      }

      if (PlatformService.isNative()) {
        await this.provider.register(this.userId, this.deviceId, async (deviceData) => {
          try {
            if (!deviceData || !deviceData.user_id || !deviceData.device_id) {
              console.warn('[NotificationManager] Native registration payload missing user_id or device_id');
              return;
            }
            await PushSubscriptionRepository.registerDevice(deviceData);
          } catch (dbErr) {
            console.error('[NotificationManager] Native registration DB error:', dbErr);
          }
        });
      } else {
        const registrationData = await this.provider.register(this.userId, this.deviceId);
        if (!registrationData || !registrationData.user_id || !registrationData.device_id) {
          console.warn('[NotificationManager] Web registration payload missing user_id or device_id');
          return;
        }
        await PushSubscriptionRepository.registerDevice(registrationData);
      }
    } catch (err) {
      console.error('[NotificationManager] Registration failed:', err);
    }
  }

  /**
   * Update the settings/enable status for the current device subscription
   */
  async setEnabled(enabled) {
    if (!this.userId || !this.deviceId) {
      return;
    }
    try {
      await PushSubscriptionRepository.updateSettings(this.userId, this.deviceId, enabled);
    } catch (err) {
      console.error('[NotificationManager] Failed to update settings:', err);
    }
  }

  /**
   * Clean up user context on logout (keeps subscription active in DB for background updates)
   */
  async unregister() {
    this.userId = null;
  }
}

export const NotificationManager = new NotificationManagerService();
