/**
 * Security Detector Service
 * Detects DevTools/Inspector, Android Developer Options, and VPN/Proxy usage.
 */

import { registerPlugin } from '@capacitor/core';
import { PlatformService } from './infrastructure/PlatformService';

const NativeSecurityStatus = registerPlugin('SecurityStatus');

class SecurityDetectorService {
  constructor() {
    this.isDevToolsOpen = false;
    this.isVpnDetected = false;
    this.isDeveloperModeDetected = false;
    this.isTorOrIpBlocked = false;
    this.nativeVpnDetected = false;
    this.serverVpnDetected = false;
    this.clientVpnDetected = false;
    this.reasons = [];
    this.listeners = new Set();
    this.isChecking = false;
    this.checkInterval = null;
    this.monitorIntervalMs = 30000; // 30s lazy loop (optimized for performance)
    this.vpnCheckTtlMs = 10000; // 10s VPN cache TTL (less aggressive polling)
    this.devToolsTrapIntervalMs = 30000; // 30s trap interval (reduced overhead)
    this.lastVpnCheckAt = 0;
    this.lastDevToolsTrapAt = 0;

    this.initKeyboardProtection();
  }

  startMonitoring() {
    this.runSecurityCheck(true);

    if (!this.checkInterval) {
      this.checkInterval = setInterval(() => {
        this.runSecurityCheck(false);
      }, this.monitorIntervalMs);
    }

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('focus', this.handleFocus);
    window.addEventListener('online', this.handleFocus);
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('online', this.handleFocus);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    const status = {
      isRestricted: this.isDevToolsOpen || this.isVpnDetected || this.isDeveloperModeDetected || this.isTorOrIpBlocked,
      isDevToolsOpen: this.isDevToolsOpen,
      isVpnDetected: this.isVpnDetected,
      isDeveloperModeDetected: this.isDeveloperModeDetected,
      isTorOrIpBlocked: this.isTorOrIpBlocked,
      reasons: this.reasons
    };
    this.listeners.forEach(fn => fn(status));
  }

  handleResize = () => {
    this.runSecurityCheck(false);
  };

  handleFocus = () => {
    this.runSecurityCheck(true);
  };

  resetManualOverride() {
    this.isDevToolsOpen = false;
    this.isVpnDetected = false;
    this.isDeveloperModeDetected = false;
    this.isTorOrIpBlocked = false;
    this.nativeVpnDetected = false;
    this.serverVpnDetected = false;
    this.clientVpnDetected = false;
    this.lastVpnCheckAt = 0;
    this.lastDevToolsTrapAt = 0;
    this.reasons = [];
    this.isChecking = false;
    this.notifyListeners();
  }

  checkDevTools() {
    let devToolsFound = false;

    const threshold = 160;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;

    if (widthThreshold || heightThreshold) {
      devToolsFound = true;
    }

    const now = Date.now();
    const shouldRunTrap = now - this.lastDevToolsTrapAt > this.devToolsTrapIntervalMs;
    if (shouldRunTrap) {
      this.lastDevToolsTrapAt = now;
      const element = new Image();
      Object.defineProperty(element, 'id', {
        get: () => {
          devToolsFound = true;
        }
      });
      console.debug('%c', element);
    } else if (!devToolsFound) {
      devToolsFound = this.isDevToolsOpen;
    }

    this.isDevToolsOpen = devToolsFound;
    this.updateReasons();
  }

  async checkNativeSecurity() {
    if (!PlatformService.isNative() || PlatformService.getPlatformName() !== 'android') {
      this.nativeVpnDetected = false;
      this.isDeveloperModeDetected = false;
      this.syncVpnStatus();
      return;
    }

    try {
      const status = await NativeSecurityStatus.getStatus();
      this.nativeVpnDetected = Boolean(status?.isVpnActive);
      this.isDeveloperModeDetected = Boolean(
        status?.isDeveloperOptionsEnabled || status?.isAdbEnabled
      );
    } catch (err) {
      // Native security status unavailable - silently fail
      this.nativeVpnDetected = false;
      this.isDeveloperModeDetected = false;
    }

    this.syncVpnStatus();
  }

  async checkVpn(force = false) {
    const now = Date.now();
    if (!force && now - this.lastVpnCheckAt < this.vpnCheckTtlMs) {
      this.syncVpnStatus();
      return;
    }

    this.lastVpnCheckAt = now;

    // Run BOTH server and client checks in parallel
    await Promise.all([
      this.checkServerVpn(),
      this.checkClientVpn()
    ]);
    
    this.syncVpnStatus();
  }

  async checkServerVpn() {
    try {
      const baseUrl = PlatformService.getApiUrl().replace(/\/$/, '');
      const url = `${baseUrl}/api/security-check`;
      
      const data = await this.fetchJsonWithTimeout(url, 3500);
      if (!data) return false;
      
      this.serverVpnDetected = Boolean(data?.isVpnDetected || data?.restricted);
      return true;
    } catch (err) {
      this.serverVpnDetected = false;
      return false;
    }
  }

  async checkClientVpn() {
    // Only use HTTPS providers to avoid mixed content errors
    const providers = [
      'https://ipwho.is/',
      'https://ipapi.co/json/'
    ];

    let detected = false;
    let successfulFetches = 0;

    for (const url of providers) {
      try {
        const data = await this.fetchJsonWithTimeout(url, 3000);
        if (data && typeof data === 'object') {
          successfulFetches++;
          if (this.inspectIpMetadata(data)) {
            detected = true;
            break;
          }
        }
      } catch (err) {
        // Silent fail for individual provider
      }
    }

    // Check if user is in TOR browser or onion proxy or if ALL IP lookup providers failed/were blocked
    const isTorBrowser = (typeof navigator !== 'undefined' && /TorBrowser|Onion/i.test(navigator.userAgent)) ||
                         (typeof window !== 'undefined' && Boolean(window.TOR));

    if (successfulFetches === 0 || isTorBrowser) {
      this.isTorOrIpBlocked = true;
    } else {
      this.isTorOrIpBlocked = false;
    }

    this.clientVpnDetected = detected;
  }

  async fetchJsonWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { 
        cache: 'no-store', 
        signal: controller.signal
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      // Silent fail - timeout or network error
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  inspectIpMetadata(data) {
    if (!data || typeof data !== 'object') return false;

    // FIRST: Check boolean flags (proxy: false should NOT trigger detection)
    const security = data.security || data.privacy || {};
    const booleanFlags = [
      data.vpn, data.proxy, data.tor, data.hosting,
      data.is_vpn, data.is_proxy, data.is_tor, data.is_hosting,
      security.vpn, security.proxy, security.tor, security.hosting, security.anonymous, security.relay
    ];

    if (booleanFlags.some(flag => flag === true)) {
      return true;
    }

    // SECOND: Check text fields only (ISP, ORG, AS description) for VPN provider names
    const textFields = [
      data.isp, data.org, data.organization, data.as, data.asn,
      data.company?.name, data.connection?.isp, data.connection?.org
    ].filter(Boolean).join(' ').toLowerCase();

    const vpnProviderNames = [
      'mullvad', 'expressvpn', 'nordvpn', 'surfshark',
      'protonvpn', 'proton ag', 'proton vpn',
      'openvpn', 'wireguard',
      'privado', 'pia', 'private internet access', 'cyberghost',
      'ipvanish', 'torguard', 'hide.me', 'windscribe',
      'purevpn', 'hotspot shield', 'strongvpn', 'vyprvpn',
      'hidemyass'
    ];

    if (vpnProviderNames.some(kw => textFields.includes(kw))) {
      return true;
    }

    // THIRD: Check for datacenter/hosting keywords in ISP/ORG fields only
    const datacenterKeywords = [
      'datacenter', 'data center', 'hosting', 'cloudflare', 
      'digitalocean', 'linode', 'vultr', 'aws', 'amazon web services',
      'google cloud', 'azure', 'microsoft cloud',
      'hetzner', 'ovh', 'fastly', 'akamai', 'leaseweb',
      'm247', 'datacamp', 'fdcservers', 'psychz', 'quadranet',
      'server hosting', 'colocation', 'dedicated server'
    ];

    if (datacenterKeywords.some(kw => textFields.includes(kw))) {
      return true;
    }

    return false;
  }

  syncVpnStatus() {
    // TOR/IP blocking is always immediate - don't require 2/3 agreement
    if (this.isTorOrIpBlocked) {
      this.isVpnDetected = true;
      this.updateReasons();
      return;
    }
    
    // For regular VPN detection: require at least 2 out of 3 detection methods to agree
    const detectionCount = [
      this.nativeVpnDetected,
      this.serverVpnDetected,
      this.clientVpnDetected
    ].filter(Boolean).length;
    
    this.isVpnDetected = detectionCount >= 2;
    this.updateReasons();
  }

  // Debug method - expose this on window for testing
  async forceVpnCheck() {
    await this.checkVpn(true);
    this.notifyListeners();
    return {
      native: this.nativeVpnDetected,
      server: this.serverVpnDetected,
      client: this.clientVpnDetected,
      detected: this.isVpnDetected,
      reasons: this.reasons
    };
  }

  async runSecurityCheck(forceVpn = false) {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      await this.checkNativeSecurity();
      this.checkDevTools();
      await this.checkVpn(forceVpn);
    } finally {
      this.isChecking = false;
      this.notifyListeners();
    }
  }

  updateReasons() {
    const list = [];
    if (this.isDevToolsOpen) {
      list.push('Developer Mode / Inspection Tools active');
    }
    if (this.isDeveloperModeDetected) {
      list.push('Android Developer Options or USB debugging active');
    }
    if (this.isVpnDetected) {
      list.push('VPN, Proxy or Datacenter IP active (e.g. ProtonVPN)');
    }
    if (this.isTorOrIpBlocked) {
      list.push('You may be in TOR or a network where IP is not detected. Please use a clearnet connection.');
    }
    this.reasons = list;
  }

  initKeyboardProtection() {
    if (typeof window === 'undefined') return;

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, true);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        this.isDevToolsOpen = true;
        this.updateReasons();
        this.notifyListeners();
        return false;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (
        (isCtrlOrCmd && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (isCtrlOrCmd && ['U', 'u'].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        this.isDevToolsOpen = true;
        this.updateReasons();
        this.notifyListeners();
        return false;
      }
    }, true);
  }
}

export const securityDetector = new SecurityDetectorService();

// Expose for debugging in development only
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.securityDetector = securityDetector;
}
