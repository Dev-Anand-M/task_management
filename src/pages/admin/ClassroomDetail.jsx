import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    Card,
    Button,
    Badge,
    Avatar,
    ProgressBar,
    Modal,
    LoadingSpinner,
    SearchBar,
    Input
} from '../../components/common';
import {
    School,
    Users,
    BookOpen,
    Trophy,
    Search,
    Filter,
    ArrowLeft,
    CheckCircle,
    XCircle,
    Clock,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    FileText,
    TrendingUp,
    Target,
    Key,
    MessageSquare,
    MoreVertical,
    Share2,
    Calendar,
    Settings,
    Plus,
    Layout,
    ArrowRight
} from 'lucide-react';
import * as db from '../../services/database';
import { getStatusColor, calculateLevel } from '../../utils/constants';
import { useMiniReload } from '../../hooks/useMiniReload';

const ClassroomDetail = () => {
    const { user } = useAuth();
    const { id: classroomId } = useParams();
    const [classroom, setClassroom] = useState(null);
    const [members, setMembers] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('stream'); // stream, classwork, people, analytics
    const [searchQuery, setSearchQuery] = useState('');
    const [announcementText, setAnnouncementText] = useState('');
    const [postingAnnouncement, setPostingAnnouncement] = useState(false);

    // Selected Student for detailed view
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [error, setError] = useState(null);
    const [removingMemberId, setRemovingMemberId] = useState(null);

    const loadData = async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setError(null);
        
        // Safety timeout to prevent infinite loading
        const safetyTimeout = setTimeout(() => {
            setLoading(false);
        }, 10000);

        try {
            const cls = await db.getClassroomById(classroomId);
            if (!cls) {
                setClassroom(null);
                setLoading(false);
                clearTimeout(safetyTimeout);
                return;
            }

            // Fetch related data
            const results = await Promise.allSettled([
                db.getMembersByClassroom(classroomId),
                db.getTasksByClassroom(classroomId),
                db.getSubmissionsByClassroom(classroomId),
                db.getClassroomStats(classroomId),
                db.getAnnouncementsByClassroom ? db.getAnnouncementsByClassroom(classroomId) : Promise.resolve([])
            ]);

            setClassroom(cls);
            
            // Map results safely
            if (results[0].status === 'fulfilled') setMembers(results[0].value || []);
            if (results[1].status === 'fulfilled') setTasks(results[1].value || []);
            if (results[2].status === 'fulfilled') setSubmissions(results[2].value || []);
            if (results[3].status === 'fulfilled') setStats(results[3].value || null);
            if (results[4].status === 'fulfilled') setAnnouncements(results[4].value || []);

            clearTimeout(safetyTimeout);
        } catch (error) {
            console.error('Error loading classroom detail:', error);
            setError('Failed to load classroom details');
            clearTimeout(safetyTimeout);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = async (member) => {
        const confirmMessage = `Are you sure you want to remove ${member.name} from this classroom?\n\nThis will permanently delete all of their task submissions, quiz attempts, and notifications for this classroom, and reset their classroom progress. This action cannot be undone.`;
        if (!window.confirm(confirmMessage)) return;

        try {
            setRemovingMemberId(member.id);
            await db.removeMemberFromClassroom(classroomId, member.id);
            alert(`${member.name} has been successfully removed from the classroom.`);
            await loadData(true);
        } catch (error) {
            console.error('Error removing member:', error);
            alert(`Failed to remove member: ${error.message || error}`);
        } finally {
            setRemovingMemberId(null);
        }
    };

    useEffect(() => {
        loadData();
    }, [classroomId]);

    // MINI RELOAD: Listen for global refresh events
    useMiniReload(() => loadData(true));

    const handlePostAnnouncement = async () => {
        if (!announcementText.trim()) return;
        try {
            setPostingAnnouncement(true);
            const newAnn = await db.createAnnouncement({
                classroom_id: classroomId,
                content: announcementText
            });
            setAnnouncements([newAnn, ...announcements]);
            setAnnouncementText('');
            
            // --- SEND NOTIFICATIONS TO ALL CLASSROOM MEMBERS ---
            try {
                const classroomMembers = members.filter(m => 
                    m.classroom_id === classroomId && m.role === 'member'
                );
                
                const notifyPromises = classroomMembers.map(async (member) => {
                    // 1. Create in-app notification
                    await db.createNotification({
                        user_id: member.id,
                        classroom_id: classroomId,
                        title: '📢 New Announcement',
                        message: announcementText.substring(0, 100) + (announcementText.length > 100 ? '...' : ''),
                        type: 'announcement',
                        link: `/classroom/${classroomId}`
                    });
                });
                
                await Promise.allSettled(notifyPromises);
            } catch (notifyError) {
                console.error('Failed to send announcement notifications:', notifyError);
            }
            // -------------------------------
        } catch (error) {
            console.error('Error posting announcement:', error);
        } finally {
            setPostingAnnouncement(false);
        }
    };

    const streamItems = useMemo(() => {
        const items = [
            ...announcements.map(a => ({ ...a, streamType: 'announcement' })),
            ...tasks.map(t => ({ ...t, streamType: 'task' }))
        ];
        return items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, [announcements, tasks]);

    const handleExportPerformance = () => {
        try {
            // Define CSV Headers
            const headers = ['Student Name', 'Email', 'XP Points', 'Current Level', 'Tasks Attempted', 'Tasks Approved', 'Completion %'];
            
            // Map member data to CSV rows
            const rows = members.filter(m => m.role === 'member').map(member => {
                const s = getStudentStats(member.id);
                return [
                    `"${member.name}"`,
                    `"${member.email}"`,
                    member.xp || 0,
                    calculateLevel(member.xp || 0),
                    s.totalSubmissions,
                    s.completedTasks,
                    `${s.completionRate}%`
                ];
            });

            // Combine into CSV string
            const csvContent = [
                headers.join(','),
                ...rows.map(r => r.join(','))
            ].join('\n');

            // Create download link
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `${classroom.name.replace(/\s+/g, '_')}_Performance_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Failed to export data. Check console for details.');
        }
    };

    const filteredMembers = useMemo(() => {
        return members.filter(m =>
            m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [members, searchQuery]);

    const getStudentStats = (studentId) => {
        const studentSubs = submissions.filter(s => s.user_id === studentId);
        const approved = studentSubs.filter(s => s.status === 'approved');
        return {
            totalSubmissions: studentSubs.length,
            completedTasks: approved.length,
            completionRate: tasks.length > 0 ? Math.round((approved.length / tasks.length) * 100) : 0,
        };
    };

    if (loading) return <div className="p-xl flex justify-center h-full items-center"><LoadingSpinner size="lg" /></div>;
    if (!classroom) return <div className="p-xl text-center"><h2>Classroom not found</h2><Link to="/admin/classroom">Back</Link></div>;

    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-sm px-lg py-md border-b-2 transition-all font-bold text-sm ${activeTab === id
                    ? 'border-primary-500 text-primary-500'
                    : 'border-transparent text-muted hover:text-text hover:bg-surface/50'
                }`}
        >
            <Icon size={18} />
            {label}
        </button>
    );

    return (
        <div className="animate-fade-in max-w-6xl mx-auto pb-2xl">
            {/* Header / Banner Area */}
            <div className="relative mb-xl rounded-2xl overflow-hidden shadow-2xl group">
                <div className="h-41 w-full bg-surface-muted overflow-hidden relative">
                    <img
                        src="/assets/classroom_banner_tech_1769972210049.png"
                        alt="Classroom Banner"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80"
                        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=2070&auto=format&fit=crop'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </div>

                <div className="absolute bottom-0 left-0 p-xl flex flex-mobile-col justify-between items-end w-full">
                    <div>
                        <h1 className="text-4xl font-black text-white m-0 tracking-tight drop-shadow-lg">{classroom.name}</h1>
                        <p className="text-white/80 font-medium m-0 mt-xs flex items-center gap-sm">
                            <Badge variant="primary" className="bg-white/20 text-white border-white/10 uppercase tracking-widest text-[10px]">
                                Class Code: {classroom.id.slice(0, 8)}
                            </Badge>
                            <span className="text-white/60">•</span>
                            <span className="text-white/80 text-xs font-bold">{members.filter(m => m.role === 'member').length} Students enrolled</span>
                        </p>
                    </div>
                    <Link to="/admin/classroom">
                        <Button variant="ghost" className="bg-white/10 hover:bg-white/20 text-white border-none" icon={Settings}>Stream Settings</Button>
                    </Link>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex tabs-scrollable border-b border-border bg-card/30 sticky top-0 z-10 backdrop-blur-md rounded-t-xl overflow-hidden shadow-sm">
                <TabButton id="stream" label="Stream" icon={Layout} />
                <TabButton id="classwork" label="Classwork" icon={BookOpen} />
                <TabButton id="people" label="People" icon={Users} />
                <TabButton id="analytics" label="Analytics" icon={TrendingUp} />
            </div>

            {/* TAB CONTENT */}
            <div className="mt-xl">
                {/* --- STREAM TAB --- */}
                {activeTab === 'stream' && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-xl">
                        <div className="lg:col-span-1 hidden lg:flex flex-col gap-lg">
                            <Card className="p-lg">
                                <h4 className="text-sm font-bold m-0 mb-md flex items-center justify-between">
                                    Upcoming
                                    <Calendar size={14} className="text-muted" />
                                </h4>
                                <div className="flex flex-col gap-md">
                                    {tasks.slice(0, 3).map(t => (
                                        <div key={t.id} className="text-xs group cursor-pointer">
                                            <div className="font-bold text-text truncate group-hover:text-primary-500 transition-colors">{t.title}</div>
                                            <div className="text-muted mt-1 uppercase font-bold tracking-tighter">Due {new Date(t.due_date || Date.now()).toLocaleDateString()}</div>
                                        </div>
                                    ))}
                                    {tasks.length === 0 && <p className="text-xs text-muted italic m-0">Woohoo, no work due soon!</p>}
                                    <Button variant="ghost" size="sm" className="w-full mt-sm text-primary-500 font-bold" onClick={() => setActiveTab('classwork')}>View All</Button>
                                </div>
                            </Card>
                        </div>

                        <div className="lg:col-span-3 flex flex-col gap-xl">
                            {/* Announce Something */}
                            <Card className="p-lg flex gap-lg items-start border-primary-500/20 shadow-lg shadow-primary-500/5 bg-gradient-to-br from-surface to-surface-muted">
                                <Avatar name={user?.name || "Admin"} image={user?.avatar_url} size="lg" className="ring-2 ring-primary-500/20" />
                                <div className="flex-1">
                                    <textarea
                                        placeholder="Announce something to your class..."
                                        className="w-full bg-surface/50 border border-border/50 rounded-xl p-md text-sm outline-none focus:ring-2 focus:ring-primary-500/30 transition-all resize-none min-h-[80px]"
                                        value={announcementText}
                                        onChange={(e) => setAnnouncementText(e.target.value)}
                                    />
                                    <div className="flex justify-end gap-sm mt-md">
                                        <Button variant="ghost" size="sm" onClick={() => setAnnouncementText('')}>Cancel</Button>
                                        <Button
                                            size="sm"
                                            disabled={!announcementText || postingAnnouncement}
                                            onClick={handlePostAnnouncement}
                                            loading={postingAnnouncement}
                                        >
                                            Post
                                        </Button>
                                    </div>
                                </div>
                            </Card>

                            {/* Feed Items (Recent Tasks & Announcements) */}
                            <div className="flex flex-col gap-md">
                                {streamItems.map(item => (
                                    <Card key={item.id} className="p-lg group hover:border-primary-500/50 transition-all cursor-pointer">
                                        <div className="flex gap-lg items-start">
                                            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg ${item.streamType === 'task' ? 'bg-primary-500 shadow-primary-500/20' : 'bg-green-500 shadow-green-500/20'
                                                }`}>
                                                {item.streamType === 'task' ? <BookOpen size={20} /> : <MessageSquare size={20} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="m-0 font-bold group-hover:text-primary-500 transition-colors">
                                                            {item.streamType === 'task' ? `Admin posted a new assignment: ${item.title}` : `Admin posted an announcement`}
                                                        </h4>
                                                        <span className="text-[10px] text-muted uppercase font-bold tracking-widest">{new Date(item.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100"><MoreVertical size={16} /></Button>
                                                </div>
                                                <div className="mt-md text-sm text-balance text-muted leading-relaxed">
                                                    {item.streamType === 'task' ? item.description : item.content}
                                                </div>

                                                {item.streamType === 'task' && (
                                                    <div className="mt-lg flex items-center gap-md">
                                                        <div className="px-3 py-1 bg-surface-muted rounded-full border border-border text-[10px] font-bold uppercase text-muted">Assignment</div>
                                                        <div className="h-px bg-border flex-1" />
                                                        <Button variant="ghost" size="sm" className="text-primary-500" icon={ArrowRight}>View Details</Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                                {streamItems.length === 0 && (
                                    <div className="p-2xl text-center flex flex-col items-center gap-md border-2 border-dashed border-border rounded-2xl opacity-50">
                                        <Layout size={40} />
                                        <p className="font-bold">No posts in the stream yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- CLASSWORK TAB --- */}
                {activeTab === 'classwork' && (
                    <div className="max-w-4xl mx-auto flex flex-col gap-xl">
                        <div className="flex flex-mobile-col justify-between items-center mb-md border-b border-border pb-lg">
                            <h2 className="m-0 font-black text-2xl flex items-center gap-md">
                                <BookOpen className="text-primary-500" size={28} />
                                Classwork
                            </h2>
                            <div className="flex gap-md">
                                <Button variant="ghost" icon={Calendar}>View Calendar</Button>
                                <Link to="/admin/tasks">
                                    <Button icon={Plus}>Create Task</Button>
                                </Link>
                            </div>
                        </div>

                        <div className="flex flex-col gap-xl">
                            {/* Grouping by "Topic" or "Module" could go here, for now a clean list */}
                            {tasks.length === 0 ? (
                                <div className="p-2xl text-center flex flex-col items-center gap-lg border-2 border-dashed border-border rounded-2xl">
                                    <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center">
                                        <BookOpen size={40} className="text-muted" />
                                    </div>
                                    <div>
                                        <h3>No material yet</h3>
                                        <p className="text-muted">Assignments can be grouped into modules or categories.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-md">
                                    <h3 className="text-sm font-black text-muted uppercase tracking-widest pl-md">Available Modules</h3>
                                    {tasks.map(task => (
                                        <div key={task.id} className="group">
                                            <div className="flex items-center gap-lg p-lg bg-card/50 border border-border rounded-2xl group-hover:bg-primary-500/5 group-hover:border-primary-500/30 transition-all cursor-pointer shadow-sm">
                                                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-500">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-base tracking-tight">{task.title}</div>
                                                    <div className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">Due {new Date(task.due_date || Date.now()).toLocaleDateString()}</div>
                                                </div>
                                                <Badge variant="secondary" className="group-hover:bg-primary-500 group-hover:text-white transition-all uppercase tracking-tighter font-black">{task.points} XP</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- PEOPLE TAB --- */}
                {activeTab === 'people' && (
                    <div className="max-w-4xl mx-auto flex flex-col gap-2xl">
                        <section>
                            <h2 className="m-0 pb-md mb-xl font-black text-2xl flex items-center justify-between border-b-2 border-primary-500/10">
                                <div className="flex items-center gap-md">
                                    <Users className="text-primary-500" size={28} />
                                    Teachers
                                </div>
                            </h2>
                            <div className="flex items-center gap-lg p-md">
                                <Avatar name={user?.name || "Admin"} image={user?.avatar_url} size="lg" className="ring-2 ring-primary-500" />
                                <span className="font-bold text-lg">{user?.name || "Admin"} (Me)</span>
                            </div>
                        </section>

                        <section>
                            <h2 className="m-0 pb-md mb-xl font-black text-2xl flex flex-mobile-col items-center justify-between border-b-2 border-primary-500/10">
                                <div className="flex items-center gap-md text-primary-500">
                                    Classmates
                                </div>
                                <div className="flex items-center gap-lg">
                                    <span className="text-xs font-black text-muted uppercase tracking-widest mr-4">{members.filter(m => m.role === 'member').length} Students</span>
                                    <SearchBar
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search students..."
                                        className="h-10"
                                        showRecommendations={false}
                                    />
                                </div>
                            </h2>
                            <div className="flex flex-col bg-card/20 rounded-2xl overflow-hidden border border-border/50">
                                {filteredMembers.filter(m => m.role === 'member').map(member => (
                                    <div key={member.id} className="flex items-center justify-between p-lg border-b border-border/50 hover:bg-primary-500/5 transition-all group">
                                        <div className="flex items-center gap-lg">
                                            <Avatar name={member.name} image={member.avatar_url} size="md" className="ring-2 ring-transparent group-hover:ring-primary-500/20" />
                                            <div>
                                                <div className="font-bold">{member.name}</div>
                                                <div className="text-xs text-muted">{member.email}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-xl">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">Level {calculateLevel(member.xp || 0)}</span>
                                                <span className="text-xs font-bold text-muted">{member.xp || 0} XP</span>
                                            </div>
                                            <div className="flex items-center gap-sm">
                                                <Button variant="ghost" size="sm" className="hidden group-hover:flex" icon={TrendingUp} onClick={() => setSelectedStudent(member)}>Stats</Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="hidden group-hover:flex text-red-500 hover:bg-red-500/10 hover:text-red-400"
                                                    icon={XCircle}
                                                    loading={removingMemberId === member.id}
                                                    disabled={removingMemberId !== null}
                                                    onClick={() => handleRemoveMember(member)}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filteredMembers.filter(m => m.role === 'member').length === 0 && (
                                    <div className="p-2xl text-center text-muted italic">No students found in this classroom.</div>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {/* --- ANALYTICS TAB --- */}
                {activeTab === 'analytics' && stats && (
                    <div className="flex flex-col gap-xl">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-md">
                            <Card className="p-xl flex flex-col items-center gap-md border-b-4 border-b-blue-500 bg-gradient-to-br from-blue-500/5 to-transparent">
                                <Users className="text-blue-500" size={32} />
                                <div className="text-center">
                                    <div className="text-3xl font-black">{members.filter(m => m.role === 'member').length}</div>
                                    <div className="text-xs uppercase tracking-widest font-bold text-muted">Enrollments</div>
                                </div>
                            </Card>
                            <Card className="p-xl flex flex-col items-center gap-md border-b-4 border-b-green-500 bg-gradient-to-br from-green-500/5 to-transparent">
                                <CheckCircle className="text-green-500" size={32} />
                                <div className="text-center">
                                    <div className="text-3xl font-black">{Math.round(stats.avgCompletion)}%</div>
                                    <div className="text-xs uppercase tracking-widest font-bold text-muted">Avg Completion</div>
                                </div>
                            </Card>
                            <Card className="p-xl flex flex-col items-center gap-md border-b-4 border-b-yellow-500 bg-gradient-to-br from-yellow-500/5 to-transparent">
                                <Trophy className="text-yellow-500" size={32} />
                                <div className="text-center">
                                    <div className="text-3xl font-black">{stats.earnedPoints.toLocaleString()}</div>
                                    <div className="text-xs uppercase tracking-widest font-bold text-muted">XP Distributed</div>
                                </div>
                            </Card>
                            <Card className="p-xl flex flex-col items-center gap-md border-b-4 border-b-purple-500 bg-gradient-to-br from-purple-500/5 to-transparent">
                                <BookOpen className="text-purple-500" size={32} />
                                <div className="text-center">
                                    <div className="text-3xl font-black">{tasks.length}</div>
                                    <div className="text-xs uppercase tracking-widest font-bold text-muted">Total Tasks</div>
                                </div>
                            </Card>
                        </div>

                        {/* Recent Performance Chart (Visual Simulation) */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
                            <Card className="lg:col-span-2 p-xl overflow-hidden relative">
                                <h3 className="m-0 mb-xl font-black text-xl">Module Completion Distribution</h3>
                                <div className="flex items-end justify-between h-48 gap-px px-md">
                                    {(tasks || []).length > 0 ? tasks.map((t, idx) => {
                                        const studentCount = (members || []).filter(m => m.role === 'member').length || 1;
                                        const approvedSubs = (submissions || []).filter(s => s.task_id === t.id && s.status === 'approved').length;
                                        const rate = Math.round((approvedSubs / studentCount) * 100);
                                        return (
                                            <div key={t.id || idx} className="flex-1 flex flex-col items-center gap-sm group">
                                                <div
                                                    className="w-full bg-primary-500/20 rounded-t-lg group-hover:bg-primary-500 transition-all flex items-end justify-center pb-2 cursor-help"
                                                    style={{ height: `${Math.max(rate, 10)}%` }}
                                                    title={`${t.title || 'Task'}: ${rate}%`}
                                                >
                                                    <span className="text-[10px] font-black text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md">{rate}%</span>
                                                </div>
                                                <div className="w-1.5 h-1.5 rounded-full bg-border" />
                                            </div>
                                        );
                                    }) : (
                                        <div className="w-full h-full flex items-center justify-center text-muted italic text-xs">
                                            No modules to display
                                        </div>
                                    )}
                                </div>
                            </Card>
                            <Card className="p-xl">
                                <h3 className="m-0 mb-xl font-black text-xl">Quick Actions</h3>
                                <div className="flex flex-col gap-sm">
                                    <Link to="/admin/invite-codes">
                                        <Button className="w-full justify-start" icon={Plus}>Add New Student</Button>
                                    </Link>
                                    <Button className="w-full justify-start" variant="secondary" icon={Share2} onClick={handleExportPerformance}>Export Performance</Button>
                                    <Button className="w-full justify-start" variant="ghost" icon={Calendar} onClick={() => setActiveTab('stream')}>Quarterly Review</Button>
                                </div>
                            </Card>
                        </div>
                    </div>
                )}
            </div>

            {/* Student Detail Modal */}
            <Modal
                isOpen={!!selectedStudent}
                onClose={() => setSelectedStudent(null)}
                title="Student Academic Profile"
                size="lg"
            >
                {selectedStudent && (
                    <div className="flex flex-col gap-xl">
                        <div className="flex items-center gap-xl p-xl bg-surface rounded-2xl border border-border border-l-4 border-l-primary-500">
                            <Avatar name={selectedStudent.name} image={selectedStudent.avatar_url} size="xl" className="ring-4 ring-primary-500/20" />
                            <div className="flex-1">
                                <h2 className="m-0 text-2xl font-bold">{selectedStudent.name}</h2>
                                <p className="text-muted mb-md">{selectedStudent.email}</p>
                                <div className="flex gap-md">
                                    <div className="px-4 py-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl border border-primary-500/20">
                                        <span className="text-xs uppercase font-bold text-primary-500 block">Current Level</span>
                                        <span className="text-lg font-black">{calculateLevel(selectedStudent.xp || 0)}</span>
                                    </div>
                                    <div className="px-4 py-2 bg-surface rounded-xl border border-border">
                                        <span className="text-xs uppercase font-bold text-muted block">Total XP</span>
                                        <span className="text-lg font-black">{selectedStudent.xp || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                            <Card className="p-lg border-border">
                                <h4 className="m-0 font-bold mb-lg flex items-center gap-sm">
                                    <FileText size={18} className="text-primary-500" />
                                    Task Submissions
                                </h4>
                                <div className="flex flex-col gap-md">
                                    {submissions
                                        .filter(s => s.user_id === selectedStudent.id)
                                        .slice(0, 5)
                                        .map(sub => (
                                            <div key={sub.id} className="p-md rounded-xl bg-surface/50 border border-border flex justify-between items-center group hover:border-primary-500 transition-all">
                                                <div className="min-w-0 text-sm font-bold truncate">{sub.tasks?.title}</div>
                                                <Badge variant={getStatusColor(sub.status)} className="uppercase text-[10px] tracking-widest font-black">{sub.status}</Badge>
                                            </div>
                                        ))
                                    }
                                </div>
                            </Card>

                            <Card className="p-lg border-border">
                                <h4 className="m-0 font-bold mb-lg flex items-center gap-sm">
                                    <Trophy size={18} className="text-amber-500" />
                                    Performance Summary
                                </h4>
                                {(() => {
                                    const s = getStudentStats(selectedStudent.id);
                                    return (
                                        <div className="flex flex-col gap-lg">
                                            <div>
                                                <div className="flex justify-between text-xs font-bold mb-xs uppercase tracking-widest text-muted">Completion Rate</div>
                                                <div className="flex items-center gap-md">
                                                    <ProgressBar value={s.completionRate} size="sm" color="var(--primary-500)" className="flex-1" />
                                                    <span className="font-black">{s.completionRate}%</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-md">
                                                <div className="p-md bg-surface rounded-xl border border-border text-center">
                                                    <div className="text-xl font-black">{s.completedTasks}</div>
                                                    <div className="text-[10px] uppercase font-bold text-muted">Tasks Done</div>
                                                </div>
                                                <div className="p-md bg-surface rounded-xl border border-border text-center">
                                                    <div className="text-xl font-black">{s.totalSubmissions}</div>
                                                    <div className="text-[10px] uppercase font-bold text-muted">Total Subs</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </Card>
                        </div>

                        <div className="flex justify-end pt-md border-t border-border">
                            <Button variant="secondary" onClick={() => setSelectedStudent(null)}>Close Profile</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default ClassroomDetail;
