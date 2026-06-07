import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  // Verify the caller's session
  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await authClient.auth.getUser(authHeader.split(' ')[1]);
    if (error || !user) return res.status(401).json({ error: 'Invalid session' });
  } catch {
    return res.status(401).json({ error: 'Auth verification failed' });
  }

  // ── VAPID ───────────────────────────────────────────────────────────────────
  const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:dev.klinux@proton.me';

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({ error: 'VAPID keys not configured on server' });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  // ── Request body ────────────────────────────────────────────────────────────
  const { subscription, user_ids, title, body, url } = req.body;

  // Mode 1: Direct subscription push (for test push / single target)
  if (subscription?.endpoint) {
    return await sendToOne(res, subscription, { title, body, url });
  }

  // Mode 2: Multi-user push (look up subscriptions from DB)
  if (Array.isArray(user_ids) && user_ids.length > 0) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, push_subscription')
      .in('id', user_ids);

    if (!profiles || profiles.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: 'No profiles found' });
    }

    const subs = profiles.filter((p) => p.push_subscription?.endpoint);
    if (subs.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: 'No active push subscriptions' });
    }

    const payload = JSON.stringify({
      title: title || 'Zenith',
      body: body || 'You have a new notification',
      url: url || '/',
      tag: 'zenith-' + Date.now(),
    });

    const results = await Promise.allSettled(
      subs.map((p) =>
        webpush.sendNotification(
          { endpoint: p.push_subscription.endpoint, keys: p.push_subscription.keys },
          payload
        ).catch(async (err) => {
          // Auto-clear expired subscriptions
          if (err.statusCode === 404 || err.statusCode === 410) {
            const adminClient = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
            await adminClient.from('profiles').update({ push_subscription: null }).eq('id', p.id);
          }
          throw err;
        })
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return res.status(200).json({ success: true, sent, failed });
  }

  return res.status(400).json({ error: 'Provide either subscription or user_ids' });
}

// ── Helper ────────────────────────────────────────────────────────────────────
async function sendToOne(res, subscription, { title, body, url }) {
  const payload = JSON.stringify({
    title: title || 'Zenith',
    body: body || 'You have a new notification',
    url: url || '/',
    tag: 'zenith-' + Date.now(),
  });

  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      payload
    );
    return res.status(200).json({ success: true, sent: 1 });
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      return res.status(410).json({ success: false, error: 'Subscription expired', expired: true });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
}
