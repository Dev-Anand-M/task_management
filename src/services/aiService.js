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
    // SambaNova Models (Default Provider)
    { id: 'Meta-Llama-3.3-70B-Instruct', provider: 'sambanova', name: 'Llama 3.3 70B (Default)', description: 'Latest Meta model - Fast and powerful', inputTokenLimit: '128k', outputTokenLimit: '4k' },
    { id: 'DeepSeek-V3.2', provider: 'sambanova', name: 'DeepSeek V3.2 (SambaNova)', description: 'Powerful reasoning model', inputTokenLimit: '128k', outputTokenLimit: '4k' },
    { id: 'gemma-3-12b-it', provider: 'sambanova', name: 'Gemma 3 12B (SambaNova)', description: 'Google latest open model', inputTokenLimit: '128k', outputTokenLimit: '4k' },
    
    // Other Providers
    { id: 'gemini-1.5-flash', provider: 'gemini', name: 'Gemini 1.5 Flash', description: 'Stable and fast for everyone', inputTokenLimit: '1M', outputTokenLimit: '8k' },
    { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', description: 'Auto-calibrated for OpenAI', inputTokenLimit: '128k', outputTokenLimit: '4k' },
    { id: 'claude-3-5-sonnet-20240620', provider: 'anthropic', name: 'Claude 3.5 Sonnet', description: 'Auto-calibrated for Anthropic', inputTokenLimit: '200k', outputTokenLimit: '4k' },
    { id: 'llama-3.1-sonar-large-128k-online', provider: 'perplexity', name: 'Sonar Large 3.1', description: 'Auto-calibrated for Perplexity', inputTokenLimit: '128k', outputTokenLimit: '4k' }
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
export const isAPIKeyConfigured = (providerId = 'sambanova') => {
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
        return (await validateAPIKey('sambanova', apiKey)).models || [];
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
    // 1. Check for manual selection first, but force SambaNova default when available
    const manualSelection = localStorage.getItem('selected_ai_model');
    if (manualSelection) {
        const manualModel = AVAILABLE_MODELS.find(m => m.id === manualSelection);
        const hasSamba = !!localStorage.getItem('sambanova_api_key');

        // If SambaNova is configured and manual model is missing/legacy/non-Samba, normalize to SambaNova default
        if (hasSamba && (!manualModel || manualModel.provider !== 'sambanova')) {
            localStorage.setItem('selected_ai_model', 'Meta-Llama-3.3-70B-Instruct');
            return 'Meta-Llama-3.3-70B-Instruct';
        }

        return manualSelection;
    }

    // 2. Fallback to configured keys in order of preference (SambaNova first)
    if (localStorage.getItem('sambanova_api_key')) return 'Meta-Llama-3.3-70B-Instruct';
    if (localStorage.getItem('gemini_api_key')) return 'gemini-1.5-flash';
    if (localStorage.getItem('openai_api_key')) return 'gpt-4o';
    if (localStorage.getItem('anthropic_api_key')) return 'claude-3-5-sonnet-20240620';
    if (localStorage.getItem('perplexity_api_key')) return 'llama-3.1-sonar-large-128k-online';

    // Default Fallback (SambaNova)
    return 'Meta-Llama-3.3-70B-Instruct';
};

// Set selected model
export const setSelectedModel = async (modelId) => {
    localStorage.setItem('selected_ai_model', modelId);
    await syncToDatabase();
};

// Helper: Get provider for a model
const getProviderForModel = (modelId) => {
    const model = AVAILABLE_MODELS.find(m => m.id === modelId);
    return model ? PROVIDERS[model.provider.toUpperCase()] : PROVIDERS.SAMBANOVA;
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

        return { valid: false, error: 'Unknown provider' };
    } catch (err) {
        return { valid: false, error: err.message || 'Validation failed' };
    }
};

// Helper: Call AI proxy
const callAIProxy = async (provider, endpoint, apiKey, body) => {
    const proxyUrl = '/api/ai-proxy';
    
    console.log(`[callAIProxy] Making request to ${proxyUrl}`, {
        provider,
        endpoint,
        hasApiKey: !!apiKey,
        hasBody: !!body
    });
    
    const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            provider,
            endpoint,
            apiKey,
            body,
            method: 'POST'
        })
    });

    console.log(`[callAIProxy] Response status: ${response.status}`);

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            const text = await response.text();
            console.error(`[callAIProxy] Failed to parse error response:`, text);
            throw new Error(`HTTP ${response.status}: ${text}`);
        }
        console.error(`[callAIProxy] Error response:`, errorData);
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }

    try {
        const data = await response.json();
        console.log(`[callAIProxy] Success, received data keys:`, Object.keys(data));
        return data;
    } catch (e) {
        const text = await response.text();
        console.error(`[callAIProxy] Failed to parse success response:`, text);
        throw new Error(`Failed to parse response: ${e.message}`);
    }
};

// Generic AI completion function
const generateContent = async (prompt, systemPrompt = '', modelId = null) => {
    let selectedModelId = modelId || getSelectedModel();
    let provider = getProviderForModel(selectedModelId);

    // Force SambaNova as execution default whenever its key is configured
    const sambaKey = getAPIKey('sambanova');
    if (sambaKey) {
        const sambaModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId && m.provider === 'sambanova')
            || AVAILABLE_MODELS.find(m => m.provider === 'sambanova');
        if (sambaModel) {
            selectedModelId = sambaModel.id;
            provider = PROVIDERS.SAMBANOVA;
            localStorage.setItem('selected_ai_model', selectedModelId);
        }
    }

    // Auto-healing: If selected provider has no key, try to find one that does
    if (!getAPIKey(provider.id)) {
        console.warn(`Provider ${provider.id} not configured. Attempting to fallback...`);
        const validProvider = PROVIDERS.SAMBANOVA && getAPIKey('sambanova') ? PROVIDERS.SAMBANOVA : Object.values(PROVIDERS).find(p => getAPIKey(p.id));
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
            const endpoint = `/v1beta/models/${selectedModelId}:generateContent`;
            const body = {
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 }
            };
            
            const data = await callAIProxy('gemini', endpoint, apiKey, body);
            await incrementUsage();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        // --- OPENAI ---
        if (provider.id === 'openai') {
            const endpoint = '/v1/chat/completions';
            const body = {
                model: selectedModelId,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            };
            
            const data = await callAIProxy('openai', endpoint, apiKey, body);
            await incrementUsage();
            return data.choices?.[0]?.message?.content || '';
        }

        // --- ANTHROPIC ---
        if (provider.id === 'anthropic') {
            const endpoint = '/v1/messages';
            const body = {
                model: selectedModelId,
                max_tokens: 4096,
                system: systemPrompt,
                messages: [{ role: 'user', content: prompt }]
            };
            
            const data = await callAIProxy('anthropic', endpoint, apiKey, body);
            await incrementUsage();
            return data.content?.[0]?.text || '';
        }

        // --- PERPLEXITY ---
        if (provider.id === 'perplexity') {
            const endpoint = '/chat/completions';
            const body = {
                model: selectedModelId,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ]
            };
            
            const data = await callAIProxy('perplexity', endpoint, apiKey, body);
            await incrementUsage();
            return data.choices?.[0]?.message?.content || '';
        }

        // --- SAMBANOVA ---
        if (provider.id === 'sambanova') {
            const endpoint = '/v1/chat/completions';
            const body = {
                model: selectedModelId,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            };
            
            const data = await callAIProxy('sambanova', endpoint, apiKey, body);
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
    const systemPrompt = `You are an expert academic evaluator and fact-checker. 
    Analyze the provided quiz questions, the designated correct answers, and the student's actual answers.
    
    CRITICAL INSTRUCTIONS:
    1. FACT-CHECK THE ANSWERS: For EVERY question (MCQ, Boolean, or Short Answer), verify if the "correctAnswer" field in the quiz data is actually factually correct. If you believe the designated correct answer is WRONG (human error by the quiz creator), set "isKeyError" to true for that question.
    2. EVALUATE STUDENT: Determine if the student's answer is conceptually correct. For short-answer questions, be flexible and look for understanding.
    3. ANALYZE ALL: Do not skip Multiple Choice or Boolean questions. Verify them too.
    
    CONTEXT: You are reviewing a quiz where:
    - Each question has a "correctAnswer" field that indicates what the quiz creator thinks is correct
    - You need to verify if that designated answer is actually factually accurate
    - If the quiz creator made an error in the answer key, flag it as "isKeyError": true
    - The student's answer should be evaluated against the actual facts, not just the quiz's answer key
    
    RESPONSE FORMAT: You MUST return ONLY a valid JSON object with this EXACT structure:
    {
      "summary": "Overall performance summary",
      "suggestions": [
        {
          "questionIndex": 0,
          "isCorrect": true,
          "isKeyError": false,
          "feedback": "Detailed feedback about this question",
          "improvementTip": "How the student can improve"
        }
      ],
      "overallGrade": "B",
      "mentorNote": "Private note for admin about student progress"
    }
    
    IMPORTANT RULES:
    - Return ONLY the JSON object, no other text
    - Use proper JSON syntax with double quotes
    - Boolean values must be true/false (not "true"/"false")
    - Grade must be one of: A, B, C, D, F
    - Include all required fields for each suggestion
    - Do not include any markdown formatting or code blocks`;

    const prompt = `
    Quiz Title: ${quizData.title}
    Questions and Designated Correct Answers: ${JSON.stringify(quizData.questions)}
    Student's Actual Answers: ${JSON.stringify(studentAnswers)}
    `;

    const response = await generateContent(prompt, systemPrompt, model);

    try {
        // Log the raw response for debugging
        console.log('AI Evaluation Raw Response:', response);
        
        // Try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const jsonStr = jsonMatch[0];
            console.log('Extracted JSON:', jsonStr);
            return JSON.parse(jsonStr);
        }
        
        // If no JSON found in match, try parsing the whole response
        return JSON.parse(response.trim());
    } catch (e) {
        console.error('Failed to parse AI evaluation:', e);
        console.error('Raw response was:', response);
        
        // Return a fallback response instead of throwing
        return {
            summary: "AI evaluation failed - unable to parse response",
            suggestions: [],
            overallGrade: "F",
            mentorNote: `Error parsing AI response: ${e.message}. Raw response: ${response.substring(0, 200)}...`
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
