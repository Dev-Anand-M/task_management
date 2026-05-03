// AI Service supporting multiple providers (Gemini, OpenAI, Anthropic, Perplexity)

import { supabase } from '../lib/supabase';

export const PROVIDERS = {
    GEMINI: { id: 'gemini', name: 'Google Gemini', icon: '✨', keyName: 'gemini_api_key', url: 'https://makersuite.google.com/app/apikey' },
    OPENAI: { id: 'openai', name: 'OpenAI', icon: '🧠', keyName: 'openai_api_key', url: 'https://platform.openai.com/api-keys' },
    ANTHROPIC: { id: 'anthropic', name: 'Anthropic Claude', icon: '🤖', keyName: 'anthropic_api_key', url: 'https://console.anthropic.com/settings/keys' },
    PERPLEXITY: { id: 'perplexity', name: 'Perplexity', icon: '🔍', keyName: 'perplexity_api_key', url: 'https://www.perplexity.ai/settings/api' },
    SAMBANOVA: { id: 'sambanova', name: 'SambaNova', icon: '⚡', keyName: 'sambanova_api_key', url: 'https://cloud.sambanova.ai/' }
};

// Available Models mapped to providers
export const AVAILABLE_MODELS = [
    // Defaults for Auto-Calibration
    { id: 'gemini-2.0-flash', provider: 'gemini', name: 'Gemini 2.0 Flash (Default)', description: 'Auto-calibrated for Gemini', inputTokenLimit: '1M', outputTokenLimit: '8k' },
    { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o (Default)', description: 'Auto-calibrated for OpenAI', inputTokenLimit: '128k', outputTokenLimit: '4k' },
    { id: 'claude-3-5-sonnet-20240620', provider: 'anthropic', name: 'Claude 3.5 Sonnet (Default)', description: 'Auto-calibrated for Anthropic', inputTokenLimit: '200k', outputTokenLimit: '4k' },
    { id: 'llama-3.1-sonar-large-128k-online', provider: 'perplexity', name: 'Sonar Large 3.1 (Default)', description: 'Auto-calibrated for Perplexity', inputTokenLimit: '128k', outputTokenLimit: '4k' },
    { id: 'Meta-Llama-3.1-405B-Instruct', provider: 'sambanova', name: 'Llama 3.1 405B (SambaNova)', description: 'Ultra-fast inference via SambaNova', inputTokenLimit: '128k', outputTokenLimit: '4k' },
    { id: 'Meta-Llama-3.1-70B-Instruct', provider: 'sambanova', name: 'Llama 3.1 70B (SambaNova)', description: 'Fast Llama 3.1 70B', inputTokenLimit: '128k', outputTokenLimit: '4k' }
];

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
export const isAPIKeyConfigured = (providerId = 'gemini') => {
    const provider = Object.values(PROVIDERS).find(p => p.id === providerId);
    return provider ? !!localStorage.getItem(provider.keyName) : false;
};

// Check if ANY API key is configured
export const isAnyAPIKeyConfigured = () => {
    return Object.values(PROVIDERS).some(p => !!localStorage.getItem(p.keyName));
};

// Fetch available models (Legacy wrapper or generic fetcher)
export const fetchAvailableModels = async (apiKey) => {
    // If we have a key, we try to guess the provider or just use the current selected one
    // This is a bit tricky for legacy calls that pass a key directly.
    // For now, let's just return all models if we can't validate, or try to validate with Gemini as default
    // effectively mimicking old behavior but safer
    try {
        // If generic key is passed and it matches a stored key, use that provider
        const provider = Object.values(PROVIDERS).find(p => localStorage.getItem(p.keyName) === apiKey);
        if (provider) {
            const validation = await validateAPIKey(provider.id, apiKey);
            return validation.models || [];
        }

        // Fallback: try Gemini
        return (await validateAPIKey('gemini', apiKey)).models || [];
    } catch (e) {
        return [];
    }
};

// Get API key for provider

// Get API key for provider
export const getAPIKey = (providerId) => {
    const provider = Object.values(PROVIDERS).find(p => p.id === providerId);
    return provider ? localStorage.getItem(provider.keyName) || '' : '';
};

// Get usage stats
export const getUsageStats = () => {
    const stats = localStorage.getItem('ai_usage_stats');
    const today = new Date().toISOString().split('T')[0];

    if (stats) {
        const parsed = JSON.parse(stats);
        if (parsed.lastDate !== today) {
            parsed.requestsToday = 0;
            parsed.lastDate = today;
            localStorage.setItem('ai_usage_stats', JSON.stringify(parsed));
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

        // Collect all keys
        const keys = {};
        Object.values(PROVIDERS).forEach(p => {
            const key = localStorage.getItem(p.keyName);
            if (key) keys[p.keyName] = encryptKey(key, user.id);
        });

        const model = localStorage.getItem('selected_ai_model');
        const usage = getUsageStats();

        const aiSettings = {
            keys: keys,
            selected_model: model,
            usage: usage
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
        localStorage.setItem(provider.keyName, key);
        await syncToDatabase();
    }
};

// Remove API key
export const removeAPIKey = async (providerId) => {
    const provider = Object.values(PROVIDERS).find(p => p.id === providerId);
    if (provider) {
        localStorage.removeItem(provider.keyName);
        await syncToDatabase();
    }
};

// Get selected model with smart fallback
export const getSelectedModel = () => {
    // Check which keys are configured and return the default model for that provider
    // This implements the "Automatic Calibration" requested by the user.
    if (localStorage.getItem('gemini_api_key')) return 'gemini-2.0-flash';
    if (localStorage.getItem('openai_api_key')) return 'gpt-4o';
    if (localStorage.getItem('anthropic_api_key')) return 'claude-3-5-sonnet-20240620';
    if (localStorage.getItem('perplexity_api_key')) return 'llama-3.1-sonar-large-128k-online';

    // Default Fallback
    return 'gemini-2.0-flash';
};

// Set selected model
export const setSelectedModel = async (modelId) => {
    localStorage.setItem('selected_ai_model', modelId);
    await syncToDatabase();
};

// Helper: Get provider for a model
const getProviderForModel = (modelId) => {
    const model = AVAILABLE_MODELS.find(m => m.id === modelId);
    return model ? PROVIDERS[model.provider.toUpperCase()] : PROVIDERS.GEMINI;
};

// Increment usage
export const incrementUsage = async () => {
    const stats = getUsageStats();
    stats.requestsToday += 1;
    stats.totalRequests += 1;
    stats.lastDate = new Date().toISOString().split('T')[0];
    localStorage.setItem('ai_usage_stats', JSON.stringify(stats));
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

            // Handle new keys structure
            if (settings.keys) {
                Object.values(PROVIDERS).forEach(p => {
                    const encrypted = settings.keys[p.keyName];
                    if (encrypted) {
                        const decrypted = decryptKey(encrypted, user.id);
                        if (decrypted) localStorage.setItem(p.keyName, decrypted);
                    }
                });
            }
            // Handle legacy structure
            else if (settings.encrypted_api_key) {
                const decrypted = decryptKey(settings.encrypted_api_key, user.id);
                if (decrypted) localStorage.setItem('gemini_api_key', decrypted);
            }

            if (settings.selected_model) {
                localStorage.setItem('selected_ai_model', settings.selected_model);
            }
            if (settings.usage) {
                localStorage.setItem('ai_usage_stats', JSON.stringify(settings.usage));
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('Failed to load AI settings:', error);
        return false;
    }
};

// Validate API key
export const validateAPIKey = async (providerId, key) => {
    if (!key || key.trim().length < 5) {
        return { valid: false, error: 'API key is too short' };
    }

    const trimmedKey = key.trim();

    try {
        if (providerId === 'gemini') {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${trimmedKey}`
            );
            if (!response.ok) throw new Error('Invalid Gemini API Key');
            // Auto-calibrate: Just return default
            return { valid: true, models: AVAILABLE_MODELS.filter(m => m.provider === 'gemini') };
        }

        if (providerId === 'openai') {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${trimmedKey}` }
            });
            if (!response.ok) throw new Error('Invalid OpenAI API Key');
            return { valid: true, models: AVAILABLE_MODELS.filter(m => m.provider === 'openai') };
        }

        if (providerId === 'anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': trimmedKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'Hi' }]
                })
            });
            if (response.status === 401 || response.status === 403) throw new Error('Invalid Anthropic API Key');
            return { valid: true, models: AVAILABLE_MODELS.filter(m => m.provider === 'anthropic') };
        }

        if (providerId === 'perplexity') {
            const response = await fetch('https://api.perplexity.ai/models', {
                headers: { 'Authorization': `Bearer ${trimmedKey}` }
            });
            if (!response.ok) throw new Error('Invalid Perplexity API Key');
            return { valid: true, models: AVAILABLE_MODELS.filter(m => m.provider === 'perplexity') };
        }
        
        if (providerId === 'sambanova') {
            const response = await fetch('https://api.sambanova.ai/v1/models', {
                headers: { 'Authorization': `Bearer ${trimmedKey}` }
            });
            if (!response.ok) throw new Error('Invalid SambaNova API Key');
            return { valid: true, models: AVAILABLE_MODELS.filter(m => m.provider === 'sambanova') };
        }

        return { valid: false, error: 'Unknown provider' };
    } catch (err) {
        return { valid: false, error: err.message || 'Validation failed' };
    }
};

// Generic AI completion function
const generateContent = async (prompt, systemPrompt = '', modelId = null) => {
    let selectedModelId = modelId || getSelectedModel();
    let provider = getProviderForModel(selectedModelId);

    // Auto-healing: If selected provider has no key, try to find one that does
    if (!getAPIKey(provider.id)) {
        console.warn(`Provider ${provider.id} not configured. Attempting to fallback...`);
        const validProvider = Object.values(PROVIDERS).find(p => getAPIKey(p.id));
        if (validProvider) {
            const newModel = AVAILABLE_MODELS.find(m => m.provider === validProvider.id);
            if (newModel) {
                console.log(`Fallback: Switching to ${validProvider.name} (${newModel.id})`);
                selectedModelId = newModel.id;
                provider = getProviderForModel(selectedModelId);
                localStorage.setItem('selected_ai_model', selectedModelId);
            }
        }
    }

    if (!provider) throw new Error('Invalid model selected');

    const apiKey = getAPIKey(provider.id);
    if (!apiKey) {
        throw new Error(`${provider.name} API key not configured. Please add it in settings.`);
    }

    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

    try {
        // --- GEMINI ---
        if (provider.id === 'gemini') {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModelId}:generateContent`;
            const response = await fetch(`${apiUrl}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }],
                    generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 }
                })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'Gemini Error');
            }
            const data = await response.json();
            await incrementUsage();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        // --- OPENAI ---
        if (provider.id === 'openai') {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: selectedModelId,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7
                })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'OpenAI Error');
            }
            const data = await response.json();
            await incrementUsage();
            return data.choices?.[0]?.message?.content || '';
        }

        // --- ANTHROPIC ---
        if (provider.id === 'anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                    'anthropic-dangerously-allow-browser': 'true'
                },
                body: JSON.stringify({
                    model: selectedModelId,
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: prompt }]
                })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'Anthropic Error');
            }
            const data = await response.json();
            await incrementUsage();
            return data.content?.[0]?.text || '';
        }

        // --- PERPLEXITY ---
        if (provider.id === 'perplexity') {
            const response = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: selectedModelId,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ]
                })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'Perplexity Error');
            }
            const data = await response.json();
            await incrementUsage();
            return data.choices?.[0]?.message?.content || '';
        }

        // --- SAMBANOVA ---
        if (provider.id === 'sambanova') {
            const response = await fetch('https://api.sambanova.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: selectedModelId,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7
                })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'SambaNova Error');
            }
            const data = await response.json();
            await incrementUsage();
            return data.choices?.[0]?.message?.content || '';
        }

    } catch (error) {
        console.error('AI Service Error:', error);
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
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(response);
    } catch (e) {
        throw new Error('Failed to parse quiz questions');
    }
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

// AI Quiz Evaluator (For Admins)
export const evaluateQuizAttempt = async (quizData, studentAnswers, model = null) => {
    const systemPrompt = `You are an expert academic evaluator. Analyze the following quiz submission and provide a detailed evaluation.
    
    For each question, determine if the student's answer is conceptually correct, especially for short-answer/text questions.
    
    Return the response as a valid JSON object in this exact format:
    {
      "summary": "Overall performance summary",
      "suggestions": [
        {
          "questionIndex": 0,
          "isCorrect": true/false,
          "feedback": "Why this is correct/incorrect",
          "improvementTip": "How the student can do better"
        }
      ],
      "overallGrade": "A/B/C/D/F",
      "mentorNote": "A private note for the admin about the student's progress"
    }
    
    Important: 
    - Be fair but rigorous.
    - For text answers, look for keywords and conceptual understanding even if phrasing is different.
    - Return ONLY the JSON object.`;

    const prompt = `
    Quiz Title: ${quizData.title}
    Questions: ${JSON.stringify(quizData.questions)}
    Student Answers: ${JSON.stringify(studentAnswers)}
    `;

    const response = await generateContent(prompt, systemPrompt, model);

    try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(response);
    } catch (e) {
        console.error('Failed to parse AI evaluation:', response);
        throw new Error('Failed to parse AI evaluation report');
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
    reviewCode,
    explainCode,
    generateQuiz,
    generateLearningPath,
    askCodingAssistant,
    generateStudyNotes,
    debugCode,
    saveHistory,
    getHistory,
    deleteHistoryItem,
    updateHistory
};
