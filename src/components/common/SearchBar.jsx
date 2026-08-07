import { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, Clock, FileText, HelpCircle, Users, Trophy, Sparkles, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SearchBar = ({
    value,
    onChange,
    placeholder = "Search...",
    className = "",
    expandable = false,
    onClear,
    showRecommendations = true,
    isAdmin = false
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [recommendations, setRecommendations] = useState([]);
    const [filteredResults, setFilteredResults] = useState([]);
    const searchRef = useRef(null);
    const navigate = useNavigate();

    // Default recommendations when search is empty
    const defaultRecommendations = [
        { icon: Sparkles, label: "🎲 I'm Feeling Lucky!", action: 'lucky' },
        { icon: RefreshCw, label: "🌀 Do a barrel roll!", action: 'barrel_roll' },
        { icon: FileText, label: 'Tasks', path: isAdmin ? '/admin/tasks' : '/tasks', type: 'page' },
        { icon: HelpCircle, label: 'Quizzes', path: isAdmin ? '/admin/quizzes' : '/quizzes', type: 'page' },
        { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', type: 'page' },
        { icon: Users, label: 'Team', path: '/admin/team', type: 'page', adminOnly: true },
    ];

    // Search suggestions covering all sections, tools, features & pages across Zenith
    const searchSuggestions = [
        { label: '🌀 Do a barrel roll!', action: 'barrel_roll', keywords: ['barrel roll', 'do a barrel roll', 'spin', 'rotate', 'easter egg', 'trick', 'roll'] },
        { label: '🎲 I\'m Feeling Lucky!', action: 'lucky', keywords: ['feeling lucky', 'i feel lucky', 'lucky', 'random', 'surprise', 'pick for me'] },
        { label: 'Dashboard Overview', path: isAdmin ? '/admin' : '/dashboard', keywords: ['dashboard', 'home', 'overview', 'main', 'stats', 'analytics'] },
        { label: 'Messages & Chat (v2.0)', path: '/chat', keywords: ['messages', 'chat', 'direct message', 'classroom chat', 'conversation', 'v2', 'inbox'] },
        { label: 'Tasks & Assignments', path: isAdmin ? '/admin/tasks' : '/tasks', keywords: ['task', 'tasks', 'assignment', 'work', 'todo', 'deadline', 'projects'] },
        { label: 'Quizzes & Practice', path: isAdmin ? '/admin/quizzes' : '/quizzes', keywords: ['quiz', 'quizzes', 'test', 'exam', 'questions', 'practice', 'mcq'] },
        { label: 'Sprint Tracker (Live Evaluation)', path: '/sprint-tracker', keywords: ['sprint', 'tracker', 'milestones', 'evaluation', 'kickoff', 'sprint week', 'submissions'] },
        { label: 'Sprint Vault', path: '/sprint-vault', keywords: ['sprint vault', 'vault', 'sprint docs', 'code project', 'zip upload', 'templates', 'briefings'] },
        { label: 'Leaderboard & Rankings', path: '/leaderboard', keywords: ['leaderboard', 'rank', 'score', 'top', 'players', 'xp', 'level', 'gamification'] },
        { label: 'Team Members & Roster', path: isAdmin ? '/admin/team' : '/team', keywords: ['team', 'members', 'students', 'classmates', 'roster', 'directory'] },
        { label: 'Activity Calendar & Milestones', path: '/calendar', keywords: ['calendar', 'events', 'schedule', 'milestones', 'kickoff', 'deadlines', 'dates'] },
        { label: 'AI Timetable Architect', path: '/timetable', keywords: ['timetable', 'ai timetable', 'schedule architect', 'routine planner', 'weekly schedule', 'ical'] },
        { label: 'Consistency Diary & History', path: '/diary', keywords: ['diary', 'routine logs', 'history', 'streak', 'habits', 'progress'] },
        { label: 'Routines & Habit Tracker', path: '/routines', keywords: ['routines', 'habits', 'recurring tasks', 'alarms', 'routine manager'] },
        { label: 'Study Lab & AI Assistant', path: '/study-lab', keywords: ['study lab', 'ai assistant', 'chat bot', 'query solver', 'ai tutor', 'help'] },
        { label: 'AI Code Review', path: '/ai/code-review', keywords: ['code review', 'ai code', 'audit', 'syntax', 'feedback', 'debug'] },
        { label: 'AI Study Tools & Flashcards', path: '/ai/study-tools', keywords: ['study tools', 'flashcards', 'summarizer', 'ai summary', 'notes generator'] },
        { label: 'AI Quiz Generator', path: '/ai/quiz-generator', keywords: ['quiz generator', 'create quiz', 'ai quiz', 'test generator', 'build quiz'] },
        { label: 'Repository (Shared Resources & Notes)', path: '/repository', keywords: ['repository', 'study materials', 'docs', 'notes', 'pdfs', 'resources', 'files', 'shared materials'] },
        { label: 'Notifications & Alerts', path: '/notifications', keywords: ['notifications', 'alerts', 'announcements', 'updates', 'messages'] },
        { label: 'My Profile & Account', path: '/profile', keywords: ['profile', 'account', 'me', 'avatar', 'user info'] },
        { label: 'Settings & Customization', path: '/settings', keywords: ['settings', 'preferences', 'theme', 'dark mode', 'light mode', 'config', 'api key'] }
    ];

    // Filter results based on search query
    useEffect(() => {
        if (!value || value.trim() === '') {
            setFilteredResults([]);
            return;
        }

        const query = value.toLowerCase().trim();
        const results = searchSuggestions.filter(suggestion => {
            return suggestion.label.toLowerCase().includes(query) ||
                   suggestion.keywords.some(keyword => keyword.includes(query));
        });

        setFilteredResults(results.slice(0, 8)); // Limit to 8 results
    }, [value]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsFocused(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (item) => {
        setIsFocused(false);
        onChange({ target: { value: '' } });
        if (onClear) onClear();

        if (typeof item === 'string') {
            navigate(item);
            return;
        }

        if (item?.action === 'barrel_roll') {
            // Trigger 360-degree screen roll!
            const rootEl = document.getElementById('root') || document.body;
            rootEl.style.transition = 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
            rootEl.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                rootEl.style.transition = 'none';
                rootEl.style.transform = 'none';
            }, 1250);
            return;
        }

        if (item?.action === 'lucky') {
            // Pick a random surprise page!
            const realPages = searchSuggestions.filter(s => s.path);
            const randomPage = realPages[Math.floor(Math.random() * realPages.length)];
            if (randomPage?.path) {
                navigate(randomPage.path);
            }
            return;
        }

        if (item?.path) {
            navigate(item.path);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && filteredResults.length > 0) {
            handleSelect(filteredResults[0]);
        }
    };

    const showDropdown = isFocused && showRecommendations && (filteredResults.length > 0 || value === '');

    return (
        <div ref={searchRef} className={`relative group flex items-center ${className}`}>
            <input
                type="search"
                name="zenith_quick_search_no_autofill"
                id="zenith_quick_search_input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                placeholder={placeholder}
                className={`
                    w-full pl-11 pr-10 py-2.5 
                    bg-surface/40 hover:bg-surface/60 focus:bg-surface/80
                    border border-border/40 focus:border-primary-500/50 
                    rounded-2xl text-sm text-text
                    outline-none transition-all duration-300
                    focus:ring-4 focus:ring-primary-500/10
                    placeholder:text-muted/40
                    backdrop-blur-md
                    ${expandable ? 'md:w-64 focus:md:w-80' : ''}
                `}
                value={value}
                onChange={onChange}
                onFocus={() => setIsFocused(true)}
                onKeyDown={handleKeyDown}
            />
            <Search
                size={18}
                style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    opacity: 0.5,
                    pointerEvents: 'none',
                    transition: 'all 0.3s',
                    zIndex: 1
                }}
                className="group-focus-within:text-primary-500"
            />

            {value && (
                <button
                    type="button"
                    onClick={() => {
                        onChange({ target: { value: '' } });
                        if (onClear) onClear();
                    }}
                    className="absolute right-3 p-1 rounded-full hover:bg-muted/10 text-muted/60 hover:text-text transition-all"
                >
                    <X size={14} />
                </button>
            )}

            {/* Dropdown with recommendations/results */}
            {showDropdown && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        right: 0,
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: 'var(--shadow-xl)',
                        zIndex: 1000,
                        overflow: 'hidden',
                        animation: 'slideInUp 0.2s ease-out',
                        minWidth: '320px'
                    }}
                >
                    {/* Show filtered results if searching */}
                    {value && filteredResults.length > 0 ? (
                        <div style={{ padding: 'var(--space-xs)' }}>
                            <div style={{
                                padding: 'var(--space-xs) var(--space-md)',
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-muted)',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                Search Results ({filteredResults.length})
                            </div>
                            {filteredResults.map((result, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSelect(result)}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--space-sm) var(--space-md)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-sm)',
                                        border: 'none',
                                        background: 'none',
                                        color: 'var(--text)',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        fontSize: 'var(--text-sm)',
                                        textAlign: 'left'
                                    }}
                                    className="dropdown-hover-item"
                                >
                                    <Search size={16} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                                    <span style={{ fontWeight: 600 }}>{result.label}</span>
                                </button>
                            ))}
                        </div>
                    ) : value && filteredResults.length === 0 ? (
                        <div style={{
                            padding: 'var(--space-lg)',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: 'var(--text-sm)'
                        }}>
                            No results found for "{value}"
                        </div>
                    ) : (
                        /* Show default recommendations when not searching */
                        <div style={{ padding: 'var(--space-xs)' }}>
                            <div style={{
                                padding: 'var(--space-xs) var(--space-md)',
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-muted)',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-xs)'
                            }}>
                                <TrendingUp size={12} />
                                Quick Access
                            </div>
                            {defaultRecommendations
                                .filter(rec => !rec.adminOnly || isAdmin)
                                .map((rec, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleSelect(rec)}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--space-sm) var(--space-md)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-sm)',
                                            border: 'none',
                                            background: 'none',
                                            color: 'var(--text)',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            fontSize: 'var(--text-sm)',
                                            textAlign: 'left'
                                        }}
                                        className="dropdown-hover-item"
                                    >
                                        <rec.icon size={16} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                                        <span style={{ fontWeight: 600 }}>{rec.label}</span>
                                    </button>
                                ))}
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes slideInUp {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
};

export default SearchBar;
