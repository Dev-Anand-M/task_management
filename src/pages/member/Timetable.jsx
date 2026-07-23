import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { routineService } from '../../services/routineService';
import { manageRoutinesChat } from '../../services/aiService';
import { supabase } from '../../lib/supabase';
import { Card, Badge, Button, Input, LoadingSpinner } from '../../components/common';
import { 
    Calendar, Sparkles, Send, Clock, 
    MessageSquare, Brain, RefreshCw, ChevronLeft, ChevronRight,
    User, Bot, CheckCircle, AlertTriangle, Zap
} from 'lucide-react';
import { format12h, getLocalDatePickerDate } from '../../utils/timeFormat';
import { shareOrDownloadFile } from '../../utils/fileExporter';

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
                routineService.getLogsForDate(getLocalDatePickerDate())
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

            // Robust Split: Find metadata marker anywhere or try to extract JSON
            let text = response;
            let metadataStr = '';
            
            if (response.includes('---METADATA---')) {
                const parts = response.split('---METADATA---');
                text = parts[0];
                metadataStr = parts[1];
            } else if (response.includes('{"routines":') || response.includes('[{"day":') || response.includes('[ { "day":')) {
                const match = response.match(/(\{|\[)[\s\S]*(\}|\])/);
                if (match) {
                    const jsonStart = response.indexOf(match[0]);
                    text = response.substring(0, jsonStart);
                    metadataStr = match[0];
                }
            }
            
            if (metadataStr) {
                try {
                    // Clean metadata string from markdown blocks
                    let cleanedMetadata = metadataStr.trim();
                    if (cleanedMetadata.startsWith('```')) {
                        const lines = cleanedMetadata.split('\n');
                        if (lines[0].startsWith('```')) lines.shift();
                        if (lines[lines.length - 1].startsWith('```')) lines.pop();
                        cleanedMetadata = lines.join('\n').trim();
                    }

                    const metadata = JSON.parse(cleanedMetadata);
                    
                    // 1. Sync Timetable (Routines)
                    const routinesList = metadata.routines || (Array.isArray(metadata) ? metadata : null);
                    if (routinesList) {
                        await routineService.replaceAllRoutines(routinesList);
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
                    console.error("Raw metadata string was:", metadataStr);
                }
            }

            let displayText = text.replace(/```json[\s\S]*?```/gi, '').replace(/[\{\[\"]+day[\s\S]*/gi, '').trim();
            if (!displayText) {
                displayText = "I've processed your request and updated your AI Timetable schedule!";
            }

            setMessages(prev => [...prev, { role: 'assistant', content: displayText }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error while updating your schedule. " + err.message }]);
        } finally {
            setSending(false);
        }
    };

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const daysMap = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7 };

    return (
        <div className="stagger-in" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 'var(--space-md)', 
            paddingBottom: 'var(--space-2xl)', 
            paddingTop: isMobile ? 'var(--space-sm)' : 0,
            minHeight: 0 
        }}>
            {/* Page Header */}
            <div className="flex flex-mobile-col justify-between items-start gap-md mb-md" style={{ flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: isMobile ? 'var(--text-xl)' : 'var(--text-3xl)', fontWeight: 800 }}>
                        <Brain className="text-primary-500" /> {isMobile ? 'AI Schedule Architect' : 'AI Scheduling Architect'}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 'var(--text-xs)', fontWeight: 600 }}>Natural language routine & timetable management</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button variant="ghost" size="sm" icon={Calendar} onClick={() => {
                        const icsContent = routineService.generateICS(routines);
                        shareOrDownloadFile(icsContent, 'zenith_routines.ics', 'text/calendar;charset=utf-8');
                    }}>Export .ICS</Button>
                    <Badge variant="primary" icon={RefreshCw} size="sm">Live Sync</Badge>
                </div>
            </div>

            <div style={{ 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row', 
                gap: 'var(--space-md)', 
                flex: 1, 
                minHeight: 0
            }}>
                {/* Chat Column */}
                <Card style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    padding: 0, 
                    overflow: 'hidden', 
                    border: '1px solid var(--border)',
                    width: isMobile ? '100%' : '340px',
                    height: isMobile ? '380px' : 'auto',
                    minHeight: isMobile ? '350px' : '500px',
                    flexShrink: 0,
                    boxShadow: 'var(--shadow-md)',
                    borderRadius: 'var(--radius-xl)'
                }}>
                    <div style={{ padding: 'var(--space-sm) var(--space-md)', borderBottom: '1px solid var(--border)', background: 'rgba(99, 102, 241, 0.05)' }}>
                        <h3 style={{ margin: 0, fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-500)', fontWeight: 800 }}>
                            <Sparkles size={14} /> AI TIMETABLE ASSISTANT
                        </h3>
                    </div>
                    
                    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{ 
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '90%',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                            }}>
                                <div style={{ 
                                    padding: '8px 12px', 
                                    borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                                    background: msg.role === 'user' ? 'var(--primary-600)' : 'var(--surface)',
                                    color: msg.role === 'user' ? 'white' : 'var(--text)',
                                    fontSize: 'var(--text-xs)',
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
                            <div style={{ alignSelf: 'flex-start', padding: '8px 12px', background: 'var(--surface)', borderRadius: '14px 14px 14px 2px', border: '1px solid var(--border)' }}>
                                <LoadingSpinner size="sm" />
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleSendMessage} style={{ padding: 'var(--space-sm)', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                        <div className="flex gap-xs">
                            <Input 
                                placeholder="e.g. Add 2h study every Mon" 
                                value={userInput} 
                                onChange={e => setUserInput(e.target.value)}
                                disabled={sending}
                                style={{ margin: 0, borderRadius: 'var(--radius-full)', fontSize: 'var(--text-xs)' }}
                            />
                            <Button variant="primary" type="submit" disabled={sending || !userInput.trim()} style={{ borderRadius: 'var(--radius-full)', width: '38px', height: '38px', padding: 0, flexShrink: 0 }}>
                                <Send size={16} />
                            </Button>
                        </div>
                    </form>
                </Card>

                {/* Timetable View */}
                <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
                    <Card style={{ marginBottom: 'var(--space-md)', background: 'linear-gradient(135deg, var(--surface) 0%, var(--bg) 100%)', border: '1px solid var(--primary-500)', padding: 'var(--space-md)' }}>
                        <div className="flex justify-between items-center gap-sm flex-wrap">
                            <div className="flex items-center gap-sm" style={{ flex: 1, minWidth: '200px' }}>
                                <RefreshCw size={20} className="text-primary-500 animate-spin-slow" style={{ flexShrink: 0 }} />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 'var(--text-xs)', fontWeight: 800 }}>Live Calendar Sync</h3>
                                    <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>
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
                        <div className="flex justify-center p-xl"><LoadingSpinner size="lg" /></div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-md)' }}>
                            {days.map(day => {
                                const dayNum = daysMap[day];
                                const dayRoutines = routines.filter(r => r.days_of_week.includes(dayNum))
                                    .sort((a,b) => a.start_time.localeCompare(b.start_time));

                                return (
                                    <Card key={day} style={{ display: 'flex', flexDirection: 'column', minHeight: '140px', padding: 'var(--space-sm)' }}>
                                        <div className="flex justify-between items-center mb-sm">
                                            <h3 style={{ margin: 0, fontSize: 'var(--text-xs)', fontWeight: 800 }}>{day}</h3>
                                            <Badge variant={dayRoutines.length > 0 ? 'primary' : 'secondary'} size="xs">{dayRoutines.length}</Badge>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {dayRoutines.map((r, i) => (
                                                <div key={i} style={{ 
                                                    padding: '6px 8px', 
                                                    background: 'var(--bg)', 
                                                    borderRadius: '6px',
                                                    borderLeft: '3px solid var(--primary-500)',
                                                    fontSize: '10px'
                                                }}>
                                                    <div style={{ color: 'var(--primary-500)', fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {r.is_anonymous ? <Zap size={10} fill="currentColor" /> : <Clock size={10} />}
                                                        {r.is_anonymous ? 'Flexible' : format12h(r.start_time)}
                                                    </div>
                                                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                                                </div>
                                            ))}
                                            {dayRoutines.length === 0 && (
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '10px', fontStyle: 'italic', height: '40px' }}>
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
