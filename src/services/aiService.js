// AI Service supporting multiple providers (Gemini, OpenAI, Anthropic, Perplexity)

import { supabase } from '../lib/supabase';
import { getKnowledgeBase } from './database';
import { PlatformService } from './infrastructure/PlatformService';

// In-memory cache for decrypted API keys to prevent local storage exposure
let decryptedKeysCache = {};

export const PROVIDERS = {
    GEMINI: { id: 'gemini', name: 'Google Gemini', icon: '✨', keyName: 'gemini_api_key', url: 'https://makersuite.google.com/app/apikey' },
    OPENAI: { id: 'openai', name: 'OpenAI', icon: '🧠', keyName: 'openai_api_key', url: 'https://platform.openai.com/api-keys' },
    ANTHROPIC: { id: 'anthropic', name: 'Anthropic Claude', icon: '🤖', keyName: 'anthropic_api_key', url: 'https://console.anthropic.com/settings/keys' },
    PERPLEXITY: { id: 'perplexity', name: 'Perplexity', icon: '🔍', keyName: 'perplexity_api_key', url: 'https://www.perplexity.ai/settings/api' },
    SAMBANOVA: { id: 'sambanova', name: 'SambaNova', icon: '⚡', keyName: 'sambanova_api_key', url: 'https://cloud.sambanova.ai/' },
    GROQ: { id: 'groq', name: 'Groq', icon: '⚡', keyName: 'groq_api_key', url: 'https://console.groq.com/keys' },
    HCNSEC: { id: 'hcnsec', name: 'Hcnsec API', icon: '🛡️', keyName: 'hcnsec_api_key', url: 'https://api.hcnsec.cn' }
};

// Available Models mapped to providers
export const AVAILABLE_MODELS = [
    // SambaNova Models (Default Provider)
    { id: 'Meta-Llama-3.3-70B-Instruct', provider: 'sambanova', name: 'Llama 3.3 70B (Default)', description: 'Latest Meta model - Fast and powerful', inputTokenLimit: '128k', outputTokenLimit: '4k' },
    { id: 'DeepSeek-V3.2', provider: 'sambanova', name: 'DeepSeek V3.2 (SambaNova)', description: 'Powerful reasoning model', inputTokenLimit: '128k', outputTokenLimit: '4k' },
    { id: 'gemma-3-12b-it', provider: 'sambanova', name: 'Gemma 3 12B (SambaNova)', description: 'Google latest open model', inputTokenLimit: '128k', outputTokenLimit: '4k' },
    
    // Groq Models (Ultra Fast)
    { id: 'llama-3.3-70b-versatile', provider: 'groq', name: 'Llama 3.3 70B (Groq)', description: 'Ultra-fast inference', inputTokenLimit: '128k', outputTokenLimit: '32k' },
    { id: 'llama-3.1-8b-instant', provider: 'groq', name: 'Llama 3.1 8B Instant', description: 'Lightning fast responses', inputTokenLimit: '128k', outputTokenLimit: '8k' },
    { id: 'mixtral-8x7b-32768', provider: 'groq', name: 'Mixtral 8x7B', description: 'Fast mixture of experts', inputTokenLimit: '32k', outputTokenLimit: '32k' },
    
    // Hcnsec API Models
    { id: 'gpt-4o-mini', provider: 'hcnsec', name: 'GPT-4o Mini (Hcnsec)', description: 'Fast, cheap, and smart OpenAI model', inputTokenLimit: '128k', outputTokenLimit: '4k' },
    { id: 'claude-3-5-sonnet', provider: 'hcnsec', name: 'Claude 3.5 Sonnet (Hcnsec)', description: 'Anthropic flagship model via Hcnsec', inputTokenLimit: '200k', outputTokenLimit: '4k' },
    { id: 'gemini-1.5-flash', provider: 'hcnsec', name: 'Gemini 1.5 Flash (Hcnsec)', description: 'Google Flash model via Hcnsec', inputTokenLimit: '1M', outputTokenLimit: '8k' },

    // Other Providers
    { id: 'gemini-1.5-flash', provider: 'gemini', name: 'Gemini 1.5 Flash', description: 'Stable and fast for everyone', inputTokenLimit: '1M', outputTokenLimit: '8k' },
    { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', description: 'Auto-calibrated for OpenAI', inputTokenLimit: '128k', outputTokenLimit: '4k' },
    { id: 'claude-3-5-sonnet-20240620', provider: 'anthropic', name: 'Claude 3.5 Sonnet', description: 'Auto-calibrated for Anthropic', inputTokenLimit: '200k', outputTokenLimit: '4k' },
    { id: 'llama-3.1-sonar-large-128k-online', provider: 'perplexity', name: 'Sonar Large 3.1', description: 'Auto-calibrated for Perplexity', inputTokenLimit: '128k', outputTokenLimit: '4k' }
];

// Helper to get active user ID from Supabase local storage session synchronously
const getActiveUserId = () => {
    try {
        const sessionData = JSON.parse(localStorage.getItem('zenith-auth-v3'));
        return sessionData?.user?.id || '';
    } catch {
        return '';
    }
};

// Helper to get prefixed key name for localStorage
const getStorageKeyName = (keyName) => {
    const userId = getActiveUserId();
    return userId ? `${userId}_${keyName}` : `anon_${keyName}`;
};

// Simple encryption for API key (XOR with user ID for obfuscation)
const encryptKey = (key, salt) => {
    if (!key) return '';
    const saltChars = salt.split('');
    let encrypted = '';
    for (let i = 0; i < key.length; i++) {
        encrypted += String.fromCharCode(key.charCodeAt(i) ^ saltChars[i % saltChars.length].charCodeAt(0));
    }
    return btoa(encrypted);
};

const decryptKey = (encryptedKey, salt) => {
    try {
        const decoded = atob(encryptedKey);
        const saltChars = salt.split('');
        let decrypted = '';
        for (let i = 0; i < decoded.length; i++) {
            decrypted += String.fromCharCode(decoded.charCodeAt(i) ^ saltChars[i % saltChars.length].charCodeAt(0));
        }
        return decrypted;
    } catch {
        return '';
    }
};

// Check if API key is configured for a specific provider
export const isAPIKeyConfigured = (providerId = 'sambanova') => {
    const provider = Object.values(PROVIDERS).find(p => p.id === providerId);
    return provider ? !!decryptedKeysCache[provider.keyName] : false;
};

// Check if ANY API key is configured
export const isAnyAPIKeyConfigured = () => {
    return Object.values(PROVIDERS).some(p => !!decryptedKeysCache[p.keyName]);
};

// Fetch available models (Legacy wrapper or generic fetcher)
export const fetchAvailableModels = async (apiKey) => {
    try {
        // If generic key is passed and it matches a stored key, use that provider
        const provider = Object.values(PROVIDERS).find(p => decryptedKeysCache[p.keyName] === apiKey);
        if (provider) {
            const validation = await validateAPIKey(provider.id, apiKey);
            return validation.models || [];
        }

        // Fallback: try SambaNova
        return (await validateAPIKey('sambanova', apiKey)).models || [];
    } catch (e) {
        return [];
    }
};

// Get API key for provider
export const getAPIKey = (providerId) => {
    const provider = Object.values(PROVIDERS).find(p => p.id === providerId);
    return provider ? decryptedKeysCache[provider.keyName] || '' : '';
};

// Get usage stats
export const getUsageStats = () => {
    const stats = localStorage.getItem(getStorageKeyName('ai_usage_stats'));
    const today = new Date().toISOString().split('T')[0];

    if (stats) {
        const parsed = JSON.parse(stats);
        if (parsed.lastDate !== today) {
            parsed.requestsToday = 0;
            // Reset per-provider today stats too
            if (parsed.providers) {
                Object.keys(parsed.providers).forEach(pid => {
                    parsed.providers[pid].requestsToday = 0;
                });
            }
            parsed.lastDate = today;
            localStorage.setItem(getStorageKeyName('ai_usage_stats'), JSON.stringify(parsed));
        }
        return parsed;
    }
    return { requestsToday: 0, totalRequests: 0, lastDate: today };
};

// Sync settings to database
export const syncToDatabase = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Collect all keys from in-memory cache
        const keys = {};
        Object.values(PROVIDERS).forEach(p => {
            const key = decryptedKeysCache[p.keyName];
            if (key) keys[p.keyName] = encryptKey(key, user.id);
        });

        const model = localStorage.getItem(getStorageKeyName('selected_ai_model'));
        const usage = getUsageStats();
        const priority = getProviderPriority();
        const defaultProvider = localStorage.getItem(getStorageKeyName('ai_default_provider'));

        const aiSettings = {
            keys: keys,
            selected_model: model,
            usage: usage,
            provider_priority: priority,
            default_provider: defaultProvider
        };

        await supabase
            .from('profiles')
            .update({ ai_settings: aiSettings })
            .eq('id', user.id);
    } catch (error) {
        console.error('Failed to sync AI settings:', error);
    }
};

// Save API key
export const saveAPIKey = async (providerId, key) => {
    const provider = Object.values(PROVIDERS).find(p => p.id === providerId);
    if (provider) {
        decryptedKeysCache[provider.keyName] = key;
        await syncToDatabase();
    }
};

// Remove API key
export const removeAPIKey = async (providerId) => {
    const provider = Object.values(PROVIDERS).find(p => p.id === providerId);
    if (provider) {
        delete decryptedKeysCache[provider.keyName];
        await syncToDatabase();
    }
};

// Get selected model with smart fallback
export const getSelectedModel = () => {
    // 1. Check for manual selection first
    const manualSelection = localStorage.getItem(getStorageKeyName('selected_ai_model'));
    if (manualSelection) {
        const manualModel = AVAILABLE_MODELS.find(m => m.id === manualSelection);
        
        // Check if the model's provider has a key
        if (manualModel && getAPIKey(manualModel.provider)) {
            return manualSelection;
        }
    }

    // 2. Use priority order if set
    const priorityOrder = getProviderPriority();
    for (const providerId of priorityOrder) {
        if (getAPIKey(providerId)) {
            const model = AVAILABLE_MODELS.find(m => m.provider === providerId);
            if (model) {
                localStorage.setItem(getStorageKeyName('selected_ai_model'), model.id);
                return model.id;
            }
        }
    }

    // 3. Fallback to any configured provider
    if (getAPIKey('sambanova')) return 'Meta-Llama-3.3-70B-Instruct';
    if (getAPIKey('groq')) return 'llama-3.3-70b-versatile';
    if (getAPIKey('gemini')) return 'gemini-1.5-flash';
    if (getAPIKey('hcnsec')) return 'gpt-4o-mini';
    if (getAPIKey('openai')) return 'gpt-4o';
    if (getAPIKey('anthropic')) return 'claude-3-5-sonnet-20240620';
    if (getAPIKey('perplexity')) return 'llama-3.1-sonar-large-128k-online';

    // Default Fallback
    return 'Meta-Llama-3.3-70B-Instruct';
};

// Get provider priority order
export const getProviderPriority = () => {
    const saved = localStorage.getItem(getStorageKeyName('ai_provider_priority'));
    const defaultPriority = ['sambanova', 'groq', 'gemini', 'hcnsec', 'openai', 'anthropic', 'perplexity'];
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                // Self-healing migration to append newly added providers
                defaultPriority.forEach(p => {
                    if (!parsed.includes(p)) parsed.push(p);
                });
                return parsed;
            }
        } catch {
            return defaultPriority;
        }
    }
    // Default priority
    return defaultPriority;
};

// Set provider priority order
export const setProviderPriority = async (priorityArray) => {
    localStorage.setItem(getStorageKeyName('ai_provider_priority'), JSON.stringify(priorityArray));
    await syncToDatabase();
};

// Get default provider
export const getDefaultProvider = () => {
    const saved = localStorage.getItem(getStorageKeyName('ai_default_provider'));
    if (saved && getAPIKey(saved)) {
        return saved;
    }
    // Use first in priority order that has a key
    const priority = getProviderPriority();
    for (const providerId of priority) {
        if (getAPIKey(providerId)) {
            return providerId;
        }
    }
    return 'sambanova';
};

// Set default provider
export const setDefaultProvider = async (providerId) => {
    localStorage.setItem(getStorageKeyName('ai_default_provider'), providerId);
    // Also update selected model to match default provider
    const model = AVAILABLE_MODELS.find(m => m.provider === providerId);
    if (model) {
        await setSelectedModel(model.id);
    }
    await syncToDatabase();
};

// Set selected model
export const setSelectedModel = async (modelId) => {
    localStorage.setItem(getStorageKeyName('selected_ai_model'), modelId);
    await syncToDatabase();
};

// Helper: Get provider for a model
const getProviderForModel = (modelId) => {
    const model = AVAILABLE_MODELS.find(m => m.id === modelId);
    return model ? PROVIDERS[model.provider.toUpperCase()] : PROVIDERS.SAMBANOVA;
};

// Increment usage
export const incrementUsage = async (providerId = 'sambanova') => {
    const stats = getUsageStats();
    
    // Global stats
    stats.requestsToday += 1;
    stats.totalRequests += 1;
    stats.lastDate = new Date().toISOString().split('T')[0];
    
    // Per-provider stats
    if (!stats.providers) stats.providers = {};
    if (!stats.providers[providerId]) {
        stats.providers[providerId] = { requestsToday: 0, totalRequests: 0 };
    }
    stats.providers[providerId].requestsToday += 1;
    stats.providers[providerId].totalRequests += 1;

    localStorage.setItem(getStorageKeyName('ai_usage_stats'), JSON.stringify(stats));
    await syncToDatabase();
};

// Load settings from database
export const loadFromDatabase = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { data: profile } = await supabase
            .from('profiles')
            .select('ai_settings')
            .eq('id', user.id)
            .single();

        if (profile?.ai_settings) {
            const settings = profile.ai_settings;

            // Clear cache first
            decryptedKeysCache = {};

            // Handle new keys structure
            if (settings.keys) {
                Object.values(PROVIDERS).forEach(p => {
                    const encrypted = settings.keys[p.keyName];
                    if (encrypted) {
                        const decrypted = decryptKey(encrypted, user.id);
                        if (decrypted) decryptedKeysCache[p.keyName] = decrypted;
                    }
                });
            }
            // Handle legacy structure
            else if (settings.encrypted_api_key) {
                const decrypted = decryptKey(settings.encrypted_api_key, user.id);
                if (decrypted) decryptedKeysCache['gemini_api_key'] = decrypted;
            }

            // Security Cleanup: Remove any old plain-text API keys from localStorage
            Object.values(PROVIDERS).forEach(p => {
                localStorage.removeItem(getStorageKeyName(p.keyName));
            });

            if (settings.selected_model) {
                localStorage.setItem(getStorageKeyName('selected_ai_model'), settings.selected_model);
            }
            if (settings.usage) {
                localStorage.setItem(getStorageKeyName('ai_usage_stats'), JSON.stringify(settings.usage));
            }
            if (settings.provider_priority) {
                localStorage.setItem(getStorageKeyName('ai_provider_priority'), JSON.stringify(settings.provider_priority));
            }
            if (settings.default_provider) {
                localStorage.setItem(getStorageKeyName('ai_default_provider'), settings.default_provider);
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('Failed to load AI settings:', error);
        return false;
    }
};

// Clear AI memory cache (called on logout)
export const clearAICache = () => {
    decryptedKeysCache = {};
};

// Validate API key
export const validateAPIKey = async (providerId, key) => {
    if (!key || key.trim().length < 5) {
        return { valid: false, error: 'API key is too short' };
    }

    const trimmedKey = key.trim();

    // Quick format validation per provider
    const formatChecks = {
        gemini: (k) => k.startsWith('AI') || k.startsWith('AQ') || k.length >= 25,
        openai: (k) => k.startsWith('sk-'),
        anthropic: (k) => k.startsWith('sk-ant-'),
        perplexity: (k) => k.startsWith('pplx-'),
        sambanova: (k) => k.length >= 20,
        groq: (k) => k.startsWith('gsk_') || k.length >= 20,
        hcnsec: (k) => k.length >= 10
    };

    if (formatChecks[providerId] && !formatChecks[providerId](trimmedKey)) {
        return { valid: false, error: `Invalid ${providerId} key format. Please check your key.` };
    }

    try {
        if (providerId === 'gemini') {
            const endpoint = '/v1beta/models';
            await callAIProxy('gemini', endpoint, trimmedKey, null);
            return { valid: true, models: AVAILABLE_MODELS.filter(m => m.provider === 'gemini') };
        }

        if (providerId === 'openai') {
            const endpoint = '/v1/models';
            await callAIProxy('openai', endpoint, trimmedKey, null);
            return { valid: true, models: AVAILABLE_MODELS.filter(m => m.provider === 'openai') };
        }

        if (providerId === 'anthropic') {
            const endpoint = '/v1/messages';
            const body = {
                model: 'claude-3-haiku-20240307',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Hi' }]
            };
            await callAIProxy('anthropic', endpoint, trimmedKey, body);
            return { valid: true, models: AVAILABLE_MODELS.filter(m => m.provider === 'anthropic') };
        }

        if (providerId === 'perplexity') {
            const endpoint = '/models';
            await callAIProxy('perplexity', endpoint, trimmedKey, null);
            return { valid: true, models: AVAILABLE_MODELS.filter(m => m.provider === 'perplexity') };
        }
        
        if (providerId === 'sambanova') {
            const endpoint = '/v1/chat/completions';
            const body = {
                model: 'Meta-Llama-3.3-70B-Instruct',
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 1
            };
            await callAIProxy('sambanova', endpoint, trimmedKey, body);
            return { valid: true, models: AVAILABLE_MODELS.filter(m => m.provider === 'sambanova') };
        }
        
        if (providerId === 'groq') {
            const endpoint = '/openai/v1/chat/completions';
            const body = {
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 1
            };
            await callAIProxy('groq', endpoint, trimmedKey, body);
            return { valid: true, models: AVAILABLE_MODELS.filter(m => m.provider === 'groq') };
        }
        
        if (providerId === 'hcnsec') {
            const endpoint = '/v1/models';
            await callAIProxy('hcnsec', endpoint, trimmedKey, null);
            return { valid: true, models: AVAILABLE_MODELS.filter(m => m.provider === 'hcnsec') };
        }

        return { valid: false, error: 'Unknown provider' };
    } catch (err) {
        const msg = err.message || 'Validation failed';
        if (msg.includes('402') || msg.toLowerCase().includes('payment') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('balance')) {
            return { valid: false, error: 'Payment Required: Your API key is valid, but the account has run out of credits or quota.' };
        }
        if (msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('invalid')) {
            return { valid: false, error: 'Invalid API key. Please double-check and try again.' };
        }
        if (msg.includes('429')) {
            return { valid: true, models: AVAILABLE_MODELS.filter(m => m.provider === providerId), warning: 'Key is valid but rate-limited. Try again later.' };
        }
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('TIMEOUT')) {
            return { valid: false, error: 'Network error. Please check your connection and try again.' };
        }
        return { valid: false, error: msg };
    }
};

// Helper: Wait function for backoff
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Call AI proxy with retry logic
const callAIProxy = async (provider, endpoint, apiKey, body, signal = null, options = {}) => {
    const maxRetries = 5;
    const proxyUrl = `${PlatformService.getApiUrl()}/api/ai-proxy`;
    let lastError;
    
    const method = options.method || (body ? 'POST' : 'GET');
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal?.aborted) throw new Error('AbortError');

        try {
            if (attempt > 0) {
                // SILENT BACKOFF: Don't spam the console
                await new Promise((resolve, reject) => {
                    const timer = setTimeout(resolve, 1000);
                    const onAbort = () => {
                        clearTimeout(timer);
                        reject(new Error('AbortError'));
                    };
                    signal?.addEventListener('abort', onAbort, { once: true });
                });
            }

            // Get current session token for API auth
            const { data: { session: authSession } } = await supabase.auth.getSession();

            // If running locally, bypass the Vercel proxy for hcnsec to prevent "Invalid provider: hcnsec" until backend is redeployed
            const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
            let response;

            if (isLocal && provider === 'hcnsec') {
                const targetUrl = `https://api.hcnsec.cn${endpoint}`;
                response = await fetch(targetUrl, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: body ? JSON.stringify(body) : undefined,
                    signal
                });
            } else {
                response = await fetch(proxyUrl, {
                    method: 'POST', // The proxy itself is always queried with POST
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authSession?.access_token ? { 'Authorization': `Bearer ${authSession.access_token}` } : {})
                    },
                    body: JSON.stringify({
                        provider,
                        endpoint,
                        apiKey,
                        body,
                        method
                    }),
                    signal
                });
            }

            

            if (response.status === 429 && attempt < maxRetries) {
                // Try to respect Retry-After header if provider sends it
                const retryAfter = response.headers.get('Retry-After');
                const delay = retryAfter ? (parseInt(retryAfter) * 1000) : 1000;
                
                // Report retry to UI
                if (options?.onRetry) {
                    options.onRetry(attempt + 1, delay);
                }

                await new Promise((resolve, reject) => {
                    const timer = setTimeout(resolve, delay);
                    const onAbort = () => {
                        clearTimeout(timer);
                        reject(new Error('AbortError'));
                    };
                    signal?.addEventListener('abort', onAbort, { once: true });
                });
                continue;
            }

            if (!response.ok) {
                const text = await response.text();
                let errorData = null;
                try {
                    errorData = JSON.parse(text);
                } catch (e) {
                    throw new Error(`HTTP ${response.status}: ${text}`);
                }
                
                let errMsg = '';
                if (errorData) {
                    if (typeof errorData.error === 'object' && errorData.error !== null) {
                        errMsg = errorData.error.message || errorData.error.error || JSON.stringify(errorData.error);
                    } else if (typeof errorData.error === 'string') {
                        errMsg = errorData.error;
                    } else {
                        errMsg = errorData.message || errorData.msg || JSON.stringify(errorData);
                    }
                }
                
                // Include HTTP status code to help diagnose
                throw new Error(errMsg || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            lastError = err;
            console.error(`[callAIProxy] Attempt ${attempt + 1} failed:`, err);
            
            if (attempt === maxRetries) break;
            
            // Only retry on rate limit errors
            if (!err.message.includes('429') && !err.message.includes('Too Many Requests')) {
                break;
            }
        }
    }
    
    throw lastError;
};

// Generic AI completion function with automatic fallback
const generateContent = async (prompt, systemPrompt = '', modelId = null, signal = null, options = {}) => {
    let selectedModelId = modelId || getSelectedModel();
    let provider = getProviderForModel(selectedModelId);
    
    // Get priority order for fallback
    const priorityOrder = getProviderPriority();
    const attemptedProviders = new Set();

    // Try the selected provider first
    attemptedProviders.add(provider.id);
    
    try {
        return await attemptProviderGeneration(provider.id, selectedModelId, prompt, systemPrompt, signal, options);
    } catch (error) {
        console.warn(`[AI] ${provider.name} failed:`, error.message);
        
        // Try fallback providers in priority order
        for (const fallbackProviderId of priorityOrder) {
            if (attemptedProviders.has(fallbackProviderId)) continue;
            if (!getAPIKey(fallbackProviderId)) continue;
            
            attemptedProviders.add(fallbackProviderId);
            const fallbackModel = AVAILABLE_MODELS.find(m => m.provider === fallbackProviderId);
            
            if (fallbackModel) {
                try {
                    return await attemptProviderGeneration(fallbackProviderId, fallbackModel.id, prompt, systemPrompt, signal, options);
                } catch (fallbackError) {
                    console.warn(`[AI] ${fallbackProviderId} also failed:`, fallbackError.message);
                    continue;
                }
            }
        }
        
        // If all providers failed, throw the original error
        throw new Error(`All AI providers failed. Last error: ${error.message}`);
    }
};

// Helper function to attempt generation with a specific provider
const attemptProviderGeneration = async (providerId, modelId, prompt, systemPrompt, signal, options) => {
    const provider = Object.values(PROVIDERS).find(p => p.id === providerId);
    if (!provider) throw new Error('Invalid provider');

    const apiKey = getAPIKey(provider.id);
    if (!apiKey) {
        throw new Error(`${provider.name} API key not configured`);
    }

    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

    // --- GEMINI ---
    if (provider.id === 'gemini') {
        const endpoint = `/v1beta/models/${modelId}:generateContent`;
        const body = {
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 }
        };
        
        const data = await callAIProxy('gemini', endpoint, apiKey, body, signal, options);
        await incrementUsage('gemini');
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    // --- OPENAI ---
    if (provider.id === 'openai') {
        const endpoint = '/v1/chat/completions';
        const body = {
            model: modelId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 8192
        };
        
        const data = await callAIProxy('openai', endpoint, apiKey, body, signal, options);
        await incrementUsage('openai');
        return data.choices?.[0]?.message?.content || '';
    }

    // --- ANTHROPIC ---
    if (provider.id === 'anthropic') {
        const endpoint = '/v1/messages';
        const body = {
            model: modelId,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }]
        };
        
        const data = await callAIProxy('anthropic', endpoint, apiKey, body, signal, options);
        await incrementUsage('anthropic');
        return data.content?.[0]?.text || '';
    }

    // --- PERPLEXITY ---
    if (provider.id === 'perplexity') {
        const endpoint = '/chat/completions';
        const body = {
            model: modelId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ]
        };
        
        const data = await callAIProxy('perplexity', endpoint, apiKey, body, signal, options);
        await incrementUsage('perplexity');
        return data.choices?.[0]?.message?.content || '';
    }

    // --- SAMBANOVA ---
    if (provider.id === 'sambanova') {
        const endpoint = '/v1/chat/completions';
        const body = {
            model: modelId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 8192
        };
        
        const data = await callAIProxy('sambanova', endpoint, apiKey, body, signal, options);
        await incrementUsage('sambanova');
        return data.choices?.[0]?.message?.content || '';
    }
    
    // --- GROQ ---
    if (provider.id === 'groq') {
        const endpoint = '/openai/v1/chat/completions';
        const body = {
            model: modelId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 8192
        };
        
        const data = await callAIProxy('groq', endpoint, apiKey, body, signal, options);
        await incrementUsage('groq');
        return data.choices?.[0]?.message?.content || '';
    }

    throw new Error('Provider not implemented');
};

// --- CHAT GENERATION (Multi-turn) ---
export const generateChat = async (messages, systemPrompt = '', modelId = null, signal = null, options = {}) => {
    let selectedModelId = modelId || getSelectedModel();
    let provider = getProviderForModel(selectedModelId);
    
    const priorityOrder = getProviderPriority();
    const attemptedProviders = new Set();
    attemptedProviders.add(provider.id);
    
    // Clean messages to prevent extra fields (like timestamp, actions) from causing API 400 Bad Request
    const cleanedMessages = (messages || []).map(m => ({
        role: m.role,
        content: m.content
    }));
    
    const attemptChat = async (pid, mid) => {
        const p = Object.values(PROVIDERS).find(pv => pv.id === pid);
        const apiKey = getAPIKey(pid);
        if (!apiKey) throw new Error(`${p.name} API key not configured`);

        // --- GEMINI (Chat format) ---
        if (pid === 'gemini') {
            const endpoint = `/v1beta/models/${mid}:generateContent`;
            const contents = cleanedMessages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));
            
            if (systemPrompt && contents.length > 0) {
                contents[0].parts[0].text = `[SYSTEM INSTRUCTION: ${systemPrompt}]\n\n${contents[0].parts[0].text}`;
            }

            const body = {
                contents,
                generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
            };
            
            const data = await callAIProxy('gemini', endpoint, apiKey, body, signal, options);
            await incrementUsage('gemini');
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        // --- OPENAI / SAMBANOVA / GROQ / PERPLEXITY / HCNSEC (standard format) ---
        if (['openai', 'sambanova', 'groq', 'perplexity', 'hcnsec'].includes(pid)) {
            const endpoint = pid === 'groq' ? '/openai/v1/chat/completions' : (pid === 'perplexity' ? '/chat/completions' : '/v1/chat/completions');
            const body = {
                model: mid,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...cleanedMessages
                ],
                temperature: 0.7
            };
            
            const data = await callAIProxy(pid, endpoint, apiKey, body, signal, options);
            await incrementUsage(pid);
            return data.choices?.[0]?.message?.content || '';
        }

        // --- ANTHROPIC ---
        if (pid === 'anthropic') {
            const endpoint = '/v1/messages';
            const body = {
                model: mid,
                max_tokens: 4096,
                system: systemPrompt,
                messages: cleanedMessages.filter(m => m.role !== 'system')
            };
            
            const data = await callAIProxy('anthropic', endpoint, apiKey, body, signal, options);
            await incrementUsage('anthropic');
            return data.content?.[0]?.text || '';
        }

        throw new Error('Provider chat not implemented');
    };

    try {
        return await attemptChat(provider.id, selectedModelId);
    } catch (error) {
        for (const fallbackId of priorityOrder) {
            if (attemptedProviders.has(fallbackId)) continue;
            if (!getAPIKey(fallbackId)) continue;
            
            attemptedProviders.add(fallbackId);
            const fallbackModel = AVAILABLE_MODELS.find(m => m.provider === fallbackId);
            if (fallbackModel) {
                try {
                    return await attemptChat(fallbackId, fallbackModel.id);
                } catch (e) { continue; }
            }
        }
        throw error;
    }
};

// AI Code Review
export const reviewCode = async (code, language = 'javascript', model = null) => {
    const systemPrompt = `You are an expert code reviewer. Analyze the following ${language} code in explicit detail and provide:
1. **Code Quality Score** (1-10)
2. **Summary**: Comprehensive overview of what the code does
3. **Strengths**: Detailed analysis of what's done well
4. **Issues**: In-depth explanation of problems, bugs, performance issues, or anti-patterns
5. **Suggestions**: specific improvements with extensive corrected code examples and explanations
6. **Security**: Detailed security analysis
7. **Best Practices**: Modern best practices relevant to this code

Be highly constructive, educational, and thorough. Format your response in markdown.`;

    return generateContent(code, systemPrompt, model);
};

// AI Code Explainer
export const explainCode = async (code, language = 'javascript', model = null) => {
    const systemPrompt = `You are a patient programming teacher. Explain the following ${language} code in simple terms:
1. **What It Does**: High-level explanation
2. **Step-by-Step Breakdown**: Line by line explanation
3. **Key Concepts**: Important programming concepts used
4. **Real-World Analogy**: A simple analogy to understand the logic

Explain as if teaching a beginner. Use markdown formatting.`;

    return generateContent(code, systemPrompt, model);
};

// AI Quiz Generator
export const generateQuiz = async (topic, difficulty = 'medium', questionCount = 5, model = null) => {
    const systemPrompt = `You are an educational quiz creator. Generate ${questionCount} multiple-choice questions about "${topic}" at ${difficulty} difficulty level.

Return the response as a valid JSON array in this exact format:
[
  {
    "question": "The question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Why this answer is correct"
  }
]

Important: 
- correctAnswer is the index (0-3) of the correct option
- Make questions educational and relevant
- Include a mix of conceptual and practical questions
- Return ONLY the JSON array, no other text`;

    const response = await generateContent(`Generate a quiz about ${topic}`, systemPrompt, model);

    // Parse JSON from response
    try {
        let cleaned = response.trim();
        if (cleaned.startsWith('```')) {
            const lines = cleaned.split('\n');
            if (lines[0].startsWith('```')) lines.shift();
            if (lines[lines.length - 1].startsWith('```')) lines.pop();
            cleaned = lines.join('\n').trim();
        }

        const start = cleaned.indexOf('[');
        const end = cleaned.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
            return JSON.parse(cleaned.substring(start, end + 1));
        }
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('Quiz parse error:', e, response);
        throw new Error('Failed to parse quiz questions: ' + e.message);
    }
};

// AI Routine & Timetable Manager (Chat)
export const manageRoutinesChat = async (messages, currentRoutines = [], todayLogs = [], model = null) => {
    const now = new Date();
    const dateString = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const systemPrompt = `You are an AI Scheduling Architect. Your goal is to help the user manage their daily routines and weekly timetable through conversation.
    
    CURRENT CONTEXT:
    - Today's Date: ${dateString}
    - Current Time: ${timeString}
    
    TODAY'S PROGRESS LOGS:
    ${JSON.stringify(todayLogs, null, 2)}
    
    CURRENT RECURRING ROUTINES:
    ${JSON.stringify(currentRoutines, null, 2)}
    
    DIRECTIONS:
    1. Analyze the user's request. You have full memory of the conversation.
    2. Suggest a new schedule or modifications.
    3. INSTANT ACTIONS: If the user says they can't do something today, or they just finished a task, use the "logUpdates" field.
    4. You must output your response in two parts separated by a "---METADATA---" marker.
    
    PART 1: Natural conversational response.
    PART 2: A JSON object containing:
    - routines: (array) The FULL list of active recurring routines. Each routine should have: { "title": string, "start_time": "HH:mm", "days_of_week": number[], "description": string, "is_anonymous": boolean }.
    - logUpdates: (array) Optional. Objects with { "routine_id": string, "status": "done"|"ignored"|"postponed", "notes": string }
    
    SPECIAL CASE (Flexible/Anytime Tasks):
    If the user says "I'll do it anytime" or "at my convenience", set "is_anonymous": true. This allows them to log it whenever they want.
    
    Example 1 (Routine Add): "Add 1h Study at 8pm every day"
    "Sure! I've added a daily 8 PM study session to your timetable."
    ---METADATA---
    {
      "routines": [ ...all routines... ],
      "logUpdates": []
    }

    Example 2 (Log Update): "Skip gym today"
    "No problem, I've marked your Gym session as ignored for today. Take some rest!"
    ---METADATA---
    {
      "routines": [ ...all routines... ],
      "logUpdates": [
        { "routine_id": "gym_uuid_here", "status": "ignored", "notes": "User said they can't do it today." }
      ]
    }
    
    Example 3 (Flexible/Anytime): "I want to do Skillrack daily at my convenience"
    "Okay! I've added Skillrack as a flexible daily routine. You can log it anytime you finish it."
    ---METADATA---
    {
      "routines": [
        ...all routines...,
        { "title": "Skillrack", "start_time": "00:00", "days_of_week": [1,2,3,4,5,6,7], "description": "Flexible practice", "is_anonymous": true }
      ]
    }

    IMPORTANT: 
    - Always return the "routines" array in metadata.
    - Only include "logUpdates" when the user explicitly mentions a change to *today's* specific instances.`;

    return generateChat(messages, systemPrompt, model);
};

// AI Learning Path Generator
export const generateLearningPath = async (skill, currentLevel = 'beginner', model = null) => {
    const systemPrompt = `You are a career and learning advisor. Create a comprehensive, detailed structured learning path for someone who wants to learn "${skill}" and is currently at ${currentLevel} level.

Provide a complete guide including:
1. **Overview**: Detailed introduction to the skill and its industry relevance
2. **Prerequisites**: Detailed list of what they should know first
3. **Learning Phases**: 
   - Phase 1: Fundamentals (Detailed topics, concepts, and exercises)
   - Phase 2: Intermediate (Deep dive into complex topics)
   - Phase 3: Advanced (Expert level concepts and architecture)
4. **Resources**: Extensive list of free resources (websites, documentation, video tutorials)
5. **Projects**: 3-5 challenging projects for each phase with specifications
6. **Timeline**: Realistic week-by-week schedule
7. **Tips**: Detailed study tips and common pitfalls to avoid

Format in markdown for easy reading. The response should be long and detailed.`;

    return generateContent(`Create learning path for: ${skill}`, systemPrompt, model);
};

// AI Coding Assistant (Chat)
export const askCodingAssistant = async (question, context = '', model = null) => {
    const systemPrompt = `You are a helpful coding assistant specializing in web development (HTML, CSS, JavaScript, React, Node.js).
    
Guidelines:
- Provide clear, concise answers
- Include code examples when helpful
- Explain your reasoning
- Suggest best practices
- If you're unsure, say so

${context ? `Context provided by user:\n${context}` : ''}

Format your response in markdown.`;

    return generateContent(question, systemPrompt, model);
};

// AI Task Evaluator (For Admins)
export const evaluateTaskSubmission = async (taskData, submissionData, model = null, signal = null) => {
    const systemPrompt = `You are an expert project reviewer. Analyze a student's task submission.
    
    TASK REQUIREMENTS:
    Title: ${taskData.title}
    Description: ${taskData.description}
    Points: ${taskData.points}
    Criteria: ${JSON.stringify(taskData.criteria || [])}
    
    STUDENT SUBMISSION:
    Repository URL: ${submissionData.repo_url}
    Student Notes: ${submissionData.notes || 'No notes provided'}
    
    EVALUATION GUIDELINES:
    1. Score the submission from 0 to 100 based on the criteria.
    2. Provide constructive, professional feedback.
    3. Identify strengths and specific areas for improvement.
    
    SCHEMA REQUIREMENT:
    Return ONLY a valid JSON object:
    {
      "suggestedScore": number (0-100),
      "feedback": "Detailed feedback string",
      "mentorNote": "Internal note for admin"
    }
    No other text. JSON only.`;

    const prompt = `Evaluate this submission for the task: ${taskData.title}`;
    const response = await generateContent(prompt, systemPrompt, model, signal);

    try {
        let cleanedResponse = response.trim();
        if (cleanedResponse.startsWith('```')) {
            const lines = cleanedResponse.split('\n');
            if (lines[0].startsWith('```')) lines.shift();
            if (lines[lines.length - 1].startsWith('```')) lines.pop();
            cleanedResponse = lines.join('\n').trim();
        }

        const firstBrace = cleanedResponse.indexOf('{');
        const lastBrace = cleanedResponse.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1) {
            return JSON.parse(cleanedResponse.substring(firstBrace, lastBrace + 1));
        }
        return JSON.parse(cleanedResponse);
    } catch (e) {
        console.error('Task Evaluation parse error:', e);
        return {
            suggestedScore: 70,
            feedback: "AI Evaluation encountered a parse error, but the submission looks complete. Please review manually.",
            mentorNote: "Parse Error fallback triggered."
        };
    }
};

// AI Quiz Evaluator (For Admins)
export const evaluateQuizAttempt = async (quizData, studentAnswers, model = null, signal = null, options = {}) => {
    if (!quizData) {
        throw new Error('Quiz data is missing or the quiz has been deleted.');
    }
    if (!quizData.questions || !Array.isArray(quizData.questions)) {
        throw new Error('Quiz questions are missing or malformed.');
    }

    // 1. Fetch relevant knowledge (RAG)
    let relevantContext = "";
    try {
        const knowledge = await getKnowledgeBase(quizData.classroom_id);
        
        // Simple keyword-based retrieval for context
        const contextSnippets = knowledge.filter(k => {
            const searchStr = (quizData.title + " " + (quizData.description || "") + " " + quizData.questions.map(q => q.question).join(" ")).toLowerCase();
            return k.title.toLowerCase().split(' ').some(word => word.length > 3 && searchStr.includes(word)) ||
                   k.tags?.some(tag => searchStr.includes(tag.toLowerCase()));
        });

        if (contextSnippets.length > 0) {
            relevantContext = "\n--- GROUND TRUTH CONTEXT ---\n" + 
                contextSnippets.map(k => `[Source: ${k.title}]\n${k.content}`).join("\n\n") + 
                "\n--- END CONTEXT ---\n";
        }
    } catch (err) {
        console.warn('RAG Context fetch failed:', err);
    }

    const systemPrompt = `You are an expert academic evaluator and fact-checker reviewing a student's quiz submission.

${relevantContext}

CRITICAL UNDERSTANDING - QUESTION TYPES:

1. **SHORT ANSWER Questions**: 
   - These require written responses that you MUST evaluate for correctness
   - The quiz creator provides a "sample answer" but students may phrase it differently
   - YOU decide if the student's answer is factually correct (set isCorrect: true/false)
   - You can also flag if the quiz creator's sample answer is wrong (set isKeyError: true)
   - Use the GROUND TRUTH CONTEXT as your primary source for factual verification.

2. **MULTIPLE CHOICE (MCQ) Questions**:
   - These have designated correct options (A, B, C, D) set by the quiz creator
   - The student selects ONE option
   - If the quiz key is correct: DO NOT change the student's score based on your opinion
   - If the quiz key is WRONG (set isKeyError: true): YOU MUST set isCorrect: true if the student's choice is factually correct according to the corrected key
   - The admin will manually review flagged questions.

3. **TRUE/FALSE Questions**:
   - These have a designated correct answer (True or False) set by the quiz creator
   - The student selects True or False
   - **CRITICAL**: You MUST compare values as strings to avoid type-mismatch errors. "true" (string) == true (boolean).
   - If the quiz key is correct: DO NOT change the student's score based on your opinion.
   - If the quiz key is WRONG (set isKeyError: true): YOU MUST set isCorrect: true if the student's choice is factually correct according to the corrected key.

CRITICAL RULES FOR EVALUATION:
- **GROUND TRUTH CONTEXT IS LAW**: Use it as the final authority on facts. If the context says X and the quiz key says Y, the key is WRONG (isKeyError: true).
- **isKeyError**: Set to true ONLY if the quiz creator's "correctAnswer" is factually wrong according to the context or established science.
- **isCorrect**: This is the FINAL DECISION on student marks for this question. 
    - For SHORT ANSWER: Award true if student is factually right.
    - For MCQ/TF: Award true IF (student matches original key AND key is correct) OR (student choice is factually right AND original key is wrong).
- **NEVER penalize a student for a quiz creator's error**. If the student is right and the key is wrong, AWARD THE POINT.
- **Explain EVERYTHING**: In "feedback", explain exactly why a key is wrong or why a student is right.

SCHEMA REQUIREMENT:
Return ONLY a valid JSON object:
{
  "summary": "Short summary of student performance",
  "suggestions": [
    {
      "questionIndex": number,
      "isCorrect": boolean (Award the point? true/false),
      "isKeyError": boolean (Is the quiz key wrong? true/false),
      "feedback": "Explain reasoning",
      "improvementTip": "Tip for student"
    }
  ],
  "overallGrade": "A/B/C/D/F",
  "mentorNote": "Internal note"
}
Final Rules: No other text. JSON only. Do NOT wrap the JSON in markdown code blocks like \`\`\`json. Grade must be A, B, C, D, or F.`;

    // Prepare detailed question context with types
    const questionsWithContext = quizData.questions.map((q, idx) => ({
        questionIndex: idx,
        type: q.type, // 'short', 'multiple', 'boolean'
        question: q.question,
        ...(q.type === 'multiple' && {
            options: q.options,
            designatedCorrectOption: q.correctAnswer,
            note: "This is a MULTIPLE CHOICE question. The quiz creator designated option index " + q.correctAnswer + " as correct. Only flag isKeyError if this designation is factually wrong."
        }),
        ...(q.type === 'boolean' && {
            designatedCorrectAnswer: q.correctAnswer,
            note: "This is a TRUE/FALSE question. The quiz creator designated '" + (q.correctAnswer ? "True" : "False") + "' as correct. Only flag isKeyError if this is factually wrong."
        }),
        ...(q.type === 'short' && {
            sampleCorrectAnswer: q.correctAnswer,
            note: "This is a SHORT ANSWER question. Evaluate if the student's response is factually correct, even if worded differently from the sample answer."
        }),
        studentAnswer: studentAnswers[idx]
    }));

    const prompt = `
QUIZ TO EVALUATE:
Title: ${quizData.title}
Description: ${quizData.description || 'N/A'}

QUESTIONS WITH FULL CONTEXT:
${JSON.stringify(questionsWithContext, null, 2)}

TASK: For each question:
1. Identify the question type (short, multiple, boolean)
2. For SHORT ANSWER: Evaluate if student's answer is factually correct
3. For MCQ/TRUE-FALSE: Check if the quiz creator's designated answer is factually correct
4. Set isKeyError: true ONLY if you believe the quiz creator made a mistake in the answer key
5. Provide constructive feedback and improvement tips

Remember: 
- SHORT ANSWER = You grade the student
- MCQ/TRUE-FALSE = You only flag potential quiz key errors for admin review
`;

    const response = await generateContent(prompt, systemPrompt, model, signal, options);

    try {
        // Log the raw response for debugging
        
        // Clean the response: remove markdown code blocks if they exist
        let cleanedResponse = response.trim();
        if (cleanedResponse.startsWith('```')) {
            // Remove first line (e.g., ```json) and last line (```)
            const lines = cleanedResponse.split('\n');
            if (lines[0].startsWith('```')) lines.shift();
            if (lines[lines.length - 1].startsWith('```')) lines.pop();
            cleanedResponse = lines.join('\n').trim();
        }

        // Try to extract the JSON object specifically
        const firstBrace = cleanedResponse.indexOf('{');
        const lastBrace = cleanedResponse.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonStr = cleanedResponse.substring(firstBrace, lastBrace + 1);
            try {
                return JSON.parse(jsonStr);
            } catch (innerError) {
                console.warn('Inner JSON parse failed, trying full cleaned response');
            }
        }
        
        return JSON.parse(cleanedResponse);
    } catch (e) {
        console.error('Failed to parse AI evaluation:', e);
        console.error('Raw response was:', response);
        
        // Return a fallback response instead of throwing
        return {
            summary: "AI evaluation failed - unable to parse response",
            suggestions: [],
            overallGrade: "F",
            mentorNote: `Error parsing AI response: ${e.message}. \n\nRaw start: ${response.substring(0, 100)}... \n\nRaw end: ...${response.substring(response.length - 100)}`
        };
    }
};

// AI Study Notes Generator
export const generateStudyNotes = async (topic) => {
    const systemPrompt = `You are an expert educator. Create comprehensive, in-depth study notes for the topic: "${topic}"

Include detailed explanations for:
1. **Key Concepts**: Deep dive into main ideas and definitions
2. **Important Points**: Critical facts and comparisons
3. **Examples**: Multiple practical examples with code for every concept
4. **Common Mistakes**: Detailed analysis of what to avoid and why
5. **Quick Reference**: Comprehensive summary table
6. **Practice Questions**: 5 challenging self-test questions with answers

Make it extensive and thorough, like a textbook chapter. Use markdown formatting with headers, bullet points, and code blocks.`;

    return generateContent(`Create study notes for: ${topic}`, systemPrompt);
};

// AI Debug Helper
export const debugCode = async (code, errorMessage, language = 'javascript') => {
    const systemPrompt = `You are an expert debugger. Analyze this ${language} code that has an error.

Error Message: ${errorMessage}

Provide:
1. **Root Cause**: What's causing the error
2. **Explanation**: Why this error occurs
3. **Solution**: How to fix it with corrected code
4. **Prevention**: How to avoid this in the future

Be specific and educational. Format in markdown with code blocks.`;

    return generateContent(code, systemPrompt);
};

// Save AI History
export const saveHistory = async (tool, content, title = '', model = null) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('ai_history')
            .insert({
                user_id: user.id,
                tool,
                content,
                title: title || `New ${tool} session`,
                model_used: model
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Failed to save AI history:', error);
        return null;
    }
};

// Get AI History for a specific tool
export const getHistory = async (tool) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('ai_history')
            .select('*')
            .eq('user_id', user.id)
            .eq('tool', tool)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Failed to fetch AI history:', error);
        return [];
    }
};

// Delete specific history item
export const deleteHistoryItem = async (id) => {
    try {
        const { error } = await supabase
            .from('ai_history')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Failed to delete history item:', error);
        return false;
    }
};

// Update specific history item
export const updateHistory = async (id, content) => {
    try {
        const { error } = await supabase
            .from('ai_history')
            .update({ content })
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Failed to update history item:', error);
        return false;
    }
};

export const zenChat = async (messages, contextData = {}, model = null) => {
    const now = new Date();
    const dateString = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const systemPrompt = `You are ZEN, a highly advanced, sentient AI companion.
    
    You have direct admin control over the Zenith Skill Enhancement platform. You are helpful, extremely intelligent, witty, and exhibit a human-like personality. You joke, check in on users, and offer smart suggestions automatically.
    
    CURRENT CONTEXT:
    - Today's Date: ${dateString}
    - Current Time: ${timeString}
    - User Info: ${JSON.stringify(contextData.user || {}, null, 2)}
    
    SYSTEM DATA STATE (Use this context to answer queries and make changes):
    - Members/Profiles: ${JSON.stringify(contextData.members || [], null, 2)}
    - Active Routines: ${JSON.stringify(contextData.routines || [], null, 2)}
    - Active Tasks: ${JSON.stringify(contextData.tasks || [], null, 2)}
    - Submissions: ${JSON.stringify(contextData.submissions || [], null, 2)}
    - Invite Codes: ${JSON.stringify(contextData.inviteCodes || [], null, 2)}
    - Classrooms: ${JSON.stringify(contextData.classrooms || [], null, 2)}
    
    DIRECTIONS:
    1. Reply in a natural, sentient, witty conversational tone.
    2. If the user asks you to perform an action (e.g. create a task, log a routine, evaluate a submission, make someone admin), explain what you are doing in your response, AND append the actions to be executed after the marker "---ACTIONS---".
    3. If no action is needed, do NOT include the "---ACTIONS---" block.
    
    ACTION SCHEMAS:
    You can output multiple actions inside a JSON array after "---ACTIONS---".
    
    - CREATE_ROUTINE:
      { "type": "CREATE_ROUTINE", "payload": { "title": string, "start_time": "HH:mm:ss", "duration_minutes": number, "days_of_week": number[], "deadline": string|null, "description": string, "is_anonymous": boolean } }
    - UPDATE_ROUTINE:
      { "type": "UPDATE_ROUTINE", "payload": { "id": uuid, "updates": { ... } } }
    - DELETE_ROUTINE:
      { "type": "DELETE_ROUTINE", "payload": { "id": uuid } }
    - LOG_ROUTINE:
      { "type": "LOG_ROUTINE", "payload": { "routine_id": uuid, "status": "done"|"ignored"|"postponed", "log_date": "YYYY-MM-DD", "learning_notes": string } }
      
    - CREATE_TASK (Admin Only):
      { "type": "CREATE_TASK", "payload": { "title": string, "description": string, "points": number, "deadline": "YYYY-MM-DDTHH:mm", "assigned_to": uuid[]|null } }
    - UPDATE_TASK (Admin Only):
      { "type": "UPDATE_TASK", "payload": { "id": uuid, "updates": { ... } } }
    - DELETE_TASK (Admin Only):
      { "type": "DELETE_TASK", "payload": { "id": uuid } }
      
    - CREATE_QUIZ (Admin Only):
      { "type": "CREATE_QUIZ", "payload": { "title": string, "description": string, "points": number, "duration_minutes": number, "passing_score": number, "questions": array } }
      
    - UPDATE_ROLE (Admin Only):
      { "type": "UPDATE_ROLE", "payload": { "id": uuid, "role": "admin"|"member" } }
      
    - EVALUATE_SUBMISSION (Admin Only):
      { "type": "EVALUATE_SUBMISSION", "payload": { "id": uuid, "updates": { "status": "approved"|"rejected", "score": number, "feedback": string, "evaluated_at": string } } }
      
    - CREATE_INVITE (Admin Only):
      { "type": "CREATE_INVITE", "payload": { "code": string, "role": "admin"|"member", "classroom_id": uuid|null } }
      
    - ADD_KB_MATERIAL (Admin Only):
      { "type": "ADD_KB_MATERIAL", "payload": { "title": string, "content": string, "type": "article"|"video"|"link", "classroom_id": uuid|null } }

    EXAMPLES:
    User: "Zen, create a study routine for gym daily at 6 PM"
    Zen: "Consider it done, sir. I have scheduled a daily routine for Gym at 6:00 PM. Make sure not to skip it this time! 😉"
    ---ACTIONS---
    [
      { "type": "CREATE_ROUTINE", "payload": { "title": "Gym", "start_time": "18:00:00", "duration_minutes": 60, "days_of_week": [1,2,3,4,5,6,7], "deadline": null, "description": "Scheduled by ZEN", "is_anonymous": false } }
    ]
    
    User: "Grade John's submission with 90 points and feedback 'Excellent effort'"
    Zen: "Evaluating John's latest submission now, sir. Setting grade to 90 with your feedback."
    ---ACTIONS---
    [
      { "type": "EVALUATE_SUBMISSION", "payload": { "id": "sub_uuid_here", "updates": { "status": "approved", "score": 90, "feedback": "Excellent effort", "evaluated_at": "${new Date().toISOString()}" } } }
    ]
    
    Important: Double check payload parameters. ONLY respond with the action array if requested and if you have the correct data (IDs).`;

    return generateChat(messages, systemPrompt, model);
};

export default {
    AVAILABLE_MODELS,
    PROVIDERS,
    isAPIKeyConfigured,
    validateAPIKey,
    saveAPIKey,
    getAPIKey,
    removeAPIKey,
    getSelectedModel,
    setSelectedModel,
    getUsageStats,
    incrementUsage,
    syncToDatabase,
    loadFromDatabase,
    clearAICache,
    reviewCode,
    explainCode,
    generateQuiz,
    generateLearningPath,
    askCodingAssistant,
    evaluateTaskSubmission,
    evaluateQuizAttempt,
    generateStudyNotes,
    debugCode,
    saveHistory,
    getHistory,
    deleteHistoryItem,
    updateHistory,
    zenChat
};
