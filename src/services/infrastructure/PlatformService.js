import { Capacitor } from '@capacitor/core';

export class PlatformService {
  static isNative() {
    return Capacitor.isNativePlatform();
  }

  static getPlatformName() {
    return Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web';
  }

  static getDeviceOS() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('android') > -1) return 'android';
    if (ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1 || ua.indexOf('ipod') > -1) return 'ios';
    return 'web';
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

  static getApiUrl() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const customUrl = window.localStorage.getItem('custom_api_url');
      if (customUrl) return customUrl;
    }

    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) return envUrl;
    
    if (this.isNative()) {
      return 'https://zenith-sable-alpha.vercel.app';
    }
    
    return window.location.origin;
  }
}
