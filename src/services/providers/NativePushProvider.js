import { PushNotifications } from '@capacitor/push-notifications';
import { PlatformService } from '../infrastructure/PlatformService';

export class NativePushProvider {
  constructor() {
    this.tokenCallback = null;
  }

  /**
   * Bind event handlers, register devices, and listen for tokens asynchronously
   */
  async register(userId, deviceId, onTokenRegistered) {
    this.tokenCallback = async (token) => {
      if (!token?.value) {
        console.warn('[NativePushProvider] Empty registration token received');
        return;
      }

      localStorage.setItem('fcm_token', token.value);

      const deviceData = {
        user_id: userId,
        device_id: deviceId,
        transport: 'fcm',
        platform: PlatformService.getPlatformName(),
        token: token.value,
        device_name: `${PlatformService.getPlatformName().toUpperCase()} Device`,
        user_agent: PlatformService.getUserAgent()
      };
      
      await onTokenRegistered(deviceData);
    };

    // Remove existing event registrations to prevent duplicates
    try {
      await PushNotifications.removeAllListeners();
    } catch (e) {
      console.warn('[NativePushProvider] removeAllListeners failed:', e);
    }

    // Set up core listeners
    await PushNotifications.addListener('registration', this.tokenCallback);
    
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[NativePushProvider] FCM Registration Error:', error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Handled by standard OS banners
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      if (action.notification.data?.url) {
        // Safe navigation via location hashing for single-page routing
        window.location.hash = action.notification.data.url;
      }
    });

    // Fire the native registration process
    await PushNotifications.register();
  }
}
