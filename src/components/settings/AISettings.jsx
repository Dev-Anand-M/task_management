import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge } from '../common';
import { Brain, Key, ExternalLink } from 'lucide-react';
import { PROVIDERS } from '../../services/aiService';

const AISettings = () => {
    const { user } = useAuth();
    const [selectedProvider, setSelectedProvider] = useState('sambanova');
    const [aiApiKey, setAiApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [aiKeyStatus, setAiKeyStatus] = useState('unconfigured'); // 'unconfigured', 'configured', 'testing', 'invalid'
    const [selectedModel, setSelectedModel] = useState('');
    const [usageStats, setUsageStats] = useState({ requestsToday: 0, totalRequests: 0, lastDate: '' });
    const [loadingAISettings, setLoadingAISettings] = useState(true);
    const [validationMessage, setValidationMessage] = useState({ type: '', text: '' }); // type: 'success', 'error', 'warning'
    const [availableModels, setAvailableModels] = useState([]); // Dynamic models from API
    const [providerPriority, setProviderPriority] = useState(['sambanova', 'groq', 'gemini', 'hcnsec', 'openai', 'anthropic', 'perplexity']);

    // Load AI settings when provider changes or on mount
    useEffect(() => {
        const loadAISettings = async () => {
            setLoadingAISettings(true);
            try {
                const {
                    loadFromDatabase,
                    getAPIKey,
                    isAPIKeyConfigured,
                    getSelectedModel,
                    getUsageStats
                } = await import('../../services/aiService');

                // Load from DB first
                await loadFromDatabase();

                // Get Key for current provider
                const key = getAPIKey(selectedProvider);
                setAiApiKey(key);
                setAiKeyStatus(isAPIKeyConfigured(selectedProvider) ? 'configured' : 'unconfigured');
                setValidationMessage({ type: '', text: '' });

                if (key) {
                    const { getAllAvailableModels } = await import('../../services/aiService');
                    setAvailableModels(getAllAvailableModels().filter(m => m.provider === selectedProvider));
                } else {
                    setAvailableModels([]);
                }

                // Load saved model and usage
                const savedModel = getSelectedModel();
                if (savedModel) setSelectedModel(savedModel);
                const stats = getUsageStats();
                setUsageStats(stats);
                
                // Load provider priority
                const { getProviderPriority } = await import('../../services/aiService');
                setProviderPriority(getProviderPriority());
            } catch (err) {
                console.error('AI Setup Error:', err);
            } finally {
                setLoadingAISettings(false);
            }
        };

        const handleGlobalModelChange = (e) => {
            if (e.detail?.modelId) {
                setSelectedModel(e.detail.modelId);
            }
        };

        window.addEventListener('ai-model-changed', handleGlobalModelChange);
        loadAISettings();
        return () => window.removeEventListener('ai-model-changed', handleGlobalModelChange);
    }, [selectedProvider, user?.id]);

    const handleSaveApiKey = async () => {
        if (!aiApiKey.trim()) return;

        setValidationMessage({ type: '', text: '' });
        setAiKeyStatus('testing');
        setAvailableModels([]);

        try {
            const { validateAPIKey, saveAPIKey } = await import('../../services/aiService');
            const result = await validateAPIKey(selectedProvider, aiApiKey.trim());

            if (!result.valid) {
                setAiKeyStatus('invalid');
                setValidationMessage({ type: 'error', text: result.error });
                return;
            }

            // Save via service
            await saveAPIKey(selectedProvider, aiApiKey.trim());
            setAiKeyStatus('configured');
            setAvailableModels(result.models || []);

            if (result.models && result.models.length > 0 && !selectedModel) {
                const { setSelectedModel: saveModelToService } = await import('../../services/aiService');
                const firstModel = result.models[0].id;
                await saveModelToService(firstModel);
                setSelectedModel(firstModel);
            }

            const pConfig = Object.values(PROVIDERS).find(p => p.id === selectedProvider);
            const providerName = pConfig ? pConfig.name : selectedProvider;
            setValidationMessage({
                type: 'success',
                text: `${providerName} API key validated and saved!`
            });
        } catch (e) {
            console.error('Failed to validate/save API key:', e);
            setAiKeyStatus('invalid');
            setValidationMessage({ type: 'error', text: 'Failed to save API key: ' + e.message });
        }
    };

    const handleRemoveApiKey = async () => {
        if (confirm('Are you sure you want to remove this API key?')) {
            try {
                const { removeAPIKey } = await import('../../services/aiService');
                await removeAPIKey(selectedProvider);
                setAiApiKey('');
                setAiKeyStatus('unconfigured');
                setAvailableModels([]);
            } catch (e) {
                console.error('Failed to remove API key:', e);
            }
        }
    };

    const handleModelChange = async (modelId) => {
        setSelectedModel(modelId);
        try {
            const { setSelectedModel: saveModelToService } = await import('../../services/aiService');
            await saveModelToService(modelId);
        } catch (e) {
            console.error('Failed to sync model change:', e);
        }
    };

    if (loadingAISettings) {
        return (
            <Card>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Loading AI Settings...</span>
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #7c3aed 100%)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                }}>
                    <Brain size={20} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>AI Settings</h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                        Configure AI-powered features
                    </p>
                </div>
            </div>

            {/* Provider Tabs */}
            <div className="tabs-scrollable" style={{
                display: 'flex',
                borderBottom: '1px solid var(--border)',
                marginBottom: 'var(--space-lg)'
            }}>
                {Object.values(PROVIDERS).map(p => {
                    const pid = p.id;
                    const pName = p.name;
                    return (
                        <button
                            key={pid}
                            onClick={async () => {
                                const { getAPIKey, isAPIKeyConfigured, AVAILABLE_MODELS } = await import('../../services/aiService');
                                setSelectedProvider(pid);
                                const key = getAPIKey(pid);
                                setAiApiKey(key);
                                setAiKeyStatus(isAPIKeyConfigured(pid) ? 'configured' : 'unconfigured');
                                setValidationMessage({ type: '', text: '' });
                                setAvailableModels(AVAILABLE_MODELS.filter(m => m.provider === pid));
                            }}
                            style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                background: selectedProvider === pid ? 'var(--primary-50)' : 'transparent',
                                borderBottom: selectedProvider === pid ? '2px solid var(--primary-500)' : 'none',
                                color: selectedProvider === pid ? 'var(--primary-600)' : 'var(--text-muted)',
                                fontWeight: selectedProvider === pid ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {pName}
                        </button>
                    );
                })}
            </div>

            {/* Provider Priority Management */}
            <div style={{
                padding: 'var(--space-lg)',
                background: 'var(--surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                marginBottom: 'var(--space-lg)'
            }}>
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-sm)', color: 'var(--text-muted)' }}>
                    ⚡ PROVIDER PRIORITY & FALLBACK
                </h4>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                    Set the order in which AI providers are used. If one fails or runs out of quota, the system automatically falls back to the next available provider.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {providerPriority.map((pid, index) => {
                        const pConfig = Object.values(PROVIDERS).find(p => p.id === pid);
                        const providerName = pConfig ? pConfig.name : (pid.charAt(0).toUpperCase() + pid.slice(1));
                        
                        const moveProvider = async (direction) => {
                            const newPriority = [...providerPriority];
                            const newIndex = index + direction;
                            if (newIndex < 0 || newIndex >= newPriority.length) return;
                            [newPriority[index], newPriority[newIndex]] = [newPriority[newIndex], newPriority[index]];
                            setProviderPriority(newPriority);
                            const { setProviderPriority: savePriority } = await import('../../services/aiService');
                            await savePriority(newPriority);
                        };
                        
                        return (
                            <div key={pid} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-sm)',
                                padding: 'var(--space-sm)',
                                background: 'var(--card)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)'
                            }}>
                                <span style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: 'var(--primary-500)',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 700
                                }}>
                                    {index + 1}
                                </span>
                                <span style={{ flex: 1, fontWeight: 500 }}>{providerName}</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                        onClick={() => moveProvider(-1)}
                                        disabled={index === 0}
                                        style={{
                                            padding: '4px 8px',
                                            background: 'var(--surface)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: index === 0 ? 'not-allowed' : 'pointer',
                                            opacity: index === 0 ? 0.5 : 1
                                        }}
                                    >
                                        ↑
                                    </button>
                                    <button
                                        onClick={() => moveProvider(1)}
                                        disabled={index === providerPriority.length - 1}
                                        style={{
                                            padding: '4px 8px',
                                            background: 'var(--surface)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: index === providerPriority.length - 1 ? 'not-allowed' : 'pointer',
                                            opacity: index === providerPriority.length - 1 ? 0.5 : 1
                                        }}
                                    >
                                        ↓
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* API Key Status */}
            <div style={{
                padding: 'var(--space-md)',
                background: aiKeyStatus === 'configured'
                    ? 'rgba(16, 185, 129, 0.1)'
                    : aiKeyStatus === 'testing'
                        ? 'rgba(59, 130, 246, 0.1)'
                        : aiKeyStatus === 'invalid'
                            ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(251, 191, 36, 0.1)',
                border: `1px solid ${aiKeyStatus === 'configured'
                    ? 'rgba(16, 185, 129, 0.3)'
                    : aiKeyStatus === 'testing'
                        ? 'rgba(59, 130, 246, 0.3)'
                        : aiKeyStatus === 'invalid'
                            ? 'rgba(239, 68, 68, 0.3)'
                            : 'rgba(251, 191, 36, 0.3)'
                    }`,
                borderRadius: 'var(--radius-md)',
                marginBottom: validationMessage.text ? 'var(--space-sm)' : 'var(--space-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)'
            }}>
                <Key
                    size={16}
                    style={{
                        color: aiKeyStatus === 'configured'
                            ? 'var(--success-500)'
                            : aiKeyStatus === 'testing'
                                ? 'var(--info-500)'
                                : aiKeyStatus === 'invalid'
                                    ? 'var(--error-500)'
                                    : 'var(--warning-500)',
                        animation: aiKeyStatus === 'testing' ? 'pulse 1s infinite' : 'none'
                    }}
                />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                    {aiKeyStatus === 'configured'
                        ? (() => {
                            const pConfig = Object.values(PROVIDERS).find(p => p.id === selectedProvider);
                            const providerName = pConfig ? pConfig.name : selectedProvider;
                            return `✅ ${providerName} API Key Configured`;
                        })()
                        : aiKeyStatus === 'testing'
                            ? '🔄 Validating API key...'
                            : aiKeyStatus === 'invalid'
                                ? '❌ Invalid API Key'
                                : '⚠️ API Key Not Configured'}
                </span>
            </div>

            {/* Active Model Selector */}
            {aiKeyStatus === 'configured' && availableModels.length > 0 && (
                <div style={{
                    padding: 'var(--space-md)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-lg)'
                }}>
                    <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-xs)', color: 'var(--text-main)' }}>
                        🎯 ACTIVE MODEL FOR {selectedProvider.toUpperCase()}
                    </h4>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
                        Select the primary AI model to power your ZEN assistant and evaluations.
                    </p>
                    <select
                        value={selectedModel}
                        onChange={(e) => handleModelChange(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--primary-500)',
                            background: 'var(--card)',
                            color: 'var(--text-main)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                            outline: 'none'
                        }}
                    >
                        {availableModels.map((m, idx) => (
                            <option key={`${m.provider}_${m.id}_${idx}`} value={m.id}>
                                {m.name} ({m.id})
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {validationMessage.text && (
                <div style={{
                    marginBottom: 'var(--space-lg)',
                    padding: 'var(--space-sm)',
                    borderRadius: 'var(--radius-md)',
                    background: validationMessage.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    color: validationMessage.type === 'error' ? 'var(--error-600)' : 'var(--success-600)',
                    fontSize: 'var(--text-sm)'
                }}>
                    {validationMessage.text}
                </div>
            )}

            {/* Usage Statistics */}
            {aiKeyStatus === 'configured' && (
                <div style={{
                    padding: 'var(--space-md)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-lg)'
                }}>
                    <div className="flex justify-between items-center mb-md">
                        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: 0, color: 'var(--text-muted)' }}>
                            USAGE STATISTICS
                        </h4>
                        <Badge variant="primary" size="xs">Provider: {selectedProvider.toUpperCase()}</Badge>
                    </div>
                    
                    <div className="grid-3-mobile-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }}>
                        {(() => {
                            const pStats = usageStats.providers?.[selectedProvider] || { requestsToday: 0, totalRequests: 0 };
                            return (
                                <>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--primary-500)' }}>
                                            {pStats.requestsToday || 0}
                                        </div>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                            Today
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-main)' }}>
                                            {pStats.totalRequests || 0}
                                        </div>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                            Total
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--success-500)' }}>
                                <span style={{ fontSize: '14px' }}>varies</span>
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                Limits
                            </div>
                        </div>
                    </div>

                    {/* Global Aggregator */}
                    <div style={{ 
                        marginTop: 'var(--space-lg)', 
                        paddingTop: 'var(--space-md)', 
                        borderTop: '1px dotted var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>PLATFORM-WIDE LIFETIME USAGE:</span>
                        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{usageStats.totalRequests || 0}</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>REQ</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Get API Key Link */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-sm)', color: 'var(--text-muted)' }}>
                    GET YOUR API KEY
                </h4>
                {(() => {
                    const pConfig = Object.values(PROVIDERS).find(p => p.id === selectedProvider);
                    const providerName = pConfig ? pConfig.name : selectedProvider;
                    const providerUrl = pConfig ? pConfig.url : '#';
                    return (
                        <>
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
                                Get your API key from the {providerName} dashboard.
                            </p>
                            <a
                                href={providerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-xs)',
                                    padding: 'var(--space-sm) var(--space-md)',
                                    background: 'var(--primary-500)',
                                    color: 'white',
                                    borderRadius: 'var(--radius-md)',
                                    textDecoration: 'none',
                                    fontSize: 'var(--text-sm)',
                                    fontWeight: 500
                                }}
                            >
                                <ExternalLink size={14} />
                                Get {providerName} Key
                            </a>
                        </>
                    );
                })()}
            </div>

            {/* API Key Input */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-sm)', color: 'var(--text-muted)' }}>
                    {selectedProvider.toUpperCase()} API KEY
                </h4>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <input
                        type={showApiKey ? 'text' : 'password'}
                        value={aiApiKey}
                        onChange={(e) => setAiApiKey(e.target.value)}
                        placeholder={`Enter your ${selectedProvider} API key...`}
                        style={{
                            flex: 1,
                            padding: 'var(--space-sm) var(--space-md)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text-main)',
                            fontSize: 'var(--text-sm)'
                        }}
                    />
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowApiKey(!showApiKey)}
                    >
                        {showApiKey ? 'Hide' : 'Show'}
                    </Button>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                    Your API key is stored locally in your browser.
                </p>
            </div>

            {/* Save/Remove Buttons */}
            <div className="flex-mobile-col" style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <Button
                    onClick={handleSaveApiKey}
                    disabled={!aiApiKey.trim() || aiKeyStatus === 'testing'}
                >
                    {aiKeyStatus === 'testing' ? 'Validating...' : 'Validate & Save Key'}
                </Button>
                {aiKeyStatus === 'configured' && (
                    <Button
                        variant="secondary"
                        onClick={handleRemoveApiKey}
                        style={{ color: 'var(--error-500)' }}
                    >
                        Remove Key
                    </Button>
                )}
            </div>

            {/* Custom Model Addition */}
            {aiKeyStatus === 'configured' && (
                <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border)' }}>
                    <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-sm)', color: 'var(--text-muted)' }}>
                        ADD CUSTOM MODEL
                    </h4>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
                        If your API key supports a model not listed above (like specific experimental versions), add its ID here.
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                        <input
                            placeholder="e.g. gemini-2.5-flash"
                            id="custom-model-input"
                            style={{
                                flex: 1,
                                padding: 'var(--space-sm) var(--space-md)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text-main)',
                                fontSize: 'var(--text-sm)'
                            }}
                        />
                        <Button
                            variant="secondary"
                            onClick={() => {
                                const input = document.getElementById('custom-model-input');
                                const modelId = input.value.trim();
                                if (modelId) {
                                    const newModel = {
                                        id: modelId,
                                        provider: selectedProvider,
                                        name: `${modelId} (Custom)`,
                                        description: 'Custom added model'
                                    };
                                    if (!availableModels.some(m => m.id === modelId)) {
                                        setAvailableModels([newModel, ...availableModels]);
                                    }
                                    handleModelChange(modelId);
                                    input.value = '';

                                    const customModels = JSON.parse(localStorage.getItem('custom_ai_models') || '[]');
                                    if (!customModels.find(m => m.id === modelId)) {
                                        customModels.push(newModel);
                                        localStorage.setItem('custom_ai_models', JSON.stringify(customModels));
                                    }

                                    alert(`Added and selected ${modelId}`);
                                }
                            }}
                        >
                            Add
                        </Button>
                    </div>
                </div>
            )}

            {/* Validation Result - Below Button */}
            {validationMessage.text && (
                <div style={{
                    marginTop: 'var(--space-md)',
                    padding: 'var(--space-md)',
                    background: validationMessage.type === 'success'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : validationMessage.type === 'warning'
                            ? 'rgba(251, 191, 36, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                    border: `2px solid ${validationMessage.type === 'success'
                        ? 'rgba(16, 185, 129, 0.5)'
                        : validationMessage.type === 'warning'
                            ? 'rgba(251, 191, 36, 0.5)'
                            : 'rgba(239, 68, 68, 0.5)'
                        }`,
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                    color: validationMessage.type === 'success'
                        ? 'var(--success-600)'
                        : validationMessage.type === 'warning'
                            ? 'var(--warning-600)'
                            : 'var(--error-600)'
                }}>
                    <span style={{ fontSize: '1.25rem' }}>
                        {validationMessage.type === 'success' && '✅'}
                        {validationMessage.type === 'warning' && '⚠️'}
                        {validationMessage.type === 'error' && '❌'}
                    </span>
                    <span>
                        {validationMessage.type === 'success' && 'VALID - '}
                        {validationMessage.type === 'error' && 'INVALID - '}
                        {validationMessage.text}
                    </span>
                </div>
            )}

            {/* Beta Notice */}
            <div style={{
                marginTop: 'var(--space-lg)',
                padding: 'var(--space-md)',
                background: 'rgba(167, 139, 250, 0.1)',
                border: '1px solid rgba(167, 139, 250, 0.3)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-sm)'
            }}>
                <Brain size={18} style={{ color: '#a78bfa', marginTop: '2px', flexShrink: 0 }} />
                <div>
                    <span style={{
                        background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                        color: 'white',
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        marginRight: '8px'
                    }}>
                        BETA
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                        AI features are in beta. Results may vary based on the model selected.
                        The free tier has usage limits that reset daily.
                    </span>
                </div>
            </div>
        </Card>
    );
};

export default AISettings;
