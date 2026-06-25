import webpush from 'web-push';
import { DeliveryStrategy } from './DeliveryStrategy.js';

export class WebPushStrategy extends DeliveryStrategy {
  canHandle(transportType) {
    return transportType === 'web';
  }

  async send(device, payload, options) {
    try {
      await webpush.sendNotification(
        { endpoint: device.endpoint, keys: device.keys },
        JSON.stringify(payload),
        options
      );
      return { status: 'sent' };
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        return { status: 'expired', reason: err.message };
      }
      return { status: 'failed', reason: err.message };
    }
  }
}
