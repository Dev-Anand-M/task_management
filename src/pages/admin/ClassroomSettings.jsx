import { useState, useEffect } from 'react';
import { Card, Button, Input, LoadingSpinner, Modal, Badge } from '../../components/common';
import { School, Save, Users, BookOpen, Key, Plus, Check, MoreVertical, LayoutGrid, Settings } from 'lucide-react';
import * as db from '../../services/database';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useMiniReload } from '../../hooks/useMiniReload';

const ClassroomSettings = () => {
    const { user, forceRefresh } = useAuth();
    const navigate = useNavigate();

    const [classrooms, setClassrooms] = useState([]);
    const [activeClassroom, setActiveClassroom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({});

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // Form states
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');

    // Edit states
    const [editId, setEditId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useMiniReload(() => loadData());

    const loadData = async () => {
        try {
            setLoading(true);
            const [list, active] = await Promise.all([
                db.getClassrooms(),
                db.getClassroom()
            ]);

            setClassrooms(list);
            setActiveClassroom(active);

            if (active) {
                // Load stats for active classroom
                const [members, tasks, codes] = await Promise.all([
                    db.getMembers(),
                    db.getTasks(),
                    db.getInviteCodes ? db.getInviteCodes() : Promise.resolve([])
                ]);
                setStats({
                    members: members.length,
                    tasks: tasks.length,
                    codes: codes.length || 0
                });
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const newClass = await db.createClassroom(newName, newDesc);
            await handleSwitch(newClass.id); // Auto switch to new
            setShowCreateModal(false);
            setNewName('');
            setNewDesc('');
        } catch (error) {
            console.error(error);
            alert('Failed to create classroom');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (classroom) => {
        setEditId(classroom.id);
        setEditName(classroom.name);
        setEditDesc(classroom.description || '');
        setShowEditModal(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            await db.updateClassroom(editId, {
                name: editName,
                description: editDesc
            });
            setShowEditModal(false);
            loadData();
        } catch (error) {
            console.error(error);
            alert('Failed to update classroom');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSwitch = async (id) => {
        try {
            setLoading(true);
            await db.switchClassroom(id);
            // Force refresh auth context instead of full page reload
            await forceRefresh();
            // Reload data after context refresh
            await loadData();
        } catch (error) {
            console.error('Switch error', error);
            alert('Failed to switch classroom');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-6xl mx-auto">
            <div className="flex flex-mobile-col justify-between items-center mb-xl">
                <div>
                    <h2>My Classrooms</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Manage and switch between your classrooms</p>
                </div>
                <Button icon={Plus} onClick={() => setShowCreateModal(true)}>
                    Create Classroom
                </Button>
            </div>

            {/* Active Classroom Overview */}
            {activeClassroom && (
                <div className="mb-2xl">
                    <h3 className="mb-md text-sm uppercase tracking-wider text-muted font-bold">Current Classroom</h3>

                    <Card className="p-xl border-primary-500 border-2 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 bg-primary-500 text-white rounded-bl-lg">
                            <span className="text-xs font-bold px-2">ACTIVE</span>
                        </div>

                        <div className="flex flex-mobile-col justify-between items-start mb-lg">
                            <div>
                                <h1 className="text-3xl font-bold mb-xs text-gradient">{activeClassroom.name}</h1>
                                <p className="text-muted max-w-2xl">{activeClassroom.description || "No description provided."}</p>
                            </div>
                            <Button variant="secondary" icon={Settings} onClick={() => handleEditClick(activeClassroom)}>Edit Details</Button>
                        </div>

                        <div className="grid grid-cols-3 grid-3-mobile-1 gap-md">
                            <div className="flex items-center gap-md p-md bg-surface rounded-lg border border-border">
                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <h4 className="m-0 text-xl">{stats.members}</h4>
                                    <span className="text-xs text-muted font-bold uppercase">Members</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-md p-md bg-surface rounded-lg border border-border">
                                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                                    <BookOpen size={20} />
                                </div>
                                <div>
                                    <h4 className="m-0 text-xl">{stats.tasks}</h4>
                                    <span className="text-xs text-muted font-bold uppercase">Tasks</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-md p-md bg-surface rounded-lg border border-border">
                                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                                    <Key size={20} />
                                </div>
                                <div>
                                    <h4 className="m-0 text-xl">{stats.codes}</h4>
                                    <span className="text-xs text-muted font-bold uppercase">Codes</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* All Classrooms Grid */}
            <div>
                <h3 className="mb-md text-sm uppercase tracking-wider text-muted font-bold">Available Classrooms ({classrooms.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
                    {classrooms.map(room => {
                        const isActive = activeClassroom?.id === room.id;
                        return (
                            <Card
                                key={room.id}
                                className={`classroom-card p-lg cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg ${isActive ? 'ring-2 ring-primary-500' : ''}`}
                                onClick={() => !isActive && handleSwitch(room.id)}
                            >
                                <div className="flex justify-between items-start mb-md">
                                    <School size={32} className={isActive ? 'text-primary-500' : 'text-muted'} />
                                    {isActive && <Badge variant="primary">Active</Badge>}
                                </div>
                                <h3 className="mb-xs text-lg">{room.name}</h3>
                                <p className="classroom-description text-sm text-muted mb-lg">
                                    {room.description || "No description"}
                                </p>
                                <div className="mt-auto flex gap-sm">
                                    {isActive ? (
                                        <Button variant="outline" className="flex-1" disabled>Currently Active</Button>
                                    ) : (
                                        <Button variant="secondary" className="flex-1" onClick={(e) => { e.stopPropagation(); handleSwitch(room.id); }}>Switch</Button>
                                    )}
                                    <div className="flex gap-xs flex-1">
                                        <Link to={`/admin/classroom/${room.id}`} className="flex-1" onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" className="w-full">Manage</Button>
                                        </Link>
                                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditClick(room); }} title="Edit">
                                            <Settings size={18} />
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}

                    {/* Add New Card */}
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex flex-col items-center justify-center p-lg rounded-xl border-2 border-dashed border-border hover:border-primary-500 hover:bg-primary-50/10 transition-all group h-full min-h-[220px]"
                    >
                        <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center mb-md group-hover:scale-110 transition-transform">
                            <Plus size={24} className="text-muted group-hover:text-primary-500" />
                        </div>
                        <h4 className="text-muted group-hover:text-primary-500">Create New Classroom</h4>
                    </button>
                </div>
            </div>

            {/* Create Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Create New Classroom"
            >
                <form onSubmit={handleCreate}>
                    <div className="flex flex-col gap-lg">
                        <Input
                            label="Classroom Name"
                            placeholder="e.g. Advanced React Course"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            required
                        />
                        <Input
                            type="textarea"
                            label="Description"
                            placeholder="What will students learn?"
                            value={newDesc}
                            onChange={(e) => setNewDesc(e.target.value)}
                        />
                        <div className="flex justify-end gap-sm mt-md">
                            <Button variant="ghost" type="button" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                            <Button type="submit" loading={isSubmitting}>Create Classroom</Button>
                        </div>
                    </div>
                </form>
            </Modal>
            {/* Edit Modal */}
            <Modal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                title="Edit Classroom"
            >
                <form onSubmit={handleUpdate}>
                    <div className="flex flex-col gap-lg">
                        <Input
                            label="Classroom Name"
                            placeholder="e.g. Advanced React Course"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            required
                        />
                        <Input
                            type="textarea"
                            label="Description"
                            placeholder="What will students learn?"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                        />
                        <div className="flex justify-end gap-sm mt-md">
                            <Button variant="ghost" type="button" onClick={() => setShowEditModal(false)}>Cancel</Button>
                            <Button type="submit" loading={isSubmitting}>Save Changes</Button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ClassroomSettings;
