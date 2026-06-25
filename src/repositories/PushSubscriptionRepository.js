import { supabase } from '../lib/supabase';

export class PushSubscriptionRepository {
  /**
   * Upsert a device registration in Supabase push_subscriptions table
   */
  static async registerDevice(subscriptionData) {
    const { user_id, device_id, endpoint, token } = subscriptionData;
    if (!user_id || !device_id) {
      throw new Error('[PushSubscriptionRepository] Missing user_id or device_id during registration');
    }

    const payload = {
      ...subscriptionData,
      last_seen: new Date().toISOString(),
      is_active: true
    };

    if (endpoint) {
      // Web push mapping
      const { data, error } = await supabase.from('push_subscriptions')
        .upsert(payload, { onConflict: 'user_id,endpoint' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else if (token) {
      // Native FCM mapping
      const { data, error } = await supabase.from('push_subscriptions')
        .upsert(payload, { onConflict: 'user_id,token' })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    
    throw new Error('[PushSubscriptionRepository] Registration payload must contain either endpoint or token');
  }

  /**
   * Deactivate a specific device installation from database pushes
   */
  static async deactivate(userId, deviceId) {
    const { error } = await supabase.from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('device_id', deviceId);
    if (error) throw error;
  }

  /**
   * Update settings/enable status for a device
   */
  static async updateSettings(userId, deviceId, enabled) {
    const { error } = await supabase.from('push_subscriptions')
      .update({ notifications_enabled: enabled })
      .eq('user_id', userId)
      .eq('device_id', deviceId);
    if (error) throw error;
  }
}
