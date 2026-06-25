import { supabase } from '../../lib/supabase';
import { PlatformService } from '../infrastructure/PlatformService';

export class WebPushProvider {
  /**
   * Request permission and subscribe using standard Web Push API
   */
  async register(userId, deviceId) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Web Push notifications are not supported in this browser.');
    }

    const registration = await navigator.serviceWorker.ready;
    
    let publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

    if (!publicKey) {
      try {
        // Fetch VAPID public key from backend api/push endpoint
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        
        const res = await fetch(`${PlatformService.getApiUrl()}/api/push`, {
          headers: { 
            Authorization: token ? `Bearer ${token}` : ''
          }
        });
        
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          publicKey = data.publicKey;
        }
      } catch (err) {
        console.warn('[WebPushProvider] Failed to fetch VAPID key from API:', err);
      }
    }

    if (!publicKey) {
      throw new Error('VAPID public key not found or configured');
    }

    // Subscribe to push service
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this._urlBase64ToUint8Array(publicKey)
      });
    }

    return {
      user_id: userId,
      device_id: deviceId,
      transport: 'web',
      platform: 'web',
      endpoint: subscription.endpoint,
      keys: subscription.toJSON().keys,
      browser: PlatformService.getBrowserName(),
      user_agent: PlatformService.getUserAgent()
    };
  }

  _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
}
