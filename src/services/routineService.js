import { supabase } from '../lib/supabase';

/**
 * Service for managing routines and consistency logs (The Diary)
 */
export const routineService = {
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

    /**
     * Create a new routine
     */
    async createRoutine(routineData) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('routines')
            .insert([{ ...routineData, user_id: user.id }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update a routine
     */
    async updateRoutine(id, updates) {
        const { data, error } = await supabase
            .from('routines')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete a routine
     */
    async deleteRoutine(id) {
        const { error } = await supabase
            .from('routines')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // --- ROUTINE LOGS (The Diary) ---

    /**
     * Get logs for a specific date (defaults to today)
     */
    async getLogsForDate(date = new Date().toISOString().split('T')[0]) {
        const { data, error } = await supabase
            .from('routine_logs')
            .select('*, routines(*)')
            .eq('log_date', date);

        if (error) throw error;
        return data;
    },

    /**
     * Log progress for a routine today
     */
    async updateLog(routineId, updates) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const today = new Date().toISOString().split('T')[0];

        // Try to update first, if it doesn't exist, it won't do anything (upsert is better)
        const { data, error } = await supabase
            .from('routine_logs')
            .upsert({
                routine_id: routineId,
                user_id: user.id,
                log_date: today,
                ...updates,
                updated_at: new Date().toISOString()
            }, { onConflict: 'routine_id,log_date' })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Get analytics for a specific routine
     */
    async getRoutineAnalytics(routineId) {
        const { data, error } = await supabase
            .from('routine_logs')
            .select('*')
            .eq('routine_id', routineId)
            .order('log_date', { ascending: false });

        if (error) throw error;
        return data;
    },

    // --- AI TIMETABLES ---

    /**
     * Save AI generated timetable
     */
    async saveTimetable(weekStart, scheduleData) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('ai_timetables')
            .upsert({
                user_id: user.id,
                week_start: weekStart,
                schedule_data: scheduleData
            }, { onConflict: 'user_id,week_start' })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Get timetable for a week
     */
    async getTimetable(weekStart) {
        const { data, error } = await supabase
            .from('ai_timetables')
            .select('*')
            .eq('week_start', weekStart)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Convert AI Timetable tasks into actual recurring Routines
     */
    async syncTimetableToRoutines(scheduleData) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const routinesToInsert = [];
        const daysMap = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7 };

        // Group tasks by title and time to find recurring ones
        const taskGroups = {}; // title_time -> { title, time, days }

        Object.entries(scheduleData.days).forEach(([dayName, tasks]) => {
            const dayNum = daysMap[dayName];
            tasks.forEach(task => {
                const key = `${task.task}_${task.time}`;
                if (!taskGroups[key]) {
                    taskGroups[key] = {
                        user_id: user.id,
                        title: task.task,
                        start_time: task.time.includes(':') ? (task.time.length === 5 ? `${task.time}:00` : task.time) : `${task.time}:00:00`,
                        days_of_week: []
                    };
                }
                taskGroups[key].days_of_week.push(dayNum);
            });
        });

        const insertData = Object.values(taskGroups);
        
        const { data, error } = await supabase
            .from('routines')
            .insert(insertData)
            .select();

        if (error) throw error;
        return data;
    /**
     * Smart Sync: Replace/Update routines without losing linked Diary logs
     */
    async replaceAllRoutines(newRoutines) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // 1. Fetch current routines
        const { data: currentRoutines } = await supabase
            .from('routines')
            .select('*')
            .eq('user_id', user.id);

        const currentMap = {};
        currentRoutines.forEach(r => {
            const key = `${r.title.toLowerCase()}_${r.start_time}`;
            currentMap[key] = r;
        });

        const routinesToUpdate = [];
        const routinesToInsert = [];
        const seenKeys = new Set();

        newRoutines.forEach(r => {
            const key = `${r.title.toLowerCase()}_${r.start_time}`;
            seenKeys.add(key);
            
            if (currentMap[key]) {
                // Update existing
                routinesToUpdate.push({
                    id: currentMap[key].id,
                    ...r,
                    user_id: user.id
                });
            } else {
                // Insert new
                routinesToInsert.push({
                    ...r,
                    user_id: user.id
                });
            }
        });

        // 2. Identify routines to delete (those not in new set)
        const idsToDelete = currentRoutines
            .filter(r => !seenKeys.has(`${r.title.toLowerCase()}_${r.start_time}`))
            .map(r => r.id);

        // 3. Execute batch operations
        if (idsToDelete.length > 0) {
            await supabase.from('routines').delete().in('id', idsToDelete);
        }

        if (routinesToUpdate.length > 0) {
            await supabase.from('routines').upsert(routinesToUpdate);
        }

        if (routinesToInsert.length > 0) {
            await supabase.from('routines').insert(routinesToInsert);
        }

    /**
     * Check for pending routines that have timed out (15 mins) and mark them as ignored
     */
    async checkAndMarkIgnored() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const today = new Date().toISOString().split('T')[0];
        
        // Fetch routines and their today's logs
        const { data: routines } = await supabase
            .from('routines')
            .select(`
                *,
                routine_logs(status, created_at)
            `)
            .eq('user_id', user.id)
            .eq('is_active', true);

        const now = new Date();
        
        for (const routine of routines) {
            const todayLog = routine.routine_logs?.find(l => l.log_date === today);
            
            // If it's pending or not logged yet but start time has passed by 15 mins
            const startTime = new Date(`${today}T${routine.start_time}`);
            const diffMinutes = (now - startTime) / (1000 * 60);

            if (diffMinutes > 15 && (!todayLog || todayLog.status === 'pending')) {
                await this.logRoutineProgress(routine.id, {
                    status: 'ignored',
                    learning_notes: 'Automatically marked ignored: Response timeout (15 mins)'
                });
            }
        }
    }

    /**
     * Generate an ICS file content for the user's routines
     * This allows 100% accurate alarms via Google/Apple Calendar
     */
    generateICS(routines) {
        let ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Zenith//Productivity System//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        const daysMap = { 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA', 7: 'SU' };

        routines.forEach(r => {
            const [hours, mins] = r.start_time.split(':');
            const startTime = `${hours}${mins}00`;
            const rrule = `FREQ=WEEKLY;BYDAY=${r.days_of_week.map(d => daysMap[d]).join(',')}`;

            ics.push('BEGIN:VEVENT');
            ics.push(`SUMMARY:${r.title}`);
            ics.push(`DESCRIPTION:${r.description || 'Zenith Routine'}`);
            ics.push(`DTSTART;TZID=UTC:20240101T${startTime}`); // Start from a Monday in 2024
            ics.push(`RRULE:${rrule}`);
            ics.push('DURATION:PT1H'); // Default 1 hour
            ics.push('END:VEVENT');
        });

        ics.push('END:VCALENDAR');
        return ics.join('\r\n');
    /**
     * Get the permanent Calendar Subscription Link
     */
    getCalendarSyncLink(userId) {
        // In a production app, this would point to a Supabase Edge Function
        // For this demo, we'll provide the instructions and the simulated endpoint
        const baseUrl = window.location.origin;
        return `${baseUrl}/api/v1/calendar/sync?user_id=${userId}`;
    }
};
