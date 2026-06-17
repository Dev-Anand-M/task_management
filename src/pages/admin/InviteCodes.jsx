import { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal, Input } from '../../components/common';
import {
    Plus,
    Trash2,
    Copy,
    Users,
    Key,
    CheckCircle,
    XCircle,
    Calendar,
    School,
    RotateCcw
} from 'lucide-react';
import * as inviteCodes from '../../services/inviteCodes';
import * as db from '../../services/database';
import { useAuth } from '../../context/AuthContext';
import { useMiniReload } from '../../hooks/useMiniReload';

const InviteCodes = () => {
    const { user } = useAuth();
    const [codes, setCodes] = useState([]);
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClassroom, setSelectedClassroom] = useState(user?.classroom_id || '');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCode, setNewCode] = useState('');
    const [customCode, setCustomCode] = useState('');
    const [useCustom, setUseCustom] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [copiedCode, setCopiedCode] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    useMiniReload(() => loadData());

    // Update selected classroom when user context changes or modal opens
    useEffect(() => {
        if (user?.classroom_id) {
            setSelectedClassroom(user.classroom_id);
        }
    }, [user?.classroom_id, showCreateModal]);

    const loadData = async () => {
        const [inviteCodeList, classroomList] = await Promise.all([
            inviteCodes.getInviteCodes(),
            db.getClassrooms()
        ]);
        setCodes(inviteCodeList);
        setClassrooms(classroomList);
    };

    const handleCreateCode = async () => {
        setLoading(true);
        console.log('InviteCodes: Starting creation process...', { useCustom, quantity, selectedClassroom, userClassroom: user?.classroom_id });
        
        try {
            const targetClassroomId = selectedClassroom || user?.classroom_id;
            
            if (!targetClassroomId) {
                console.warn('InviteCodes: No classroom ID found.');
                throw new Error('Please select a classroom first.');
            }

            if (useCustom) {
                if (!customCode) throw new Error('Please enter a custom code.');
                const code = customCode.toUpperCase();
                console.log('InviteCodes: Creating custom code:', code);
                await inviteCodes.createInviteCode(code, targetClassroomId);
            } else {
                // Bulk or Single Random
                console.log(`InviteCodes: Creating ${quantity} random codes for classroom ${targetClassroomId}`);
                const promises = [];
                for (let i = 0; i < quantity; i++) {
                    const code = (i === 0 && newCode) ? newCode : Math.random().toString(36).substring(2, 8).toUpperCase();
                    promises.push(inviteCodes.createInviteCode(code, targetClassroomId));
                }
                await Promise.all(promises);
            }

            console.log('InviteCodes: Success! Reloading data...');
            await loadData();
            setShowCreateModal(false);
            setNewCode('');
            setCustomCode('');
            setUseCustom(false);
            setQuantity(1);
            alert('Invite code(s) created successfully!');
        } catch (error) {
            console.error('InviteCodes: Creation failed:', error);
            alert('Failed to create invite code: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCode = async (id, codeStr) => {
        if (confirm(`Are you sure you want to delete invite code "${codeStr}"?`)) {
            setLoading(true);
            try {
                const success = await inviteCodes.deleteInviteCode(id);
                if (success) {
                    setCodes(codes.filter(c => c.id !== id));
                } else {
                    alert('Failed to delete invite code. You might not have permission or it might already be deleted.');
                }
            } catch (error) {
                console.error('Error deleting code:', error);
                alert('Error deleting code: ' + error.message);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleClearUsed = async () => {
        if (confirm('Delete all used invite codes? This cannot be undone.')) {
            setLoading(true);
            try {
                const usedCodes = codes.filter(c => c.is_used);
                const results = await Promise.all(usedCodes.map(c => inviteCodes.deleteInviteCode(c.id)));

                if (results.every(r => r)) {
                    await loadData();
                } else {
                    alert('Some used codes could not be deleted.');
                    await loadData();
                }
            } catch (error) {
                console.error('Error clearing codes:', error);
                alert('Error clearing codes: ' + error.message);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(''), 2000);
    };

    const generateRandomCode = () => {
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        setNewCode(random);
    };

    const stats = {
        total: codes.length,
        used: codes.filter(c => c.is_used).length,
        available: codes.filter(c => !c.is_used).length
    };

    const currentClassroomName = classrooms.find(c => c.id === selectedClassroom)?.name || user?.classroom_name;

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex flex-mobile-col justify-between items-center mb-lg">
                <div>
                    <h2 style={{ margin: 0, marginBottom: '4px' }}>
                        Invite Codes
                        {user?.classroom_name && <span className="text-muted text-lg font-normal ml-sm">for {user.classroom_name}</span>}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        Manage registration invite codes for your friends in this classroom
                    </p>
                </div>
                <div className="flex gap-sm">
                    <Button variant="ghost" onClick={loadData} title="Refresh List">
                        <RotateCcw size={18} />
                    </Button>
                    {codes.some(c => c.is_used) && (
                        <Button variant="danger" onClick={handleClearUsed} title="Delete all used codes">
                            Clear Used
                        </Button>
                    )}
                    <Button icon={Plus} onClick={() => setShowCreateModal(true)}>
                        Create Code
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 grid-3-mobile-1 mb-xl">
                <Card style={{ textAlign: 'center' }}>
                    <Key size={24} style={{ color: 'var(--primary-500)', marginBottom: '8px' }} />
                    <h3 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>{stats.total}</h3>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                        Total Codes
                    </p>
                </Card>
                <Card style={{ textAlign: 'center' }}>
                    <CheckCircle size={24} style={{ color: 'var(--success-500)', marginBottom: '8px' }} />
                    <h3 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>{stats.used}</h3>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                        Used Codes
                    </p>
                </Card>
                <Card style={{ textAlign: 'center' }}>
                    <Users size={24} style={{ color: 'var(--warning-500)', marginBottom: '8px' }} />
                    <h3 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>{stats.available}</h3>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                        Available Codes
                    </p>
                </Card>
            </div>

            {/* Codes List */}
            <Card>
                <h3 style={{ marginBottom: 'var(--space-lg)' }}>All Invite Codes</h3>
                {codes.length === 0 ? (
                    <div className="empty-state">
                        <Key size={32} />
                        <h3>No invite codes yet</h3>
                        <p>Create your first invite code to allow friends to register</p>
                        <Button icon={Plus} onClick={() => setShowCreateModal(true)}>
                            Create Code
                        </Button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {codes.map((code) => (
                            <div
                                key={code.code}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-md)',
                                    background: 'var(--card)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: 'var(--radius-md)',
                                        background: code.is_used
                                            ? 'rgba(16, 185, 129, 0.1)'
                                            : 'rgba(99, 102, 241, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {code.is_used ? (
                                            <CheckCircle size={20} style={{ color: 'var(--success-500)' }} />
                                        ) : (
                                            <Key size={20} style={{ color: 'var(--primary-500)' }} />
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>
                                            {code.code}
                                        </div>
                                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                            {code.is_used ? 'Used' : 'Available'}
                                            {code.classroom_id && (
                                                <span style={{ marginLeft: '8px', opacity: 0.8 }}>
                                                    • {classrooms.find(c => c.id === code.classroom_id)?.name || 'Classroom'}
                                                </span>
                                            )}
                                            {!code.classroom_id && (
                                                <span style={{ marginLeft: '8px', opacity: 0.8 }}>
                                                    • Global
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                    {code.is_used && (
                                        <Badge variant="success" style={{ fontSize: '10px' }}>
                                            Used
                                        </Badge>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleCopyCode(code.code)}
                                        title="Copy code"
                                    >
                                        <Copy size={16} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteCode(code.id, code.code)}
                                        title="Delete code"
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Create Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Create Invite Code"
                size="sm"
            >
                <form onSubmit={(e) => { e.preventDefault(); handleCreateCode(); }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div className="input-group">
                            <label className="input-label">Assign to Classroom</label>
                            <div className="relative">
                                <School size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <select
                                    className="input pl-10"
                                    value={selectedClassroom}
                                    onChange={(e) => setSelectedClassroom(e.target.value)}
                                >
                                    <option value="">Global (No Classroom)</option>
                                    {classrooms.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} {c.id === user?.classroom_id ? '(Current)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Code Type</label>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                    <input
                                        type="radio"
                                        checked={!useCustom}
                                        onChange={() => setUseCustom(false)}
                                    />
                                    <span>Random Code</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                    <input
                                        type="radio"
                                        checked={useCustom}
                                        onChange={() => setUseCustom(true)}
                                    />
                                    <span>Custom Code</span>
                                </label>
                            </div>
                        </div>

                        {!useCustom ? (
                            <>
                                <div className="input-group">
                                    <label className="input-label">Random Code Preview</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                        <Input
                                            value={newCode}
                                            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                                            placeholder="Generate or enter"
                                            style={{ textTransform: 'uppercase' }}
                                        />
                                        <Button type="button" onClick={generateRandomCode}>
                                            Generate
                                        </Button>
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Quantity to Generate</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={quantity}
                                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                    />
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        Generate multiple unique codes at once
                                    </p>
                                </div>
                            </>
                        ) : (
                            <Input
                                label="Custom Code"
                                value={customCode}
                                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                                placeholder="Enter custom code"
                                style={{ textTransform: 'uppercase' }}
                            />
                        )}
                    </div>

                    <div className="flex justify-end gap-md" style={{ marginTop: 'var(--space-lg)' }}>
                        <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={loading}>
                            Create Code
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Copy Success Toast */}
            {copiedCode && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    padding: 'var(--space-md)',
                    background: 'var(--success-500)',
                    color: 'white',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    animation: 'slideInUp 0.3s ease'
                }}>
                    Copied {copiedCode} to clipboard!
                </div>
            )}

        </div>
    );
};

export default InviteCodes;
