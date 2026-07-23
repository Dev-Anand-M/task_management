import { supabase } from '../lib/supabase';
import { cryptoService } from './cryptoService';
import * as db from './database';

const LOCAL_CHAT_ROOMS = 'zenith_local_chat_rooms';
const LOCAL_CHAT_MESSAGES = 'zenith_local_chat_messages';
const LOCAL_USER_KEYS = 'zenith_local_user_keys';

export const chatService = {
    // 1. Initialize user public key & register to DB
    async initUserCrypto(userId) {
        if (!userId) return null;
        const keys = await cryptoService.getOrCreateUserKeys();
        
        try {
            // Upsert public key to Supabase
            await supabase
                .from('user_crypto_keys')
                .upsert({
                    user_id: userId,
                    public_key: keys.publicKeySpki,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
        } catch (e) {
            console.warn("Supabase user_crypto_keys sync fallback to localStorage:", e.message);
        }

        // Cache locally for instant lookup
        let localKeys = {};
        try {
            const stored = localStorage.getItem(LOCAL_USER_KEYS);
            if (stored) localKeys = JSON.parse(stored);
        } catch (err) {}
        localKeys[userId] = keys.publicKeySpki;
        localStorage.setItem(LOCAL_USER_KEYS, JSON.stringify(localKeys));

        return keys;
    },

    // 2. Fetch peer public key
    async getPeerPublicKey(peerId) {
        if (!peerId) return null;
        try {
            const { data } = await supabase
                .from('user_public_keys')
                .select('public_key_spki')
                .eq('user_id', peerId)
                .single();

            if (data?.public_key_spki) {
                return await cryptoService.importPublicKey(data.public_key_spki);
            }
        } catch (e) {}
        return null;
    },

    // 3. Get or Create Private Chat Room
    async getOrCreatePrivateRoom(currentUserId, peerId, peerName = 'Team Member') {
        const roomId = [currentUserId, peerId].sort().join('_room_');

        let room = null;
        try {
            const { data } = await supabase
                .from('chat_rooms')
                .select('*')
                .eq('id', roomId)
                .single();
            if (data) room = data;
        } catch (e) {}

        if (!room) {
            room = {
                id: roomId,
                type: 'private',
                name: peerName,
                members: [currentUserId, peerId],
                created_at: new Date().toISOString(),
                last_message_at: new Date().toISOString()
            };

            try {
                await supabase.from('chat_rooms').upsert(room);
            } catch (e) {}
        }

        let rooms = this.getLocalRooms();
        if (!rooms.some(r => r.id === room.id)) {
            rooms.unshift(room);
            localStorage.setItem(LOCAL_CHAT_ROOMS, JSON.stringify(rooms));
        }

        return room;
    },

    // 4. Get or Create Classroom Chat Room
    async getOrCreateClassroomRoom(currentUserId, classroomId = 'main_classroom', classroomName = 'Classroom Chat') {
        const roomId = `classroom_${classroomId}`;

        let room = null;
        try {
            const { data } = await supabase
                .from('chat_rooms')
                .select('*')
                .eq('id', roomId)
                .single();
            if (data) room = data;
        } catch (e) {}

        if (!room) {
            room = {
                id: roomId,
                type: 'classroom',
                name: classroomName,
                avatar_url: '',
                members: [],
                created_by: currentUserId,
                created_at: new Date().toISOString(),
                last_message_at: new Date().toISOString()
            };

            try {
                await supabase.from('chat_rooms').upsert(room);
            } catch (e) {}
        }

        let rooms = this.getLocalRooms();
        if (!rooms.some(r => r.id === room.id)) {
            rooms.unshift(room);
            localStorage.setItem(LOCAL_CHAT_ROOMS, JSON.stringify(rooms));
        }

        return room;
    },

    // 4. Create Group Chat Room
    async createGroupRoom(currentUserId, groupName, memberIds, avatarUrl = '') {
        const roomId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const allMembers = Array.from(new Set([currentUserId, ...memberIds]));

        const room = {
            id: roomId,
            type: 'group',
            name: groupName,
            avatar_url: avatarUrl,
            members: allMembers,
            created_by: currentUserId,
            created_at: new Date().toISOString(),
            last_message_at: new Date().toISOString()
        };

        try {
            await supabase.from('chat_rooms').insert(room);
            
            // Insert member records
            const memberRecords = allMembers.map(uid => ({
                room_id: roomId,
                user_id: uid,
                role: uid === currentUserId ? 'admin' : 'member'
            }));
            await supabase.from('chat_members').insert(memberRecords);
        } catch (e) {
            console.warn("Group room creation Supabase fallback:", e.message);
        }

        let rooms = this.getLocalRooms();
        rooms.unshift(room);
        localStorage.setItem(LOCAL_CHAT_ROOMS, JSON.stringify(rooms));

        return room;
    },

    // 5. Fetch all rooms for current user
    async fetchUserRooms(currentUserId) {
        let rooms = [];
        try {
            const { data } = await supabase
                .from('chat_rooms')
                .select('*')
                .order('last_message_at', { ascending: false });

            if (data && data.length > 0) {
                rooms = data.filter(r => !r.members || r.members.length === 0 || r.members.includes(currentUserId));
            }
        } catch (e) {}

        const localRooms = this.getLocalRooms().filter(r => !r.members || r.members.length === 0 || r.members.includes(currentUserId));
        
        // Merge & deduplicate by ID
        const roomMap = new Map();
        localRooms.forEach(r => roomMap.set(r.id, r));
        rooms.forEach(r => roomMap.set(r.id, r));

        // Cross-reference: if a room has no local messages, blank out last_message
        const localMsgs = this.getLocalMessages();
        const merged = Array.from(roomMap.values()).map(room => {
            const roomMsgs = localMsgs.filter(m => m.room_id === room.id);
            if (roomMsgs.length === 0 && room.last_message) {
                return { ...room, last_message: '' };
            }
            return room;
        });

        return merged.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
    },

    // 6. Send Encrypted Message
    async sendMessage({ roomId, senderId, senderName, receiverId, content, messageType = 'text', mediaUrl = '' }) {
        const myKeys = await cryptoService.getOrCreateUserKeys();
        
        let ciphertext = content;
        let iv = '';

        // E2EE Encryption for 1-on-1 private chat
        if (receiverId) {
            const peerPublicKey = await this.getPeerPublicKey(receiverId);
            if (peerPublicKey) {
                const sharedKey = await cryptoService.deriveSharedKey(myKeys.privateKey, peerPublicKey);
                const encrypted = await cryptoService.encryptMessage(content, sharedKey);
                ciphertext = encrypted.ciphertext;
                iv = encrypted.iv;
            }
        }

        const msgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            room_id: roomId,
            sender_id: senderId,
            sender_name: senderName,
            encrypted_content: ciphertext,
            iv: iv,
            plaintext_fallback: content,
            content: content,
            message_type: messageType,
            media_url: mediaUrl,
            created_at: new Date().toISOString()
        };

        // Broadcast via Supabase Realtime Channel for 100% instant delivery on all devices
        try {
            const bChannel = this.getGlobalBroadcastChannel();
            bChannel.send({
                type: 'broadcast',
                event: 'new_message',
                payload: msgObj
            });
        } catch (e) {
            console.warn("Realtime broadcast error:", e);
        }

        // Try Supabase insert
        try {
            await supabase.from('chat_messages').insert({
                id: msgObj.id,
                room_id: msgObj.room_id,
                sender_id: msgObj.sender_id,
                sender_name: msgObj.sender_name,
                encrypted_content: msgObj.encrypted_content,
                iv: msgObj.iv,
                message_type: msgObj.message_type,
                media_url: msgObj.media_url,
                created_at: msgObj.created_at
            });

            // Update room last_message_at
            await supabase.from('chat_rooms').update({
                last_message_at: msgObj.created_at
            }).eq('id', roomId);
        } catch (e) {
            console.warn("Supabase message insert fallback to local:", e.message);
        }

        // Save to Local Messages Cache
        const allMsgs = this.getLocalMessages();
        allMsgs.push(msgObj);
        localStorage.setItem(LOCAL_CHAT_MESSAGES, JSON.stringify(allMsgs));

        // Update local room timestamp
        const rooms = this.getLocalRooms();
        const roomIdx = rooms.findIndex(r => r.id === roomId);
        if (roomIdx !== -1) {
            rooms[roomIdx].last_message_at = msgObj.created_at;
            rooms[roomIdx].last_message = content;
            localStorage.setItem(LOCAL_CHAT_ROOMS, JSON.stringify(rooms));
        }

        return msgObj;
    },

    // 7. Fetch and Decrypt Messages for Room
    async fetchRoomMessages(roomId, currentUserId, peerId) {
        let rawMessages = [];
        try {
            const { data } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('room_id', roomId)
                .order('created_at', { ascending: true });

            if (data && data.length > 0) {
                rawMessages = data;
            }
        } catch (e) {}

        const localMsgs = this.getLocalMessages().filter(m => m.room_id === roomId);
        
        // Deduplicate local + DB messages by ID
        const msgMap = new Map();
        localMsgs.forEach(m => msgMap.set(m.id, m));
        rawMessages.forEach(m => {
            const existing = msgMap.get(m.id);
            msgMap.set(m.id, { ...existing, ...m });
        });

        const combinedMessages = Array.from(msgMap.values()).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const myKeys = await cryptoService.getOrCreateUserKeys();
        let sharedKey = null;

        if (peerId) {
            const peerPublicKey = await this.getPeerPublicKey(peerId);
            if (peerPublicKey) {
                sharedKey = await cryptoService.deriveSharedKey(myKeys.privateKey, peerPublicKey);
            }
        }

        // Decrypt each message payload
        const decryptedMessages = await Promise.all(combinedMessages.map(async (msg) => {
            if (msg.plaintext_fallback && msg.sender_id === currentUserId) {
                return { ...msg, content: msg.plaintext_fallback };
            }

            if (msg.encrypted_content && msg.iv && sharedKey) {
                try {
                    const plaintext = await cryptoService.decryptMessage(msg.encrypted_content, msg.iv, sharedKey);
                    if (plaintext) return { ...msg, content: plaintext };
                } catch (e) {}
            }

            return { ...msg, content: msg.content || msg.plaintext_fallback || msg.encrypted_content || "🔒 Encrypted Message" };
        }));

        return decryptedMessages;
    },

    // 8. Upload Media File to Supabase Storage or Base64 Data URI
    async uploadMedia(file) {
        if (!file) return null;

        try {
            const fileExt = file.name ? file.name.split('.').pop() : 'png';
            const fileName = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
            const filePath = `attachments/${fileName}`;

            const { data, error } = await supabase.storage
                .from('chat-attachments')
                .upload(filePath, file);

            if (!error && data) {
                const { data: urlData } = supabase.storage
                    .from('chat-attachments')
                    .getPublicUrl(filePath);

                if (urlData?.publicUrl) {
                    return {
                        url: urlData.publicUrl,
                        fileName: file.name || fileName,
                        fileSize: file.size,
                        mimeType: file.type
                    };
                }
            }
        } catch (e) {
            console.warn("Supabase storage upload fallback to Base64:", e.message);
        }

        // Fallback: Convert File to Base64 Data URI
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    url: e.target.result,
                    fileName: file.name || 'file',
                    fileSize: file.size,
                    mimeType: file.type
                });
            };
            reader.readAsDataURL(file);
        });
    },

    // 9. Clear Room Local Messages & Reset Last Message Snippet
    async clearRoomMessages(roomId) {
        try {
            await supabase.from('chat_messages').delete().eq('room_id', roomId);
            await supabase.from('chat_rooms').update({
                last_message: '',
                last_message_at: new Date().toISOString()
            }).eq('id', roomId);
        } catch (e) {}

        const allMsgs = this.getLocalMessages().filter(m => m.room_id !== roomId);
        localStorage.setItem(LOCAL_CHAT_MESSAGES, JSON.stringify(allMsgs));

        const rooms = this.getLocalRooms();
        const rIdx = rooms.findIndex(r => r.id === roomId);
        if (rIdx !== -1) {
            rooms[rIdx].last_message = '';
            localStorage.setItem(LOCAL_CHAT_ROOMS, JSON.stringify(rooms));
        }
    },

    // 10. Track User Online Presence
    trackUserPresence(userId, onPresenceChange) {
        if (!userId) return null;

        const channel = supabase.channel('online-presence', {
            config: { presence: { key: userId } }
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const onlineUserIds = Object.keys(state);
                onPresenceChange(onlineUserIds);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ online_at: new Date().toISOString() });
                }
            });

        return channel;
    },

    // Helper: Local Rooms storage
    getLocalRooms() {
        try {
            const stored = localStorage.getItem(LOCAL_CHAT_ROOMS);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    },

    // Helper: Local Messages storage
    getLocalMessages() {
        try {
            const stored = localStorage.getItem(LOCAL_CHAT_MESSAGES);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }
};
