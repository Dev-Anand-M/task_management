import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { routineService } from '../../services/routineService';
import { Volume2, VolumeX } from 'lucide-react';

const GlobalAlarmListener = () => {
    const { user } = useAuth();
    const [enabled, setEnabled] = useState(() => localStorage.getItem('alarms_enabled') === 'true');
    const [activeAlarm, setActiveAlarm] = useState(null);
    const [nextAlarm, setNextAlarm] = useState(null); // { title: string, minutes: number }
    const audioRef = useRef(null);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (user?.role === 'member' && enabled) {
            startListener();
        } else {
            stopListener();
        }
        return () => stopListener();
    }, [user?.id, enabled]);

    const startListener = () => {
        if (intervalRef.current) return;
        console.log('[Alarm] Starting global listener...');
        intervalRef.current = setInterval(checkAlarms, 60000); 
        checkAlarms(); 
    };

    const stopListener = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const checkAlarms = async () => {
        if (!user?.id) return;
        try {
            const routines = await routineService.getRoutines();
            const now = new Date();
            const currentDay = now.getDay() === 0 ? 7 : now.getDay();
            const currentTimeStr = now.toTimeString().slice(0, 5);

            const triggerRoutine = routines.find(r => 
                r.is_active && 
                r.days_of_week.includes(currentDay) && 
                r.start_time.slice(0, 5) === currentTimeStr
            );

            if (triggerRoutine) {
                triggerAlarm(triggerRoutine);
            }

            calculateNextAlarm(routines, now, currentDay);
            await routineService.checkAndMarkIgnored();
            
            // Check for new general task/quiz notifications
            await checkNewNotifications();
            
        } catch (err) {
            console.error('[Alarm] Check failed:', err);
        }
    };

    const checkNewNotifications = async () => {
        try {
            const { data } = await routineService.supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(5);

            if (data && data.length > 0) {
                const latest = data[0];
                const lastNotifId = localStorage.getItem('last_notif_id');
                
                if (latest.id !== lastNotifId) {
                    localStorage.setItem('last_notif_id', latest.id);
                    if (Notification.permission === 'granted') {
                        new Notification(latest.title, {
                            body: latest.message,
                            icon: '/zenith.png'
                        });
                    }
                }
            }
        } catch (err) {
            console.warn('[Notif] Check failed:', err);
        }
    };

    const calculateNextAlarm = (routines, now, currentDay) => {
        let minDiff = Infinity;
        let soonest = null;

        routines.filter(r => r.is_active).forEach(r => {
            r.days_of_week.forEach(day => {
                let dayDiff = day - currentDay;
                if (dayDiff < 0) dayDiff += 7;

                const [hours, mins] = r.start_time.split(':').map(Number);
                const alarmDate = new Date(now);
                alarmDate.setDate(now.getDate() + dayDiff);
                alarmDate.setHours(hours, mins, 0, 0);

                if (alarmDate <= now) {
                    alarmDate.setDate(alarmDate.getDate() + 7);
                }

                const diff = (alarmDate - now) / 60000;
                if (diff < minDiff) {
                    minDiff = diff;
                    soonest = { title: r.title, minutes: Math.round(diff) };
                }
            });
        });
        setNextAlarm(soonest);
    };

    const triggerAlarm = (routine) => {
        if (activeAlarm === routine.id) return;
        setActiveAlarm(routine.id);

        if (Notification.permission === 'granted') {
            new Notification(`⏰ Alarm: ${routine.title}`, {
                body: `It's time for your scheduled routine! Respond within 15 minutes.`,
                icon: '/zenith.png'
            });
        }

        if (audioRef.current) {
            audioRef.current.play().catch(e => console.warn('[Alarm] Audio blocked:', e));
        }

        setTimeout(() => setActiveAlarm(null), 65000);
    };

    const toggleEnabled = async () => {
        if (!enabled) {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('Please enable notifications to use alarms.');
                return;
            }
            if (audioRef.current) {
                audioRef.current.play().then(() => {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                }).catch(() => {});
            }
        }
        const newState = !enabled;
        setEnabled(newState);
        localStorage.setItem('alarms_enabled', newState);
    };

    const testAlarm = () => {
        triggerAlarm({ title: 'Test Alarm', id: 'test' });
        alert('Test triggered! If you didn\'t hear a sound or see a popup, check your phone\'s Notification & Sound settings.');
    };

    return (
        <>
            <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" loop />
            <div 
                className="global-alarm-toggle"
                onClick={toggleEnabled}
                style={{
                    position: 'fixed', bottom: '20px', right: '20px',
                    padding: nextAlarm && enabled ? '0 16px 0 0' : '0',
                    height: '48px', borderRadius: '24px',
                    background: enabled ? 'var(--primary-500)' : 'var(--surface)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    cursor: 'pointer', boxShadow: 'var(--shadow-xl)',
                    zIndex: 9999, transition: 'all 0.5s',
                    color: enabled ? 'white' : 'var(--text-muted)',
                    overflow: 'hidden'
                }}
            >
                <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {enabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </div>

                {enabled && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); testAlarm(); }}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        TEST
                    </button>
                )}

                {enabled && nextAlarm && (
                    <div style={{ display: 'flex', flexDirection: 'column', whiteSpace: 'nowrap', animation: 'fadeIn 0.3s' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.8 }}>Next Alarm</span>
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>
                            {nextAlarm.minutes === 0 ? 'Soon!' : `in ${nextAlarm.minutes}m`}
                        </span>
                    </div>
                )}
            </div>
            <style>{`
                .global-alarm-toggle:hover { transform: translateY(-4px); }
                @keyframes fadeIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
            `}</style>
        </>
    );
};

export default GlobalAlarmListener;
