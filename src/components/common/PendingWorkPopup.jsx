import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge, Modal } from '../common';
import { AlertTriangle, Clock, CheckCircle, Zap, ChevronRight, X } from 'lucide-react';
import { RoutineNotificationService } from '../../services/RoutineNotificationService';
import { format12h } from '../../utils/timeFormat';

const PendingWorkPopup = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [show, setShow] = useState(false);
    const [pending, setPending] = useState([]);
    const [missed, setMissed] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!user?.id || dismissed) return;

        const checkPending = async () => {
            setLoading(true);
            try {
                const { pending: p, missed: m } = await RoutineNotificationService.getPendingWork();
                setPending(p);
                setMissed(m);

                // Only show if there's something actionable
                if (p.length > 0 || m.length > 0) {
                    // Don't show again if dismissed this session
                    const lastDismissed = sessionStorage.getItem('pending_popup_dismissed');
                    if (!lastDismissed) {
                        setShow(true);
                    }
                }
            } catch (err) {
                console.error('[PendingWorkPopup] Error:', err);
            } finally {
                setLoading(false);
            }
        };

        // Delay slightly to let app settle
        const timer = setTimeout(checkPending, 1500);
        return () => clearTimeout(timer);
    }, [user?.id, dismissed]);

    const handleDismiss = () => {
        setShow(false);
        setDismissed(true);
        sessionStorage.setItem('pending_popup_dismissed', 'true');
    };

    const handleGoToRoutines = () => {
        handleDismiss();
        navigate('/routines');
    };

    if (!show || loading) return null;

    const overdueItems = pending.filter(p => p.status === 'overdue');
    const upcomingItems = pending.filter(p => p.status === 'upcoming');

    return (
        <Modal isOpen={show} onClose={handleDismiss}>
            <div style={{ maxWidth: '420px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 'var(--space-lg)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <div style={{ 
                            width: 40, height: 40, borderRadius: '50%',
                            background: missed.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {missed.length > 0 
                                ? <AlertTriangle size={20} color="var(--error-500)" />
                                : <Clock size={20} color="var(--primary-500)" />
                            }
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
                                {missed.length > 0 ? "You've got catching up to do" : "Today's Lineup"}
                            </h3>
                            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleDismiss}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Missed Section */}
                {missed.length > 0 && (
                    <div style={{ marginBottom: 'var(--space-md)' }}>
                        <div style={{ 
                            display: 'flex', alignItems: 'center', gap: '6px', 
                            marginBottom: 'var(--space-sm)',
                            color: 'var(--error-500)', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase'
                        }}>
                            <AlertTriangle size={12} /> Missed ({missed.length})
                        </div>
                        {missed.map(item => (
                            <div key={item.id} style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                borderRadius: 'var(--radius-md)',
                                background: 'rgba(239, 68, 68, 0.06)',
                                borderLeft: '3px solid var(--error-500)',
                                marginBottom: '6px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <div>
                                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                                        {item.isAnonymous ? '⚡' : '🔄'} {item.title}
                                    </p>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                        {item.isAnonymous ? 'Flexible' : format12h(item.time)}
                                        {item.minutesLate ? ` • ${item.minutesLate}m late` : ''}
                                    </span>
                                </div>
                                <Badge variant="error" size="xs">Missed</Badge>
                            </div>
                        ))}
                    </div>
                )}

                {/* Overdue Section */}
                {overdueItems.length > 0 && (
                    <div style={{ marginBottom: 'var(--space-md)' }}>
                        <div style={{ 
                            display: 'flex', alignItems: 'center', gap: '6px', 
                            marginBottom: 'var(--space-sm)',
                            color: 'var(--warning-500)', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase'
                        }}>
                            <Clock size={12} /> Overdue ({overdueItems.length})
                        </div>
                        {overdueItems.map(item => (
                            <div key={item.id} style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                borderRadius: 'var(--radius-md)',
                                background: 'rgba(245, 158, 11, 0.06)',
                                borderLeft: '3px solid var(--warning-500)',
                                marginBottom: '6px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <div>
                                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600 }}>🔄 {item.title}</p>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                        {format12h(item.time)} • {item.minutesLate}m overdue
                                    </span>
                                </div>
                                <Badge variant="warning" size="xs">Hurry!</Badge>
                            </div>
                        ))}
                    </div>
                )}

                {/* Upcoming Section */}
                {upcomingItems.length > 0 && (
                    <div style={{ marginBottom: 'var(--space-md)' }}>
                        <div style={{ 
                            display: 'flex', alignItems: 'center', gap: '6px', 
                            marginBottom: 'var(--space-sm)',
                            color: 'var(--primary-500)', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase'
                        }}>
                            <CheckCircle size={12} /> Upcoming ({upcomingItems.length})
                        </div>
                        {upcomingItems.slice(0, 5).map(item => (
                            <div key={item.id} style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                borderRadius: 'var(--radius-md)',
                                background: 'rgba(99, 102, 241, 0.04)',
                                borderLeft: `3px solid ${item.isAnonymous ? '#8b5cf6' : 'var(--primary-400)'}`,
                                marginBottom: '6px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <div>
                                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                                        {item.isAnonymous ? '⚡' : '🔄'} {item.title}
                                    </p>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                        {item.isAnonymous ? 'Flexible — anytime today' : format12h(item.time)}
                                    </span>
                                </div>
                                <Badge variant={item.isAnonymous ? 'accent' : 'primary'} size="xs">
                                    {item.isAnonymous ? 'Flex' : 'Queued'}
                                </Badge>
                            </div>
                        ))}
                        {upcomingItems.length > 5 && (
                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', margin: '4px 0 0' }}>
                                +{upcomingItems.length - 5} more routines today
                            </p>
                        )}
                    </div>
                )}

                {/* Summary */}
                <div style={{ 
                    padding: 'var(--space-sm)', 
                    background: 'var(--surface)', 
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                    marginBottom: 'var(--space-md)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)'
                }}>
                    {missed.length > 0 && `${missed.length} missed · `}
                    {overdueItems.length > 0 && `${overdueItems.length} overdue · `}
                    {upcomingItems.length} upcoming today
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <Button variant="ghost" onClick={handleDismiss} style={{ flex: 1 }}>
                        Dismiss
                    </Button>
                    <Button variant="primary" onClick={handleGoToRoutines} style={{ flex: 1 }}>
                        <Zap size={14} /> Go to Routines <ChevronRight size={14} />
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default PendingWorkPopup;
