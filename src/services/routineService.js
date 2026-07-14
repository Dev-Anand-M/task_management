import { supabase } from '../lib/supabase';
import { PlatformService } from './infrastructure/PlatformService';

/**
 * Service for managing routines and consistency logs (The Diary)
 */
export const routineService = {
    supabase, // Expose for other services if needed

    // --- ROUTINES ---
    
    /**
     * Fetch all routines for the current user
     */
    async getRoutines() {
        const { data, error } = await supabase
            .from('routines')
            .select('*')
            .eq('is_active', true)
            .order('start_time', { ascending: true });
            
        if (error) throw error;
        return data;
    },

    async createRoutine(routine) {
        const { data: { user } } = await supabase.auth.getUser();
        // Clean up empty strings for optional fields
        const cleanedRoutine = { ...routine };
        if (!cleanedRoutine.deadline) cleanedRoutine.deadline = null;
        if (!cleanedRoutine.description) cleanedRoutine.description = null;

        const { data, error } = await supabase
            .from('routines')
            .insert([{ ...cleanedRoutine, user_id: user.id }])
            .select();
        if (error) throw error;
        return data[0];
    },

    async updateRoutine(id, updates) {
        const cleanedUpdates = { ...updates };
        if (cleanedUpdates.deadline === '') cleanedUpdates.deadline = null;
        if (cleanedUpdates.description === '') cleanedUpdates.description = null;

        const { data, error } = await supabase
            .from('routines')
            .update(cleanedUpdates)
            .eq('id', id)
            .select();
        if (error) throw error;
        return data[0];
    },

    async deleteRoutine(id) {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        const local = new Date(now.getTime() - (offset * 60 * 1000));
        const todayStr = local.toISOString().split('T')[0];
        
        const { error } = await supabase
            .from('routines')
            .update({ 
                is_active: false,
                deadline: todayStr
            })
            .eq('id', id);
        if (error) throw error;
    },

    /**
     * Fetch all routines (active and inactive) for history views (Calendar/Diary)
     */
    async getAllRoutinesForHistory() {
        const { data, error } = await supabase
            .from('routines')
            .select('*')
            .order('start_time', { ascending: true });
            
        if (error) throw error;
        return data;
    },

    // --- LOGS (The Diary) ---

    async getLogsForDate(date) {
        const { data, error } = await supabase
            .from('routine_logs')
            .select('*')
            .eq('log_date', date);
        if (error) throw error;
        return data;
    },

    async getAllLogs() {
        const { data, error } = await supabase
            .from('routine_logs')
            .select('*, routines(*)')
            .order('log_date', { ascending: false });
        if (error) throw error;
        return data;
    },

    async clearAllLogs() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const { error } = await supabase
            .from('routine_logs')
            .delete()
            .eq('user_id', user.id);
        if (error) throw error;
        return true;
    },

    async logRoutineProgress(routineId, data) {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Use provided log_date if available, otherwise use local current date
        let logDate = data.log_date;
        
        if (!logDate) {
            const now = new Date();
            const offset = now.getTimezoneOffset();
            const localDate = new Date(now.getTime() - (offset * 60 * 1000));
            logDate = localDate.toISOString().split('T')[0];
        }
        
        // Fetch routine details to snapshot
        const { data: routine } = await supabase
            .from('routines')
            .select('title, start_time')
            .eq('id', routineId)
            .single();

        const { data: result, error } = await supabase
            .from('routine_logs')
            .upsert({
                routine_id: routineId,
                user_id: user.id,
                log_date: logDate,
                snapshot_title: routine?.title,
                snapshot_start_time: routine?.start_time,
                ...data
            }, { onConflict: 'routine_id,log_date' })
            .select();
            
        if (error) throw error;
        return result[0];
    },

    // --- TIMETABLE ARCHIVE ---

    async saveTimetable(weekStart, scheduleData) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('ai_timetables')
            .upsert({
                user_id: user.id,
                week_start: weekStart,
                schedule_data: scheduleData
            }, { onConflict: 'user_id,week_start' })
            .select();
        if (error) throw error;
        return data[0];
    },

    async getTimetable(weekStart) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('ai_timetables')
            .select('*')
            .eq('user_id', user.id)
            .eq('week_start', weekStart)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async updateLog(routineId, updates) {
        return this.logRoutineProgress(routineId, updates);
    },
    async deleteLog(routineId, logDate) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('routine_logs')
            .delete()
            .eq('routine_id', routineId)
            .eq('user_id', user.id)
            .eq('log_date', logDate);
        if (error) throw error;
        return true;
    },

    /**
     * Smart Sync: Replace/Update routines without losing linked Diary logs
     */
    /**
     * Check for time conflicts between routines
     */
    checkLogConflicts(logs, newLog) {
        // newLog: { start_time: "HH:mm", minutes: number, routine_id: string }
        const toMinutes = (time) => {
            if (!time) return 0;
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
        };

        const newStart = toMinutes(newLog.start_time);
        const newEnd = newStart + (parseInt(newLog.minutes) || 60);

        return logs.filter(log => {
            if (log.routine_id === newLog.routine_id) return false;
            if (log.status !== 'done') return false;
            
            // Use log's actual_start_time and time_spent_minutes
            const logStart = toMinutes(log.actual_start_time);
            const logEnd = logStart + (log.time_spent_minutes || 60);

            // Strict Overlap logic: (StartA < EndB) and (EndA > StartB)
            return (newStart < logEnd) && (newEnd > logStart);
        });
    },

    checkConflicts(routines, newRoutine) {
        if (newRoutine.is_anonymous) return []; // Anon routines don't have a fixed time
        
        const conflicts = routines.filter(r => {
            if (r.id === newRoutine.id) return false;
            if (!r.is_active || r.is_anonymous) return false;
            
            // Check day overlap
            const commonDays = r.days_of_week.filter(d => newRoutine.days_of_week.includes(d));
            if (commonDays.length === 0) return false;

            const rTime = r.start_time.slice(0, 5);
            const nTime = newRoutine.start_time.slice(0, 5);
            
            return rTime === nTime;
        });
        
        return conflicts;
    },

    async replaceAllRoutines(newRoutines) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: currentRoutines } = await supabase
            .from('routines')
            .select('*')
            .eq('user_id', user.id);

        const currentMap = {};
        currentRoutines.forEach(r => {
            const key = `${r.title.toLowerCase()}_${r.start_time.slice(0, 5)}`;
            currentMap[key] = r;
        });

        const routinesToUpdate = [];
        const routinesToInsert = [];
        const seenInNew = new Set();

        newRoutines.forEach(nr => {
            // Validation & Normalization for AI output
            if (!nr.title) return;

            // Ensure start_time is HH:mm:ss (Required by DB)
            let formattedTime = nr.start_time || '00:00:00';
            if (formattedTime.length === 5) formattedTime += ':00';
            else if (formattedTime.length === 1 || formattedTime.length === 2) {
                const hour = formattedTime.padStart(2, '0');
                formattedTime = `${hour}:00:00`;
            }
            // If it's still invalid or too short, fallback to 00:00:00
            if (!/^\d{2}:\d{2}/.test(formattedTime)) formattedTime = '00:00:00';

            // Ensure days_of_week is an array of integers
            let days = nr.days_of_week || [1,2,3,4,5,6,7];
            if (!Array.isArray(days)) days = [1,2,3,4,5,6,7];
            days = days.map(d => parseInt(d)).filter(d => !isNaN(d) && d >= 1 && d <= 7);

            const routineData = {
                ...nr,
                start_time: formattedTime,
                days_of_week: days,
                user_id: user.id,
                is_active: true
            };

            const key = `${nr.title.toLowerCase()}_${formattedTime.slice(0, 5)}`;
            seenInNew.add(key);

            if (currentMap[key]) {
                routinesToUpdate.push({
                    id: currentMap[key].id,
                    ...routineData
                });
            } else {
                routinesToInsert.push(routineData);
            }
        });

        const routinesToDelete = currentRoutines
            .filter(r => {
                const key = `${r.title.toLowerCase()}_${r.start_time.slice(0, 5)}`;
                return !seenInNew.has(key);
            })
            .map(r => r.id);

        if (routinesToDelete.length > 0) {
            await supabase.from('routines').update({ is_active: false }).in('id', routinesToDelete);
        }
        if (routinesToUpdate.length > 0) {
            await supabase.from('routines').upsert(routinesToUpdate);
        }
        if (routinesToInsert.length > 0) {
            await supabase.from('routines').insert(routinesToInsert);
        }
        return true;
    },

    /**
     * Check for pending routines that have timed out (15 mins) and mark them as ignored
     */
    async checkAndMarkIgnored() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const today = new Date().toISOString().split('T')[0];
        const { data: routines } = await supabase
            .from('routines')
            .select('*, routine_logs(status, log_date)')
            .eq('user_id', user.id)
            .eq('is_active', true);

        const now = new Date();
        for (const routine of routines) {
            // Skip anonymous routines - they have no strict window
            if (routine.is_anonymous) continue;

            const todayLog = routine.routine_logs?.find(l => l.log_date === today);
            const startTime = new Date(`${today}T${routine.start_time}`);
            const diffMinutes = (now - startTime) / (1000 * 60);
            
            if (diffMinutes > 15 && (!todayLog || todayLog.status === 'pending')) {
                await this.logRoutineProgress(routine.id, {
                    status: 'ignored',
                    learning_notes: 'Automatically marked ignored: Response timeout (15 mins)'
                });
            }
        }
    },

    /**
     * Generate an ICS file content
     */
    generateICS(routines) {
        let ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Zenith//Productivity System//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
        const daysMap = { 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA', 7: 'SU' };
        routines.forEach(r => {
            const [hours, mins] = r.start_time.split(':');
            const startTime = `${hours}${mins}00`;
            const rrule = `FREQ=WEEKLY;BYDAY=${r.days_of_week.map(d => daysMap[d]).join(',')}`;
            ics.push('BEGIN:VEVENT', `SUMMARY:${r.title}`, `DESCRIPTION:${r.description || 'Zenith Routine'}`, `DTSTART;TZID=UTC:20240101T${startTime}`, `RRULE:${rrule}`, 'DURATION:PT1H', 'END:VEVENT');
        });
        ics.push('END:VCALENDAR');
        return ics.join('\r\n');
    },

    /**
     * Get the permanent Calendar Subscription Link
     */
    getCalendarSyncLink(userId) {
        const baseUrl = PlatformService.getApiUrl();
        return `${baseUrl}/api/v1/calendar/sync?user_id=${userId}`;
    }
};
