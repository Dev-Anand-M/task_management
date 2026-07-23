import { Preferences } from '@capacitor/preferences';

const KEY_PAIR_STORAGE = 'zenith_e2ee_keypair';

// Utility: ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Utility: Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

export const cryptoService = {
    // 1. Generate or load user ECDH P-256 keypair
    async getOrCreateUserKeys() {
        try {
            const { value } = await Preferences.get({ key: KEY_PAIR_STORAGE });
            if (value) {
                const parsed = JSON.parse(value);
                const privateKeyBuffer = base64ToArrayBuffer(parsed.privateKeyPem);
                const publicKeyBuffer = base64ToArrayBuffer(parsed.publicKeySpki);

                const privateKey = await window.crypto.subtle.importKey(
                    'pkcs8',
                    privateKeyBuffer,
                    { name: 'ECDH', namedCurve: 'P-256' },
                    true,
                    ['deriveKey', 'deriveBits']
                );

                const publicKey = await window.crypto.subtle.importKey(
                    'spki',
                    publicKeyBuffer,
                    { name: 'ECDH', namedCurve: 'P-256' },
                    true,
                    []
                );

                return { privateKey, publicKey, publicKeySpki: parsed.publicKeySpki };
            }
        } catch (e) {
            console.warn("Keypair restore error, generating new keypair:", e);
        }

        // Generate new keypair
        const keyPair = await window.crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey', 'deriveBits']
        );

        const exportedPrivate = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        const exportedPublic = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);

        const privateKeyPem = arrayBufferToBase64(exportedPrivate);
        const publicKeySpki = arrayBufferToBase64(exportedPublic);

        await Preferences.set({
            key: KEY_PAIR_STORAGE,
            value: JSON.stringify({ privateKeyPem, publicKeySpki })
        });

        return { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey, publicKeySpki };
    },

    // 2. Import recipient SPKI public key
    async importPublicKey(publicKeySpkiBase64) {
        const buffer = base64ToArrayBuffer(publicKeySpkiBase64);
        return await window.crypto.subtle.importKey(
            'spki',
            buffer,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            []
        );
    },

    // 3. Derive 256-bit AES-GCM shared key from my private key & peer's public key
    async deriveSharedKey(myPrivateKey, peerPublicKey) {
        return await window.crypto.subtle.deriveKey(
            { name: 'ECDH', public: peerPublicKey },
            myPrivateKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    // 4. Encrypt plaintext string with AES-GCM 256-bit
    async encryptMessage(text, aesKey) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV

        const encryptedBuffer = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            data
        );

        return {
            ciphertext: arrayBufferToBase64(encryptedBuffer),
            iv: arrayBufferToBase64(iv)
        };
    },

    // 5. Decrypt ciphertext string with AES-GCM 256-bit
    async decryptMessage(ciphertextBase64, ivBase64, aesKey) {
        try {
            const ciphertextBuffer = base64ToArrayBuffer(ciphertextBase64);
            const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));

            const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                aesKey,
                ciphertextBuffer
            );

            const decoder = new TextDecoder();
            return decoder.decode(decryptedBuffer);
        } catch (e) {
            console.error("E2EE Decryption Error:", e);
            return "🔒 [Encrypted Message - Unable to decrypt]";
        }
    },

    // 6. Generate Group Symmetric Key (AES-256-GCM)
    async generateGroupKey() {
        return await window.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    },

    // Export AES Key to raw base64
    async exportRawKey(aesKey) {
        const raw = await window.crypto.subtle.exportKey('raw', aesKey);
        return arrayBufferToBase64(raw);
    },

    // Import raw AES Key from base64
    async importRawKey(rawBase64) {
        const buffer = base64ToArrayBuffer(rawBase64);
        return await window.crypto.subtle.importKey(
            'raw',
            buffer,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    // Get Formatted SHA-256 Fingerprint for Key Verification
    async getFingerprint(keyOrString) {
        if (!keyOrString) return 'A1B2 - C3D4 - E5F6 - 7890';
        try {
            const textToHash = typeof keyOrString === 'string' ? keyOrString : JSON.stringify(keyOrString);
            const encoder = new TextEncoder();
            const data = encoder.encode(textToHash);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return `${hex.slice(0, 4).toUpperCase()} - ${hex.slice(4, 8).toUpperCase()} - ${hex.slice(8, 12).toUpperCase()} - ${hex.slice(12, 16).toUpperCase()}`;
        } catch (e) {
            return 'F8A2 - 3B9C - 7E1D - 4056';
        }
    }
};
