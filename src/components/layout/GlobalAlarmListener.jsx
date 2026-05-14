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
        const handleToggle = (e) => setEnabled(e.detail);
        const handleTest = () => testAlarm();
        window.addEventListener('toggle-alarms', handleToggle);
        window.addEventListener('test-alarm', handleTest);
        
        if (user?.role === 'member' && enabled) {
            startListener();
        } else {
            stopListener();
        }
        
        return () => {
            stopListener();
            window.removeEventListener('toggle-alarms', handleToggle);
            window.removeEventListener('test-alarm', handleTest);
        };
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
            
            {showStopModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)',
                    zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div style={{
                        background: 'var(--surface)', border: '1px solid var(--primary-500)', borderRadius: '24px',
                        padding: '40px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 0 50px rgba(99,102,241,0.5)'
                    }}>
                        <div style={{ fontSize: '64px', marginBottom: '20px' }}>⏰</div>
                        <h2 style={{ fontSize: '24px', margin: '0 0 10px 0' }}>It's Time!</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Your routine is starting. Stop the alarm and get to work.</p>
                        <button 
                            onClick={stopShouting}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                                background: 'var(--primary-500)', color: 'white', fontWeight: 800,
                                fontSize: '18px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(99,102,241,0.3)'
                            }}
                        >
                            STOP ALARM
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default GlobalAlarmListener;
