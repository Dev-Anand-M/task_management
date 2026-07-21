import { supabase } from '../lib/supabase';

// Local storage key helpers
const getStorageKey = (userId) => userId ? `${userId}_sentient_broadcast_memory` : 'anon_sentient_broadcast_memory';
const getDispatchPlanKey = (dateStr) => `zen_daily_dispatch_plan_${dateStr}`;

/**
 * Service to manage Time-Aware ZEN Start-of-Day Dispatch Planning & Autonomous Broadcasts
 */
export const sentientBroadcastService = {
    /**
     * Get today's formatted date string (YYYY-MM-DD)
     */
    getTodayDateString() {
        return new Date().toISOString().split('T')[0];
    },

    /**
     * Get all broadcast history sent by ZEN to the user
     */
    getBroadcastHistory(userId) {
        try {
            const data = localStorage.getItem(getStorageKey(userId));
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    /**
     * Save a new broadcast message to history and push to Supabase notifications table
     */
    async recordBroadcast(userId, messageObj) {
        try {
            const currentHistory = this.getBroadcastHistory(userId);
            const updated = [messageObj, ...currentHistory].slice(0, 50); // Keep last 50
            localStorage.setItem(getStorageKey(userId), JSON.stringify(updated));

            if (userId) {
                // Insert into Supabase notifications table so it alerts the user in-app
                await supabase.from('notifications').insert([{
                    user_id: userId,
                    title: messageObj.title || '✨ ZEN Notification',
                    message: messageObj.content,
                    type: 'sentient_broadcast',
                    is_read: false,
                    created_at: new Date().toISOString()
                }]);
            }
            return true;
        } catch (err) {
            console.error('[SentientBroadcast] Record failed:', err);
            return false;
        }
    },

    /**
     * Retrieve today's Start-of-Day Dispatch Plan
     */
    getTodayDispatchPlan() {
        const todayStr = this.getTodayDateString();
        try {
            const data = localStorage.getItem(getDispatchPlanKey(todayStr));
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    /**
     * Compute personalized time slots based on past chat activity or user-seeded random hash
     */
    computePersonalizedTimeSlots(userId, chatHistory = []) {
        // Default base windows: morning (07-10), midday (12-15), evening (17-20), night (21-23)
        let morningHour = 8;
        let morningMin = 15;
        let middayHour = 13;
        let middayMin = 10;
        let eveningHour = 18;
        let eveningMin = 30;
        let nightHour = 22;
        let nightMin = 15;

        // 1. Analyze Chat Activity Timestamps if available
        if (chatHistory && chatHistory.length > 0) {
            const hours = chatHistory
                .map(msg => msg.timestamp ? new Date(msg.timestamp).getHours() : null)
                .filter(h => h !== null && !isNaN(h));

            if (hours.length > 0) {
                const mHours = hours.filter(h => h >= 5 && h < 12);
                const dHours = hours.filter(h => h >= 12 && h < 17);
                const eHours = hours.filter(h => h >= 17 && h < 22);
                const nHours = hours.filter(h => h >= 22 || h < 5);

                if (mHours.length > 0) morningHour = Math.round(mHours.reduce((a, b) => a + b, 0) / mHours.length);
                if (dHours.length > 0) middayHour = Math.round(dHours.reduce((a, b) => a + b, 0) / dHours.length);
                if (eHours.length > 0) eveningHour = Math.round(eHours.reduce((a, b) => a + b, 0) / eHours.length);
                if (nHours.length > 0) nightHour = Math.round(nHours.reduce((a, b) => a + b, 0) / nHours.length);
            }
        }

        // 2. User-Seeded Random Hash Offset (Guarantees every user has a distinct, personalized schedule)
        let seed = 0;
        if (userId) {
            for (let i = 0; i < userId.length; i++) {
                seed = (seed << 5) - seed + userId.charCodeAt(i);
                seed |= 0;
            }
        }
        const absSeed = Math.abs(seed);

        morningMin = (morningMin + (absSeed % 40)) % 60;
        middayMin = (middayMin + ((absSeed >> 2) % 45)) % 60;
        eveningMin = (eveningMin + ((absSeed >> 4) % 45)) % 60;
        nightMin = (nightMin + ((absSeed >> 6) % 50)) % 60;

        const pad = (n) => String(n).padStart(2, '0');

        return {
            morning: `${pad(morningHour)}:${pad(morningMin)}`,
            midday: `${pad(middayHour)}:${pad(middayMin)}`,
            evening: `${pad(eveningHour)}:${pad(eveningMin)}`,
            night: `${pad(nightHour)}:${pad(nightMin)}`
        };
    },

    /**
     * Generate or ensure today's Start-of-Day Dispatch Schedule Matrix
     * Determines WHO to send WHAT and WHEN throughout the day.
     */
    ensureStartOfDayPlan(userId, userName, routines = [], tasks = [], chatHistory = []) {
        if (!userId) return null;
        const todayStr = this.getTodayDateString();
        const existingPlan = this.getTodayDispatchPlan();

        if (existingPlan) return existingPlan;

        const displayName = userName || 'Commander';
        const routineCount = routines.length;
        const taskCount = tasks.filter(t => !t.completed).length;

        // Compute personalized time schedule derived from user chat activity & seed hash
        const timeSlots = this.computePersonalizedTimeSlots(userId, chatHistory);

        // Construct 4 personalized dispatches for the day
        const dispatches = [
            {
                id: `disp_${todayStr}_morning`,
                time_slot: 'morning',
                scheduled_time: timeSlots.morning,
                target_user_id: userId,
                target_user_name: displayName,
                type: 'morning_sync',
                title: '🌅 ZEN Morning Sync',
                content: `Good morning, ${displayName}! ${routineCount > 0 ? `You have ${routineCount} active routine(s) planned for today.` : 'Ready to dominate the day?'} Systems online and calibrated.`,
                status: 'pending'
            },
            {
                id: `disp_${todayStr}_midday`,
                time_slot: 'midday',
                scheduled_time: timeSlots.midday,
                target_user_id: userId,
                target_user_name: displayName,
                type: 'midday_pulse',
                title: '⚡ ZEN Midday Status Check',
                content: `Midday check-in for ${displayName}! ${taskCount > 0 ? `You have ${taskCount} pending task(s) remaining.` : 'Keep up the solid momentum!'} Take a breath and stay sharp.`,
                status: 'pending'
            },
            {
                id: `disp_${todayStr}_evening`,
                time_slot: 'evening',
                scheduled_time: timeSlots.evening,
                target_user_id: userId,
                target_user_name: displayName,
                type: 'evening_reflection',
                title: '🌌 ZEN Evening Reflection',
                content: `Evening is approaching, ${displayName}. Time to review what you've conquered today or record study notes in your Diary!`,
                status: 'pending'
            },
            {
                id: `disp_${todayStr}_night`,
                time_slot: 'night',
                scheduled_time: timeSlots.night,
                target_user_id: userId,
                target_user_name: displayName,
                type: 'night_protocol',
                title: '🌙 ZEN Night Protocol',
                content: `Late night session alert for ${displayName}. Wrap up your active tasks and recharge your core for tomorrow.`,
                status: 'pending'
            }
        ];

        const planObj = {
            date: todayStr,
            generated_at: new Date().toISOString(),
            user_id: userId,
            personalized_slots: timeSlots,
            dispatches
        };

        localStorage.setItem(getDispatchPlanKey(todayStr), JSON.stringify(planObj));
        return planObj;
    },

    /**
     * Time-Aware Dispatch Executor: Checks current time against scheduled dispatches
     * and fires them automatically when time is reached!
     */
    async checkAndExecuteScheduledDispatches(userId, userName, routines = [], tasks = [], chatHistory = []) {
        if (!userId) return null;

        const plan = this.ensureStartOfDayPlan(userId, userName, routines, tasks, chatHistory);
        if (!plan || !plan.dispatches) return null;

        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTimeMinutes = currentHours * 60 + currentMinutes;

        let executedCount = 0;
        const todayStr = this.getTodayDateString();

        for (const dispatch of plan.dispatches) {
            if (dispatch.status !== 'pending') continue;

            const [schHours, schMins] = dispatch.scheduled_time.split(':').map(Number);
            const scheduledTimeMinutes = schHours * 60 + schMins;

            // Execute if current time has reached or passed the scheduled time
            if (currentTimeMinutes >= scheduledTimeMinutes) {
                dispatch.status = 'sent';
                dispatch.sent_at = now.toISOString();

                await this.recordBroadcast(userId, {
                    id: dispatch.id,
                    title: dispatch.title,
                    content: dispatch.content,
                    topic: dispatch.time_slot,
                    timestamp: dispatch.sent_at
                });

                executedCount++;
            }
        }

        if (executedCount > 0) {
            localStorage.setItem(getDispatchPlanKey(todayStr), JSON.stringify(plan));
        }

        return plan;
    },

    /**
     * Alias wrapper for backwards compatibility
     */
    async checkAndRunDailyBroadcast(userId, userName, routines = [], tasks = [], chatHistory = []) {
        return this.checkAndExecuteScheduledDispatches(userId, userName, routines, tasks, chatHistory);
    }
};

export default sentientBroadcastService;
