import admin from 'firebase-admin';
import { getMessaging } from 'firebase-admin/messaging';
import { DeliveryStrategy } from './DeliveryStrategy.js';

export class FCMStrategy extends DeliveryStrategy {
  canHandle(transportType) {
    return transportType === 'fcm';
  }

  async send(device, payload, options) {
    if (!admin.getApps().length) {
      return { status: 'failed', reason: 'Firebase SDK not initialized' };
    }

    try {
      const message = {
        token: device.token,
        notification: {
          title: payload.title,
          body: payload.body
        },
        data: {
          url: payload.url || '/'
        },
        android: {
          priority: 'high',
          notification: {
            channelId: payload.channelId || 'tasks'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default'
            }
          }
        }
      };

      const response = await getMessaging().send(message);
      return { status: 'sent', messageId: response };
    } catch (err) {
      const code = err.code;
      if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
        return { status: 'expired', reason: err.message };
      }
      return { status: 'failed', reason: err.message };
    }
  }
}
