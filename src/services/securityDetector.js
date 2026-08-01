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
    this.nativeVpnDetected = false;
    this.serverVpnDetected = false;
    this.clientVpnDetected = false;
    this.reasons = [];
    this.listeners = new Set();
    this.isChecking = false;
    this.checkInterval = null;
    this.monitorIntervalMs = 30000; // Increased from 15s to 30s
    this.vpnCheckTtlMs = 60000; // Increased from 30s to 60s (1 minute cache)
    this.devToolsTrapIntervalMs = 30000; // Increased from 15s to 30s
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
      isRestricted: this.isDevToolsOpen || this.isVpnDetected || this.isDeveloperModeDetected,
      isDevToolsOpen: this.isDevToolsOpen,
      isVpnDetected: this.isVpnDetected,
      isDeveloperModeDetected: this.isDeveloperModeDetected,
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
      console.warn('[SecurityDetector] Native security status unavailable:', err);
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

    const serverChecked = await this.checkServerVpn();
    if (serverChecked) {
      this.clientVpnDetected = false;
    } else {
      await this.checkClientVpn();
    }
    this.syncVpnStatus();
  }

  async checkServerVpn() {
    // Skip server check in development mode
    if (import.meta.env.DEV) {
      console.log('[SecurityDetector] ⏭️ Skipping server VPN check in development mode');
      this.serverVpnDetected = false;
      return true; // Return true to skip client check
    }

    try {
      const baseUrl = PlatformService.getApiUrl().replace(/\/$/, '');
      const url = `${baseUrl}/api/security-check`;
      console.log('[SecurityDetector] 🔍 Checking server VPN at:', url);
      
      const data = await this.fetchJsonWithTimeout(url, 3500);
      console.log('[SecurityDetector] 📦 Server response:', data);
      
      if (!data) {
        console.warn('[SecurityDetector] ⚠️ No data returned from server');
        return false;
      }
      
      this.serverVpnDetected = Boolean(data?.isVpnDetected || data?.restricted);
      console.log('[SecurityDetector] ✅ Server VPN detected:', this.serverVpnDetected);
      return true;
    } catch (err) {
      console.error('[SecurityDetector] ❌ Server VPN check failed:', err);
      this.serverVpnDetected = false;
      return false;
    }
  }

  async checkClientVpn() {
    // Skip client check in development mode
    if (import.meta.env.DEV) {
      console.log('[SecurityDetector] ⏭️ Skipping client VPN check in development mode');
      this.clientVpnDetected = false;
      return;
    }

    const providers = [
      'https://ipwho.is/',
      'https://ipapi.co/json/',
      'https://ipinfo.io/json'
    ];

    console.log('[SecurityDetector] 🔍 Starting client-side VPN check...');
    let detected = false;
    
    // RTT check - VPNs usually add 50-200ms latency
    const rttStart = performance.now();
    try {
      await fetch('https://www.google.com/favicon.ico', { cache: 'no-store', mode: 'no-cors' });
      const rtt = performance.now() - rttStart;
      console.log(`[SecurityDetector] ⏱️ RTT to Google: ${rtt.toFixed(0)}ms`);
      
      // Suspicious latency (might indicate VPN/proxy)
      if (rtt > 150) {
        console.log('[SecurityDetector] ⚠️ High latency detected - possible VPN/proxy');
      }
    } catch (err) {
      console.log('[SecurityDetector] ⚠️ RTT check failed (might be blocked)');
    }
    
    for (const url of providers) {
      try {
        console.log(`[SecurityDetector] 🌐 Fetching from: ${url}`);
        const data = await this.fetchJsonWithTimeout(url, 3500);
        console.log(`[SecurityDetector] 📦 Response from ${url}:`, data);
        
        if (this.inspectIpMetadata(data)) {
          console.log(`[SecurityDetector] ⚠️ VPN detected by ${url}!`);
          detected = true;
          break;
        } else {
          console.log(`[SecurityDetector] ✅ No VPN detected by ${url}`);
        }
      } catch (err) {
        console.error(`[SecurityDetector] ❌ Failed to fetch from ${url}:`, err);
      }
    }

    this.clientVpnDetected = detected;
    console.log('[SecurityDetector] 🏁 Client VPN detection result:', detected);
  }

  async fetchJsonWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { 
        cache: 'no-store', 
        signal: controller.signal,
        // Add priority hint for better browser scheduling
        priority: 'low' 
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn(`[SecurityDetector] Request timeout: ${url}`);
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  inspectIpMetadata(data) {
    if (!data || typeof data !== 'object') {
      console.log('[SecurityDetector] ❌ Invalid metadata:', data);
      return false;
    }

    console.log('[SecurityDetector] 🔍 Full IP Metadata:', JSON.stringify(data, null, 2));

    const keywords = [
      'vpn', 'proxy', 'hosting', 'datacenter', 'data center',
      'mullvad', 'expressvpn', 'nordvpn', 'surfshark',
      'proton', 'protonvpn', 'proton ag', 'proton vpn',
      'openvpn', 'wireguard', 'tunnel', 'anonymizer',
      'cloudflare', 'digitalocean', 'linode', 'vultr',
      'aws', 'amazon', 'google cloud', 'azure', 'microsoft',
      'hetzner', 'ovh', 'fastly', 'akamai', 'leaseweb',
      'privado', 'pia', 'private internet', 'cyberghost',
      'ipvanish', 'torguard', 'hide.me', 'windscribe',
      'purevpn', 'hotspot shield', 'strongvpn', 'vyprvpn',
      'vpn unlimited', 'tunnelbear', 'hide my ass', 'hma',
      'server', 'colo', 'colocation', 'anonymous', 'relay',
      // Additional aggressive patterns
      'virtual', 'virtual private', 'dedicated', 'vps',
      'cloud', 'shared hosting', 'network solutions',
      'residential proxy', 'rotating', 'mobile proxy',
      // Specific ISP patterns that VPNs use
      'M247', 'datacamp', 'fdcservers', 'psychz', 'quadranet',
      'online sas', 'server hosting', 'tier.net', 'zenlayer'
    ];

    const matchesVpn = (value) => {
      const str = String(value || '').toLowerCase();
      const matched = keywords.some(keyword => str.includes(keyword));
      if (matched) {
        console.log(`[SecurityDetector] 🎯 Keyword match found: "${value}" matches VPN pattern`);
      }
      return matched;
    };

    const security = data.security || data.privacy || {};
    const booleanFlags = [
      data.vpn,
      data.proxy,
      data.tor,
      data.hosting,
      data.is_vpn,
      data.is_proxy,
      data.is_tor,
      data.is_hosting,
      security.vpn,
      security.proxy,
      security.tor,
      security.hosting,
      security.relay
    ];

    console.log('[SecurityDetector] 🔍 Checking boolean flags:', {
      vpn: data.vpn,
      proxy: data.proxy,
      tor: data.tor,
      hosting: data.hosting,
      is_vpn: data.is_vpn,
      security_vpn: security.vpn
    });

    if (booleanFlags.some(Boolean)) {
      console.log('[SecurityDetector] ⚠️ VPN detected via boolean flag!');
      return true;
    }

    const typedFields = [
      data.type,
      data.connection?.type,
      data.company?.type,
      security.type
    ];

    console.log('[SecurityDetector] 🔍 Checking type fields:', {
      type: data.type,
      connectionType: data.connection?.type,
      companyType: data.company?.type
    });

    if (typedFields.some(type => ['vpn', 'proxy', 'tor', 'hosting', 'relay'].includes(String(type || '').toLowerCase()))) {
      console.log('[SecurityDetector] ⚠️ VPN detected via type field!');
      return true;
    }

    const textFields = [
      data.org,
      data.isp,
      data.asn,
      data.asn_org,
      data.network,
      data.hostname,
      data.connection?.isp,
      data.connection?.org,
      data.connection?.domain,
      data.company?.name,
      data.company?.domain
    ];

    console.log('[SecurityDetector] 🔍 Checking text fields:', {
      org: data.org,
      isp: data.isp,
      asn: data.asn,
      hostname: data.hostname,
      companyName: data.company?.name
    });

    const textMatch = textFields.some(matchesVpn);
    if (textMatch) {
      console.log('[SecurityDetector] ⚠️ VPN detected via text field keyword match!');
      return true;
    }

    // Additional heuristic checks for stealthy VPNs
    
    // 1. Check if timezone doesn't match IP location (common with VPNs)
    if (data.timezone && data.timezone.id) {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const ipTz = data.timezone.id;
      if (browserTz !== ipTz) {
        console.log(`[SecurityDetector] ⚠️ Timezone mismatch! Browser: ${browserTz}, IP: ${ipTz}`);
        // Don't return true yet, just suspicious
      }
    }

    // 2. Check for suspicious ASN numbers (common VPN providers)
    const vpnAsnNumbers = [
      'AS396982', // Google Fiber (used by many VPNs)
      'AS174', // Cogent (common VPN backbone)
      'AS9009', // M247 (major VPN infrastructure)
      'AS63949', // Linode
      'AS14061', // DigitalOcean
      'AS16276', // OVH
      'AS24940', // Hetzner
      'AS20473', // Vultr
      'AS13335', // Cloudflare
      'AS60068', // Datacamp
      'AS40676', // Psychz
      'AS8100', // QuadraNet
    ];
    
    const asn = String(data.asn || data.as || '').toUpperCase();
    if (vpnAsnNumbers.some(vpnAsn => asn.includes(vpnAsn.replace('AS', '')))) {
      console.log(`[SecurityDetector] ⚠️ Suspicious ASN detected: ${asn}`);
      return true;
    }

    // 3. Check if country code seems inconsistent
    if (data.country_code && data.languages) {
      const browserLang = navigator.language || navigator.userLanguage;
      console.log(`[SecurityDetector] 🌍 Country: ${data.country_code}, Browser Language: ${browserLang}`);
    }

    // 4. DNS leak check - if reverse DNS doesn't match ISP, suspicious
    if (data.hostname && data.isp) {
      const hostname = String(data.hostname).toLowerCase();
      const isp = String(data.isp).toLowerCase();
      
      // Hostname should usually contain ISP name
      if (hostname && isp && !hostname.includes(isp.split(' ')[0].toLowerCase())) {
        console.log(`[SecurityDetector] ⚠️ Hostname-ISP mismatch: ${hostname} vs ${isp}`);
      }
    }

    // 5. Check for common VPN port patterns in the IP
    // Some VPNs expose port info
    if (data.port || data.protocols) {
      const suspiciousPorts = [1194, 443, 8443, 1723, 500, 4500, 51820];
      console.log('[SecurityDetector] 🔍 Checking ports...');
    }
    
    return false;
  }

  syncVpnStatus() {
    this.isVpnDetected = this.nativeVpnDetected || this.serverVpnDetected || this.clientVpnDetected;
    console.log('[SecurityDetector] 🔄 VPN Status Synced:', {
      native: this.nativeVpnDetected,
      server: this.serverVpnDetected,
      client: this.clientVpnDetected,
      final: this.isVpnDetected
    });
    this.updateReasons();
  }

  // Debug method - expose this on window for testing
  async forceVpnCheck() {
    console.log('[SecurityDetector] 🚀 FORCE VPN CHECK INITIATED');
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
      list.push('VPN or Proxy connection active');
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

// Expose for debugging in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.securityDetector = securityDetector;
  console.log('[SecurityDetector] 🐛 Debug mode enabled. Use window.securityDetector.forceVpnCheck() to test');
}
