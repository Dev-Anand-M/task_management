/**
 * RoutineNotificationService
 * 
 * Client-side service that:
 * 1. Schedules local notifications at routine start times via Service Worker
 * 2. Auto-marks regular routines as missed after 15 min inactivity (with action buttons)
 * 3. Auto-marks anonymous routines as missed at EOD (midnight)
 * 4. Provides pending work summary for app-open popup
 */

import { routineService } from './routineService';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

class RoutineNotificationServiceClass {
    constructor() {
        this.timers = new Map(); // routineId -> { notifyTimer, missTimer }
        this.eodTimer = null;
        this.initialized = false;
        this.currentDate = null;
        this.onMissCallback = null; // callback when a routine is auto-missed
    }

    /**
     * Initialize the service for today
     * @param {Function} onMiss - callback(routineId) when auto-miss triggers
     */
    async init(onMiss) {
        this.onMissCallback = onMiss;
        this.initialized = true;

        if (Capacitor.isNativePlatform()) {
            try {
                await LocalNotifications.requestPermissions();
                LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
                    const extra = notification.notification.extra;
                    if (extra && extra.url) {
                        window.location.href = extra.url;
                    }
                });
            } catch (e) {
                console.warn('[LocalNotifications] Permission request / listener failed:', e);
            }
        }

        await this.reschedule();
    }

    /**
     * Clear all timers
     */
    clearAll() {
        for (const [, timers] of this.timers) {
            if (timers.notifyTimer) clearTimeout(timers.notifyTimer);
            if (timers.missTimer) clearTimeout(timers.missTimer);
        }
        this.timers.clear();
        if (this.eodTimer) {
            clearTimeout(this.eodTimer);
            this.eodTimer = null;
        }

        if (Capacitor.isNativePlatform()) {
            try {
                LocalNotifications.getPending().then(pending => {
                    if (pending && pending.notifications?.length > 0) {
                        LocalNotifications.cancel({ notifications: pending.notifications });
                    }
                }).catch(err => console.warn('[LocalNotifications] Cancel failed:', err));
            } catch (err) {
                console.warn('[LocalNotifications] Cancel failed:', err);
            }
        }
    }

    /**
     * Reschedule all notifications for today's routines
     */
    async reschedule() {
        this.clearAll();

        try {
            const now = new Date();
            const todayStr = this._toLocalISO(now);
            this.currentDate = todayStr;

            const routines = await routineService.getRoutines();
            const logs = await routineService.getLogsForDate(todayStr);
            const logMap = {};
            logs.forEach(l => { logMap[l.routine_id] = l; });

            const todayDayNum = now.getDay() === 0 ? 7 : now.getDay();

            // Schedule notifications for each active routine today
            for (const r of routines) {
                if (!r.days_of_week.includes(todayDayNum)) continue;
                if (!r.is_active) continue;

                // Skip if already done or ignored
                const log = logMap[r.id];
                if (log && (log.status === 'done' || log.status === 'ignored')) continue;

                if (r.is_anonymous) {
                    // Anonymous routines: schedule EOD miss check
                    // (handled by the single EOD timer below)
                    continue;
                }

                // Parse routine start time
                const [h, m] = r.start_time.split(':').map(Number);
                const startTime = new Date(now);
                startTime.setHours(h, m, 0, 0);

                const msUntilStart = startTime.getTime() - now.getTime();
                const msUntilMiss = msUntilStart + (15 * 60 * 1000); // +15 min

                const timers = {};

                // Schedule start notification
                if (msUntilStart > 0) {
                    timers.notifyTimer = setTimeout(() => {
                        this._fireNotification(
                            `🔔 Time for: ${r.title}`,
                            `Your routine "${r.title}" starts now! Tap to begin.`,
                            '/routines',
                            `routine-start-${r.id}`
                        );
                    }, msUntilStart);

                    if (Capacitor.isNativePlatform()) {
                        try {
                            const startId = this._hashStringTo32BitInt(r.id + '-start');
                            LocalNotifications.schedule({
                                notifications: [
                                    {
                                        title: `🔔 Time for: ${r.title}`,
                                        body: `Your routine "${r.title}" starts now! Tap to begin.`,
                                        id: startId,
                                        schedule: {
                                            at: new Date(now.getTime() + msUntilStart),
                                            allowWhileIdle: true
                                        },
                                        extra: { url: '/routines' }
                                    }
                                ]
                            }).catch(err => console.warn('[LocalNotifications] Schedule start failed:', err));
                        } catch (err) {
                            console.warn('[LocalNotifications] Schedule start failed:', err);
                        }
                    }
                } else if (msUntilStart > -60000) {
                    // Just passed (within 1 min), fire immediately
                    this._fireNotification(
                        `🔔 Time for: ${r.title}`,
                        `Your routine "${r.title}" starts now! Tap to begin.`,
                        '/routines',
                        `routine-start-${r.id}`
                    );
                }

                // Schedule 15-min auto-miss warning
                if (msUntilMiss > 0) {
                    timers.missTimer = setTimeout(async () => {
                        // Re-check if routine was completed in the meantime
                        const freshLogs = await routineService.getLogsForDate(todayStr);
                        const freshLog = freshLogs.find(l => l.routine_id === r.id);

                        if (freshLog && (freshLog.status === 'done' || freshLog.status === 'ignored')) {
                            return; // Already handled
                        }

                        // Auto-mark as missed
                        await this._autoMissRoutine(r.id, todayStr);

                        // Fire warning notification
                        this._fireNotification(
                            `⚠️ ${r.title} — Auto-Missed`,
                            `15 minutes passed with no response. Marked as missed. No mercy! 💀`,
                            '/routines',
                            `routine-miss-${r.id}`
                        );
                    }, msUntilMiss);

                    if (Capacitor.isNativePlatform()) {
                        try {
                            const missId = this._hashStringTo32BitInt(r.id + '-miss');
                            LocalNotifications.schedule({
                                notifications: [
                                    {
                                        title: `⚠️ ${r.title} — Auto-Missed`,
                                        body: `15 minutes passed with no response. Marked as missed. No mercy! 💀`,
                                        id: missId,
                                        schedule: {
                                            at: new Date(now.getTime() + msUntilMiss),
                                            allowWhileIdle: true
                                        },
                                        extra: { url: '/routines' }
                                    }
                                ]
                            }).catch(err => console.warn('[LocalNotifications] Schedule miss failed:', err));
                        } catch (err) {
                            console.warn('[LocalNotifications] Schedule miss failed:', err);
                        }
                    }
                } else if (msUntilMiss < 0 && !log) {
                    // Already past 15 min mark and no log exists — auto-miss now
                    await this._autoMissRoutine(r.id, todayStr);
                }

                this.timers.set(r.id, timers);
            }

            // Schedule EOD timer for anonymous routines (midnight)
            this._scheduleEOD(routines, logMap, todayStr);

        } catch (err) {
            console.error('[RoutineNotifications] Reschedule error:', err);
        }
    }

    /**
     * Schedule end-of-day check for anonymous routines
     */
    _scheduleEOD(routines, logMap, todayStr) {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(23, 59, 59, 0);

        const msUntilMidnight = midnight.getTime() - now.getTime();
        if (msUntilMidnight <= 0) return;

        const anonRoutines = routines.filter(r => 
            r.is_anonymous && 
            r.is_active &&
            r.days_of_week.includes(now.getDay() === 0 ? 7 : now.getDay()) &&
            (!logMap[r.id] || (logMap[r.id].status !== 'done' && logMap[r.id].status !== 'ignored'))
        );

        if (anonRoutines.length === 0) return;

        this.eodTimer = setTimeout(async () => {
            // Re-check at EOD
            const freshLogs = await routineService.getLogsForDate(todayStr);
            const freshLogMap = {};
            freshLogs.forEach(l => { freshLogMap[l.routine_id] = l; });

            let missedCount = 0;
            for (const r of anonRoutines) {
                const log = freshLogMap[r.id];
                if (!log || (log.status !== 'done' && log.status !== 'ignored')) {
                    await this._autoMissRoutine(r.id, todayStr);
                    missedCount++;
                }
            }

            if (missedCount > 0) {
                this._fireNotification(
                    `🌙 Day Over — ${missedCount} Flexible ${missedCount === 1 ? 'Task' : 'Tasks'} Expired`,
                    `${missedCount} anonymous routine${missedCount === 1 ? '' : 's'} ${missedCount === 1 ? 'was' : 'were'} auto-marked as missed at end of day.`,
                    '/routines',
                    'routine-eod-miss'
                );
            }
        }, msUntilMidnight);
    }

    /**
     * Auto-mark a routine as missed
     */
    async _autoMissRoutine(routineId, logDate) {
        try {
            await routineService.logRoutineProgress(routineId, {
                status: 'ignored',
                log_date: logDate,
                learning_notes: '⚠️ Auto-marked as missed (no response within time limit)'
            });
            if (this.onMissCallback) this.onMissCallback(routineId);
        } catch (err) {
            console.error('[RoutineNotifications] Auto-miss failed:', err);
        }
    }

    /**
     * Fire a notification via Service Worker postMessage
     */
    _fireNotification(title, body, url = '/routines', tag = 'zenith-routine') {
        try {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'TEST_MOCK_PUSH',
                    payload: { title, body, url, tag, timestamp: Date.now() }
                });
            } else if ('Notification' in window && Notification.permission === 'granted') {
                // Fallback: direct Notification API
                new Notification(title, { body, icon: '/zenith.png', tag });
            }
        } catch (err) {
            console.warn('[RoutineNotifications] Notification failed:', err);
        }
    }

    /**
     * Get pending work summary for app-open popup
     */
    async getPendingWork() {
        try {
            const now = new Date();
            const todayStr = this._toLocalISO(now);
            const todayDayNum = now.getDay() === 0 ? 7 : now.getDay();
            const currentTime = now.toTimeString().slice(0, 5);

            const [routines, logs] = await Promise.all([
                routineService.getRoutines(),
                routineService.getLogsForDate(todayStr)
            ]);

            const logMap = {};
            logs.forEach(l => { logMap[l.routine_id] = l; });

            const pending = [];
            const missed = [];

            for (const r of routines) {
                if (!r.days_of_week.includes(todayDayNum)) continue;
                if (!r.is_active) continue;

                const log = logMap[r.id];
                if (log?.status === 'done') continue;

                if (log?.status === 'ignored') {
                    missed.push({
                        id: r.id,
                        title: r.title,
                        time: r.start_time,
                        isAnonymous: r.is_anonymous,
                        status: 'missed'
                    });
                    continue;
                }

                // Check if past start time
                const routineTime = r.start_time.slice(0, 5);
                if (!r.is_anonymous && routineTime < currentTime) {
                    // Past due, not done
                    const [h, m] = r.start_time.split(':').map(Number);
                    const startMs = new Date(now).setHours(h, m, 0, 0);
                    const minutesLate = Math.floor((now.getTime() - startMs) / 60000);

                    if (minutesLate >= 15 && !log) {
                        missed.push({
                            id: r.id,
                            title: r.title,
                            time: r.start_time,
                            isAnonymous: false,
                            status: 'missed',
                            minutesLate
                        });
                    } else {
                        pending.push({
                            id: r.id,
                            title: r.title,
                            time: r.start_time,
                            isAnonymous: false,
                            status: 'overdue',
                            minutesLate
                        });
                    }
                } else {
                    pending.push({
                        id: r.id,
                        title: r.title,
                        time: r.is_anonymous ? 'Anytime' : r.start_time,
                        isAnonymous: r.is_anonymous,
                        status: 'upcoming'
                    });
                }
            }

            return { pending, missed };
        } catch (err) {
            console.error('[RoutineNotifications] getPendingWork error:', err);
            return { pending: [], missed: [] };
        }
    }

    /**
     * Mark a routine as extended (postpone by N minutes)
     */
    async extendRoutine(routineId, minutes = 15) {
        const todayStr = this._toLocalISO(new Date());
        try {
            await routineService.logRoutineProgress(routineId, {
                status: 'postponed',
                postponed_count: 1,
                log_date: todayStr,
                learning_notes: `Extended by ${minutes} minutes`
            });

            // Reschedule the miss timer
            const existingTimers = this.timers.get(routineId);
            if (existingTimers?.missTimer) clearTimeout(existingTimers.missTimer);

            const newMissTimer = setTimeout(async () => {
                const freshLogs = await routineService.getLogsForDate(todayStr);
                const freshLog = freshLogs.find(l => l.routine_id === routineId);
                if (freshLog && (freshLog.status === 'done' || freshLog.status === 'ignored')) return;

                await this._autoMissRoutine(routineId, todayStr);
                this._fireNotification(
                    `⚠️ Extension expired — Auto-Missed`,
                    `Your extended time ran out. Routine marked as missed.`,
                    '/routines',
                    `routine-ext-miss-${routineId}`
                );
            }, minutes * 60 * 1000);

            this.timers.set(routineId, { ...(existingTimers || {}), missTimer: newMissTimer });
        } catch (err) {
            console.error('[RoutineNotifications] Extend failed:', err);
        }
    }

    _toLocalISO(date) {
        const d = new Date(date);
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - (offset * 60 * 1000));
        return local.toISOString().split('T')[0];
    }

    _hashStringTo32BitInt(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    destroy() {
        this.clearAll();
        this.initialized = false;
    }
}

export const RoutineNotificationService = new RoutineNotificationServiceClass();
