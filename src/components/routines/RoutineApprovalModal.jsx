import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { routineService } from '../../services/routineService';
import { Check, X, Clock, Minimize2, Maximize2, Zap, AlertCircle } from 'lucide-react';

/**
 * RoutineApprovalModal Component
 * Popup window asking for user approval for routines starting within the 30-minute window.
 * Features compressible floating orb state and automatic 30-min missed tracking.
 */
export const RoutineApprovalModal = () => {
    const { user } = useAuth();
    const [pendingRoutines, setPendingRoutines] = useState([]);
    const [isMinimized, setIsMinimized] = useState(false);
    const [timeRemainingMap, setTimeRemainingMap] = useState({});

    // Fetch active routines within the 30-min start time window
    const checkActiveRoutinesWindow = async () => {
        if (!user?.id) return;
        try {
            const routines = await routineService.getRoutines();
            const now = new Date();
            const currentDay = now.getDay() === 0 ? 7 : now.getDay();
            const todayStr = now.toISOString().split('T')[0];

            // Fetch today's logs
            const todayLogs = await routineService.getLogsForDate(todayStr);
            const loggedRoutineIds = new Set((todayLogs || []).map(l => l.routine_id));

            const activeInWindow = [];
            const times = {};

            routines.forEach(r => {
                if (!r.is_active || r.is_anonymous || !r.days_of_week?.includes(currentDay)) return;
                if (loggedRoutineIds.has(r.id)) return; // Already answered/logged today

                const [h, m] = r.start_time.split(':').map(Number);
                const startTime = new Date(now);
                startTime.setHours(h, m, 0, 0);

                const diffMs = now - startTime;
                const diffMins = diffMs / (1000 * 60);

                // Check if within [0, 30] minutes window
                if (diffMins >= 0 && diffMins <= 30) {
                    const remainingSeconds = Math.max(0, Math.floor((30 * 60 * 1000 - diffMs) / 1000));
                    activeInWindow.push(r);
                    times[r.id] = remainingSeconds;
                } else if (diffMins > 30 && !loggedRoutineIds.has(r.id)) {
                    // Auto-mark missed if > 30 minutes expired and not logged
                    routineService.logRoutineProgress(r.id, {
                        status: 'ignored',
                        log_date: todayStr,
                        learning_notes: 'Automatically marked missed: Response timeout (30 mins)'
                    }).catch(console.error);
                }
            });

            setPendingRoutines(activeInWindow);
            setTimeRemainingMap(times);
        } catch (err) {
            console.error('[RoutineApprovalModal] Window check error:', err);
        }
    };

    useEffect(() => {
        checkActiveRoutinesWindow();
        const interval = setInterval(checkActiveRoutinesWindow, 10000); // Check every 10 sec
        return () => clearInterval(interval);
    }, [user?.id]);

    // Live 1-second countdown timer update
    useEffect(() => {
        if (pendingRoutines.length === 0) return;

        const timer = setInterval(() => {
            setTimeRemainingMap(prev => {
                const nextMap = { ...prev };
                let hasExpired = false;

                Object.keys(nextMap).forEach(id => {
                    if (nextMap[id] > 0) {
                        nextMap[id] -= 1;
                    } else {
                        hasExpired = true;
                    }
                });

                if (hasExpired) {
                    checkActiveRoutinesWindow();
                }

                return nextMap;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [pendingRoutines]);

    const handleAction = async (routineId, isDoing) => {
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const status = isDoing ? 'done' : 'ignored';
            const notes = isDoing ? 'Approved: In Progress / Completed' : 'Disapproved: Marked Missed';

            await routineService.logRoutineProgress(routineId, {
                status,
                log_date: todayStr,
                learning_notes: notes
            });

            // Remove from active list
            setPendingRoutines(prev => prev.filter(r => r.id !== routineId));
        } catch (err) {
            console.error('[RoutineApprovalModal] Action failed:', err);
        }
    };

    if (!user || pendingRoutines.length === 0) return null;

    const formatCountdown = (seconds = 0) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    // ── MINIMIZED FLOATING BADGE / ORB ──
    if (isMinimized) {
        return (
            <div
                onClick={() => setIsMinimized(false)}
                style={{
                    position: 'fixed',
                    bottom: 'calc(80px + max(env(safe-area-inset-bottom, 0px), 16px))',
                    left: '20px',
                    zIndex: 99990,
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    borderRadius: '28px',
                    padding: '8px 16px',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 0 20px rgba(99, 102, 241, 0.6), inset 0 0 8px rgba(255,255,255,0.3)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    animation: 'routine-badge-pulse 2s infinite'
                }}
                className="routine-minimized-badge"
                title="Click to expand active routine approvals"
            >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Zap size={16} className="text-amber-300 animate-pulse" />
                    <span style={{
                        position: 'absolute', top: -3, right: -3,
                        width: 8, height: 8, borderRadius: '50%', background: '#ef4444'
                    }} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>
                    {pendingRoutines.length} Active {pendingRoutines.length === 1 ? 'Routine' : 'Routines'}
                </span>
                <Maximize2 size={14} style={{ opacity: 0.8 }} />

                <style>{`
                    @keyframes routine-badge-pulse {
                        0%, 100% { transform: scale(1); box-shadow: 0 0 15px rgba(99, 102, 241, 0.5); }
                        50% { transform: scale(1.05); box-shadow: 0 0 25px rgba(124, 58, 237, 0.8); }
                    }
                `}</style>
            </div>
        );
    }

    // ── EXPANDED FLOATING APPROVAL CARD / POPUP ──
    return (
        <div
            style={{
                position: 'fixed',
                bottom: 'calc(80px + max(env(safe-area-inset-bottom, 0px), 16px))',
                left: '20px',
                width: '350px',
                maxWidth: '92vw',
                zIndex: 99990,
                background: 'rgba(13, 14, 22, 0.94)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                border: '1.5px solid rgba(99, 102, 241, 0.4)',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(99, 102, 241, 0.25)',
                overflow: 'hidden',
                animation: 'routine-modal-appear 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
        >
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={18} className="text-amber-400 animate-bounce" />
                    <div>
                        <h4 style={{ margin: 0, color: 'white', fontSize: '13px', fontWeight: 700 }}>
                            Routine Approval Protocol
                        </h4>
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>
                            30-Min Window Active ({pendingRoutines.length} Pending)
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => setIsMinimized(true)}
                    style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px',
                        color: 'rgba(255,255,255,0.7)',
                        cursor: 'pointer'
                    }}
                    title="Compress into floating symbol"
                >
                    <Minimize2 size={16} />
                </button>
            </div>

            {/* Routine List */}
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
                {pendingRoutines.map(routine => {
                    const secondsLeft = timeRemainingMap[routine.id] || 0;
                    return (
                        <div
                            key={routine.id}
                            style={{
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '12px',
                                padding: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h5 style={{ margin: 0, color: 'white', fontSize: '13px', fontWeight: 600 }}>
                                        {routine.title}
                                    </h5>
                                    <span style={{ fontSize: '10px', color: 'var(--primary-400)' }}>
                                        Scheduled: {routine.start_time?.slice(0, 5)}
                                    </span>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    color: secondsLeft < 300 ? '#ef4444' : '#f59e0b',
                                    fontWeight: 700,
                                    background: 'rgba(0,0,0,0.4)',
                                    padding: '2px 6px',
                                    borderRadius: '6px'
                                }}>
                                    <Clock size={12} />
                                    <span>{formatCountdown(secondsLeft)}</span>
                                </div>
                            </div>

                            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                                Are you performing this task now? Confirm to log progress before timeout.
                            </p>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <button
                                    onClick={() => handleAction(routine.id, true)}
                                    style={{
                                        flex: 1,
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        border: 'none',
                                        color: 'white',
                                        fontWeight: 600,
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <Check size={14} /> Yes, Doing It
                                </button>
                                <button
                                    onClick={() => handleAction(routine.id, false)}
                                    style={{
                                        flex: 1,
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        background: 'rgba(239, 68, 68, 0.2)',
                                        border: '1px solid rgba(239, 68, 68, 0.4)',
                                        color: '#fca5a5',
                                        fontWeight: 600,
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <X size={14} /> No, Missed
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                @keyframes routine-modal-appear {
                    0% { transform: translateY(20px) scale(0.95); opacity: 0; }
                    100% { transform: translateY(0) scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default RoutineApprovalModal;
