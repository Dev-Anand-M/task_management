import { supabase } from '../lib/supabase';

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
            .order('start_time', { ascending: true });
            
        if (error) throw error;
        return data;
    },

    async createRoutine(routine) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('routines')
            .insert([{ ...routine, user_id: user.id }])
            .select();
        if (error) throw error;
        return data[0];
    },

    async updateRoutine(id, updates) {
        const { data, error } = await supabase
            .from('routines')
            .update(updates)
            .eq('id', id)
            .select();
        if (error) throw error;
        return data[0];
    },

    async deleteRoutine(id) {
        const { error } = await supabase
            .from('routines')
            .delete()
            .eq('id', id);
        if (error) throw error;
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

    async logRoutineProgress(routineId, data) {
        const { data: { user } } = await supabase.auth.getUser();
        const logDate = new Date().toISOString().split('T')[0];
        
        const { data: result, error } = await supabase
            .from('routine_logs')
            .upsert({
                routine_id: routineId,
                user_id: user.id,
                log_date: logDate,
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
                week_start_date: weekStart,
                schedule_data: scheduleData
            }, { onConflict: 'user_id,week_start_date' })
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
            .eq('week_start_date', weekStart)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async updateLog(routineId, updates) {
        return this.logRoutineProgress(routineId, updates);
    },

    /**
     * Smart Sync: Replace/Update routines without losing linked Diary logs
     */
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
            const key = `${nr.title.toLowerCase()}_${nr.start_time.slice(0, 5)}`;
            seenInNew.add(key);
            if (currentMap[key]) {
                routinesToUpdate.push({
                    id: currentMap[key].id,
                    ...nr,
                    user_id: user.id,
                    is_active: true
                });
            } else {
                routinesToInsert.push({
                    ...nr,
                    user_id: user.id,
                    is_active: true
                });
            }
        });

        const routinesToDelete = currentRoutines
            .filter(r => !seenInNew.has(`${r.title.toLowerCase()}_${r.start_time.slice(0, 5)}`))
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
        const baseUrl = window.location.origin;
        return `${baseUrl}/api/v1/calendar/sync?user_id=${userId}`;
    }
};
