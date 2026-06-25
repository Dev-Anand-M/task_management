import { Capacitor } from '@capacitor/core';

export class PlatformService {
  static isNative() {
    return Capacitor.isNativePlatform();
  }

  static getPlatformName() {
    return Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web';
  }

  static getBrowserName() {
    const ua = navigator.userAgent;
    if (ua.match(/chrome|chromium|crios/i)) return 'Chrome';
    if (ua.match(/firefox|fxios/i)) return 'Firefox';
    if (ua.match(/safari/i)) return 'Safari';
    if (ua.match(/edg/i)) return 'Edge';
    return 'Browser';
  }

  static getUserAgent() {
    return navigator.userAgent;
  }
}
