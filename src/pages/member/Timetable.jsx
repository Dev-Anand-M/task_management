import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { routineService } from '../../services/routineService';
import { manageRoutinesChat } from '../../services/aiService';
import { supabase } from '../../lib/supabase';
import { Card, Badge, Button, Input, LoadingSpinner } from '../../components/common';
import { 
    Calendar, Sparkles, Send, Clock, 
    MessageSquare, Brain, RefreshCw, ChevronLeft, ChevronRight,
    User, Bot, CheckCircle, AlertTriangle
} from 'lucide-react';
import { format12h } from '../../utils/timeFormat';

const Timetable = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [routines, setRoutines] = useState([]);
    const [todayLogs, setTodayLogs] = useState([]);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Hello! I'm your AI Scheduling Architect. How can I help you organize your week? You can say things like 'Add DSA study at 8am on weekdays' or 'Clear my Wednesday afternoon'." }
    ]);
    const [userInput, setUserInput] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const chatEndRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        fetchRoutines();
    }, [user?.id]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        if (messages.length > 1) {
            saveChatHistory(messages);
        }
    }, [messages]);

    useEffect(() => {
        if (user?.id) {
            fetchChatHistory();
        }
    }, [user?.id]);

    const fetchChatHistory = async () => {
        try {
            const { data } = await supabase
                .from('ai_history')
                .select('*')
                .eq('user_id', user.id)
                .eq('tool', 'timetable_architect')
                .maybeSingle();

            if (data?.content?.messages) {
                setMessages(data.content.messages);
            }
        } catch (err) {
            console.error('Error fetching chat history:', err);
        }
    };

    const saveChatHistory = async (newMessages) => {
        try {
            await supabase.from('ai_history').upsert({
                user_id: user.id,
                tool: 'timetable_architect',
                title: 'Main Timetable Chat',
                content: { messages: newMessages }
            }, { onConflict: 'user_id,tool,title' });
        } catch (err) {
            console.error('Error saving chat history:', err);
        }
    };

    const fetchRoutines = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const [routineData, logData] = await Promise.all([
                routineService.getRoutines(),
                routineService.getLogsForDate(new Date().toISOString().split('T')[0])
            ]);
            setRoutines(routineData);
            setTodayLogs(logData);
        } catch (err) {
            console.error('Failed to fetch routines:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!userInput.trim() || sending) return;

        const userMsg = userInput;
        setUserInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setSending(true);

        try {
            const response = await manageRoutinesChat(
                [...messages, { role: 'user', content: userMsg }],
                routines,
                todayLogs
            );

            // Split response and metadata
            const [text, metadataStr] = response.split('---METADATA---');
            
            if (metadataStr) {
                try {
                    const metadata = JSON.parse(metadataStr.trim());
                    
                    // 1. Sync Timetable (Routines)
                    if (metadata.routines) {
                        await routineService.replaceAllRoutines(metadata.routines);
                    }
                    
                    // 2. Perform Log Actions (Today's instances)
                    if (metadata.logUpdates) {
                        for (const update of metadata.logUpdates) {
                            await routineService.logRoutineProgress(update.routine_id, {
                                status: update.status,
                                learning_notes: update.notes || `Updated via AI: ${userMsg}`
                            });
                        }
                    }

                    await fetchRoutines(); // Refresh UI
                } catch (e) {
                    console.error("Failed to parse AI metadata:", e);
                }
            }

            setMessages(prev => [...prev, { role: 'assistant', content: text.trim() }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error while updating your schedule. " + err.message }]);
        } finally {
            setSending(false);
        }
    };

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const daysMap = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7 };

    return (
        <div className="page-content animate-fade-in" style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', fontSize: isMobile ? 'var(--text-xl)' : 'var(--text-4xl)' }}>
                        <Brain className="text-primary-500" /> {isMobile ? 'AI Planner' : 'AI Scheduling Architect'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: isMobile ? '10px' : 'var(--text-sm)' }}>Natural language timetable management</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <Button variant="ghost" icon={Calendar} onClick={() => {
                        const icsContent = routineService.generateICS(routines);
                        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
                        const link = document.createElement('a');
                        link.href = window.URL.createObjectURL(blob);
                        link.setAttribute('download', 'zenith_routines.ics');
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}>Export to Calendar</Button>
                    <Badge variant="primary" icon={RefreshCw}>Live Sync Active</Badge>
                </div>
            </div>

            <div style={{ 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row', 
                gap: 'var(--space-lg)', 
                flex: 1, 
                minHeight: 0,
                overflowY: 'auto'
            }}>
                {/* Chat Column */}
                <Card style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    padding: 0, 
                    overflow: 'hidden', 
                    border: '1px solid var(--border)',
                    width: isMobile ? '100%' : '350px',
                    height: isMobile ? '500px' : 'auto',
                    flexShrink: 0,
                    boxShadow: 'var(--shadow-lg)',
                    borderRadius: 'var(--radius-xl)'
                }}>
                    <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border)', background: 'rgba(99, 102, 241, 0.05)' }}>
                        <h3 style={{ margin: 0, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-500)' }}>
                            <Sparkles size={16} /> Strategy & Planning
                        </h3>
                    </div>
                    
                    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{ 
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '90%',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                            }}>
                                <div style={{ 
                                    padding: '10px 14px', 
                                    borderRadius: msg.role === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                                    background: msg.role === 'user' ? 'var(--primary-600)' : 'var(--surface)',
                                    color: msg.role === 'user' ? 'white' : 'var(--text)',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    boxShadow: 'var(--shadow-sm)',
                                    border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                                    wordBreak: 'break-word',
                                    lineHeight: '1.4'
                                }}>
                                    {msg.content}
                                </div>
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: msg.role === 'user' ? 'right' : 'left', margin: '0 4px' }}>
                                    {msg.role === 'user' ? 'You' : 'Architect'}
                                </span>
                            </div>
                        ))}
                        {sending && (
                            <div style={{ alignSelf: 'flex-start', padding: '10px 14px', background: 'var(--surface)', borderRadius: '18px 18px 18px 2px', border: '1px solid var(--border)' }}>
                                <LoadingSpinner size="sm" />
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleSendMessage} style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                        <div className="flex gap-sm">
                            <Input 
                                placeholder="e.g. Add 2h study every Mon" 
                                value={userInput} 
                                onChange={e => setUserInput(e.target.value)}
                                disabled={sending}
                                style={{ margin: 0, borderRadius: 'var(--radius-full)' }}
                            />
                            <Button variant="primary" type="submit" disabled={sending || !userInput.trim()} style={{ borderRadius: 'var(--radius-full)', width: '42px', height: '42px', padding: 0 }}>
                                <Send size={18} />
                            </Button>
                        </div>
                    </form>
                </Card>

                {/* Timetable View */}
                <div style={{ flex: 1, minWidth: 0, paddingRight: '4px' }}>
                    <Card style={{ marginBottom: 'var(--space-md)', background: 'linear-gradient(135deg, var(--surface) 0%, var(--bg) 100%)', border: '1px solid var(--primary-500)' }}>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-md">
                                <RefreshCw className="text-primary-500 animate-spin-slow" />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 'var(--text-sm)' }}>Live Calendar Sync</h3>
                                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                        Subscribe once, and your phone calendar will auto-update with the AI's plan.
                                    </p>
                                </div>
                            </div>
                            <Button variant="primary" size="sm" onClick={() => {
                                const link = routineService.getCalendarSyncLink(user.id);
                                navigator.clipboard.writeText(link);
                                alert('Sync Link Copied! \n\nPaste this into Google Calendar -> "Add by URL" to sync Zenith with your phone.');
                            }}>Copy Sync Link</Button>
                        </div>
                    </Card>

                    {loading ? (
                        <div className="flex justify-center p-2xl"><LoadingSpinner size="lg" /></div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                            {days.map(day => {
                                const dayNum = daysMap[day];
                                const dayRoutines = routines.filter(r => r.days_of_week.includes(dayNum))
                                    .sort((a,b) => a.start_time.localeCompare(b.start_time));

                                return (
                                    <Card key={day} style={{ display: 'flex', flexDirection: 'column', minHeight: '150px' }}>
                                        <div className="flex justify-between items-center mb-md">
                                            <h3 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 800 }}>{day}</h3>
                                            <Badge variant={dayRoutines.length > 0 ? 'primary' : 'secondary'} size="xs">{dayRoutines.length}</Badge>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {dayRoutines.map((r, i) => (
                                                <div key={i} style={{ 
                                                    padding: '8px', 
                                                    background: 'var(--bg)', 
                                                    borderRadius: '8px',
                                                    borderLeft: '3px solid var(--primary-500)',
                                                    fontSize: '11px'
                                                }}>
                                                    <div style={{ color: 'var(--primary-500)', fontWeight: 700, marginBottom: '2px' }}>
                                                        {format12h(r.start_time)}
                                                    </div>
                                                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                                                </div>
                                            ))}
                                            {dayRoutines.length === 0 && (
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '10px', fontStyle: 'italic', height: '60px' }}>
                                                    Free Day
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Timetable;
