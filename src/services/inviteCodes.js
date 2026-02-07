// Invite Code Management Service (Supabase)
import * as db from './database';

// Helper to generate code
const generateCodeStr = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const validateInviteCode = async (code) => {
    try {
        const result = await db.validateInviteCode(code);
        // Ensure we return the object if valid, or false if not
        return result || false;
    } catch (error) {
        console.error('Error validating invite code:', error);
        return false;
    }
};

export const useInviteCode = async (code, userId) => {
    try {
        await db.useInviteCode(code, userId);
        return { valid: true, message: 'Invite code accepted' };
    } catch (error) {
        return { valid: false, message: error.message || 'Error using invite code' };
    }
};

export const createInviteCode = async (customCode = null, classroomId = null) => {
    try {
        const codeToCheck = customCode || generateCodeStr();
        return await db.createInviteCode(codeToCheck, classroomId);
    } catch (error) {
        throw error;
    }
};

export const getInviteCodes = async () => {
    try {
        return await db.getInviteCodes();
    } catch (error) {
        console.error('Error getting invite codes:', error);
        return [];
    }
};

export const deleteInviteCode = async (id) => {
    try {
        return await db.deleteInviteCode(id);
    } catch (error) {
        console.error('Error deleting invite code:', error);
        return false;
    }
};
