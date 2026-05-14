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
    }
};
