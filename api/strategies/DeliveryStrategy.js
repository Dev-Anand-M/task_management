export class DeliveryStrategy {
  canHandle(transportType) {
    throw new Error('canHandle() must be overridden');
  }

  async send(device, payload, options) {
    throw new Error('send() must be overridden');
  }
}
