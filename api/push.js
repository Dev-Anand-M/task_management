import webpush from 'web-push';
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import { WebPushStrategy } from './strategies/WebPushStrategy.js';
import { FCMStrategy } from './strategies/FCMStrategy.js';
import fs from 'fs';
import path from 'path';

// Setup VAPID Web Push
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:dev.klinux@proton.me';
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

// Setup Firebase Admin SDK
if (!admin.getApps().length) {
  try {
    let serviceAccount = null;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      } catch (err) {
        console.warn('[FCM Admin] Env JSON parse error, trying file...', err.message);
      }
    }

    if (!serviceAccount) {
      const files = fs.readdirSync(process.cwd());
      const serviceAccountFile = files.find(f => f.startsWith('idl-skillenhancement-firebase-adminsdk') && f.endsWith('.json'));
      if (serviceAccountFile) {
        const filePath = path.join(process.cwd(), serviceAccountFile);
        serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log('[FCM Admin] Loaded service account from local file:', serviceAccountFile);
      }
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.cert(serviceAccount)
      });
      console.log('[FCM Admin] Initialized successfully');
    } else {
      console.warn('[FCM Admin] No service account credentials found');
    }
  } catch (err) {
    console.warn('[FCM Admin] Initialization error:', err.message);
  }
}

// Delivery strategies registry
const strategies = [
  new WebPushStrategy(),
  new FCMStrategy()
];

const DEFAULT_OPTIONS = {
  TTL: 86400,
  urgency: 'high'
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Bypass-Tunnel-Reminder, ngrok-skip-browser-warning');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    if (!VAPID_PUBLIC) {
      return res.status(500).json({ error: 'VAPID public key not configured on server' });
    }
    return res.status(200).json({ publicKey: VAPID_PUBLIC });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth Header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  // Verify Auth
  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await authClient.auth.getUser(authHeader.split(' ')[1]);
    if (error || !user) return res.status(401).json({ error: 'Invalid session' });
  } catch {
    return res.status(401).json({ error: 'Auth verification failed' });
  }

  const { subscription, user_ids, title, body, url, channelId } = req.body;
  const payload = {
    title: title || 'Zenith',
    body: body || 'New Notification Alert',
    url: url || '/',
    channelId: channelId || 'tasks'
  };

  const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

  // 1. Direct Web Push (testing)
  if (subscription?.endpoint) {
    const strategy = new WebPushStrategy();
    const result = await strategy.send({ endpoint: subscription.endpoint, keys: subscription.keys }, payload, DEFAULT_OPTIONS);
    return res.status(result.status === 'sent' ? 200 : 500).json(result);
  }

  // 2. Dispatch Router
  if (Array.isArray(user_ids) && user_ids.length > 0) {
    const { data: devices, error: dbErr } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('is_active', true)
      .eq('notifications_enabled', true)
      .in('user_id', user_ids);

    if (dbErr) {
      console.error('[Push Router] DB fetch error:', dbErr);
      return res.status(500).json({ error: 'Failed to fetch device subscriptions', details: dbErr.message });
    }

    if (!devices || devices.length === 0) {
      return res.status(200).json({ 
        success: true, 
        sent: 0, 
        message: 'No active device subscriptions'
      });
    }

    // Deduplicate target devices to avoid sending duplicate push notifications to the same device
    const uniqueDevices = [];
    const seenTargets = new Set();
    for (const device of devices) {
      const target = device.transport === 'fcm' ? device.token : device.endpoint;
      if (target && !seenTargets.has(target)) {
        seenTargets.add(target);
        uniqueDevices.push(device);
      }
    }

    let sent = 0;
    let failed = 0;

    const dispatches = uniqueDevices.map(async (device) => {
      const strategy = strategies.find(s => s.canHandle(device.transport));
      if (!strategy) {
        console.warn(`[Push Router] No strategy found for transport: ${device.transport}`);
        return;
      }

      // Log queued event to notification_logs
      let logEntry = null;
      try {
        const { data } = await supabase.from('notification_logs').insert({
          device_id: device.device_id,
          type: device.platform,
          status: 'queued'
        }).select().single();
        logEntry = data;
      } catch (logErr) {
        console.warn('[Push Router] Failed to create log entry:', logErr.message);
      }

      const result = await strategy.send(device, payload, DEFAULT_OPTIONS);

      // Update log state
      if (logEntry) {
        try {
          await supabase.from('notification_logs').update({
            notification_id: result.messageId || null,
            status: result.status,
            failure_reason: result.reason || null
          }).eq('id', logEntry.id);
        } catch (logUpdateErr) {
          console.warn('[Push Router] Failed to update log entry:', logUpdateErr.message);
        }
      }

      if (result.status === 'sent') {
        sent++;
      } else {
        failed++;
        if (result.status === 'expired') {
          try {
            await supabase.from('push_subscriptions')
              .update({ is_active: false })
              .eq('id', device.id);
          } catch (dbUpdateErr) {
            console.warn('[Push Router] Failed to deactivate expired token:', dbUpdateErr.message);
          }
        }
      }
    });

    await Promise.all(dispatches);
    return res.status(200).json({ success: true, sent, failed });
  }

  return res.status(400).json({ error: 'Missing destination targets' });
}
