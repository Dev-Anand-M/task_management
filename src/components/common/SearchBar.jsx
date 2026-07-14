import { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, Clock, FileText, HelpCircle, Users, Trophy } from 'lucide-react';
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
        { icon: FileText, label: 'Tasks', path: isAdmin ? '/admin/tasks' : '/tasks', type: 'page' },
        { icon: HelpCircle, label: 'Quizzes', path: isAdmin ? '/admin/quizzes' : '/quizzes', type: 'page' },
        { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', type: 'page' },
        { icon: Users, label: 'Team', path: '/admin/team', type: 'page', adminOnly: true },
    ];

    // Search suggestions based on common actions
    const searchSuggestions = [
        { label: 'View tasks', path: isAdmin ? '/admin/tasks' : '/tasks', keywords: ['task', 'assignment', 'work', 'todo'] },
        { label: 'Take/View quizzes', path: isAdmin ? '/admin/quizzes' : '/quizzes', keywords: ['quiz', 'test', 'exam', 'questions'] },
        { label: 'Check leaderboard', path: '/leaderboard', keywords: ['leaderboard', 'rank', 'score', 'top', 'players'] },
        { label: 'My profile', path: '/profile', keywords: ['profile', 'me', 'account', 'user'] },
        { label: 'Settings', path: '/settings', keywords: ['settings', 'preferences', 'config', 'theme', 'api'] },
        { label: 'Dashboard', path: isAdmin ? '/admin' : '/dashboard', keywords: ['dashboard', 'home', 'overview', 'main'] },
        { label: 'Notifications', path: '/notifications', keywords: ['notifications', 'alerts', 'updates', 'messages'] },
        { label: 'AI Assistant', path: '/ai/assistant', keywords: ['ai', 'assistant', 'help', 'chat', 'bot'] },
        { label: 'Code Review', path: '/ai/code-review', keywords: ['code', 'review', 'feedback', 'audit'] },
        { label: 'Study Tools', path: '/ai/study-tools', keywords: ['study', 'learn', 'flashcard', 'summary'] },
        { label: 'Quiz Generator', path: '/ai/quiz-generator', keywords: ['generator', 'create', 'ai quiz', 'build'] },
        { label: 'ZEN AI', path: '/ai/zen', keywords: ['zen', 'assistant', 'sentient', 'admin', 'execute', 'run'] },
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

        setFilteredResults(results.slice(0, 5)); // Limit to 5 results
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

    const handleSelect = (path) => {
        navigate(path);
        setIsFocused(false);
        onChange({ target: { value: '' } });
        if (onClear) onClear();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && filteredResults.length > 0) {
            handleSelect(filteredResults[0].path);
        }
    };

    const showDropdown = isFocused && showRecommendations && (filteredResults.length > 0 || value === '');

    return (
        <div ref={searchRef} className={`relative group flex items-center ${className}`}>
            <input
                type="text"
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
                        minWidth: '300px'
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
                                Search Results
                            </div>
                            {filteredResults.map((result, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSelect(result.path)}
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
                                        textAlign: 'left',
                                        transition: 'all 0.2s'
                                    }}
                                    className="hover:bg-primary-500/10"
                                >
                                    <Search size={16} style={{ color: 'var(--primary-500)', opacity: 0.7 }} />
                                    <span>{result.label}</span>
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
                                        onClick={() => handleSelect(rec.path)}
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
                                            textAlign: 'left',
                                            transition: 'all 0.2s'
                                        }}
                                        className="hover:bg-primary-500/10"
                                    >
                                        <rec.icon size={16} style={{ color: 'var(--primary-500)', opacity: 0.7 }} />
                                        <span>{rec.label}</span>
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
