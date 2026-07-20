import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { WebPushStrategy } from '../strategies/WebPushStrategy.js';
import { FCMStrategy } from '../strategies/FCMStrategy.js';

// Setup VAPID Web Push
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:dev.klinux@proton.me';
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const strategies = [new WebPushStrategy(), new FCMStrategy()];

const DEFAULT_OPTIONS = {
  TTL: 86400,
  urgency: 'high'
};

/**
 * Vercel Cron Job: Routine Reminders
 * Runs every 5 minutes, checks for routines about to start,
 * and sends push notifications even when the app is closed.
 */
export default async function handler(req, res) {
  // Only allow GET (Vercel Cron uses GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret (Vercel sends this automatically for cron jobs)
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

  try {
    // Default timezone offset: IST = UTC+5:30
    const DEFAULT_OFFSET_MINUTES = 330;
    
    // Get current time in IST
    const now = new Date();
    const userNow = new Date(now.getTime() + DEFAULT_OFFSET_MINUTES * 60000);
    
    const currentDay = userNow.getUTCDay() === 0 ? 7 : userNow.getUTCDay();
    const currentHour = userNow.getUTCHours();
    const currentMinute = userNow.getUTCMinutes();
    const todayStr = userNow.toISOString().split('T')[0];
    
    // Build time window: current time +/- 2.5 minutes (5 min cron interval)
    const windowStart = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}:00`;
    
    // Calculate window end (current + 5 minutes)
    const endDate = new Date(userNow.getTime() + 5 * 60000);
    const endHour = endDate.getUTCHours();
    const endMinute = endDate.getUTCMinutes();
    const windowEnd = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00`;
    
    console.log(`[Cron] Checking routines for day=${currentDay}, time window ${windowStart} to ${windowEnd}, date=${todayStr}`);

    // Fetch all active routines that start within the time window
    let routineQuery = supabase
      .from('routines')
      .select('*, profiles!inner(id, name)')
      .eq('is_active', true)
      .eq('is_anonymous', false)
      .gte('start_time', windowStart)
      .lt('start_time', windowEnd)
      .contains('days_of_week', [currentDay]);

    const { data: routines, error: routineError } = await routineQuery;

    if (routineError) {
      console.error('[Cron] Routine query error:', routineError);
      return res.status(500).json({ error: 'Failed to fetch routines', details: routineError.message });
    }

    if (!routines || routines.length === 0) {
      return res.status(200).json({ success: true, message: 'No routines to notify', checked: `${windowStart}-${windowEnd}` });
    }

    console.log(`[Cron] Found ${routines.length} routines in window`);

    // Check which routines already have logs for today (skip those)
    const routineIds = routines.map(r => r.id);
    const userIds = [...new Set(routines.map(r => r.user_id))];
    
    const { data: existingLogs } = await supabase
      .from('routine_logs')
      .select('routine_id, status')
      .in('routine_id', routineIds)
      .eq('log_date', todayStr)
      .in('status', ['done', 'ignored']);

    const completedRoutineIds = new Set((existingLogs || []).map(l => l.routine_id));

    // Filter to only routines that haven't been completed/ignored today
    const pendingRoutines = routines.filter(r => !completedRoutineIds.has(r.id));

    if (pendingRoutines.length === 0) {
      return res.status(200).json({ success: true, message: 'All routines already handled', checked: `${windowStart}-${windowEnd}` });
    }

    // Group pending routines by user
    const routinesByUser = {};
    pendingRoutines.forEach(r => {
      if (!routinesByUser[r.user_id]) routinesByUser[r.user_id] = [];
      routinesByUser[r.user_id].push(r);
    });

    // Fetch push subscriptions for these users
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('is_active', true)
      .eq('notifications_enabled', true)
      .in('user_id', Object.keys(routinesByUser));

    let totalSent = 0;
    let totalFailed = 0;

    // Send notifications per user
    for (const [userId, userRoutines] of Object.entries(routinesByUser)) {
      const userSubs = (subscriptions || []).filter(s => s.user_id === userId);
      if (userSubs.length === 0) continue;

      // Build notification payload
      const routineNames = userRoutines.map(r => r.title).join(', ');
      const startTime = userRoutines[0].start_time.slice(0, 5);
      const title = userRoutines.length === 1
        ? `🔔 Time for: ${userRoutines[0].title}`
        : `🔔 ${userRoutines.length} Routines Starting`;
      const body = userRoutines.length === 1
        ? `Your routine "${userRoutines[0].title}" starts now! Tap to begin.`
        : `Starting now: ${routineNames}. Tap to open your routines.`;

      const payload = {
        title,
        body,
        url: '/routines',
        channelId: 'routines',
        tag: `routine-cron-${todayStr}-${startTime}`
      };

      // Deduplicate devices
      const uniqueDevices = [];
      const seenTargets = new Set();
      for (const device of userSubs) {
        let target = device.transport === 'fcm' ? device.token : device.endpoint;
        if (target) {
          if (target.includes('fcm.googleapis.com/fcm/send/')) {
            const parts = target.split('/');
            target = parts[parts.length - 1];
          }
          if (!seenTargets.has(target)) {
            seenTargets.add(target);
            uniqueDevices.push(device);
          }
        }
      }

      // Send to each device
      for (const device of uniqueDevices) {
        const strategy = strategies.find(s => s.canHandle(device.transport));
        if (!strategy) continue;

        try {
          const result = await strategy.send(device, payload, DEFAULT_OPTIONS);
          if (result.status === 'sent') {
            totalSent++;
          } else {
            totalFailed++;
            if (result.status === 'expired') {
              await supabase.from('push_subscriptions')
                .update({ is_active: false })
                .eq('id', device.id);
            }
          }
        } catch (err) {
          console.error(`[Cron] Push failed for device ${device.id}:`, err.message);
          totalFailed++;
        }
      }
    }

    console.log(`[Cron] Completed: ${totalSent} sent, ${totalFailed} failed`);

    return res.status(200).json({
      success: true,
      routinesChecked: pendingRoutines.length,
      notificationsSent: totalSent,
      notificationsFailed: totalFailed,
      timeWindow: `${windowStart}-${windowEnd}`,
      date: todayStr
    });

  } catch (err) {
    console.error('[Cron] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
