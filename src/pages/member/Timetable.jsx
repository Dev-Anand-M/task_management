import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { routineService } from '../../services/routineService';
import { Card, Badge, Button, Input, LoadingSpinner } from '../../components/common';
import { 
    Calendar, Sparkles, Send, Download, 
    ChevronLeft, ChevronRight, Clock, Trash2,
    CheckCircle, Brain
} from 'lucide-react';

const Timetable = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [timetable, setTimetable] = useState(null);
    const [userInput, setUserInput] = useState('');
    const [weekStart, setWeekStart] = useState(() => {
        const d = new Date();
        const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        return new Date(d.setDate(diff)).toISOString().split('T')[0];
    });

    useEffect(() => {
        fetchTimetable();
    }, [weekStart, user?.id]);

    const fetchTimetable = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const data = await routineService.getTimetable(weekStart);
            setTimetable(data?.schedule_data || null);
        } catch (err) {
            console.error('Failed to fetch timetable:', err);
        } finally {
            setLoading(false);
        }
    };

    const generateTimetable = async () => {
        if (!userInput.trim()) return;
        setGenerating(true);
        try {
            const { getAPIKey, getSelectedModel } = await import('../../services/aiService');
            const modelId = getSelectedModel();
            const apiKey = getAPIKey('sambanova'); // Defaulting to sambanova for speed

            const systemPrompt = `You are an AI Scheduling Architect. Create a detailed weekly timetable (Mon-Sun) based on user goals. 
            Output ONLY a JSON object in this format:
            {
              "title": "Weekly Success Plan",
              "days": {
                "Monday": [{ "time": "08:00", "task": "DSA Study", "duration": "2h" }, ...],
                ...
              }
            }
            Include morning routines, study blocks, breaks, and exercise.`;

            const res = await fetch('/api/ai-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: 'sambanova',
                    endpoint: '/v1/chat/completions',
                    apiKey,
                    body: {
                        model: modelId || 'Meta-Llama-3.1-70B-Instruct',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userInput }
                        ],
                        response_format: { type: "json_object" }
                    }
                })
            });

            const json = await res.json();
            const schedule = JSON.parse(json.choices[0].message.content);
            
            await routineService.saveTimetable(weekStart, schedule);
            setTimetable(schedule);
            setUserInput('');
        } catch (err) {
            console.error('Generation failed:', err);
            alert('Failed to generate timetable. Check your API key.');
        } finally {
            setGenerating(false);
        }
    };

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return (
        <div className="page-content animate-fade-in">
            <div className="flex flex-mobile-col justify-between items-center mb-xl">
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Calendar className="text-primary-500" /> AI Timetable
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Smart scheduling for your week</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <Button variant="ghost" icon={ChevronLeft} onClick={() => {
                        const d = new Date(weekStart); d.setDate(d.getDate() - 7);
                        setWeekStart(d.toISOString().split('T')[0]);
                    }} />
                    <Card style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', fontWeight: 700 }}>
                        Week of {new Date(weekStart).toLocaleDateString()}
                    </Card>
                    <Button variant="ghost" icon={ChevronRight} onClick={() => {
                        const d = new Date(weekStart); d.setDate(d.getDate() + 7);
                        setWeekStart(d.toISOString().split('T')[0]);
                    }} />
                </div>
            </div>

            {!timetable && !generating ? (
                <Card style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                    <Sparkles size={48} style={{ color: 'var(--primary-500)', marginBottom: 'var(--space-lg)' }} />
                    <h2>No Weekly Plan Yet</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-xl)', maxWidth: '500px', margin: '0 auto var(--space-xl)' }}>
                        Tell the AI how you want your week to look, and it will architect a professional timetable for you.
                    </p>
                    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <textarea 
                            value={userInput}
                            onChange={e => setUserInput(e.target.value)}
                            placeholder="Example: I want to study DSA every morning at 8am for 2 hours, have a lunch break at 1pm, and do coding projects in the evening. I also need 1 hour of gym 3 times a week."
                            style={{ 
                                width: '100%', 
                                height: '120px', 
                                padding: '16px', 
                                borderRadius: 'var(--radius-lg)', 
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text)',
                                fontSize: 'var(--text-sm)',
                                marginBottom: 'var(--space-md)',
                                resize: 'none'
                            }}
                        />
                        <Button 
                            variant="primary" 
                            icon={Brain} 
                            onClick={generateTimetable} 
                            disabled={!userInput.trim()}
                            style={{ width: '100%', height: '48px' }}
                        >
                            Generate My Week
                        </Button>
                    </div>
                </Card>
            ) : generating ? (
                <Card style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                    <div className="flex flex-col items-center gap-md">
                        <LoadingSpinner size="lg" />
                        <h3>Architecting your schedule...</h3>
                        <p style={{ color: 'var(--text-muted)' }}>The AI is analyzing your goals and optimizing your time.</p>
                    </div>
                </Card>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
                    {days.map(day => (
                        <Card key={day} style={{ display: 'flex', flexDirection: 'column' }}>
                            <div className="flex justify-between items-center mb-md">
                                <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 800 }}>{day}</h3>
                                <Badge variant="secondary">{timetable.days[day]?.length || 0} tasks</Badge>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                {timetable.days[day]?.map((item, i) => (
                                    <div key={i} style={{ 
                                        padding: 'var(--space-sm)', 
                                        background: 'var(--bg)', 
                                        borderRadius: 'var(--radius-md)',
                                        borderLeft: '4px solid var(--primary-500)',
                                        display: 'flex',
                                        gap: 'var(--space-sm)'
                                    }}>
                                        <div style={{ color: 'var(--primary-500)', fontWeight: 700, fontSize: 'var(--text-xs)', width: '45px' }}>
                                            {item.time}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)' }}>{item.task}</p>
                                            <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Duration: {item.duration}</p>
                                        </div>
                                    </div>
                                ))}
                                {(!timetable.days[day] || timetable.days[day].length === 0) && (
                                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textAlign: 'center' }}>No tasks scheduled</p>
                                )}
                            </div>
                        </Card>
                    ))}
                    <Card style={{ gridColumn: '1 / -1', background: 'var(--surface-light)', border: '1px dashed var(--primary-500)' }}>
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 style={{ margin: 0 }}>Reset Week?</h3>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>You can regenerate your plan anytime.</p>
                            </div>
                            <Button variant="secondary" onClick={() => setTimetable(null)}>Regenerate Plan</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default Timetable;
