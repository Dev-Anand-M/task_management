/**
 * Ultra-Reliable Text-To-Speech (TTS) Service
 * Handles speech synthesis across Web Browsers, Android WebViews, iOS WebViews, and Mobile Native environments.
 */

let cachedVoices = [];

// Warm up system voices as soon as available
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const loadVoices = () => {
        try {
            cachedVoices = window.speechSynthesis.getVoices() || [];
        } catch {
            cachedVoices = [];
        }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
}

export const ttsService = {
    /**
     * Stop all active speech synthesis
     */
    stop() {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel();
            } catch (err) {
                console.warn('[TTS] Cancel error:', err);
            }
        }
    },

    /**
     * Speak given text aloud using the best available voice with safe fallback recovery
     */
    speak(text, options = {}) {
        if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) {
            return false;
        }

        try {
            // Cancel any ongoing or stuck speech
            window.speechSynthesis.cancel();

            // Resume if synthesis is in a paused state
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }

            // Strip Markdown formatting tags (e.g., **, *, `, #) for clean speech
            const cleanText = text
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\*(.*?)\*/g, '$1')
                .replace(/`(.*?)`/g, '$1')
                .replace(/#(.*?)\n/g, '$1 ')
                .replace(/\[(.*?)\]\(.*?\)/g, '$1')
                .trim();

            if (!cleanText) return false;

            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.pitch = options.pitch ?? 0.95;
            utterance.rate = options.rate ?? 1.0;
            utterance.volume = options.volume ?? 1.0;

            // Voice selection logic: pick best English voice
            const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
            if (voices && voices.length > 0) {
                const englishVoice = voices.find(v => v.lang && v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Alex'))) 
                    || voices.find(v => v.lang && v.lang.startsWith('en'))
                    || voices[0];
                
                if (englishVoice) {
                    utterance.voice = englishVoice;
                }
            }

            utterance.onerror = (e) => {
                console.warn('[TTS] Utterance error event:', e);
            };

            // Speak utterance
            window.speechSynthesis.speak(utterance);
            return true;
        } catch (err) {
            console.error('[TTS] Speak failed:', err);
            return false;
        }
    }
};

export default ttsService;
