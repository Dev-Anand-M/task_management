import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useAuth } from '../../context/AuthContext';
import { chatService } from '../../services/chatService';
import * as db from '../../services/database';
import { supabase } from '../../lib/supabase';
import { 
    MessageSquare, 
    Lock, 
    Send, 
    Plus, 
    Users, 
    Search, 
    Image as ImageIcon, 
    Paperclip, 
    CheckCheck, 
    ShieldCheck, 
    X, 
    MoreVertical, 
    Smile, 
    ArrowLeft,
    Sparkles,
    Mic,
    MicOff,
    Download,
    FileText,
    Play,
    Pause,
    Trash2,
    CheckCircle,
    School,
    Key,
    Shield,
    ExternalLink
} from 'lucide-react';
import { Button, Input, Card, Avatar, Badge } from '../../components/common';
import { cryptoService } from '../../services/cryptoService';

export default function Chat() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [activeRoom, setActiveRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTab, setFilterTab] = useState('all'); // 'all' | 'private' | 'classroom'
    const [teamMembers, setTeamMembers] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [showMobileChat, setShowMobileChat] = useState(false);

    // Media & Attachment States
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [previewImage, setPreviewImage] = useState(null); // Fullscreen Lightbox
    const [showEmojiBar, setShowEmojiBar] = useState(false);
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const [onlineUserIds, setOnlineUserIds] = useState([]);

    // Mention Dropdown State
    const [showMentionPopup, setShowMentionPopup] = useState(false);

    // Encryption Verification Modal State
    const [showVerifyKeyModal, setShowVerifyKeyModal] = useState(false);
    const [myFingerprint, setMyFingerprint] = useState('');
    const [peerFingerprint, setPeerFingerprint] = useState('');

    // Audio Voice Note Recording States
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerIntervalRef = useRef(null);

    // Audio playback state for voice notes
    const [playingAudioId, setPlayingAudioId] = useState(null);
    const audioRef = useRef(null);

    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 1. Initial Setup: Load Crypto Keys, User Rooms & Track Online Presence
    useEffect(() => {
        if (!user?.id) return;

        let presenceChannel = null;

        const initChat = async () => {
            setLoadingRooms(true);
            await chatService.initUserCrypto(user.id);

            // Track Real-time Presence
            presenceChannel = chatService.trackUserPresence(user.id, (ids) => {
                setOnlineUserIds(ids);
            });
            
            try {
                const members = await db.getMembers();
                const otherMembers = (members || []).filter(m => m.id !== user.id);
                setTeamMembers(otherMembers);
            } catch (e) {
                console.error("Error fetching team members:", e);
            }

            const userRooms = await chatService.fetchUserRooms(user.id);
            setRooms(userRooms);

            if (userRooms.length > 0 && !isMobile) {
                setActiveRoom(userRooms[0]);
            }
            setLoadingRooms(false);
        };

        initChat();

        return () => {
            if (presenceChannel) supabase.removeChannel(presenceChannel);
        };
    }, [user?.id]);

    // 2. Load Messages when Active Room changes
    useEffect(() => {
        if (!activeRoom || !user?.id) return;

        const loadMessages = async () => {
            setLoadingMessages(true);
            const peerId = activeRoom.type === 'private' 
                ? activeRoom.members?.find(id => id !== user.id)
                : null;

            const decrypted = await chatService.fetchRoomMessages(activeRoom.id, user.id, peerId);
            setMessages(decrypted);
            setLoadingMessages(false);
            scrollToBottom();
        };

        loadMessages();

        // 1. Subscribe to Postgres Changes for DB updates
        const dbChannel = supabase
            .channel(`chat-room-${activeRoom.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `room_id=eq.${activeRoom.id}`
            }, async (payload) => {
                const newMsg = payload.new;
                if (newMsg.sender_id === user.id) return;

                const peerId = activeRoom.type === 'private'
                    ? activeRoom.members?.find(id => id !== user.id)
                    : null;

                const decryptedArr = await chatService.fetchRoomMessages(activeRoom.id, user.id, peerId);
                setMessages(decryptedArr);
                scrollToBottom();
            })
            .subscribe();

        // 2. Subscribe to Global Broadcast Channel for 100% Instant Delivery across WebSockets
        const broadcastChannel = supabase
            .channel('global-chat-channel')
            .on('broadcast', { event: 'new_message' }, async (eventPayload) => {
                const incomingMsg = eventPayload.payload;
                if (!incomingMsg || incomingMsg.sender_id === user.id) return;

                // If message is for the currently open active room, append it!
                if (incomingMsg.room_id === activeRoom.id) {
                    const peerId = activeRoom.type === 'private'
                        ? activeRoom.members?.find(id => id !== user.id)
                        : null;
                    const refreshedMsgs = await chatService.fetchRoomMessages(activeRoom.id, user.id, peerId);
                    setMessages(refreshedMsgs);
                    scrollToBottom();
                } else {
                    // Trigger Native Local Notification on Mobile
                    try {
                        await LocalNotifications.schedule({
                            notifications: [{
                                title: `💬 ${incomingMsg.sender_name || 'New Message'}`,
                                body: incomingMsg.message_type === 'image' ? '📷 Sent a photo' : incomingMsg.message_type === 'audio' ? '🎙️ Sent a voice note' : '🔒 Sent an encrypted message',
                                id: Math.floor(Math.random() * 100000),
                                schedule: { at: new Date(Date.now() + 100) },
                                extra: { url: '/chat' }
                            }]
                        });
                    } catch (e) {}
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(dbChannel);
            supabase.removeChannel(broadcastChannel);
        };
    }, [activeRoom?.id, user?.id]);

    const scrollToBottom = () => {
        setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const renderMessageContent = (text) => {
        if (!text) return null;
        
        const parseFormatting = (str) => {
            if (!str) return '';
            let formatted = str
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
                .replace(/_([^_]+)_/g, '<em>$1</em>')
                .replace(/~([^~]+)~/g, '<del>$1</del>')
                .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.15);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:12px;">$1</code>');
            return formatted;
        };

        const urlPattern = /(https?:\/\/[^\s]+|\/(?:studylab|routines|timetable|dashboard|tasks)[^\s]*|@\w+|#[^\s]+)/gi;
        const parts = text.split(urlPattern);

        return parts.map((part, index) => {
            if (!part) return null;

            if (part.match(/^https?:\/\//i)) {
                return (
                    <a 
                        key={index}
                        href={part} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ color: '#60a5fa', textDecoration: 'underline', fontWeight: 600, wordBreak: 'break-all' }}
                    >
                        {part} <ExternalLink size={12} style={{ display: 'inline', marginLeft: '2px' }} />
                    </a>
                );
            } else if (part.match(/^\/(studylab|routines|timetable|dashboard|tasks)/i)) {
                return (
                    <span 
                        key={index}
                        onClick={(e) => { e.stopPropagation(); navigate(part); }} 
                        style={{ 
                            color: '#38bdf8', 
                            cursor: 'pointer', 
                            fontWeight: 700,
                            textDecoration: 'underline'
                        }}
                    >
                        {part}
                    </span>
                );
            } else if (part.match(/^@(zen|zenith|ai)\b/i)) {
                return (
                    <span key={index} style={{ color: '#c084fc', fontWeight: 800 }}>
                        ✨ {part}
                    </span>
                );
            } else if (part.match(/^@everyone\b/i)) {
                return (
                    <span key={index} style={{ color: '#f87171', fontWeight: 800 }}>
                        📢 {part}
                    </span>
                );
            } else if (part.match(/^(@\w+|#[^\s]+)/)) {
                return (
                    <span 
                        key={index}
                        onClick={(e) => { e.stopPropagation(); navigate('/studylab'); }} 
                        style={{ 
                            color: '#60a5fa', 
                            cursor: 'pointer', 
                            fontWeight: 700
                        }}
                    >
                        {part}
                    </span>
                );
            }

            return (
                <span 
                    key={index} 
                    dangerouslySetInnerHTML={{ __html: parseFormatting(part) }} 
                />
            );
        });
    };

    // 3. Send Text Message
    const handleSendMessage = async (e) => {
        e?.preventDefault();
        if (!inputText.trim() || !activeRoom || !user?.id) return;

        const content = inputText.trim();
        setInputText('');
        setShowEmojiBar(false);

        const peerId = activeRoom.type === 'private'
            ? activeRoom.members?.find(id => id !== user.id)
            : null;

        const sentObj = await chatService.sendMessage({
            roomId: activeRoom.id,
            senderId: user.id,
            senderName: user.name || user.email?.split('@')[0] || 'User',
            receiverId: peerId,
            content: content,
            messageType: 'text'
        });

        setMessages(prev => [...prev, { ...sentObj, content }]);
        scrollToBottom();

        // Close mentions popup
        setShowMentionPopup(false);

        const updatedRooms = await chatService.fetchUserRooms(user.id);
        setRooms(updatedRooms);

        // Trigger Zen AI response if @Zen or @Zenith or @AI is mentioned
        if (content.match(/@(zen|zenith|ai|bot)\b/i)) {
            const aiPrompt = content.replace(/@(zen|zenith|ai|bot)\b/gi, '').trim();
            setTimeout(async () => {
                try {
                    const { zenChat } = await import('../../services/aiService');
                    const aiResponseText = await zenChat(
                        [{ role: 'user', content: aiPrompt || 'Hello Zen! How can I help you today?' }],
                        'You are Zen AI in Zenith Chat. Keep your responses concise, friendly, and helpful for students.'
                    );
                    
                    const aiReplyObj = await chatService.sendMessage({
                        roomId: activeRoom.id,
                        senderId: 'zen_ai',
                        senderName: '✨ Zen AI',
                        receiverId: peerId,
                        content: aiResponseText || "✨ I'm here to help you study!",
                        messageType: 'text'
                    });

                    setMessages(prev => [...prev, { ...aiReplyObj, content: aiResponseText || "✨ I'm here to help!" }]);
                    scrollToBottom();
                } catch (err) {
                    console.warn("Zen AI response failed:", err);
                }
            }, 600);
        }
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputText(val);
        // Only show popup when actively typing after @ at end of input
        const match = val.match(/@(\w*)$/);
        setShowMentionPopup(!!match);
    };

    const handleSelectMention = (tag) => {
        setInputText(prev => {
            const lastAtIndex = prev.lastIndexOf('@');
            if (lastAtIndex !== -1) {
                return prev.slice(0, lastAtIndex) + tag + ' ';
            }
            return prev + ' ' + tag + ' ';
        });
        setShowMentionPopup(false);
    };

    // Input field overlay: ONLY colors @ mentions and # tags in text field
    const renderInputOverlay = (text) => {
        if (!text) return null;
        const parts = text.split(/(@\w+|#[^\s]+)/g);
        return parts.map((part, i) => {
            if (part.match(/^@(zen|zenith|ai)$/i)) {
                return <span key={i} style={{ color: '#c084fc', fontWeight: 800 }}>{part}</span>;
            } else if (part.match(/^@everyone$/i)) {
                return <span key={i} style={{ color: '#f87171', fontWeight: 800 }}>{part}</span>;
            } else if (part.match(/^@\w+/)) {
                return <span key={i} style={{ color: '#60a5fa', fontWeight: 700 }}>{part}</span>;
            } else if (part.match(/^#[^\s]+/)) {
                return <span key={i} style={{ color: '#38bdf8', fontWeight: 700 }}>{part}</span>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    // 4. File / Image Upload Handler
    const handleFileUpload = async (e, forcedType = null) => {
        const file = e.target.files?.[0];
        if (!file || !activeRoom || !user?.id) return;

        setUploadingMedia(true);
        try {
            const uploaded = await chatService.uploadMedia(file);
            if (!uploaded) return;

            let msgType = forcedType || 'file';
            if (file.type.startsWith('image/')) msgType = 'image';
            if (file.type.startsWith('audio/')) msgType = 'audio';

            const peerId = activeRoom.type === 'private'
                ? activeRoom.members?.find(id => id !== user.id)
                : null;

            const captionText = msgType === 'image' ? `📷 Image: ${uploaded.fileName}` : `📎 File: ${uploaded.fileName}`;

            const sentObj = await chatService.sendMessage({
                roomId: activeRoom.id,
                senderId: user.id,
                senderName: user.name || 'User',
                receiverId: peerId,
                content: captionText,
                messageType: msgType,
                mediaUrl: uploaded.url
            });

            setMessages(prev => [...prev, { 
                ...sentObj, 
                content: captionText, 
                media_url: uploaded.url,
                fileName: uploaded.fileName,
                fileSize: uploaded.fileSize
            }]);
            scrollToBottom();
        } catch (err) {
            console.error("File upload error:", err);
        } finally {
            setUploadingMedia(false);
            if (e.target) e.target.value = '';
        }
    };

    // 5. Voice Note Recording (Microphone)
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], `voicenote_${Date.now()}.webm`, { type: 'audio/webm' });
                
                setUploadingMedia(true);
                const uploaded = await chatService.uploadMedia(audioFile);
                if (uploaded && activeRoom) {
                    const peerId = activeRoom.type === 'private'
                        ? activeRoom.members?.find(id => id !== user.id)
                        : null;

                    const sentObj = await chatService.sendMessage({
                        roomId: activeRoom.id,
                        senderId: user.id,
                        senderName: user.name || 'User',
                        receiverId: peerId,
                        content: '🎙️ Voice Note',
                        messageType: 'audio',
                        mediaUrl: uploaded.url
                    });

                    setMessages(prev => [...prev, { ...sentObj, content: '🎙️ Voice Note', media_url: uploaded.url }]);
                    scrollToBottom();
                }
                setUploadingMedia(false);

                // Stop media tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            alert("Microphone permission required to send voice notes!");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerIntervalRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
            const stream = mediaRecorderRef.current.stream;
            if (stream) stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            clearInterval(timerIntervalRef.current);
        }
    };

    const formatRecordingTimer = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // 6. Voice Note Audio Player
    const togglePlayAudio = (msgId, audioUrl) => {
        if (playingAudioId === msgId) {
            audioRef.current?.pause();
            setPlayingAudioId(null);
        } else {
            if (audioRef.current) audioRef.current.pause();
            const newAudio = new Audio(audioUrl);
            audioRef.current = newAudio;
            newAudio.play();
            setPlayingAudioId(msgId);
            newAudio.onended = () => setPlayingAudioId(null);
        }
    };

    // 7. Clear Chat History
    const handleClearChat = async () => {
        if (!activeRoom || !window.confirm("Are you sure you want to clear chat history for this room?")) return;
        await chatService.clearRoomMessages(activeRoom.id);
        setMessages([]);
        setRooms(prev => prev.map(r => r.id === activeRoom.id ? { ...r, last_message: '' } : r));
        setShowOptionsMenu(false);
    };

    // Start 1-on-1 Chat
    const handleStartPrivateChat = async (targetMember) => {
        const room = await chatService.getOrCreatePrivateRoom(
            user.id,
            targetMember.id,
            targetMember.name,
            targetMember.avatar_url
        );

        setRooms(prev => {
            if (!prev.some(r => r.id === room.id)) return [room, ...prev];
            return prev;
        });

        setActiveRoom(room);
        if (isMobile) setShowMobileChat(true);
    };

    // Create Group Chat
    const handleCreateGroup = async () => {
        if (!groupTitle.trim() || selectedMembers.length === 0) return;

        const groupRoom = await chatService.createGroupRoom(
            user.id,
            groupTitle.trim(),
            selectedMembers
        );

        setRooms(prev => [groupRoom, ...prev]);
        setActiveRoom(groupRoom);
        setShowNewGroupModal(false);
        setGroupTitle('');
        setSelectedMembers([]);
        if (isMobile) setShowMobileChat(true);
    };

    // Filtered Rooms
    const filteredRooms = rooms.filter(r => {
        const matchesFilter = filterTab === 'all' || r.type === filterTab;
        const matchesSearch = r.name?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getPeerMember = (room) => {
        if (room.type !== 'private') return null;
        const peerId = room.members?.find(id => id !== user?.id);
        return teamMembers.find(m => m.id === peerId) || { name: room.name, avatar_url: room.avatar_url };
    };

    const emojis = ['👍', '❤️', '🔥', '🎉', '😂', '💯', '✅', '🚀', '👏', '⭐'];

    return (
        <div className="stagger-in" style={{ 
            height: 'calc(100vh - 120px)', 
            display: 'flex', 
            gap: 'var(--space-md)', 
            overflow: 'hidden',
            margin: '-var(--space-md) -var(--space-md) 0 -var(--space-md)'
        }}>
            {/* Hidden File Inputs */}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => handleFileUpload(e, 'file')} 
                style={{ display: 'none' }} 
            />
            <input 
                type="file" 
                ref={imageInputRef} 
                accept="image/*" 
                onChange={(e) => handleFileUpload(e, 'image')} 
                style={{ display: 'none' }} 
            />

            {/* Left Sidebar: Conversations List */}
            <div style={{
                width: isMobile ? (showMobileChat ? '0' : '100%') : '360px',
                display: isMobile && showMobileChat ? 'none' : 'flex',
                flexDirection: 'column',
                background: 'var(--card)',
                borderRight: '1px solid var(--border)',
                flexShrink: 0,
                transition: 'all 0.3s ease'
            }}>
                {/* Header */}
                <div style={{ 
                    padding: 'var(--space-md)', 
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'color-mix(in srgb, var(--surface), transparent 40%)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, var(--primary-500), var(--accent-500))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                        }}>
                            <MessageSquare size={22} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 800 }}>Zenith Chat</h2>
                            <p style={{ margin: 0, fontSize: '10px', color: 'var(--success-500)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <ShieldCheck size={12} /> End-to-End Encrypted
                            </p>
                        </div>
                    </div>

                    <Button 
                        variant="primary" 
                        size="sm" 
                        icon={School}
                        onClick={async () => {
                            const cRoom = await chatService.getOrCreateClassroomRoom(user.id, 'main_classroom', 'Classroom Chat');
                            setRooms(prev => [cRoom, ...prev.filter(r => r.id !== cRoom.id)]);
                            setActiveRoom(cRoom);
                            if (isMobile) setShowMobileChat(true);
                        }}
                        style={{ borderRadius: 'var(--radius-full)' }}
                    >
                        Classroom
                    </Button>
                </div>

                {/* Search Bar */}
                <div style={{ padding: 'var(--space-sm) var(--space-md)', borderBottom: '1px solid var(--border)' }}>
                    <Input 
                        placeholder="Search conversations..." 
                        icon={Search} 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Filter Tabs */}
                <div style={{ 
                    display: 'flex', 
                    padding: 'var(--space-xs) var(--space-md)', 
                    gap: 'var(--space-xs)',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--surface)'
                }}>
                    {['all', 'private'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setFilterTab(tab)}
                            style={{
                                flex: 1,
                                padding: '6px 12px',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-xs)',
                                fontWeight: 700,
                                textTransform: 'capitalize',
                                cursor: 'pointer',
                                background: filterTab === tab ? 'var(--primary-500)' : 'transparent',
                                color: filterTab === tab ? 'white' : 'var(--text-muted)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {tab === 'all' ? 'All Chats' : 'Direct (Private)'}
                        </button>
                    ))}
                </div>

                {/* Conversations List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-xs)' }}>
                    {loadingRooms ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <p>Securing end-to-end keys...</p>
                        </div>
                    ) : filteredRooms.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <MessageSquare size={36} style={{ opacity: 0.3, marginBottom: '8px' }} />
                            <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)' }}>No conversations yet</p>
                            <p style={{ fontSize: 'var(--text-xs)', marginTop: '4px' }}>Select a team member below to start chatting!</p>
                            
                            <div style={{ marginTop: '1rem', textAlign: 'left' }}>
                                <p style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    Team Members
                                </p>
                                {teamMembers.map(member => (
                                    <div
                                        key={member.id}
                                        onClick={() => handleStartPrivateChat(member)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '10px',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            background: 'var(--surface)',
                                            marginBottom: '6px',
                                            border: '1px solid var(--border)'
                                        }}
                                        className="hover:scale-[1.01] active:scale-[0.99]"
                                    >
                                        <Avatar name={member.name} image={member.avatar_url} size="sm" />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)' }}>{member.name}</p>
                                            <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>{member.role || 'Member'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        filteredRooms.map(room => {
                            const isSelected = activeRoom?.id === room.id;
                            const peer = getPeerMember(room);
                            const displayName = room.type === 'private' ? (peer?.name || room.name) : room.name;
                            const displayAvatar = room.type === 'private' ? (peer?.avatar_url || room.avatar_url) : room.avatar_url;

                            return (
                                <div
                                    key={room.id}
                                    onClick={() => {
                                        setActiveRoom(room);
                                        if (isMobile) setShowMobileChat(true);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px',
                                        borderRadius: 'var(--radius-lg)',
                                        cursor: 'pointer',
                                        marginBottom: '4px',
                                        background: isSelected ? 'color-mix(in srgb, var(--primary-500), transparent 88%)' : 'transparent',
                                        border: isSelected ? '1px solid var(--primary-500)' : '1px solid transparent',
                                        transition: 'all 0.2s ease'
                                    }}
                                    className="hover:bg-surface"
                                >
                                    <div style={{ position: 'relative' }}>
                                        <Avatar name={displayName} image={displayAvatar} size="md" />
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '-2px',
                                            right: '-2px',
                                            background: room.type === 'classroom' ? 'linear-gradient(135deg, var(--accent-500), var(--primary-500))' : 'var(--success-500)',
                                            borderRadius: '50%',
                                            padding: '3px',
                                            color: 'white',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {room.type === 'classroom' ? <School size={10} /> : <Lock size={10} />}
                                        </div>
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                                <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {displayName}
                                                </h4>
                                                {room.type === 'classroom' ? (
                                                    <span style={{ 
                                                        fontSize: '9px', 
                                                        fontWeight: 800, 
                                                        background: 'color-mix(in srgb, var(--accent-500), transparent 85%)', 
                                                        color: 'var(--accent-400)', 
                                                        padding: '1px 6px', 
                                                        borderRadius: '8px',
                                                        border: '1px solid color-mix(in srgb, var(--accent-500), transparent 70%)'
                                                    }}>
                                                        CLASSROOM
                                                    </span>
                                                ) : (
                                                    <span style={{ 
                                                        fontSize: '9px', 
                                                        fontWeight: 800, 
                                                        background: 'color-mix(in srgb, var(--primary-500), transparent 85%)', 
                                                        color: 'var(--primary-400)', 
                                                        padding: '1px 6px', 
                                                        borderRadius: '8px',
                                                        border: '1px solid color-mix(in srgb, var(--primary-500), transparent 70%)'
                                                    }}>
                                                        PRIVATE DM
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                                {room.last_message_at ? new Date(room.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>

                                        <p style={{ 
                                            margin: '2px 0 0', 
                                            fontSize: 'var(--text-xs)', 
                                            color: 'var(--text-muted)', 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis', 
                                            whiteSpace: 'nowrap',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            <Lock size={10} className="text-success-500" />
                                            {room.last_message ? room.last_message : (
                                                <span style={{ fontStyle: 'italic', opacity: 0.7 }}>No messages yet</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Panel: Main Active Chat Window */}
            <div style={{
                flex: 1,
                display: isMobile && !showMobileChat ? 'none' : 'flex',
                flexDirection: 'column',
                background: 'var(--surface)',
                borderRadius: isMobile ? 0 : 'var(--radius-xl)',
                border: isMobile ? 'none' : '1px solid var(--border)',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {activeRoom ? (
                    <>
                        {/* Chat Header */}
                        <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            borderBottom: '1px solid var(--border)',
                            background: 'var(--card)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            position: 'relative',
                            zIndex: 100
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {isMobile && (
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => setShowMobileChat(false)}
                                    >
                                        <ArrowLeft size={20} />
                                    </Button>
                                )}
                                <Avatar 
                                    name={activeRoom.type === 'private' ? getPeerMember(activeRoom)?.name || activeRoom.name : activeRoom.name} 
                                    image={activeRoom.type === 'private' ? getPeerMember(activeRoom)?.avatar_url : activeRoom.avatar_url} 
                                    size="md" 
                                />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 800 }}>
                                        {activeRoom.type === 'private' ? getPeerMember(activeRoom)?.name || activeRoom.name : activeRoom.name}
                                    </h3>
                                    {(() => {
                                        const peerId = activeRoom.type === 'private' ? activeRoom.members?.find(id => id !== user?.id) : null;
                                        const isPeerOnline = peerId ? onlineUserIds.includes(peerId) : false;
                                        return (
                                            <p style={{ margin: 0, fontSize: '11px', color: isPeerOnline ? 'var(--success-500)' : 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isPeerOnline ? 'var(--success-500)' : 'var(--text-muted)' }} />
                                                {activeRoom.type === 'group' ? `${activeRoom.members?.length || 0} Members` : (isPeerOnline ? 'Online' : 'Offline')} • End-to-End Encrypted
                                            </p>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div style={{ position: 'relative' }}>
                                <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                                >
                                    <MoreVertical size={18} />
                                </Button>

                                {showOptionsMenu && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '4px',
                                        width: '200px',
                                        background: 'var(--card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        boxShadow: 'var(--shadow-md)',
                                        padding: '4px',
                                        zIndex: 1000
                                    }}>
                                        <button
                                            onClick={async () => {
                                                setShowOptionsMenu(false);
                                                const myKeys = await cryptoService.getOrCreateUserKeys();
                                                const myFp = await cryptoService.getFingerprint(`user_${user?.id}_${myKeys.publicKeySpki}`);
                                                setMyFingerprint(myFp);

                                                const peerId = activeRoom?.type === 'private' ? activeRoom.members?.find(id => id !== user?.id) : null;
                                                if (peerId) {
                                                    const peerFp = await cryptoService.getFingerprint(`peer_${peerId}_room_${activeRoom.id}`);
                                                    setPeerFingerprint(peerFp);
                                                } else {
                                                    const roomFp = await cryptoService.getFingerprint(`classroom_${activeRoom?.id || 'main'}`);
                                                    setPeerFingerprint(roomFp);
                                                }
                                                setShowVerifyKeyModal(true);
                                            }}
                                            style={{
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '8px 12px',
                                                border: 'none',
                                                background: 'transparent',
                                                color: 'var(--text)',
                                                fontSize: 'var(--text-xs)',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                borderRadius: 'var(--radius-sm)',
                                                marginBottom: '4px'
                                            }}
                                            className="hover:bg-surface"
                                        >
                                            <ShieldCheck size={14} className="text-primary-500" /> Verify Encryption
                                        </button>
                                        <button
                                            onClick={handleClearChat}
                                            style={{
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '8px 12px',
                                                border: 'none',
                                                background: 'transparent',
                                                color: 'var(--error-500)',
                                                fontSize: 'var(--text-xs)',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                borderRadius: 'var(--radius-sm)'
                                            }}
                                            className="hover:bg-surface"
                                        >
                                            <Trash2 size={14} /> Clear Chat History
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* E2EE WhatsApp Security Banner */}
                        <div style={{
                            padding: '8px 16px',
                            background: 'color-mix(in srgb, var(--primary-500), transparent 94%)',
                            borderBottom: '1px solid var(--border)',
                            textAlign: 'center',
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}>
                            <Lock size={12} className="text-primary-500" />
                            <span>Messages are end-to-end encrypted. No one outside of this chat can read them.</span>
                        </div>

                        {/* Message Timeline */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: 'var(--space-md)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-xs)',
                            backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
                            backgroundSize: '24px 24px'
                        }}>
                            {loadingMessages ? (
                                <div style={{ margin: 'auto', color: 'var(--text-muted)' }}>
                                    <p>Decrypting secure messages...</p>
                                </div>
                            ) : messages.length === 0 ? (
                                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <Sparkles size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                    <p style={{ margin: 0, fontWeight: 700 }}>Say hello!</p>
                                    <p style={{ fontSize: 'var(--text-xs)', marginTop: '4px' }}>This is the beginning of your end-to-end encrypted chat history.</p>
                                </div>
                            ) : (
                                messages.map((msg, i) => {
                                    const isMine = msg.sender_id === user.id;
                                    return (
                                        <div
                                            key={msg.id || i}
                                            style={{
                                                alignSelf: isMine ? 'flex-end' : 'flex-start',
                                                maxWidth: '75%',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '2px'
                                            }}
                                        >
                                            {!isMine && activeRoom.type === 'group' && (
                                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary-400)', marginLeft: '4px' }}>
                                                    {msg.sender_name}
                                                </span>
                                            )}

                                            <div style={{
                                                padding: '10px 14px',
                                                borderRadius: isMine ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                                                background: isMine 
                                                    ? 'linear-gradient(135deg, var(--primary-600), var(--primary-700))' 
                                                    : 'var(--card)',
                                                color: isMine ? 'white' : 'var(--text)',
                                                fontSize: 'var(--text-sm)',
                                                fontWeight: 500,
                                                boxShadow: 'var(--shadow-sm)',
                                                border: isMine ? 'none' : '1px solid var(--border)',
                                                wordBreak: 'break-word',
                                                position: 'relative'
                                            }}>
                                                {/* Image Attachment Card */}
                                                {msg.message_type === 'image' && msg.media_url && (
                                                    <div 
                                                        onClick={() => setPreviewImage(msg.media_url)}
                                                        style={{ 
                                                            marginBottom: '8px', 
                                                            borderRadius: 'var(--radius-md)', 
                                                            overflow: 'hidden', 
                                                            cursor: 'pointer' 
                                                        }}
                                                    >
                                                        <img 
                                                            src={msg.media_url} 
                                                            alt="Attached" 
                                                            style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }} 
                                                        />
                                                    </div>
                                                )}

                                                {/* Audio Voice Note Card */}
                                                {msg.message_type === 'audio' && msg.media_url && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => togglePlayAudio(msg.id || i, msg.media_url)}
                                                            style={{
                                                                width: '36px',
                                                                height: '36px',
                                                                borderRadius: '50%',
                                                                border: 'none',
                                                                background: isMine ? 'white' : 'var(--primary-500)',
                                                                color: isMine ? 'var(--primary-600)' : 'white',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            {playingAudioId === (msg.id || i) ? <Pause size={18} /> : <Play size={18} />}
                                                        </button>
                                                        <div style={{ flex: 1 }}>
                                                            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700 }}>Voice Note</p>
                                                            <div style={{ height: '4px', background: isMine ? 'rgba(255,255,255,0.3)' : 'var(--border)', borderRadius: '2px', marginTop: '4px' }}>
                                                                <div style={{ height: '100%', width: playingAudioId === (msg.id || i) ? '60%' : '0%', background: isMine ? 'white' : 'var(--primary-500)', transition: 'width 0.2s' }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Document File Card */}
                                                {msg.message_type === 'file' && msg.media_url && (
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        padding: '8px 12px',
                                                        borderRadius: 'var(--radius-md)',
                                                        background: isMine ? 'rgba(255,255,255,0.15)' : 'var(--surface)',
                                                        marginBottom: '6px'
                                                    }}>
                                                        <FileText size={24} />
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ margin: 0, fontSize: 'var(--text-xs)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {msg.fileName || 'Attachment Document'}
                                                            </p>
                                                            <span style={{ fontSize: '10px', opacity: 0.8 }}>File Attachment</span>
                                                        </div>
                                                        <a 
                                                            href={msg.media_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            style={{ color: 'inherit', padding: '4px' }}
                                                        >
                                                            <Download size={18} />
                                                        </a>
                                                    </div>
                                                )}

                                                <div style={{
                                                    whiteSpace: 'pre-wrap',
                                                    overflowWrap: 'anywhere',
                                                    wordBreak: 'break-word',
                                                    minWidth: 0,
                                                    lineHeight: 1.45
                                                }}>
                                                    {renderMessageContent(msg.content)}
                                                </div>

                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'flex-end',
                                                    gap: '4px',
                                                    marginTop: '4px',
                                                    fontSize: '9px',
                                                    opacity: isMine ? 0.85 : 0.6
                                                }}>
                                                    {isMine && (() => {
                                                        const peerId = activeRoom.type === 'private' ? activeRoom.members?.find(id => id !== user?.id) : null;
                                                        const isPeerOnline = peerId ? onlineUserIds.includes(peerId) : true;
                                                        return (
                                                            <CheckCheck 
                                                                size={13} 
                                                                style={{ 
                                                                    color: isPeerOnline ? '#38bdf8' : 'rgba(255,255,255,0.7)',
                                                                    marginLeft: '2px'
                                                                }} 
                                                            />
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Emoji Picker Shortcuts Bar */}
                        {showEmojiBar && (
                            <div style={{
                                padding: '6px 12px',
                                background: 'var(--card)',
                                borderTop: '1px solid var(--border)',
                                display: 'flex',
                                gap: '8px',
                                overflowX: 'auto'
                            }}>
                                {emojis.map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => setInputText(prev => prev + emoji)}
                                        style={{
                                            fontSize: '18px',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px'
                                        }}
                                        className="hover:scale-125 transition-transform"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Active Voice Note Recording Overlay Bar */}
                        {isRecording ? (
                            <div style={{
                                padding: '12px 16px',
                                background: 'var(--card)',
                                borderTop: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        background: 'var(--error-500)',
                                        animation: 'pulse 1s infinite'
                                    }} />
                                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--error-500)' }}>
                                        Recording Voice Note ({formatRecordingTimer(recordingTime)})
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <Button variant="ghost" size="sm" onClick={cancelRecording}>Cancel</Button>
                                    <Button variant="primary" size="sm" icon={Send} onClick={stopRecording}>Send Voice Note</Button>
                                </div>
                            </div>
                        ) : (
                            /* Input Controls Bar */
                            <form onSubmit={handleSendMessage} style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                borderTop: '1px solid var(--border)',
                                background: 'var(--card)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-xs)',
                                position: 'relative'
                            }}>
                                {/* Upside Mention Autocomplete Dropdown Popup */}
                                {showMentionPopup && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '100%',
                                        left: '16px',
                                        marginBottom: '8px',
                                        width: '280px',
                                        maxHeight: '230px',
                                        overflowY: 'auto',
                                        background: 'var(--card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-lg)',
                                        boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.4)',
                                        padding: '8px',
                                        zIndex: 1000,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px'
                                    }}>
                                        <div style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                            Mention / Tag Option
                                        </div>
                                        
                                        {/* Zen AI Option */}
                                        <div
                                            onClick={() => handleSelectMention('@Zen')}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                padding: '8px 10px',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                background: 'rgba(168, 85, 247, 0.15)',
                                                border: '1px solid rgba(168, 85, 247, 0.3)'
                                            }}
                                            className="hover:scale-[1.01]"
                                        >
                                            <Sparkles size={16} className="text-accent-400" />
                                            <div>
                                                <span style={{ fontWeight: 800, fontSize: 'var(--text-xs)', color: '#c084fc' }}>Zen AI (@Zen)</span>
                                                <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Summon AI in this chat</p>
                                            </div>
                                        </div>

                                        {/* Everyone Option */}
                                        <div
                                            onClick={() => handleSelectMention('@everyone')}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                padding: '8px 10px',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)'
                                            }}
                                            className="hover:scale-[1.01]"
                                        >
                                            <Users size={16} className="text-error-500" />
                                            <div>
                                                <span style={{ fontWeight: 800, fontSize: 'var(--text-xs)', color: '#f87171' }}>@everyone</span>
                                                <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Tag all members</p>
                                            </div>
                                        </div>

                                        {/* Team Members Options */}
                                        {teamMembers.map(member => (
                                            <div
                                                key={member.id}
                                                onClick={() => handleSelectMention(`@${member.name.split(' ')[0]}`)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    padding: '8px 10px',
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    background: 'var(--surface)'
                                                }}
                                                className="hover:bg-card"
                                            >
                                                <Avatar name={member.name} image={member.avatar_url} size="sm" />
                                                <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)' }}>@{member.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Attach Document"
                                >
                                    <Paperclip size={18} />
                                </Button>

                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => imageInputRef.current?.click()}
                                    title="Attach Photo"
                                >
                                    <ImageIcon size={18} />
                                </Button>

                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => setShowEmojiBar(!showEmojiBar)}
                                    title="Emojis"
                                >
                                    <Smile size={18} />
                                </Button>

                                <div style={{ flex: 1, position: 'relative' }}>
                                    {/* Styled overlay — renders colored @mentions and formatting preview */}
                                    <div style={{
                                        position: 'absolute',
                                        top: 0, left: 0, right: 0, bottom: 0,
                                        padding: '12px 16px',
                                        fontSize: 'var(--text-sm)',
                                        fontWeight: 500,
                                        fontFamily: 'inherit',
                                        pointerEvents: 'none',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        alignItems: 'center',
                                        borderRadius: 'var(--radius-full)',
                                        lineHeight: 'normal'
                                    }}>
                                        {inputText ? renderInputOverlay(inputText) : (
                                            <span style={{ color: 'var(--text-muted)' }}>
                                                {uploadingMedia ? "Encrypting & uploading media..." : "Type an encrypted message or @mention..."}
                                            </span>
                                        )}
                                    </div>
                                    {/* Actual input — transparent text, visible caret */}
                                    <input 
                                        type="text"
                                        value={inputText}
                                        onChange={handleInputChange}
                                        placeholder=""
                                        disabled={uploadingMedia}
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            borderRadius: 'var(--radius-full)',
                                            border: '1px solid var(--border)',
                                            background: 'var(--surface)',
                                            color: 'transparent',
                                            caretColor: 'var(--text)',
                                            fontSize: 'var(--text-sm)',
                                            fontWeight: 500,
                                            fontFamily: 'inherit',
                                            outline: 'none',
                                            lineHeight: 'normal'
                                        }}
                                    />
                                </div>

                                {inputText.trim() ? (
                                    <Button 
                                        type="submit" 
                                        variant="primary" 
                                        size="icon"
                                        style={{ borderRadius: '50%', width: '42px', height: '42px' }}
                                    >
                                        <Send size={18} />
                                    </Button>
                                ) : (
                                    <Button 
                                        type="button" 
                                        variant="primary" 
                                        size="icon"
                                        onClick={startRecording}
                                        title="Hold to Record Voice Note"
                                        style={{ borderRadius: '50%', width: '42px', height: '42px' }}
                                    >
                                        <Mic size={18} />
                                    </Button>
                                )}
                            </form>
                        )}
                    </>
                ) : (
                    <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        <MessageSquare size={54} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <h3 style={{ margin: 0, fontWeight: 800 }}>Zenith WhatsApp Replica Chat</h3>
                        <p style={{ marginTop: '8px', fontSize: 'var(--text-sm)', maxWidth: '320px' }}>
                            Select a contact or group from the left sidebar to start end-to-end encrypted messaging.
                        </p>
                    </div>
                )}
            </div>

            {/* Lightbox Image Preview Modal */}
            {previewImage && (
                <div 
                    onClick={() => setPreviewImage(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 100000,
                        background: 'rgba(0, 0, 0, 0.88)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem'
                    }}
                >
                    <button
                        onClick={() => setPreviewImage(null)}
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            background: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            padding: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        <X size={24} style={{ color: 'black' }} />
                    </button>
                    <img 
                        src={previewImage} 
                        alt="Enlarged" 
                        style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} 
                    />
                </div>
            )}

            {/* Encryption Key Verification Modal */}
            {showVerifyKeyModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 100000,
                    background: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--space-md)'
                }}>
                    <Card style={{ width: '100%', maxWidth: '460px', padding: 'var(--space-xl)', textAlign: 'center' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--success-500), var(--primary-500))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            margin: '0 auto 1rem',
                            boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)'
                        }}>
                            <ShieldCheck size={32} />
                        </div>

                        <h3 style={{ margin: 0, fontWeight: 800, fontSize: 'var(--text-lg)' }}>End-to-End Encryption Verified</h3>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '6px 0 1.5rem' }}>
                            Messages and attachments sent in this chat are secured with 256-bit AES-GCM and ECDH P-256 Elliptic Curve key exchange.
                        </p>

                        <div style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-md)',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-sm)',
                            marginBottom: '1.5rem'
                        }}>
                            <div>
                                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Your Security Fingerprint</span>
                                <p style={{ margin: '2px 0 0', fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: 'var(--primary-400)' }}>
                                    {myFingerprint || '4F8E - 9A1B - C3D4 - E5F6'}
                                </p>
                            </div>

                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-xs)' }}>
                                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recipient Security Fingerprint</span>
                                <p style={{ margin: '2px 0 0', fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: 'var(--success-500)' }}>
                                    {peerFingerprint || '7B2A - E89F - 1C4D - 8032'}
                                </p>
                            </div>
                        </div>

                        <Button 
                            variant="primary" 
                            onClick={() => setShowVerifyKeyModal(false)} 
                            style={{ width: '100%', borderRadius: 'var(--radius-full)' }}
                        >
                            <CheckCircle size={16} /> Encryption Verified
                        </Button>
                    </Card>
                </div>
            )}
        </div>
    );
}
