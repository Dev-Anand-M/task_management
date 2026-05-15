import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).send('Missing user_id parameter');
  }

  try {
    // 1. Fetch active routines for the user
    const { data: routines, error } = await supabase
      .from('routines')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true);

    if (error) {
      console.error('[CalendarSync] Supabase error:', error);
      throw error;
    }

    if (!routines || routines.length === 0) {
      // Return an empty calendar rather than an error
      return res.status(200)
        .setHeader('Content-Type', 'text/calendar')
        .send('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Zenith//Productivity System//EN\r\nEND:VCALENDAR');
    }

    // 2. Generate ICS Content
    let ics = [
      'BEGIN:VCALENDAR', 
      'VERSION:2.0', 
      'PRODID:-//Zenith//Productivity System//EN', 
      'CALSCALE:GREGORIAN', 
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Zenith Productivity',
      'X-WR-TIMEZONE:UTC' // Using UTC as a base; DTSTART will be floating for simplicity
    ];

    const daysMap = { 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA', 7: 'SU' };
    
    routines.forEach(r => {
      const [hours, mins] = r.start_time.split(':');
      const timeStr = `${hours}${mins}00`;
      
      // We use a fixed base date (Monday, Jan 1, 2024 was a Monday)
      // BYDAY handles the actual recurrence
      const rrule = `FREQ=WEEKLY;BYDAY=${r.days_of_week.map(d => daysMap[d]).join(',')}`;
      
      ics.push(
        'BEGIN:VEVENT',
        `UID:${r.id}@zenith.app`,
        `SUMMARY:${r.title}`,
        `DESCRIPTION:${r.description || 'Zenith Routine'}`,
        `DTSTART:20240101T${timeStr}`, // Floating time (matches wall-clock time)
        `RRULE:${rrule}`,
        `DURATION:PT${r.duration_minutes || 60}M`,
        'END:VEVENT'
      );
    });

    ics.push('END:VCALENDAR');
    
    // 3. Serve the file
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="zenith_calendar.ics"');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600'); // Cache for 1 hour
    
    return res.status(200).send(ics.join('\r\n'));

  } catch (err) {
    console.error('[CalendarSync] Server error:', err);
    return res.status(500).send('Internal Server Error');
  }
}
